import { Body, Controller, Get, HttpCode, Param, Post, Put, UseGuards } from '@nestjs/common';
import { FabricUseCases } from '../../../../contexts/catalog/application/use-cases/fabric.use-cases';
import { ProductTypeUseCases } from '../../../../contexts/catalog/application/use-cases/product-type.use-cases';
import {
  FabricDto,
  ProductTypeDto,
} from '../../../../contexts/catalog/application/dto/catalog.dto';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { JwtAuthGuard } from '../../../security/guards/jwt-auth.guard';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import { FabricRequestDto, ProductTypeRequestDto } from './dto/catalog-request.dto';

/**
 * Tecidos. `JwtAuthGuard` e não `AdminGuard`: a §5 diz que **os três papéis** cadastram tecido e
 * tipo de produto.
 *
 * Não é descuido de permissão, é o fluxo real — quem descobre que a malha nova cola acima de
 * 2,5 cm é o Modelista, na máquina. Obrigá-lo a pedir para o Administrativo cadastrar perderia o
 * dado no caminho, e é justamente esse dado que sustenta a próxima estimativa.
 */
@Controller('fabrics')
@UseGuards(JwtAuthGuard)
export class FabricController {
  constructor(private readonly fabricUseCases: FabricUseCases) {}

  @Get()
  async list(@CurrentUser() user: AuthTokenPayload): Promise<FabricDto[]> {
    return this.fabricUseCases.list(user.accountId);
  }

  @Post()
  @HttpCode(201)
  async create(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: FabricRequestDto,
  ): Promise<FabricDto> {
    return this.fabricUseCases.create(user.accountId, dto);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
    @Body() dto: FabricRequestDto,
  ): Promise<FabricDto> {
    return this.fabricUseCases.update(user.accountId, id, dto);
  }
}

/** Tipos de produto. Mesma regra do tecido: os três papéis cadastram (§5). */
@Controller('product-types')
@UseGuards(JwtAuthGuard)
export class ProductTypeController {
  constructor(private readonly productTypeUseCases: ProductTypeUseCases) {}

  @Get()
  async list(@CurrentUser() user: AuthTokenPayload): Promise<ProductTypeDto[]> {
    return this.productTypeUseCases.list(user.accountId);
  }

  @Post()
  @HttpCode(201)
  async create(
    @CurrentUser() user: AuthTokenPayload,
    @Body() dto: ProductTypeRequestDto,
  ): Promise<ProductTypeDto> {
    return this.productTypeUseCases.create(user.accountId, dto.name);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthTokenPayload,
    @Param('id') id: string,
    @Body() dto: ProductTypeRequestDto,
  ): Promise<ProductTypeDto> {
    return this.productTypeUseCases.update(user.accountId, id, dto.name);
  }
}
