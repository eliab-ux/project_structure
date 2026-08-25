import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  CONNECTION_REPOSITORY,
  ConnectionRepositoryPort,
} from '../../ports/output/connection-repository.port';
import { ConnectionDto } from '../../dto/connection.dto';

export interface GetConnectionStatusQuery {
  ownerId: string;
}

@Injectable()
export class GetConnectionStatusUseCase implements UseCase<
  GetConnectionStatusQuery,
  ConnectionDto
> {
  constructor(
    @Inject(CONNECTION_REPOSITORY)
    private readonly connectionRepository: ConnectionRepositoryPort,
  ) {}

  async execute(query: GetConnectionStatusQuery): Promise<ConnectionDto> {
    const connection = await this.connectionRepository.findByOwner(query.ownerId);
    return ConnectionDto.fromDomain(connection);
  }
}
