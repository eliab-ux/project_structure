/**
 * Seed de DESENVOLVIMENTO.
 *
 *   npm run seed:dev -w apps/batuta-system/backend
 *
 * Cria o mínimo para exercitar o produto de ponta a ponta: um admin de plataforma, uma conta, um
 * usuário admin da conta, dois canais CONNECTED e uma base de contatos alocada entre eles.
 *
 * Três recusas deliberadas:
 *
 *  1. **Não roda com `NODE_ENV=production`.** Um seed que cria usuário com senha conhecida é uma
 *     porta dos fundos; a checagem é a fechadura.
 *  2. **Não usa `schema:fresh` nem apaga nada além do que ele mesmo cria** — é idempotente por
 *     e-mail/telefone. Um seed que destrói dados de trabalho é usado uma vez e evitado depois.
 *  3. **Não marca canal como CONNECTED via Evolution.** O estado é escrito direto porque não há
 *     chip real em desenvolvimento; isso está aqui e não no código de produção justamente para que
 *     nenhum caminho da aplicação saiba forjar conexão de canal.
 */
import { config as loadEnv } from 'dotenv';
import { MikroORM } from '@mikro-orm/postgresql';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import config from '../mikro-orm.config';
import { AccountOrmEntity } from '../src/infrastructure/persistence/mikro-orm/entities/account-orm.entity';
import { UserOrmEntity } from '../src/infrastructure/persistence/mikro-orm/entities/user-orm.entity';
import { PlatformAdminOrmEntity } from '../src/infrastructure/persistence/mikro-orm/entities/platform-admin-orm.entity';
import { ChannelOrmEntity } from '../src/infrastructure/persistence/mikro-orm/entities/channel-orm.entity';
import { ContactOrmEntity } from '../src/infrastructure/persistence/mikro-orm/entities/contact-orm.entity';
import { ContactSenderHistoryOrmEntity } from '../src/infrastructure/persistence/mikro-orm/entities/contact-sender-history-orm.entity';
import { AccountPlan } from '../src/contexts/account/domain/value-objects/account-plan.vo';
import { AccountStatus } from '../src/contexts/account/domain/value-objects/account-status.vo';
import { UserRole } from '../src/contexts/user/domain/value-objects/user-role.vo';
import { UserStatus } from '../src/contexts/user/domain/value-objects/user-status.vo';
import { ChannelStatus } from '../src/contexts/channel/domain/value-objects/channel-status.vo';
import { AllocationReason } from '../src/contexts/audience/domain/value-objects/allocation-reason.vo';
import { deriveFirstName } from '../src/contexts/audience/domain/value-objects/first-name.vo';

loadEnv({ override: false });

const PASSWORD = 'Batuta@2026';
const PLATFORM_EMAIL = 'plataforma@batuta.local';
const ACCOUNT_EMAIL = 'admin@gabinete.local';
const CONTACT_COUNT = 40;

