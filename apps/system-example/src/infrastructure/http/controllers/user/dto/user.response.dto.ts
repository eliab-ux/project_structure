import { UserDto } from '../../../../../contexts/user/application/dto/user.dto';

export class UserResponseDto {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;

  static fromDto(dto: UserDto): UserResponseDto {
    const response = new UserResponseDto();
    response.id = dto.id;
    response.email = dto.email;
    response.name = dto.name;
    response.createdAt = dto.createdAt;
    response.updatedAt = dto.updatedAt;
    response.isActive = dto.isActive;
    return response;
  }
}
