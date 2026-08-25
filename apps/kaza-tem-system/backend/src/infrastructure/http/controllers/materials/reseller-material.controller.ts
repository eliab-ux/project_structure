import { Controller, Get, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ResellerGuard } from '@infrastructure/security/guards/reseller.guard';
import { ListMaterialsUseCase } from '@contexts/materials/application/use-cases/list-materials/list-materials.use-case';
import { ListMaterialsQuery } from '@contexts/materials/application/use-cases/list-materials/list-materials.query';
import { MaterialResponseDto } from './dto/material.response.dto';

@Controller('materials')
@UseGuards(ResellerGuard)
export class ResellerMaterialController {
  constructor(private readonly listMaterialsUseCase: ListMaterialsUseCase) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async list(): Promise<MaterialResponseDto[]> {
    const materials = await this.listMaterialsUseCase.execute(new ListMaterialsQuery(true));
    return materials.map(MaterialResponseDto.fromDto);
  }
}
