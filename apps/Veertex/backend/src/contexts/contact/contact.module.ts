import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ContactOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/contact-orm.entity';
import { ContactEmailOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/contact-email-orm.entity';
import { ContactPhoneOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/contact-phone-orm.entity';
import { ContactAddressOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/contact-address-orm.entity';
import { ContactMapper } from '../../infrastructure/persistence/mikro-orm/mappers/contact.mapper';
import { MikroOrmContactRepository } from '../../infrastructure/persistence/mikro-orm/repositories/contact.repository';
import { AccountModule } from '../account/account.module';
import { FieldConfigModule } from '../field-config/field-config.module';
import { CONTACT_REPOSITORY } from './application/ports/output/contact-repository.port';
import { CreateContactUseCase } from './application/use-cases/create-contact/create-contact.use-case';
import { UpdateContactUseCase } from './application/use-cases/update-contact/update-contact.use-case';
import { ListContactsUseCase } from './application/use-cases/list-contacts/list-contacts.use-case';
import { GetContactUseCase } from './application/use-cases/get-contact/get-contact.use-case';

/**
 * `FieldConfigModule` fornece o `RequiredFieldsChecker` (obrigatório dinâmico, §7.5); `AccountModule`
 * fornece o `AccountPreferencesReader` (documento duplicado, §3.4). Os dois são CORE e não criam
 * ciclo — nenhum deles importa Contato.
 */
@Module({
  imports: [
    MikroOrmModule.forFeature([
      ContactOrmEntity,
      ContactEmailOrmEntity,
      ContactPhoneOrmEntity,
      ContactAddressOrmEntity,
    ]),
    AccountModule,
    FieldConfigModule,
  ],
  providers: [
    ContactMapper,
    { provide: CONTACT_REPOSITORY, useClass: MikroOrmContactRepository },
    CreateContactUseCase,
    UpdateContactUseCase,
    ListContactsUseCase,
    GetContactUseCase,
  ],
  // Exportados porque a aprovação da Mesa despacha para os MESMOS use cases que o controller usa —
  // é isso que impede a intenção de ser um caminho com validação mais frouxa.
  exports: [CreateContactUseCase, UpdateContactUseCase, ListContactsUseCase, GetContactUseCase],
})
export class ContactModule {}
