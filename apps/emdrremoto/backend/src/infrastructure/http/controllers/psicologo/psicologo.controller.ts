import { BadRequestException, Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { RegisterPsicologoUseCase } from '../../../../contexts/psicologo/application/use-cases/register-psicologo/register-psicologo.use-case';
import { RegisterPsicologoCommand } from '../../../../contexts/psicologo/application/use-cases/register-psicologo/register-psicologo.command';
import {
  VerifyEmailUseCase,
  VerifyEmailCommand,
} from '../../../../contexts/psicologo/application/use-cases/verify-email/verify-email.use-case';
import { PsicologoDto } from '../../../../contexts/psicologo/application/dto/psicologo.dto';
import { RegisterPsicologoRequestDto } from './dto/register-psicologo.request.dto';

@Controller('psicologos')
export class PsicologoController {
  constructor(
    private readonly registerPsicologo: RegisterPsicologoUseCase,
    private readonly verifyEmail: VerifyEmailUseCase,
  ) {}

  // Público: auto-cadastro do psicólogo. Sem guard por natureza (é o onboarding).
  @Post()
  @HttpCode(201)
  async register(@Body() dto: RegisterPsicologoRequestDto): Promise<PsicologoDto> {
    if (dto.senha !== dto.confsenha) {
      throw new BadRequestException('A senha e a confirmação de senha devem ser iguais.');
    }
    return this.registerPsicologo.execute(
      new RegisterPsicologoCommand(dto.email, dto.nome, dto.telefone, dto.senha),
    );
  }

  // Público: confirmação de e-mail via link enviado no cadastro (contém o id).
  // Não requer guard: o próprio id no link é o portador da ação, e só marca email_verificado.
  @Post(':id/verify-email')
  @HttpCode(200)
  async verify(@Param('id') id: string): Promise<{ ok: true }> {
    await this.verifyEmail.execute(new VerifyEmailCommand(id));
    return { ok: true };
  }
}
