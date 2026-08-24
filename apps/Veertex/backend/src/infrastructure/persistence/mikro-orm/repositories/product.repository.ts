import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import {
  ListProductsFilter,
  ProductRepositoryPort,
} from '../../../../contexts/product/application/ports/output/product-repository.port';
import { Product } from '../../../../contexts/product/domain/entities/product.entity';
import { ProductId } from '../../../../contexts/product/domain/value-objects/product-id.vo';
import { ProductOrmEntity } from '../entities/product-orm.entity';
import { ProductSupplierOrmEntity } from '../entities/product-supplier-orm.entity';
import { ContactOrmEntity } from '../entities/contact-orm.entity';
import { ProductMapper } from '../mappers/product.mapper';

/**
 * Repositório de produtos.
 *
 * Como nos demais: **nenhum método recebe `accountId`**. O filtro global do MikroORM e a policy de RLS
 * escopam toda leitura, e não há o que esquecer de passar.
 */
@Injectable()
export class MikroOrmProductRepository implements ProductRepositoryPort {
  private readonly logger = new Logger(MikroOrmProductRepository.name);

  constructor(
    private readonly em: EntityManager,
    private readonly mapper: ProductMapper,
  ) {}

  async findById(id: ProductId): Promise<Product | null> {
    const orm = await this.em.findOne(
      ProductOrmEntity,
      { id: id.value },
      // Os fornecedores vêm na mesma consulta: o DTO os expõe, e buscá-los depois seria N+1 no
      // caminho mais usado da tela de edição.
      { populate: ['suppliers', 'suppliers.contact'] },
    );
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findBySku(sku: string, exceptId?: ProductId): Promise<Product | null> {
    const orm = await this.em.findOne(ProductOrmEntity, {
      sku,
      ...(exceptId ? { id: { $ne: exceptId.value } } : {}),
    });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findByBarcode(barcode: string, exceptId?: ProductId): Promise<Product | null> {
    const orm = await this.em.findOne(ProductOrmEntity, {
      barcode,
      ...(exceptId ? { id: { $ne: exceptId.value } } : {}),
    });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async list(filter: ListProductsFilter): Promise<Product[]> {
    const termo = filter.search?.trim();
    const digitos = termo?.replace(/\D/g, '') ?? '';

    const rows = await this.em.find(
      ProductOrmEntity,
      {
        ...(filter.includeInactive ? {} : { active: true }),
        ...(filter.kind ? { kind: filter.kind } : {}),
        // Prefixo, não igualdade: sem a árvore, filtrar por "Ferramentas" tem de trazer
        // "Ferramentas > Manuais". É a semântica que a árvore terá, antecipada no texto.
        ...(filter.categoryPath ? { categoryPath: { $ilike: `${filter.categoryPath}%` } } : {}),
        ...(termo
          ? {
              $or: [
                { name: { $ilike: `%${termo}%` } },
                { sku: { $ilike: `%${termo}%` } },
                { brand: { $ilike: `%${termo}%` } },
                { categoryPath: { $ilike: `%${termo}%` } },
                // GTIN é buscado por DÍGITOS: quem lê o código de barras com leitor pode receber
                // separadores, e comparar o texto cru não acharia nada.
                ...(digitos.length >= 3 ? [{ barcode: { $like: `%${digitos}%` } }] : []),
              ],
            }
          : {}),
      },
      { orderBy: { name: 'ASC' } },
    );

    // Linha que falha ao MAPEAR é pulada com ERRO no log (nomeando a linha) — uma linha
    // envenenada não pode negar serviço da lista inteira (defeito real, 24/08/2026: um produto
    // irreconstituível derrubava GET /products com 500 para a conta toda).
    const mapped: Product[] = [];
    for (const row of rows) {
      try {
        mapped.push(this.mapper.toDomain(row));
      } catch (error) {
        this.logger.error(
          `Produto ${row.id} pulado na listagem: ${(error as Error)?.message ?? 'erro de mapeamento'}`,
          (error as Error)?.stack,
        );
      }
    }
    return mapped;
  }

  /**
   * Grava o produto e **sincroniza os fornecedores**.
   *
   * `em.upsert` não serve: ele resolve escalares e ignora filhos, e o resultado seria um produto
   * salvo com a lista de fornecedores antiga.
   *
   * A sincronização é por SUBSTITUIÇÃO — as linhas atuais saem, as novas entram —, que é a semântica
   * que o formulário produz: a tela manda a lista inteira que o usuário está vendo.
   *
   * **As que saem levam `deleted_at`, não DELETE.** `orphanRemoval` emitiria DELETE, e o papel de
   * runtime não tem DELETE — invariante que o `verify:isolation` verifica, e que existe para que uma
   * falha na aplicação não consiga apagar dado de cliente. O custo é lixo invisível: um produto
   * editado muitas vezes deixa linhas mortas, filtradas na leitura. Enfraquecer o privilégio para
   * facilitar a sincronização de um formulário seria trocar proteção real por conveniência.
   *
   * Cada filho recebe `accountId` explicitamente. Sem isso a coluna iria nula e a policy de RLS
   * recusaria o INSERT — comportamento correto da policy, e o bug seria nosso.
   */
  async save(product: Product): Promise<Product> {
    /*
     * Tipo explícito, e não inferido: `findOne` com `populate` devolve `Loaded<...>`, um tipo mais
     * estreito que não aceita a entidade recém-criada do `else`. Sem a anotação, o TypeScript
     * empurraria para um cast — e cast aqui esconderia justamente o caso em que a coleção não está
     * carregada, que é o defeito que a linha seguinte previne.
     */
    let orm: ProductOrmEntity | null = await this.em.findOne(
      ProductOrmEntity,
      { id: product.id.value },
      { populate: ['suppliers', 'suppliers.contact'] },
    );

    if (!orm) {
      orm = this.em.create(ProductOrmEntity, {
        id: product.id.value,
        accountId: product.accountId,
        name: product.name,
        sku: product.sku,
        format: product.format,
        kind: product.kind,
        unit: product.unit,
        condition: product.condition,
        basePrice: product.basePrice === null ? null : product.basePrice.toFixed(2),
        brand: product.brand,
        categoryPath: product.categoryPath,
        tags: [...product.tags],
        ownProduction: product.ownProduction,
        shelfLifeDays: product.shelfLifeDays,
        barcode: product.barcode,
        dun14: product.dun14,
        shortDescription: product.shortDescription,
        longDescription: product.longDescription,
        externalUrl: product.externalUrl,
        videoUrl: product.videoUrl,
        netWeightKg: tresCasas(product.measures.netWeightKg),
        grossWeightKg: tresCasas(product.measures.grossWeightKg),
        widthCm: tresCasas(product.measures.widthCm),
        heightCm: tresCasas(product.measures.heightCm),
        lengthCm: tresCasas(product.measures.lengthCm),
        itemsPerBox: product.measures.itemsPerBox,
        minimumQuantity: tresCasas(product.stockParams.minimumQuantity),
        maximumQuantity: tresCasas(product.stockParams.maximumQuantity),
        stockLocation: product.stockParams.location,
        taxOrigin: product.tax.origin,
        ncm: product.tax.ncm,
        cest: product.tax.cest,
        itemType: product.tax.itemType,
        approximateTaxPercent:
          product.tax.approximateTaxPercent === null
            ? null
            : product.tax.approximateTaxPercent.toFixed(2),
        taxGroup: product.tax.taxGroup,
        taxableBarcode: product.tax.taxableBarcode,
        active: product.active,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      });
      this.em.persist(orm);
    } else {
      this.mapper.applyScalars(orm, product);
    }

    const agora = new Date();
    /*
     * Garante a coleção carregada antes de percorrê-la.
     *
     * No caminho de criação, `orm` acabou de ser construído e a coleção já é inicializada (vazia). No
     * de edição, ela veio pelo `populate`. Este `if` cobre o terceiro caso, que é o que morde:
     * `orm` vindo do cache de identidade do EntityManager — buscado antes, na mesma requisição, por
     * uma consulta SEM populate. Aí `getItems()` devolveria vazio, nenhuma linha antiga seria
     * marcada como removida, e o produto ficaria com fornecedor duplicado.
     */
    if (!orm.suppliers.isInitialized()) {
      await this.em.populate(orm, ['suppliers', 'suppliers.contact']);
    }

    for (const antiga of orm.suppliers.getItems()) {
      antiga.deletedAt = agora;
    }

    for (const entry of product.suppliers) {
      orm.suppliers.add(
        this.em.create(ProductSupplierOrmEntity, {
          id: randomUUID(),
          accountId: product.accountId,
          product: orm,
          // `getReference` em vez de buscar o contato: o use case JÁ validou que ele existe e é
          // fornecedor, e uma segunda consulta aqui só repetiria o trabalho.
          contact: this.em.getReference(ContactOrmEntity, entry.contactId),
          supplierDescription: entry.supplierDescription,
          supplierSku: entry.supplierSku,
          cost: entry.cost === null ? null : entry.cost.toFixed(2),
          isDefault: entry.isDefault,
          createdAt: agora,
          updatedAt: agora,
          deletedAt: null,
        }),
      );
    }

    await this.em.flush();
    return this.mapper.toDomain(orm);
  }
}

function tresCasas(value: number | null): string | null {
  return value === null ? null : value.toFixed(3);
}
