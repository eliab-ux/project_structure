import { Module } from '@nestjs/common';
import { GetFieldConfigUseCase } from './application/use-cases/get-field-config/get-field-config.use-case';
import { SetFieldConfigUseCase } from './application/use-cases/set-field-config/set-field-config.use-case';
import { RequiredFieldsChecker } from './application/required-fields.checker';

/**
 * `field_config` — §3.6 do CORE. O repositório vem do `@Global` RepositoriesModule, então este módulo
 * só cabeia os use cases e o `RequiredFieldsChecker`.
 *
 * `RequiredFieldsChecker` é exportado porque Contato e Produto o injetam para cobrar o obrigatório
 * dinâmico no cadastro. `GetFieldConfigUseCase` é exportado porque os controllers de Contato e
 * Produto o usam para devolver o catálogo já mesclado com a config.
 */
@Module({
  providers: [GetFieldConfigUseCase, SetFieldConfigUseCase, RequiredFieldsChecker],
  exports: [GetFieldConfigUseCase, SetFieldConfigUseCase, RequiredFieldsChecker],
})
export class FieldConfigModule {}
