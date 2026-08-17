import { E2EContext } from './e2e-app';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../../src/contexts/account/application/ports/output/account-repository.port';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../src/contexts/user/application/ports/output/user-repository.port';
import {
  PASSWORD_HASHER,
  PasswordHasherPort,
} from '../../src/contexts/user/application/ports/output/password-hasher.port';
import {
  MACHINE_REPOSITORY,
  MachineRepositoryPort,
} from '../../src/contexts/machine/application/ports/output/machine-repository.port';
import {
  BANK_ACCOUNT_REPOSITORY,
  BankAccountRepositoryPort,
} from '../../src/contexts/finance/application/ports/output/finance-repository.port';
import { BankAccount } from '../../src/contexts/finance/domain/entities/bank-account.entity';
import { Account } from '../../src/contexts/account/domain/entities/account.entity';
import { User } from '../../src/contexts/user/domain/entities/user.entity';
import { Machine } from '../../src/contexts/machine/domain/entities/machine.entity';
import { UserRole } from '../../src/contexts/user/domain/value-objects/user-role.vo';
import { Email } from '../../src/shared/domain/value-objects/email.vo';
import { PhoneE164 } from '../../src/shared/domain/value-objects/phone-e164.vo';
import { Money } from '../../src/shared/domain/value-objects/money.vo';

export const TEST_PASSWORD = 'senha-de-teste-123';

export interface SeededAccount {
  accountId: string;
  users: Record<UserRole, { id: string; email: string }>;
  machineId: string;
  /** Conta bancária única e ativa — é ela que o pagamento resolve sozinho (§4.15). */
  bankAccountId: string;
}

/**
 * Semeia uma conta completa: os três papéis, uma máquina e uma conta bancária.
 *
 * A conta bancária entrou na Fase 6 e é **uma só, ativa**, de propósito: com uma única conta ativa
 * o registro de pagamento resolve o destino do dinheiro sem escolha explícita, que é o caminho que
 * os testes de agenda das fases anteriores já exercitavam.
 *
 * Passa pelos repositórios reais, e não por INSERT direto, de propósito: assim o dado do teste
 * atravessa mapper e entidade de domínio, e um erro de mapeamento aparece aqui em vez de virar um
 * teste que passa sobre um estado que a aplicação nunca produziria.
 */
export async function seedAccount(ctx: E2EContext, prefix: string): Promise<SeededAccount> {
  const accounts = ctx.app.get<AccountRepositoryPort>(ACCOUNT_REPOSITORY);
  const users = ctx.app.get<UserRepositoryPort>(USER_REPOSITORY);
  const machines = ctx.app.get<MachineRepositoryPort>(MACHINE_REPOSITORY);
  const bankAccounts = ctx.app.get<BankAccountRepositoryPort>(BANK_ACCOUNT_REPOSITORY);
  const hasher = ctx.app.get<PasswordHasherPort>(PASSWORD_HASHER);

  // Tudo dentro de um RequestContext, como numa requisição real — ver o docblock de
  // `runInContext`.
  return ctx.runInContext(async () => {
    const account = await accounts.save(Account.create({ name: `Conta ${prefix}`, city: 'Ceres' }));

    const passwordHash = await hasher.hash(TEST_PASSWORD);
    const roles: UserRole[] = ['owner', 'admin', 'modelista'];
    const seededUsers = {} as SeededAccount['users'];

    for (const role of roles) {
      const email = `${role}.${prefix}@corteceres.com.br`;
      const saved = await users.save(
        User.create({
          accountId: account.id,
          name: `Usuário ${role}`,
          email: Email.create(email),
          phone: PhoneE164.create('62998708893'),
          passwordHash,
          role,
          // Sem a obrigação de trocar: o teste precisa autenticar e seguir para as rotas, e a
          // troca obrigatória tem o seu próprio teste.
          mustChangePassword: false,
        }),
      );
      seededUsers[role] = { id: saved.id.value, email };
    }

    const machine = await machines.save(
      Machine.create({
        accountId: account.id,
        name: `Máquina ${prefix}`,
        model: 'Audaces Neocut Bravo',
        hourPrice: Money.fromCents(8500),
      }),
    );

    const bankAccount = await bankAccounts.save(
      BankAccount.create({
        accountId: account.id,
        name: 'Conta principal',
        bank: 'Banco de teste',
        openingBalanceCents: 0,
      }),
    );

    return {
      accountId: account.id.value,
      users: seededUsers,
      machineId: machine.id.value,
      bankAccountId: bankAccount.id.value,
    };
  });
}
