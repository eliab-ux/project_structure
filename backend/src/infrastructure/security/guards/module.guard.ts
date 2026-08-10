import { ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  TOKEN_SERVICE,
  TokenServicePort,
} from '../../../contexts/auth/application/ports/output/token-service.port';
import { ModuleInactiveForbiddenException } from '../../../contexts/module/domain/exceptions/module-exceptions';
import { TenantContextService } from '../tenant-context.service';
import { AuthenticatedRequest, JwtAuthGuard } from './jwt-auth.guard';
import { REQUIRED_MODULE } from '../decorators/require-module.decorator';

/**
 * `JwtAuthGuard` + o módulo declarado em `@RequireModule`.
 *
 * Estende o JwtAuthGuard em vez de assumir que ele rodou antes — exatamente como o
 * `PermissionGuard`. Assim uma rota anotada só com este guard continua autenticada e escopada, e
 * anotar só um dos dois deixa de ser uma forma de abrir o endpoint sem querer. Compor os dois
 * verifica o token duas vezes (~15µs de HS256 num payload pequeno), preço irrelevante pela garantia.
 *
 * É um guard SEPARADO do de permissão porque os eixos são independentes: módulo é da conta,
 * permissão é do papel. Juntá-los numa classe só acoplaria dois eixos que evoluem por motivos
 * diferentes — e a primeira regra nova de um deles teria que ser pensada dentro do outro.
 *
 * A leitura vem do token (`payload.modules`), já resolvido como `plano ∩ conta`. Consultar
 * `account_modules` aqui seria impossível: guards rodam antes da transação que carrega o escopo do
 * RLS, e a consulta devolveria zero linhas.
 */
@Injectable()
export class ModuleGuard extends JwtAuthGuard {
  constructor(
    @Inject(TOKEN_SERVICE) tokens: TokenServicePort,
    tenantContext: TenantContextService,
    private readonly reflector: Reflector,
  ) {
    super(tokens, tenantContext);
  }

  canActivate(context: ExecutionContext): boolean {
    super.canActivate(context);

    const required = this.reflector.getAllAndOverride<string>(REQUIRED_MODULE, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required) {
      // Erro de fiação, não do cliente: sai como 500 e vai para o error reporter. Deixar passar
      // faria um erro de digitação no decorator abrir a rota para qualquer conta autenticada.
      throw new Error('ModuleGuard usado em rota sem @RequireModule — declare o módulo exigido.');
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const active = request.user?.modules ?? [];

    if (!active.includes(required)) {
      // 403 com mensagem própria, diferente de "sem permissão": quem vê isto TEM o direito de fazer
      // a operação; o que falta é a conta ter o módulo. A saída é falar com o administrador ou fazer
      // upgrade — informação inútil se a mensagem fosse a mesma dos dois casos.
      throw new ModuleInactiveForbiddenException(required);
    }

    return true;
  }
}
