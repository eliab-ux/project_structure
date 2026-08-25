import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  PSICOLOGO_REPOSITORY,
  PsicologoRepositoryPort,
} from '../../../../psicologo/application/ports/output/psicologo-repository.port';
import { PsicologoId } from '../../../../psicologo/domain/value-objects/psicologo-id.vo';
import { PsicologoDto } from '../../../../psicologo/application/dto/psicologo.dto';
import { PsicologoNotFoundException } from '../../../../psicologo/domain/exceptions/psicologo.exceptions';

export class GetMeQuery {
  constructor(public readonly psicologoId: string) {}
}

@Injectable()
export class GetMeUseCase implements UseCase<GetMeQuery, PsicologoDto> {
  constructor(@Inject(PSICOLOGO_REPOSITORY) private readonly psicologos: PsicologoRepositoryPort) {}

  async execute(query: GetMeQuery): Promise<PsicologoDto> {
    const psicologo = await this.psicologos.findById(PsicologoId.from(query.psicologoId));
    if (!psicologo) {
      throw new PsicologoNotFoundException(query.psicologoId);
    }
    return PsicologoDto.fromDomain(psicologo);
  }
}
