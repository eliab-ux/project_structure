import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../../contexts/account/application/ports/output/account-repository.port';
import { AccountId } from '../../contexts/account/domain/value-objects/account-id.vo';
import { AccountNotFoundException } from '../../contexts/account/domain/exceptions/account-not-found.exception';

export interface EvolutionServer {
  baseUrl: string;
  apiKey: string;
  /** True when this tenant runs on its own server rather than the platform's shared one. */
  dedicated: boolean;
}

/**
 * Resolves WHICH Evolution server a tenant talks to (§14, decisão 7).
 *
 * The decision recorded in the spec is: one shared platform server on v1, but the destination is
 * resolved per account, so moving a heavy or risky tenant to a dedicated server is one row in
 * `accounts` and no refactor. This class is that resolution, and it is the only place allowed to
 * read `EVOLUTION_API_URL` — the send path must never read the env directly.
 *
 * Resolution is cached per account for a short TTL: it sits in front of every send, and re-reading
 * `accounts` for each message would be a query per message.
 */
@Injectable()
export class EvolutionServerResolver {
  private readonly cache = new Map<string, { server: EvolutionServer; expiresAt: number }>();
  private static readonly CACHE_TTL_MS = 60_000;

  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
    private readonly config: ConfigService,
  ) {}

  async resolve(accountId: string): Promise<EvolutionServer> {
    const cached = this.cache.get(accountId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.server;
    }

    const account = await this.accounts.findById(AccountId.from(accountId));
    if (!account) {
      throw new AccountNotFoundException();
    }

    const server =
      account.evolutionServerUrl && account.evolutionApiKey
        ? {
            baseUrl: EvolutionServerResolver.normalize(account.evolutionServerUrl),
            apiKey: account.evolutionApiKey,
            dedicated: true,
          }
        : this.platformServer();

    this.cache.set(accountId, {
      server,
      expiresAt: Date.now() + EvolutionServerResolver.CACHE_TTL_MS,
    });
    return server;
  }

  /** Called when an account's server changes, so the next send does not use the old destination. */
  invalidate(accountId: string): void {
    this.cache.delete(accountId);
  }

  private platformServer(): EvolutionServer {
    const baseUrl = this.config.get<string>('EVOLUTION_API_URL');
    const apiKey = this.config.get<string>('EVOLUTION_API_KEY');

    if (!baseUrl || !apiKey) {
      // Explicit at the point of use, rather than a vague failure at boot.
      throw new Error(
        'Evolution não configurado: defina EVOLUTION_API_URL e EVOLUTION_API_KEY, ou dê ' +
          'à conta um servidor dedicado (evolution_server_url + evolution_api_key).',
      );
    }

    return { baseUrl: EvolutionServerResolver.normalize(baseUrl), apiKey, dedicated: false };
  }

  private static normalize(url: string): string {
    return url.replace(/\/+$/, '');
  }
}
