import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  COMMISSION_TIER_REPOSITORY,
  CommissionTierRepositoryPort,
} from '../../ports/output/commission-tier-repository.port';
import { CommissionTierDto } from '../../dto/commission.dto';

/** Lê as faixas do Modelo A da conta (§2 do 02A). Sem argumento — o tenant escopa. */
export class GetCommissionTiersQuery {}

@Injectable()
export class GetCommissionTiersUseCase implements UseCase<
  GetCommissionTiersQuery,
  CommissionTierDto[]
> {
  constructor(
    @Inject(COMMISSION_TIER_REPOSITORY) private readonly tiers: CommissionTierRepositoryPort,
  ) {}

  async execute(): Promise<CommissionTierDto[]> {
    const tiers = await this.tiers.getForAccount();
    return tiers.map(CommissionTierDto.fromDomain);
  }
}
