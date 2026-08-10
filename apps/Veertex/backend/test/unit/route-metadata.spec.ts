import 'reflect-metadata';
import { GUARDS_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { HttpModule } from '../../src/infrastructure/http/http.module';
import { REQUIRED_PERMISSIONS } from '../../src/infrastructure/security/decorators/require-permission.decorator';
import { REQUIRED_MODULE } from '../../src/infrastructure/security/decorators/require-module.decorator';
import { ModuleGuard } from '../../src/infrastructure/security/guards/module.guard';
import { isKnownModule } from '../../src/contexts/module/domain/modules.catalog';
import { isKnownPermission } from '../../src/contexts/role/domain/permissions.catalog';

/**
 * Transforma "não esqueça o guard" em algo que quebra o build.
 *
 * Toda rota do sistema é varrida a partir do PRÓPRIO `HttpModule` — a lista de controllers sai do
 * metadata do módulo, não de um array mantido à mão aqui. Um controller novo entra na varredura
 * sozinho; uma lista paralela seria mais uma coisa a lembrar de atualizar, e a que esquecesse
 * produziria exatamente o buraco que este teste existe para impedir.
 *
 * As duas listas de exceção abaixo são a parte importante: elas tornam cada rota sem permissão uma
 * decisão explícita, escrita, revisável em diff — em vez de uma ausência que ninguém nota.
 */

/**
 * Rotas PÚBLICAS — sem guard nenhum. Cada uma existe porque o chamador ainda não pode estar
 * autenticado, e o motivo está escrito ao lado.
 */
const PUBLIC_ROUTES: ReadonlySet<string> = new Set([
  // Probe de liveness do container: um probe que precisa de token não roda.
  'HealthController.check',
  // É onde a autenticação começa; exigir autenticação seria circular.
  'AuthController.login',
  // O access token já expirou por definição quando esta rota é chamada.
  'AuthController.refresh',
  // Quem esqueceu a senha não consegue entrar para pedir uma nova.
  'AuthController.requestPasswordReset',
  'AuthController.resetPassword',
]);

/**
 * Rotas AUTENTICADAS mas sem permissão — operações do usuário sobre a própria identidade.
 *
 * Exigir uma permissão aqui criaria a situação absurda de um papel poder proibir alguém de trocar a
 * própria senha ou de saber quem é. O guard continua obrigatório: o que se dispensa é a autorização
 * por papel, nunca a autenticação.
 */
const SELF_SERVICE_ROUTES: ReadonlySet<string> = new Set([
  'AuthController.me',
  'AuthController.changePassword',
]);

interface RouteInfo {
  id: string;
  controller: string;
  method: string;
  classGuards: unknown[];
  methodGuards: unknown[];
  permissions: string[] | undefined;
  moduleCode: string | undefined;
}

function collectRoutes(): RouteInfo[] {
  const controllers: (new (...args: never[]) => object)[] =
    Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, HttpModule) ?? [];

  return controllers.flatMap((controller) => {
    const prototype = controller.prototype as Record<string, unknown>;

    return (
      Object.getOwnPropertyNames(prototype)
        .filter((name) => name !== 'constructor')
        .filter((name) => typeof prototype[name] === 'function')
        // `PATH_METADATA` no método é o que distingue um handler de rota de um método auxiliar.
        .filter((name) => Reflect.hasMetadata(PATH_METADATA, prototype[name] as object))
        .map((name) => ({
          id: `${controller.name}.${name}`,
          controller: controller.name,
          method: name,
          classGuards: Reflect.getMetadata(GUARDS_METADATA, controller) ?? [],
          methodGuards: Reflect.getMetadata(GUARDS_METADATA, prototype[name] as object) ?? [],
          permissions:
            Reflect.getMetadata(REQUIRED_PERMISSIONS, prototype[name] as object) ??
            Reflect.getMetadata(REQUIRED_PERMISSIONS, controller),
          moduleCode:
            Reflect.getMetadata(REQUIRED_MODULE, prototype[name] as object) ??
            Reflect.getMetadata(REQUIRED_MODULE, controller),
        }))
    );
  });
}

