import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { GetResellerProfileCommand } from './get-profile.command';
import { RESELLER_REPOSITORY, ResellerRepositoryPort } from '../../ports/output/reseller-repository.port';
import { ResellerId } from '../../../domain/value-objects/reseller-id.vo';
import { ResellerNotFoundException } from '../../../domain/exceptions/reseller-not-found.exception';
import { USER_REPOSITORY, UserRepositoryPort } from '@contexts/user/application/ports/output/user-repository.port';
import { UserId } from '@contexts/user/domain/value-objects/user-id.vo';
import { UserNotFoundException } from '@contexts/user/domain/exceptions/user-not-found.exception';
import { UserDto } from '@contexts/user/application/dto/user.dto';
import { ResellerDto } from '../../dto/reseller.dto';

export interface GetResellerProfileResult {
  user: UserDto;
  reseller: ResellerDto;
}

@Injectable()
export class GetResellerProfileUseCase implements UseCase<GetResellerProfileCommand, GetResellerProfileResult> {
  constructor(
    @Inject(RESELLER_REPOSITORY)
    private readonly resellerRepository: ResellerRepositoryPort,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(command: GetResellerProfileCommand): Promise<GetResellerProfileResult> {
    const reseller = await this.resellerRepository.findById(ResellerId.from(command.resellerId));
    if (!reseller) {
      throw new ResellerNotFoundException(command.resellerId);
    }

    const user = await this.userRepository.findById(UserId.from(reseller.userId));
    if (!user) {
      throw new UserNotFoundException(reseller.userId);
    }

    return {
      user: UserDto.fromDomain(user),
      reseller: ResellerDto.fromDomain(reseller),
    };
  }
}
