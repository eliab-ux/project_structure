import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { CreateUserUseCase } from '../../../../contexts/user/application/use-cases/create-user/create-user.use-case';
import { GetUserUseCase } from '../../../../contexts/user/application/use-cases/get-user/get-user.use-case';
import { CreateUserCommand } from '../../../../contexts/user/application/use-cases/create-user/create-user.command';
import { GetUserQuery } from '../../../../contexts/user/application/use-cases/get-user/get-user.query';
import { CreateUserRequestDto } from './dto/create-user.request.dto';
import { UserResponseDto } from './dto/user.response.dto';

@Controller('users')
export class UserController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly getUserUseCase: GetUserUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateUserRequestDto): Promise<UserResponseDto> {
    const command = new CreateUserCommand(dto.email, dto.name);
    const userDto = await this.createUserUseCase.execute(command);
    return UserResponseDto.fromDto(userDto);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getById(@Param('id') id: string): Promise<UserResponseDto> {
    const query = new GetUserQuery(id);
    const userDto = await this.getUserUseCase.execute(query);
    return UserResponseDto.fromDto(userDto);
  }
}
