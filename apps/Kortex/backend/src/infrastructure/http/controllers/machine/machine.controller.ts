import { Body, Controller, Get, HttpCode, Param, Post, Put, UseGuards } from '@nestjs/common';
import {
  ListMachinesUseCase,
  ListMachinesQuery,
} from '../../../../contexts/machine/application/use-cases/list-machines/list-machines.use-case';
import {
  CreateMachineUseCase,
  CreateMachineCommand,
} from '../../../../contexts/machine/application/use-cases/create-machine/create-machine.use-case';
import {
  UpdateMachineUseCase,
  UpdateMachineCommand,
} from '../../../../contexts/machine/application/use-cases/update-machine/update-machine.use-case';
import { MachineDto } from '../../../../contexts/machine/application/dto/machine.dto';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { AdminGuard } from '../../../security/guards/admin.guard';
import { OwnerGuard } from '../../../security/guards/owner.guard';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import { CreateMachineRequestDto, UpdateMachineRequestDto } from './dto/machine-request.dto';

/**
 * Máquinas e preço da hora.
 *
 * `AdminGuard` no controller inteiro e `OwnerGuard` na escrita: cadastrar máquina e definir preço
 * é exclusivo do dono (§5). O Modelista não alcança nenhuma destas rotas — o `MachineDto` carrega
 * `hourPriceCents`, e ele nunca vê valor em dinheiro.
 */
@Controller('machines')
@UseGuards(AdminGuard)
export class MachineController {
  constructor(
    private readonly listMachinesUseCase: ListMachinesUseCase,
    private readonly createMachineUseCase: CreateMachineUseCase,
    private readonly updateMachineUseCase: UpdateMachineUseCase,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthTokenPayload): Promise<MachineDto[]> {
    return this.listMachinesUseCase.execute(new ListMachinesQuery(user.accountId));
  }

  @Post()
  @UseGuards(OwnerGuard)
  @HttpCode(201)
  async create(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: CreateMachineRequestDto,
  ): Promise<MachineDto> {
    return this.createMachineUseCase.execute(
      new CreateMachineCommand(user.accountId, dto.name, dto.model ?? null, dto.hourPriceCents),
    );
  }

  @Put(':id')
  @UseGuards(OwnerGuard)
  async update(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateMachineRequestDto,
  ): Promise<MachineDto> {
    return this.updateMachineUseCase.execute(
      new UpdateMachineCommand(
        user.accountId,
        id,
        dto.name,
        dto.model ?? null,
        dto.hourPriceCents,
        dto.isActive,
      ),
    );
  }
}
