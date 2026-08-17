import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ListUsersUseCase,
  ListUsersQuery,
} from '../../../../contexts/user/application/use-cases/list-users/list-users.use-case';
import {
  CreateUserUseCase,
  CreateUserCommand,
} from '../../../../contexts/user/application/use-cases/create-user/create-user.use-case';
import {
  UpdateUserUseCase,
  UpdateUserCommand,
} from '../../../../contexts/user/application/use-cases/update-user/update-user.use-case';
import {
  SetUserActiveUseCase,
  SetUserActiveCommand,
} from '../../../../contexts/user/application/use-cases/set-user-active/set-user-active.use-case';
import { UserDto } from '../../../../contexts/user/application/dto/user.dto';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { PlainPassword } from '../../../../shared/domain/value-objects/plain-password.vo';
import { AdminGuard } from '../../../security/guards/admin.guard';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import {
  CreateUserRequestDto,
  SetUserActiveRequestDto,
  UpdateUserRequestDto,
} from './dto/user-request.dto';

/**
 * A equipe. Todo mundo aqui é usuário do sistema — não existe pessoa sem login (§4.3).
 *
 * `AdminGuard` cobre o controller: criar e editar `modelista`/`admin` é do Administrativo para
 * cima. A parte que é só do dono — criar ou mexer num `owner` — é decidida **dentro do use case**,
 * a partir do `actorRole`, porque depende do papel ALVO e não da rota. Um guard não consegue ver
 * o corpo da requisição.
 */
@Controller('users')
@UseGuards(AdminGuard)
export class UserController {
  constructor(
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
    private readonly setUserActiveUseCase: SetUserActiveUseCase,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthTokenPayload): Promise<UserDto[]> {
    return this.listUsersUseCase.execute(new ListUsersQuery(user.accountId));
  }

  @Post()
  @HttpCode(201)
  async create(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: CreateUserRequestDto,
  ): Promise<UserDto> {
    return this.createUserUseCase.execute(
      new CreateUserCommand(
        user.accountId,
        user.role,
        dto.name,
        dto.email,
        dto.phone,
        dto.role,
        PlainPassword.create(dto.initialPassword),
      ),
    );
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateUserRequestDto,
  ): Promise<UserDto> {
    return this.updateUserUseCase.execute(
      new UpdateUserCommand(
        user.accountId,
        user.role,
        // O ator vai junto porque a regra do telefone (§6.12) depende de quem edita QUEM: trocar
        // o próprio número é livre, o de terceiro é só do dono.
        user.sub,
        id,
        dto.name,
        dto.email,
        dto.phone,
        dto.role,
      ),
    );
  }

  @Patch(':id/active')
  async setActive(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
    @Body() dto: SetUserActiveRequestDto,
  ): Promise<UserDto> {
    return this.setUserActiveUseCase.execute(
      new SetUserActiveCommand(user.accountId, user.role, user.sub, id, dto.isActive),
    );
  }
}