describe('Metadata das rotas HTTP', () => {
  const routes = collectRoutes();

  it('encontra rotas para varrer (a varredura em si não pode falhar em silêncio)', () => {
    // Sem esta asserção, um erro que fizesse `collectRoutes` devolver vazio deixaria todos os
    // testes abaixo passando por vacuidade — o modo de falha mais perigoso de um teste de varredura.
    expect(routes.length).toBeGreaterThan(10);
  });

  it('toda rota não pública tem guard', () => {
    const offenders = routes
      .filter((route) => !PUBLIC_ROUTES.has(route.id))
      .filter((route) => route.classGuards.length === 0 && route.methodGuards.length === 0)
      .map((route) => route.id);

    expect(offenders).toEqual([]);
  });

  it('toda rota não pública declara permissão (salvo as de autoatendimento)', () => {
    const offenders = routes
      .filter((route) => !PUBLIC_ROUTES.has(route.id) && !SELF_SERVICE_ROUTES.has(route.id))
      .filter((route) => !route.permissions || route.permissions.length === 0)
      .map((route) => route.id);

    expect(offenders).toEqual([]);
  });

  it('nenhuma rota pública carrega guard (indício de exceção desatualizada)', () => {
    // Pega o caso inverso: uma rota que ganhou guard e continuou na lista de públicas. A lista teria
    // virado mentira, e a próxima rota realmente pública adicionada ali passaria despercebida.
    const offenders = routes
      .filter((route) => PUBLIC_ROUTES.has(route.id))
      .filter((route) => route.classGuards.length > 0 || route.methodGuards.length > 0)
      .map((route) => route.id);

    expect(offenders).toEqual([]);
  });

  it('as listas de exceção não têm entradas órfãs', () => {
    // Uma rota renomeada ou removida deixaria a exceção para trás, e a exceção órfã aliviaria a
    // rota errada no dia em que alguém criasse um método com o mesmo nome.
    const existing = new Set(routes.map((route) => route.id));
    const orphans = [...PUBLIC_ROUTES, ...SELF_SERVICE_ROUTES].filter((id) => !existing.has(id));

    expect(orphans).toEqual([]);
  });

  it('toda permissão declarada existe no catálogo', () => {
    const offenders = routes
      .flatMap((route) => (route.permissions ?? []).map((permission) => ({ route, permission })))
      .filter(({ permission }) => !isKnownPermission(permission))
      .map(({ route, permission }) => `${route.id} → ${permission}`);

    expect(offenders).toEqual([]);
  });

  it('rota com @RequireModule usa ModuleGuard e declara módulo do catálogo', () => {
    const withModule = routes.filter((route) => route.moduleCode);

    const unknownCodes = withModule
      .filter((route) => !isKnownModule(route.moduleCode as string))
      .map((route) => `${route.id} → ${route.moduleCode}`);
    expect(unknownCodes).toEqual([]);

    const missingGuard = withModule
      .filter((route) => ![...route.classGuards, ...route.methodGuards].includes(ModuleGuard))
      .map((route) => route.id);
    // Declarar o módulo sem o guard é pior do que não declarar: a rota LÊ como protegida em revisão
    // de código e não é verificada em runtime.
    expect(missingGuard).toEqual([]);
  });

  it('rota com ModuleGuard declara @RequireModule', () => {
    const offenders = routes
      .filter((route) => [...route.classGuards, ...route.methodGuards].includes(ModuleGuard))
      .filter((route) => !route.moduleCode)
      .map((route) => route.id);

    // O guard também lança em runtime nesse caso, mas aí só na primeira requisição — aqui falha no
    // build, que é onde quem escreveu ainda está olhando.
    expect(offenders).toEqual([]);
  });
});
