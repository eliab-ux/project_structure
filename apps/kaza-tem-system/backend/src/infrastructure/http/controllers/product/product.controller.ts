import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  GetProductByIdUseCase,
  GetProductQuery,
} from '../../../../contexts/product/application/use-cases/get-product/get-product.use-case';
import {
  SearchProductsUseCase,
  SearchProductsQuery,
} from '../../../../contexts/product/application/use-cases/search-products/search-products.use-case';
import { ProductResponseDto } from './dto/product-response.dto';

@Controller('products')
export class ProductController {
  constructor(
    private readonly getProductByIdUseCase: GetProductByIdUseCase,
    private readonly searchProductsUseCase: SearchProductsUseCase,
  ) {}

  @Get(':id')
  async getProduct(@Param('id') id: string): Promise<ProductResponseDto> {
    const query = new GetProductQuery(id);
    const productDto = await this.getProductByIdUseCase.execute(query);
    return ProductResponseDto.fromDto(productDto);
  }

  @Get()
  async searchProducts(
    @Query('q') searchTerm?: string,
    @Query('category') categoryName?: string,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<ProductResponseDto[]> {
    const query = new SearchProductsQuery(
      searchTerm,
      categoryName,
      minPrice,
      maxPrice,
      limit,
      offset,
      true,
    );
    const products = await this.searchProductsUseCase.execute(query);
    return products.map(ProductResponseDto.fromDto);
  }

}
