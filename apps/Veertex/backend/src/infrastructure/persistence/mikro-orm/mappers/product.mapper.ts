import { Injectable } from '@nestjs/common';
import { Product } from '../../../../contexts/product/domain/entities/product.entity';
import {
  CommercialUnit,
  ProductCondition,
  ProductFormat,
  ProductKind,
  ProductOrigin,
} from '../../../../contexts/product/domain/product-types';
import { ProductOrmEntity } from '../entities/product-orm.entity';

/**
 * Domínio ↔ ORM do produto.
 *
 * ## `decimal` chega como STRING, e converter é o trabalho deste arquivo
 *
 * O driver do Postgres devolve `numeric` como string — de propósito, porque `numeric` cabe mais que o
 * `number` do JavaScript. Converter na leitura e formatar na escrita concentra isso aqui: se cada
 * lugar fizesse `Number(x)` na hora, um deles usaria `parseFloat` num campo de 3 casas e o valor
 * mudaria de significado no caminho.
 */
@Injectable()
export class ProductMapper {
  toDomain(orm: ProductOrmEntity): Product {
    return Product.restore({
      id: orm.id,
      accountId: orm.accountId,
      name: orm.name,
      sku: orm.sku,
      format: orm.format as ProductFormat,
      kind: orm.kind as ProductKind,
      unit: orm.unit as CommercialUnit,
      condition: orm.condition as ProductCondition,
      basePrice: numero(orm.basePrice),
      brand: orm.brand,
      categoryPath: orm.categoryPath,
      tags: [...(orm.tags ?? [])],
      ownProduction: orm.ownProduction,
      shelfLifeDays: orm.shelfLifeDays,
      barcode: orm.barcode,
      dun14: orm.dun14,
      shortDescription: orm.shortDescription,
      longDescription: orm.longDescription,
      externalUrl: orm.externalUrl,
      videoUrl: orm.videoUrl,
      measures: {
        netWeightKg: numero(orm.netWeightKg),
        grossWeightKg: numero(orm.grossWeightKg),
        widthCm: numero(orm.widthCm),
        heightCm: numero(orm.heightCm),
        lengthCm: numero(orm.lengthCm),
        itemsPerBox: orm.itemsPerBox,
      },
      stockParams: {
        minimumQuantity: numero(orm.minimumQuantity),
        maximumQuantity: numero(orm.maximumQuantity),
        location: orm.stockLocation,
      },
      tax: {
        origin: (orm.taxOrigin as ProductOrigin | null) ?? null,
        ncm: orm.ncm,
        cest: orm.cest,
        itemType: orm.itemType,
        approximateTaxPercent: numero(orm.approximateTaxPercent),
        taxGroup: orm.taxGroup,
        taxableBarcode: orm.taxableBarcode,
      },
      /*
       * As linhas mortas (soft-delete) são filtradas AQUI, e não só pelo filtro global.
       *
       * A coleção pode vir carregada de uma consulta anterior no mesmo EntityManager, e nesse caso o
       * filtro `notDeleted` já foi aplicado — mas confiar nisso significaria que a corretude do
       * mapper depende de como alguém buscou o produto. Filtrar de novo é barato e não depende de
       * nada.
       */
      suppliers: orm.suppliers
        .getItems()
        .filter((entry) => entry.deletedAt === null)
        .map((entry) => ({
          contactId: entry.contact.id,
          supplierDescription: entry.supplierDescription,
          supplierSku: entry.supplierSku,
          cost: numero(entry.cost),
          isDefault: entry.isDefault,
        })),
      active: orm.active,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  /** Aplica os escalares do domínio na linha existente — usado na edição. */
  applyScalars(orm: ProductOrmEntity, product: Product): void {
    orm.name = product.name;
    orm.sku = product.sku;
    // `format` NÃO é copiado: ele é imutável no domínio, e reescrevê-lo aqui abriria por baixo o
    // caminho que a entidade fecha por cima.
    orm.kind = product.kind;
    orm.unit = product.unit;
    orm.condition = product.condition;
    orm.basePrice = dinheiro(product.basePrice);
    orm.brand = product.brand;
    orm.categoryPath = product.categoryPath;
    orm.tags = [...product.tags];
    orm.ownProduction = product.ownProduction;
    orm.shelfLifeDays = product.shelfLifeDays;
    orm.barcode = product.barcode;
    orm.dun14 = product.dun14;
    orm.shortDescription = product.shortDescription;
    orm.longDescription = product.longDescription;
    orm.externalUrl = product.externalUrl;
    orm.videoUrl = product.videoUrl;
    orm.netWeightKg = medida(product.measures.netWeightKg);
    orm.grossWeightKg = medida(product.measures.grossWeightKg);
    orm.widthCm = medida(product.measures.widthCm);
    orm.heightCm = medida(product.measures.heightCm);
    orm.lengthCm = medida(product.measures.lengthCm);
    orm.itemsPerBox = product.measures.itemsPerBox;
    orm.minimumQuantity = medida(product.stockParams.minimumQuantity);
    orm.maximumQuantity = medida(product.stockParams.maximumQuantity);
    orm.stockLocation = product.stockParams.location;
    orm.taxOrigin = product.tax.origin;
    orm.ncm = product.tax.ncm;
    orm.cest = product.tax.cest;
    orm.itemType = product.tax.itemType;
    orm.approximateTaxPercent = dinheiro(product.tax.approximateTaxPercent);
    orm.taxGroup = product.tax.taxGroup;
    orm.taxableBarcode = product.tax.taxableBarcode;
    orm.active = product.active;
    orm.updatedAt = product.updatedAt;
  }
}

function numero(value: string | null): number | null {
  return value === null || value === undefined ? null : Number(value);
}

/** Duas casas — dinheiro e percentual. */
function dinheiro(value: number | null): string | null {
  return value === null ? null : value.toFixed(2);
}

/** Três casas — peso e dimensão. 0,125 kg precisa sobreviver ao arredondamento. */
function medida(value: number | null): string | null {
  return value === null ? null : value.toFixed(3);
}