const NAMES = [
  'Maria Silva',
  'João Pereira',
  'Ana Souza',
  'Carlos Lima',
  'Beatriz Alves',
  'Rafael Costa',
  'Juliana Rocha',
  'Pedro Martins',
  'Fernanda Dias',
  'Lucas Barros',
];

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed:dev não roda em produção.');
  }

  const orm = await MikroORM.init(config);
  const em = orm.em.fork();
  // O seed escreve em várias contas de propósito (plataforma + tenant), então roda FORA do filtro de
  // tenant — é o único lugar do repositório, além do login, com essa licença, e é um script.
  em.setFilterParams('tenant', { accountId: null });

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const now = new Date();

  const platformAdmin = await em.findOne(PlatformAdminOrmEntity, { email: PLATFORM_EMAIL });
  if (!platformAdmin) {
    await em.insert(PlatformAdminOrmEntity, {
      id: randomUUID(),
      name: 'Admin da Plataforma',
      email: PLATFORM_EMAIL,
      passwordHash,
      active: true,
      lastLoginAt: null,
      createdAt: now,
    });
    log('platform admin criado', PLATFORM_EMAIL);
  }

  let user = await em.findOne(UserOrmEntity, { email: ACCOUNT_EMAIL }, { filters: false });
  let accountId = user?.accountId;

  if (!accountId) {
    accountId = randomUUID();
    await em.insert(AccountOrmEntity, {
      id: accountId,
      name: 'Gabinete Exemplo',
      // CNPJ com dígitos verificadores VÁLIDOS: o Document do domínio valida na reconstituição,
      // então um número inventado faz o login falhar com "Documento inválido" — e o sintoma aparece
      // longe da causa.
      document: '12345678000195',
      plan: AccountPlan.STANDARD,
      status: AccountStatus.ACTIVE,
      dailySendCeiling: 300,
      timezone: 'America/Sao_Paulo',
      evolutionServerUrl: null,
      evolutionApiKey: null,
      suspendedAt: null,
      suspensionReason: null,
      createdAt: now,
    });
    const userId = randomUUID();
    await em.insert(UserOrmEntity, {
      id: userId,
      accountId,
      name: 'Admin do Gabinete',
      email: ACCOUNT_EMAIL,
      // Número de teste, não real: em desenvolvimento a recuperação por WhatsApp não vai a lugar
      // nenhum (a instância de sistema não está configurada). O campo existe para o login ter os
      // três dados obrigatórios (CLAUDE.md regra 9) e para a tela poder exibi-lo.
      phone: '+5511900000000',
      passwordHash,
      role: UserRole.ACCOUNT_ADMIN,
      status: UserStatus.ACTIVE,
      lastLoginAt: null,
      createdAt: now,
    });
    user = await em.findOne(UserOrmEntity, { id: userId }, { filters: false });
    log('conta e admin criados', `${ACCOUNT_EMAIL} / conta ${accountId}`);
  }

  const existingChannels = await em.find(ChannelOrmEntity, { accountId }, { filters: false });
  const channels = existingChannels.length > 0 ? existingChannels : [];

  if (channels.length === 0) {
    for (const [index, label] of ['Chip Principal', 'Chip Secundário'].entries()) {
      const id = randomUUID();
      await em.insert(ChannelOrmEntity, {
        id,
        accountId,
        label,
        phoneE164: `+551133330${String(index + 10).padStart(3, '0')}`,
        evolutionInstanceName: `acct-${accountId}-ch-${id}`,
        // Estado escrito à mão: não há chip real em dev. Ver a recusa 3 no topo do arquivo.
        status: ChannelStatus.CONNECTED,
        warmupStartedAt: now,
        currentQuota: 20,
        quotaFloor: 20,
        quotaCeiling: 150,
        consecutiveFailures: 0,
        lastSendAt: null,
        lastQuotaReviewAt: null,
        disconnectEventsToday: 0,
        lastDisconnectAt: null,
        retiredAt: null,
        retiredBy: null,
        terminalReason: null,
        createdAt: now,
      });
      const inserted = await em.findOne(ChannelOrmEntity, { id }, { filters: false });
      if (inserted) {
        channels.push(inserted);
      }
    }
    log('canais criados', channels.map((channel) => channel.label).join(', '));
  }

  const contactCount = await em.count(ContactOrmEntity, { accountId }, { filters: false });
  if (contactCount === 0) {
    for (let index = 0; index < CONTACT_COUNT; index += 1) {
      const name = `${NAMES[index % NAMES.length]} ${index + 1}`;
      const contactId = randomUUID();
      // Alternado entre os canais: a alocação real é do §6.2, aqui só precisa haver carga nos dois.
      const channel = channels[index % channels.length];
      await em.insert(ContactOrmEntity, {
        id: contactId,
        accountId,
        phoneE164: `+5511${String(900000000 + index).slice(0, 9)}`,
        name,
        firstName: deriveFirstName(name),
        tags: index % 3 === 0 ? ['zona-norte'] : ['zona-sul'],
        currentChannelId: channel.id,
        active: true,
        optedOutAt: null,
        contactImportId: null,
        createdAt: now,
      });
      await em.insert(ContactSenderHistoryOrmEntity, {
        id: randomUUID(),
        accountId,
        contactId,
        channelId: channel.id,
        assignedAt: now,
        releasedAt: null,
        reason: AllocationReason.INITIAL_ALLOCATION,
        migrationId: null,
        createdAt: now,
      });
    }
    log('contatos criados', String(CONTACT_COUNT));
  }

  await em.flush();
  await orm.close(true);

  process.stdout.write(
    [
      '',
      'Seed pronto.',
      `  Plataforma : ${PLATFORM_EMAIL} / ${PASSWORD}`,
      `  Conta      : ${ACCOUNT_EMAIL} / ${PASSWORD}`,
      `  accountId  : ${accountId}`,
      '',
    ].join('\n'),
  );
}

function log(what: string, detail: string): void {
  process.stdout.write(`  · ${what}: ${detail}\n`);
}

main().catch((error: Error) => {
  process.stderr.write(`Seed falhou: ${error.message}\n`);
  process.exit(1);
});
