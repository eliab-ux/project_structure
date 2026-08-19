import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CreateProductCommand,
  CreateProductUseCase,
} from '../../../../contexts/product/application/use-cases/create-product/create-product.use-case';
import {
  UpdateProductCommand,
  UpdateProductUseCase,
} from '../../../../contexts/product/application/use-cases/update-product/update-product.use-case';
import {
  ListProductsQuery,
  ListProductsUseCase,
} from '../../../../contexts/product/application/use-cases/list-products/list-products.use-case';
import {
  GetProductQuery,
  GetProductUseCase,
} from '../../../../contexts/product/application/use-cases/get-product/get-product.use-case';
import { ProductDto } from '../../../../contexts/product/application/dto/product.dto';
import {
  PRODUCT_FIELD_CATALOG,
  ProductFieldDefinition,
} from '../../../../contexts/product/domain/product-field.catalog';
import {
  COMMERCIAL_UNITS,
  CREATABLE_PRODUCT_FORMATS,
  PRODUCT_CONDITION_LABEL,
  PRODUCT_KIND_LABEL,
  PRODUCT_ORIGIN_LABEL,
} from '../../../../contexts/product/domain/product-types';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { PERMISSIONS } from '../../../../contexts/role/domain/permissions.catalog';
import { PermissionGuard } from '../../../security/guards/permission.guard';
import { RequirePermission } from '../../../security/decorators/require-permission.decorator';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import {
  CreateProductRequestDto,
  ListProductsQueryDto,
  UpdateProductRequestDto,
} from './dto/product-request.dto';

/**
 * Produtos — §3.5 do CORE.
 *
 * **Sem `@RequireModule`**: produto é CORE. Ele existe em toda conta, independentemente de plano ou
 * de módulo contratado — como empresas, usuários, papéis e contatos. O que os módulos acrescentam é
 * o que FAZER com o produto (vender no VND, estocar no EST, emitir nota no FIS), nunca o direito de
 * cadastrá-lo.
 */
@Controller('products')
@UseGuards(PermissionGuard)
export class ProductController {
  constructor(
    private readonly createProductUseCase: CreateProductUseCase,
    private readonly updateProductUseCase: UpdateProductUseCase,
    private readonly listProductsUseCase: ListProductsUseCase,
    private readonly getProductUseCase: GetProductUseCase,
  ) {}

  @Get()
  @RequirePermission(PERMISSIONS.products.read)
  async list(
    @Query() query: ListProductsQueryDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<ProductDto[]> {
    return this.listProductsUseCase.execute(
      new ListProductsQuery(actor.modules ?? [], {
        search: query.search ?? null,
        kind: query.kind ?? null,
        categoryPath: query.categoryPath ?? null,
        includeInactive: query.includeInactive ?? false,
      }),
    );
  }

  /**
   * O catálogo de campos e as listas fechadas, para a tela montar o formulário sem manter cópia.
   *
   * Antes de `:id`, senão o roteador trataria "field-catalog" como um id e o `ParseUUIDPipe`
   * responderia 400 para uma rota que existe.
   *
   * As listas (unidades, origens, tipos, condições) viajam junto porque são **validadas no
   * servidor**: uma cópia no frontend divergiria na primeira sigla nova, e o sintoma seria a tela
   * oferecer uma opção que a API recusa.
   */
  @Get('field-catalog')
  @RequirePermission(PERMISSIONS.products.read)
  fieldCatalog(): {
    fields: ProductFieldDefinition[];
    units: string[];
    origins: { code: string; label: string }[];
    kinds: { code: string; label: string }[];
    conditions: { code: string; label: string }[];
    creatableFormats: string[];
  } {
    return {
      fields: [...PRODUCT_FIELD_CATALOG],
      units: [...COMMERCIAL_UNITS],
      origins: Object.entries(PRODUCT_ORIGIN_LABEL).map(([code, label]) => ({ code, label })),
      kinds: Object.entries(PRODUCT_KIND_LABEL).map(([code, label]) => ({ code, label })),
      conditions: Object.entries(PRODUCT_CONDITION_LABEL).map(([code, label]) => ({ code, label })),
      // A tela não oferece kit nem variação porque o servidor não os cria. Uma opção na tela que a
      // API recusa é a definição de casca.
      creatableFormats: [...CREATABLE_PRODUCT_FORMATS],
    };
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.products.read)
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<ProductDto> {
    return this.getProductUseCase.execute(new GetProductQuery(id, actor.modules ?? []));
  }

  @Post()
  @RequirePermission(PERMISSIONS.products.create)
  async create(
    @Body() dto: CreateProductRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<ProductDto> {
    // `accountId` e `modules` do TOKEN, nunca do corpo — é por isso que nenhum DTO os tem.
    return this.createProductUseCase.execute(
      new CreateProductCommand(actor.accountId, actor.modules ?? [], dto),
    );
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.products.update)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<ProductDto> {
    return this.updateProductUseCase.execute(
      new UpdateProductCommand(id, actor.modules ?? [], dto),
    );
  }
}
