import 'reflect-metadata';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ModuleGuard } from '../../src/infrastructure/security/guards/module.guard';
import { REQUIRED_MODULE } from '../../src/infrastructure/security/decorators/require-module.decorator';
import {
  AuthTokenPayload,
  TokenServicePort,
} from '../../src/contexts/auth/application/ports/output/token-service.port';
import { TenantContextService } from '../../src/infrastructure/security/tenant-context.service';
import { ModuleInactiveForbiddenException } from '../../src/contexts/module/domain/exceptions/module-exceptions';
import { MODULES } from '../../src/contexts/module/domain/modules.catalog';

/**
 * `ModuleGuard` — INSTRUCOES §B5.
 *
 * O guard estende `JwtAuthGuard`, então cada caso exercita as duas responsabilidades de uma vez:
 * autenticar/escopar (o `super.canActivate`) e decidir sobre o módulo. É de propósito que sejam
 * inseparáveis — anotar uma rota só com este guard tem de continuar autenticando.
 */

const VALID_TOKEN = 'Bearer token-valido';

function buildContext(params: {
  authorization?: string;
  requiredModule?: string;
  /** Metadata no MÉTODO em vez de na classe — o Reflector precisa achar nos dois lugares. */
  onHandler?: boolean;
}): {
  context: ExecutionContext;
  request: { headers: Record<string, string>; user?: AuthTokenPayload };
} {
  const request: { headers: Record<string, string>; user?: AuthTokenPayload } = {
    headers: params.authorization ? { authorization: params.authorization } : {},
  };

  const handler = function handler() {};
  const controller = class Controller {};

  if (params.requiredModule) {
    const target = params.onHandler ? handler : controller;
    Reflect.defineMetadata(REQUIRED_MODULE, params.requiredModule, target);
  }

  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => controller,
  } as unknown as ExecutionContext;

  return { context, request };
}

function buildGuard(modules: string[]): ModuleGuard {
  const payload: AuthTokenPayload = {
    sub: '11111111-1111-4111-8111-111111111111',
    accountId: '22222222-2222-4222-8222-222222222222',
    roleId: '33333333-3333-4333-8333-333333333333',
    permissions: ['*'],
    modules,
  };

  const tokens: TokenServicePort = {
    issueForUser: () => ({ accessToken: 'a', refreshToken: 'r', expiresIn: 900 }),
    verifyAccessToken: () => payload,
    verifyRefreshToken: () => payload,
  };

  // O TenantContextService real depende do EntityManager. O guard só chama `establish`, então um
  // dublê com essa única função é suficiente — e não injetar o ORM mantém o teste unitário.
  const tenantContext = { establish: jest.fn() } as unknown as TenantContextService;

  return new ModuleGuard(tokens, tenantContext, new Reflector());
}

describe('ModuleGuard', () => {
  it('libera quando o módulo exigido está entre os do token', () => {
    const guard = buildGuard([MODULES.CORE, MODULES.VND]);
    const { context } = buildContext({
      authorization: VALID_TOKEN,
      requiredModule: MODULES.VND,
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('recusa com 403 quando o módulo está inativo na conta', () => {
    // A conta tem VND, não tem ROT. É o caso do critério §7.4: módulo desativado → 403.
    const guard = buildGuard([MODULES.CORE, MODULES.VND]);
    const { context } = buildContext({
      authorization: VALID_TOKEN,
      requiredModule: MODULES.ROT,
    });

    expect(() => guard.canActivate(context)).toThrow(ModuleInactiveForbiddenException);
  });

  it('recusa quando a conta não tem vínculo com nenhum módulo', () => {
    // Token com `modules: []` — conta sem nenhuma ativação. Nem por isso o guard pode liberar:
    // "lista vazia" precisa significar "nada liberado", nunca "sem restrição".
    const guard = buildGuard([]);
    const { context } = buildContext({
      authorization: VALID_TOKEN,
      requiredModule: MODULES.VND,
    });

    expect(() => guard.canActivate(context)).toThrow(ModuleInactiveForbiddenException);
  });

  it('libera módulo core, que está sempre entre os efetivos', () => {
    // `resolveEffectiveModules` inclui os core mesmo quando o plano não os lista, então o token de
    // qualquer sessão válida traz CORE. O guard não precisa de regra especial para isso.
    const guard = buildGuard([MODULES.CORE]);
    const { context } = buildContext({
      authorization: VALID_TOKEN,
      requiredModule: MODULES.CORE,
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('lê o @RequireModule declarado no método, não só na classe', () => {
    const guard = buildGuard([MODULES.CORE, MODULES.EST]);
    const { context } = buildContext({
      authorization: VALID_TOKEN,
      requiredModule: MODULES.EST,
      onHandler: true,
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('autentica antes de decidir sobre o módulo: sem token, 401 e não 403', () => {
    // A ordem importa para o cliente: sem credencial a resposta é "entre", não "seu plano não tem".
    // E importa para o servidor: se o módulo fosse checado primeiro, `request.user` seria undefined
    // e o guard liberaria a rota lendo uma lista vazia... ou quebraria com TypeError.
    const guard = buildGuard([MODULES.CORE, MODULES.VND]);
    const { context } = buildContext({ requiredModule: MODULES.VND });

    expect(() => guard.canActivate(context)).toThrow(/Autenticação obrigatória/);
  });

  it('estabelece o escopo do tenant mesmo sendo o guard de módulo', () => {
    const tokens: TokenServicePort = {
      issueForUser: () => ({ accessToken: 'a', refreshToken: 'r', expiresIn: 900 }),
      verifyAccessToken: () => ({
        sub: '11111111-1111-4111-8111-111111111111',
        accountId: 'conta-do-token',
        roleId: '33333333-3333-4333-8333-333333333333',
        permissions: [],
        modules: [MODULES.VND],
      }),
      verifyRefreshToken: () => {
        throw new Error('não usado');
      },
    };
    const establish = jest.fn();
    const guard = new ModuleGuard(
      tokens,
      { establish } as unknown as TenantContextService,
      new Reflector(),
    );
    const { context } = buildContext({
      authorization: VALID_TOKEN,
      requiredModule: MODULES.VND,
    });

    guard.canActivate(context);

    // Sem isto, uma rota anotada SÓ com o ModuleGuard rodaria sem escopo — e sob RLS leria zero
    // linhas, parecendo bug de dados em vez de erro de fiação.
    expect(establish).toHaveBeenCalledWith('conta-do-token');
  });

  it('trata rota sem @RequireModule como erro de fiação, não como liberação', () => {
    const guard = buildGuard([MODULES.CORE]);
    const { context } = buildContext({ authorization: VALID_TOKEN });

    // Erro comum (→ 500), não ForbiddenException: deixar passar faria um erro de digitação no
    // decorator abrir a rota para qualquer conta autenticada.
    expect(() => guard.canActivate(context)).toThrow(/sem @RequireModule/);
  });
});
