import {
  Controller,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  Patch,
  ForbiddenException,
} from '@nestjs/common';
import {
  RegisterResellerUseCase,
  RegisterResellerCommand,
} from '../../../../contexts/reseller/application/use-cases/register-reseller/register-reseller.use-case';
import {
  ApproveResellerRegistrationUseCase,
  ApproveResellerCommand,
} from '../../../../contexts/reseller/application/use-cases/approve-reseller/approve-reseller.use-case';
import { AdminGuard } from '../../../../infrastructure/security/guards/admin.guard';
import { RegisterResellerRequestDto } from './dto/register-reseller.request.dto';
import { ApproveResellerRequestDto } from './dto/approve-reseller.request.dto';
import { ResellerDto } from '../../../../contexts/reseller/application/dto/reseller.dto';
import { GetResellerProfileUseCase } from '../../../../contexts/reseller/application/use-cases/get-profile/get-profile.use-case';
import { GetResellerProfileCommand } from '../../../../contexts/reseller/application/use-cases/get-profile/get-profile.command';
import { UpdateResellerProfileUseCase } from '../../../../contexts/reseller/application/use-cases/update-profile/update-profile.use-case';
import { UpdateResellerProfileCommand } from '../../../../contexts/reseller/application/use-cases/update-profile/update-profile.command';
import { UpdateResellerBankInfoUseCase } from '../../../../contexts/reseller/application/use-cases/update-bank-info/update-bank-info.use-case';
import { UpdateResellerBankInfoCommand } from '../../../../contexts/reseller/application/use-cases/update-bank-info/update-bank-info.command';
import { UpdateResellerProfileRequestDto } from './dto/update-profile.request.dto';
import { UpdateResellerBankInfoRequestDto } from './dto/update-bank-info.request.dto';
import { ResellerProfileResponseDto } from './dto/reseller-profile.response.dto';
import { ResellerGuard } from '../../../../infrastructure/security/guards/reseller.guard';
import { CurrentUser } from '../../../../infrastructure/security/decorators/current-user.decorator';
import { AuthTokenPayload } from '../../../../infrastructure/security/ports/token-service.port';

@Controller('resellers')
export class ResellerController {
  constructor(
    private readonly registerResellerUseCase: RegisterResellerUseCase,
    private readonly approveResellerUseCase: ApproveResellerRegistrationUseCase,
    private readonly getResellerProfileUseCase: GetResellerProfileUseCase,
    private readonly updateResellerProfileUseCase: UpdateResellerProfileUseCase,
    private readonly updateResellerBankInfoUseCase: UpdateResellerBankInfoUseCase,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterResellerRequestDto): Promise<ResellerDto> {
    const command = new RegisterResellerCommand(dto.userId, dto.cpf, dto.fullName);
    return this.registerResellerUseCase.execute(command);
  }

  @Post(':id/approve')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  async approve(@Param('id') id: string, @Body() dto: ApproveResellerRequestDto): Promise<void> {
    const command = new ApproveResellerCommand(id, dto.approvedBy);
    return this.approveResellerUseCase.execute(command);
  }

  @Get('profile')
  @UseGuards(ResellerGuard)
  @HttpCode(HttpStatus.OK)
  async profile(@CurrentUser() user: AuthTokenPayload): Promise<ResellerProfileResponseDto> {
    const resellerId = this.ensureResellerId(user);
    const result = await this.getResellerProfileUseCase.execute(
      new GetResellerProfileCommand(resellerId),
    );
    return ResellerProfileResponseDto.from(result.user, result.reseller);
  }

  @Patch('profile')
  @UseGuards(ResellerGuard)
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: UpdateResellerProfileRequestDto,
  ): Promise<ResellerDto> {
    const resellerId = this.ensureResellerId(user);
    return this.updateResellerProfileUseCase.execute(
      new UpdateResellerProfileCommand(resellerId, dto.fullName ?? null, dto.phone ?? null),
    );
  }

  @Patch('bank-info')
  @UseGuards(ResellerGuard)
  @HttpCode(HttpStatus.OK)
  async updateBankInfo(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: UpdateResellerBankInfoRequestDto,
  ): Promise<ResellerDto> {
    const resellerId = this.ensureResellerId(user);
    return this.updateResellerBankInfoUseCase.execute(
      new UpdateResellerBankInfoCommand(
        resellerId,
        dto.bankName ?? null,
        dto.bankCode ?? null,
        dto.bankAgency ?? null,
        dto.bankAccount ?? null,
        dto.bankAccountType ?? null,
        dto.bankHolderName ?? null,
        dto.bankHolderCpf ?? null,
        dto.pixKey ?? null,
        dto.pixKeyType ?? null,
      ),
    );
  }

  private ensureResellerId(user: AuthTokenPayload): string {
    if (!user.resellerId) {
      throw new ForbiddenException('Acesso restrito a revendedores autenticados');
    }
    return user.resellerId;
  }
}
