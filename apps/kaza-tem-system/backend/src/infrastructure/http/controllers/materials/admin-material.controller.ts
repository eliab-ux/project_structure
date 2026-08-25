import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '@infrastructure/security/guards/admin.guard';
import { CreateMaterialUseCase } from '@contexts/materials/application/use-cases/create-material/create-material.use-case';
import { ListMaterialsUseCase } from '@contexts/materials/application/use-cases/list-materials/list-materials.use-case';
import { DeleteMaterialUseCase } from '@contexts/materials/application/use-cases/delete-material/delete-material.use-case';
import { CreateMaterialCommand } from '@contexts/materials/application/use-cases/create-material/create-material.command';
import { DeleteMaterialCommand } from '@contexts/materials/application/use-cases/delete-material/delete-material.command';
import { ListMaterialsQuery } from '@contexts/materials/application/use-cases/list-materials/list-materials.query';
import { CreateMaterialRequestDto } from './dto/create-material.request.dto';
import { MaterialResponseDto } from './dto/material.response.dto';

@Controller('admin/materials')
@UseGuards(AdminGuard)
export class AdminMaterialController {
  constructor(
    private readonly createMaterialUseCase: CreateMaterialUseCase,
    private readonly listMaterialsUseCase: ListMaterialsUseCase,
    private readonly deleteMaterialUseCase: DeleteMaterialUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateMaterialRequestDto): Promise<MaterialResponseDto> {
    const fileBuffer = Buffer.from(dto.fileBase64, 'base64');
    const thumbnailBuffer = dto.thumbnailBase64
      ? Buffer.from(dto.thumbnailBase64, 'base64')
      : undefined;

    const command = new CreateMaterialCommand(
      dto.title,
      dto.description ?? '',
      dto.type,
      fileBuffer,
      dto.fileName,
      dto.fileMimeType,
      thumbnailBuffer,
      dto.thumbnailName,
      dto.thumbnailMimeType,
    );

    const result = await this.createMaterialUseCase.execute(command);
    return MaterialResponseDto.fromDto(result);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async list(): Promise<MaterialResponseDto[]> {
    const materials = await this.listMaterialsUseCase.execute(new ListMaterialsQuery());
    return materials.map(MaterialResponseDto.fromDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    await this.deleteMaterialUseCase.execute(new DeleteMaterialCommand(id));
  }
}
