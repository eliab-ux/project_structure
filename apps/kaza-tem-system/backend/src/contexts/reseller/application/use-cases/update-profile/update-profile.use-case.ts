import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { UpdateResellerProfileCommand } from './update-profile.command';
import { RESELLER_REPOSITORY, ResellerRepositoryPort } from '../../ports/output/reseller-repository.port';
import { ResellerId } from '../../../domain/value-objects/reseller-id.vo';
import { ResellerNotFoundException } from '../../../domain/exceptions/reseller-not-found.exception';
import { ResellerDto } from '../../dto/reseller.dto';
import { UNIT_OF_WORK, UnitOfWorkPort } from '@infrastructure/persistence/ports/unit-of-work.port';

@Injectable()
export class UpdateResellerProfileUseCase implements UseCase<UpdateResellerProfileCommand, ResellerDto> {
  constructor(
    @Inject(RESELLER_REPOSITORY)
    private readonly resellerRepository: ResellerRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: UpdateResellerProfileCommand): Promise<ResellerDto> {
    const reseller = await this.resellerRepository.findById(ResellerId.from(command.resellerId));
    if (!reseller) {
      throw new ResellerNotFoundException(command.resellerId);
    }

    reseller.updateProfile(command.fullName ?? null, command.phone ?? null);

    const updated = await this.unitOfWork.execute(async () => {
      return this.resellerRepository.save(reseller);
    });

    return ResellerDto.fromDomain(updated);
  }
}
