import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SeedDefaultRolesUseCase } from './application/use-cases/seed-default-roles/seed-default-roles.use-case';
import { ListRolesUseCase } from './application/use-cases/list-roles/list-roles.use-case';
import { CreateRoleUseCase } from './application/use-cases/create-role/create-role.use-case';
import { UpdateRoleUseCase } from './application/use-cases/update-role/update-role.use-case';
import { DeleteRoleUseCase } from './application/use-cases/delete-role/delete-role.use-case';
import { ReadPermissionPhraseUseCase } from './application/use-cases/read-permission-phrase/read-permission-phrase.use-case';
import { RoleAdministrationPolicy } from './application/policies/role-administration.policy';
import { PERMISSION_PHRASE_TRANSLATOR } from './application/ports/output/permission-phrase-translator.port';
import { GeminiPermissionPhraseTranslator } from '../../infrastructure/intent/gemini-permission-phrase-translator';
import { DeterministicPermissionPhraseTranslator } from '../../infrastructure/intent/deterministic-permission-phrase-translator';

@Module({
  imports: [ConfigModule],
  providers: [
    SeedDefaultRolesUseCase,
    ListRolesUseCase,
    CreateRoleUseCase,
    UpdateRoleUseCase,
    DeleteRoleUseCase,
    ReadPermissionPhraseUseCase,
    RoleAdministrationPolicy,
    GeminiPermissionPhraseTranslator,
    DeterministicPermissionPhraseTranslator,
    {
      provide: PERMISSION_PHRASE_TRANSLATOR,
      inject: [
        ConfigService,
        DeterministicPermissionPhraseTranslator,
        GeminiPermissionPhraseTranslator,
      ],
      /**
       * A MESMA variável que escolhe o tradutor da Mesa (`INTENT_PARSER_DRIVER`), de propósito.
       *
       * Duas variáveis para "usar IA ou não" acabariam divergindo, e o ambiente ficaria metade num
       * modo e metade no outro — que é o pior dos três estados possíveis. Como lá, o PADRÃO é o
       * Gemini: ambiente sem chave falha visivelmente, em vez de traduzir PERMISSÃO por
       * palavra-chave e chamar isso de tradução.
       */
      useFactory: (
        config: ConfigService,
        deterministic: DeterministicPermissionPhraseTranslator,
        gemini: GeminiPermissionPhraseTranslator,
      ) =>
        config.get<string>('INTENT_PARSER_DRIVER') === 'deterministic' ? deterministic : gemini,
    },
  ],
  // A política é EXPORTADA porque os use cases de usuário também a usam: desabilitar um usuário e
  // trocar o papel dele podem trancar a conta do mesmo jeito que editar um papel. A regra é uma só e
  // vive num lugar só — três cópias divergiriam, e a que divergisse seria a que ninguém testou.
  exports: [
    SeedDefaultRolesUseCase,
    ListRolesUseCase,
    CreateRoleUseCase,
    UpdateRoleUseCase,
    DeleteRoleUseCase,
    ReadPermissionPhraseUseCase,
    RoleAdministrationPolicy,
  ],
})
export class RoleModule {}
