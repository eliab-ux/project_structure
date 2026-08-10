import { Module } from '@nestjs/common';
import { GetEffectiveModulesUseCase } from './application/use-cases/get-effective-modules/get-effective-modules.use-case';
import { ListModulesUseCase } from './application/use-cases/list-modules/list-modules.use-case';
import { ToggleModuleUseCase } from './application/use-cases/toggle-module/toggle-module.use-case';
import { SeedAccountModulesUseCase } from './application/use-cases/seed-account-modules/seed-account-modules.use-case';

/**
 * `ModuleModule` é um nome infeliz e inevitável: o contexto se chama "module" e o decorator do Nest
 * também. O contexto é o do catálogo de módulos do produto (`MODULES.VND`, `MODULES.ROT`), sem
 * relação com módulos do Nest.
 */
@Module({
  providers: [
    GetEffectiveModulesUseCase,
    ListModulesUseCase,
    ToggleModuleUseCase,
    SeedAccountModulesUseCase,
  ],
  exports: [
    GetEffectiveModulesUseCase,
    ListModulesUseCase,
    ToggleModuleUseCase,
    SeedAccountModulesUseCase,
  ],
})
export class ModuleModule {}
