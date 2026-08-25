import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  CONNECTION_REPOSITORY,
  ConnectionRepositoryPort,
} from '../../ports/output/connection-repository.port';

/** Minimal per-tenant descriptor for scheduler fan-out. Carries NO token. */
export interface ConnectedTenant {
  ownerId: string;
  igUserId: string;
}

/**
 * INTERNAL use case (scheduler only) — lists every connected tenant so the scheduler can
 * enqueue one child job per tenant (fan-out), isolating one tenant's failure from the others.
 */
@Injectable()
export class ListConnectedTenantsUseCase implements UseCase<void, ConnectedTenant[]> {
  constructor(
    @Inject(CONNECTION_REPOSITORY)
    private readonly connectionRepository: ConnectionRepositoryPort,
  ) {}

  async execute(): Promise<ConnectedTenant[]> {
    const connections = await this.connectionRepository.findAllConnected();
    return connections.map((c) => ({ ownerId: c.ownerId, igUserId: c.igUserId }));
  }
}
