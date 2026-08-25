import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  RESELLER_REPOSITORY,
  ResellerRepositoryPort,
} from '../../ports/output/reseller-repository.port';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '@contexts/user/application/ports/output/user-repository.port';
import { UNIT_OF_WORK, UnitOfWorkPort } from '@infrastructure/persistence/ports/unit-of-work.port';
import { Reseller } from '../../../domain/entities/reseller.entity';
import { UniqueLink } from '../../../domain/value-objects/unique-link.vo';
import { CPF } from '../../../domain/value-objects/cpf.vo';
import { ResellerDto } from '../../dto/reseller.dto';
import { ResellerAlreadyExistsException } from '../../../domain/exceptions/reseller-already-exists.exception';
import { UserId } from '@contexts/user/domain/value-objects/user-id.vo';
import { UserNotFoundException } from '@contexts/user/domain/exceptions/user-not-found.exception';

export class RegisterResellerCommand {
  constructor(
    public readonly userId: string,
    public readonly cpf: string,
    public readonly fullName: string,
    public readonly type: 'pf' | 'pj',
    public readonly birthDate: string,
    public readonly addressZipCode: string,
    public readonly addressStreet: string,
    public readonly addressNumber: string,
    public readonly addressComplement: string | null,
    public readonly addressNeighborhood: string,
    public readonly addressCity: string,
    public readonly addressState: string,
    public readonly phone?: string | null,
    public readonly bankName?: string | null,
    public readonly bankCode?: string | null,
    public readonly bankAgency?: string | null,
    public readonly bankAccount?: string | null,
    public readonly bankAccountType?: string | null,
    public readonly bankHolderName?: string | null,
    public readonly bankHolderCpf?: string | null,
    public readonly pixKey?: string | null,
    public readonly pixKeyType?: string | null,
  ) {}
}

@Injectable()
export class RegisterResellerUseCase implements UseCase<RegisterResellerCommand, ResellerDto> {
  constructor(
    @Inject(RESELLER_REPOSITORY)
    private readonly resellerRepository: ResellerRepositoryPort,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: RegisterResellerCommand): Promise<ResellerDto> {
    const userIdVo = UserId.from(command.userId);
    const user = await this.userRepository.findById(userIdVo);
    if (!user) {
      throw new UserNotFoundException(command.userId);
    }

    const existingReseller = await this.resellerRepository.findByUserId(userIdVo.value);
    if (existingReseller) {
      throw new ResellerAlreadyExistsException('User is already a reseller');
    }

    const cpfVO = CPF.create(command.cpf);
    const existingByCPF = await this.resellerRepository.findByCPF(cpfVO);
    if (existingByCPF) {
      throw new ResellerAlreadyExistsException('CPF already registered');
    }

    const uniqueLink = UniqueLink.generate(command.fullName);

    let link = uniqueLink;
    let attempts = 0;

    while (await this.resellerRepository.findByUniqueLink(link)) {
      attempts++;
      if (attempts > 10) {
        throw new Error('Failed to generate unique link');
      }
      link = UniqueLink.generate(`${command.fullName}${attempts}`);
    }

    const normalize = (value?: string | null) => {
      const trimmed = value?.trim();
      return trimmed && trimmed.length > 0 ? trimmed : null;
    };

    const birthDate =
      command.birthDate && command.birthDate.length > 0 ? new Date(command.birthDate) : null;

    const reseller = Reseller.create(
      command.userId,
      link,
      command.fullName,
      cpfVO,
      command.type,
      birthDate,
      {
        zipCode: normalize(command.addressZipCode),
        street: normalize(command.addressStreet),
        number: normalize(command.addressNumber),
        complement: normalize(command.addressComplement),
        neighborhood: normalize(command.addressNeighborhood),
        city: normalize(command.addressCity),
        state: normalize(command.addressState),
      },
      normalize(command.phone),
      normalize(command.bankName),
      normalize(command.bankCode),
      normalize(command.bankAgency),
      normalize(command.bankAccount),
      normalize(command.bankAccountType),
      normalize(command.bankHolderName),
      normalize(command.bankHolderCpf),
      normalize(command.pixKey),
      normalize(command.pixKeyType),
    );

    return this.unitOfWork.execute(async () => {
      const saved = await this.resellerRepository.save(reseller);
      return ResellerDto.fromDomain(saved);
    });
  }
}
