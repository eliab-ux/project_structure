import { Inject, Injectable } from '@nestjs/common';
import { ACCOUNT_REPOSITORY, AccountRepositoryPort } from './ports/output/account-repository.port';
import { AccountId } from '../domain/value-objects/account-id.vo';
import { AccountPreferences } from '../domain/value-objects/account-preferences.vo';
import { AccountNotFoundException } from '../domain/exceptions/account-not-found.exception';

/**
 * Lê as preferências da conta em vigor. Existe para que Contato e Produto consultem as preferências
 * (documento duplicado, numeração) sem depender do repositório inteiro de conta nem repetir o
 * `findById` — e para que a leitura passe pelo escopo de tenant (RLS + filtro global) como qualquer
 * outra. Exportado pelo `AccountModule`, injetado nos use cases de cadastro.
 */
@Injectable()
export class AccountPreferencesReader {
  constructor(@Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort) {}

  async forAccount(accountId: string): Promise<AccountPreferences> {
    const account = await this.accounts.findById(AccountId.from(accountId));
    if (!account) {
      throw new AccountNotFoundException();
    }
    return account.preferences;
  }
}
