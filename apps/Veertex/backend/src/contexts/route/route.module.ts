import { Module } from '@nestjs/common';
import { CreateRouteUseCase } from './application/use-cases/create-route/create-route.use-case';
import { ListRoutesUseCase } from './application/use-cases/list-routes/list-routes.use-case';
import { UpdateRouteUseCase } from './application/use-cases/update-route/update-route.use-case';
import { GetCommercialRuleUseCase } from './application/use-cases/get-commercial-rule/get-commercial-rule.use-case';
import { SetCommercialRuleUseCase } from './application/use-cases/set-commercial-rule/set-commercial-rule.use-case';

/**
 * ROT — Rota/Consignação (§04), fatia 2: rotas + Regra Comercial do representante. Os repositórios
 * vêm do @Global RepositoriesModule; este módulo cabeia os use cases. Trip, carga, acerto e
 * fechamento entram nas fatias seguintes, no mesmo contexto.
 */
@Module({
  providers: [
    CreateRouteUseCase,
    ListRoutesUseCase,
    UpdateRouteUseCase,
    GetCommercialRuleUseCase,
    SetCommercialRuleUseCase,
  ],
  exports: [
    CreateRouteUseCase,
    ListRoutesUseCase,
    UpdateRouteUseCase,
    GetCommercialRuleUseCase,
    SetCommercialRuleUseCase,
  ],
})
export class RouteModule {}
