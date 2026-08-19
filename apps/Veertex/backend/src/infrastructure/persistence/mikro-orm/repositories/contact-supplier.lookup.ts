import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import {
  SupplierInfo,
  SupplierLookupPort,
} from '../../../../contexts/product/application/ports/output/supplier-lookup.port';
import { ContactOrmEntity } from '../entities/contact-orm.entity';

/**
 * O adapter do `SupplierLookupPort` — lê a tabela de contatos e responde só o que o Produto pediu.
 *
 * Vive na infraestrutura de propósito: é aqui que os dois contextos podem se encontrar sem que o
 * Produto passe a depender do módulo do Contato. O domínio do Produto conhece um port com um método;
 * quem sabe que aquilo é uma tabela de contatos é este arquivo.
 *
 * A consulta é escopada pelo tenant como qualquer outra (filtro global + RLS), então um id de outra
 * conta simplesmente não vem — e o use case o trata como inexistente, que é a resposta correta e não
 * revela que ele existe em outro lugar.
 */
@Injectable()
export class ContactSupplierLookup implements SupplierLookupPort {
  constructor(private readonly em: EntityManager) {}

  async findByIds(contactIds: readonly string[]): Promise<Map<string, SupplierInfo>> {
    if (contactIds.length === 0) {
      return new Map();
    }

    const rows = await this.em.find(
      ContactOrmEntity,
      { id: { $in: [...new Set(contactIds)] } },
      // Só as três colunas necessárias. `fields` não é micro-otimização aqui: sem ele, a consulta
      // traria o contato inteiro — inclusive o limite de crédito e as observações — para responder
      // "este id é fornecedor?".
      { fields: ['id', 'legalName', 'tradeName', 'types'] },
    );

    return new Map(
      rows.map((row) => [
        row.id,
        {
          // O nome de exibição segue a mesma regra do contato: fantasia quando existe.
          name: row.tradeName ?? row.legalName,
          isSupplier: (row.types ?? []).includes('supplier'),
        },
      ]),
    );
  }
}
