import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, UseGuards } from '@nestjs/common';
import { PsicologoGuard } from '../../../security/guards/psicologo.guard';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import { AuthTokenPayload } from '../../../security/ports/token-service.port';
import {
  CreatePacienteUseCase,
  CreatePacienteCommand,
} from '../../../../contexts/paciente/application/use-cases/create-paciente/create-paciente.use-case';
import {
  ListPacientesUseCase,
  ListPacientesQuery,
} from '../../../../contexts/paciente/application/use-cases/list-pacientes/list-pacientes.use-case';
import {
  DeletePacienteUseCase,
  DeletePacienteCommand,
} from '../../../../contexts/paciente/application/use-cases/delete-paciente/delete-paciente.use-case';
import {
  GetPacienteByHashUseCase,
  GetPacienteByHashQuery,
} from '../../../../contexts/paciente/application/use-cases/get-paciente-by-hash/get-paciente-by-hash.use-case';
import {
  GetPacienteUseCase,
  GetPacienteQuery,
} from '../../../../contexts/paciente/application/use-cases/get-paciente/get-paciente.use-case';
import {
  UpdatePacienteUseCase,
  UpdatePacienteCommand,
} from '../../../../contexts/paciente/application/use-cases/update-paciente/update-paciente.use-case';
import {
  ListOnlinePacientesUseCase,
  ListOnlinePacientesQuery,
} from '../../../../contexts/paciente/application/use-cases/list-online-pacientes/list-online-pacientes.use-case';
import {
  PacienteDto,
  PacientePublicDto,
} from '../../../../contexts/paciente/application/dto/paciente.dto';
import { CreatePacienteRequestDto } from './dto/create-paciente.request.dto';

@Controller('pacientes')
export class PacienteController {
  constructor(
    private readonly createPaciente: CreatePacienteUseCase,
    private readonly listPacientes: ListPacientesUseCase,
    private readonly deletePaciente: DeletePacienteUseCase,
    private readonly getByHash: GetPacienteByHashUseCase,
    private readonly getPaciente: GetPacienteUseCase,
    private readonly updatePaciente: UpdatePacienteUseCase,
    private readonly listOnline: ListOnlinePacientesUseCase,
  ) {}

  @Post()
  @UseGuards(PsicologoGuard)
  @HttpCode(201)
  async create(
    @Body() dto: CreatePacienteRequestDto,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<PacienteDto> {
    return this.createPaciente.execute(
      new CreatePacienteCommand(user.sub, dto.email, dto.nome, dto.telefone, dto.pais),
    );
  }

  @Get()
  @UseGuards(PsicologoGuard)
  async list(@CurrentUser() user: AuthTokenPayload): Promise<PacienteDto[]> {
    return this.listPacientes.execute(new ListPacientesQuery(user.sub));
  }

  // IDs dos pacientes online agora (para o indicador 🟢 no dashboard).
  // Declarado ANTES de ':id' para não ser capturado como um id.
  @Get('online')
  @UseGuards(PsicologoGuard)
  async online(@CurrentUser() user: AuthTokenPayload): Promise<string[]> {
    return this.listOnline.execute(new ListOnlinePacientesQuery(user.sub));
  }

  @Get(':id')
  @UseGuards(PsicologoGuard)
  async getOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<PacienteDto> {
    return this.getPaciente.execute(new GetPacienteQuery(id, user.sub));
  }

  @Put(':id')
  @UseGuards(PsicologoGuard)
  async update(
    @Param('id') id: string,
    @Body() dto: CreatePacienteRequestDto,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<PacienteDto> {
    return this.updatePaciente.execute(
      new UpdatePacienteCommand(id, user.sub, dto.email, dto.nome, dto.telefone, dto.pais),
    );
  }

  @Delete(':id')
  @UseGuards(PsicologoGuard)
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthTokenPayload): Promise<void> {
    await this.deletePaciente.execute(new DeletePacienteCommand(id, user.sub));
  }

  // Público: o paciente confirma o próprio link de convite. Expõe apenas o nome
  // (PacientePublicDto) — nenhum outro dado de paciente. Sem guard por natureza.
  @Get('by-hash/:hash')
  async byHash(@Param('hash') hash: string): Promise<PacientePublicDto> {
    return this.getByHash.execute(new GetPacienteByHashQuery(hash));
  }
}
