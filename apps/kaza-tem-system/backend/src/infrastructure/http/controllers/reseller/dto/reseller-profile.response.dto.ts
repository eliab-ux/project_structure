import { UserDto } from '@contexts/user/application/dto/user.dto';
import { ResellerDto } from '@contexts/reseller/application/dto/reseller.dto';

export class ResellerProfileResponseDto {
  user!: UserDto;
  reseller!: ResellerDto;

  static from(user: UserDto, reseller: ResellerDto): ResellerProfileResponseDto {
    const dto = new ResellerProfileResponseDto();
    dto.user = user;
    dto.reseller = reseller;
    return dto;
  }
}
