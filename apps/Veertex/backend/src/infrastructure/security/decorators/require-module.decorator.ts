import { SetMetadata } from '@nestjs/common';

export const REQUIRED_MODULE = 'requiredModule';

/**
 * Declara a qual módulo opcional a rota pertence. Aplicado por `ModuleGuard`.
 *
 * **No CONTROLLER, não no método** — um controller pertence a um módulo inteiro, enquanto a
 * permissão varia por operação. Os dois eixos são independentes por natureza: módulo é da CONTA
 * (o que ela contratou e ligou), permissão é do PAPEL (o que aquele usuário pode fazer). Misturá-los
 * num decorator só acoplaria coisas que mudam por motivos diferentes.
 *
 * Um único código, e não uma lista: rota que pertencesse a dois módulos ao mesmo tempo indicaria um
 * limite de contexto mal traçado, não uma necessidade a acomodar.
 *
 * @example
 * @Controller('orders')
 * @UseGuards(ModuleGuard, PermissionGuard)
 * @RequireModule(MODULES.VND)
 */
export const RequireModule = (moduleCode: string) => SetMetadata(REQUIRED_MODULE, moduleCode);
