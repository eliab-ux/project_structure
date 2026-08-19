import { SupplierLookupPort } from '../ports/output/supplier-lookup.port';
import { ProductSupplierEntry } from '../../domain/entities/product.entity';

/**
 * Confere que todo fornecedor do produto é um contato existente **com o tipo `supplier`**, e devolve
 * os nomes para o DTO.
 *
 * Compartilhada entre criação e edição por um motivo específico: se cada use case tivesse a sua, a
 * edição poderia aceitar um vínculo que a criação recusa — e a porta mais frouxa é a que o dado ruim
 * encontra. É a mesma razão de a Mesa despachar para os mesmos use cases do controller.
 *
 * A validação vive no use case, e não na entidade, porque exige o banco: saber se um id é um contato
 * fornecedor não é invariante que a entidade possa verificar sozinha.
 */
export async function validarFornecedores(
  lookup: SupplierLookupPort,
  suppliers: readonly ProductSupplierEntry[],
  recusar: (mensagem: string) => never,
): Promise<Map<string, string>> {
  if (suppliers.length === 0) {
    return new Map();
  }

  const encontrados = await lookup.findByIds(suppliers.map((entry) => entry.contactId));
  const nomes = new Map<string, string>();

  for (const entry of suppliers) {
    const info = encontrados.get(entry.contactId);
    if (!info) {
      // Mensagem sem revelar se o id existe em OUTRA conta: o escopo de tenant já faz um id de
      // outra conta se comportar como inexistente, e a mensagem não deve desfazer isso.
      recusar(`Fornecedor ${entry.contactId} não encontrado.`);
    }
    if (!info.isSupplier) {
      recusar(
        `O contato "${info.name}" não está marcado como Fornecedor. ` +
          'Ajuste os tipos do contato antes de vinculá-lo ao produto.',
      );
    }
    nomes.set(entry.contactId, info.name);
  }

  return nomes;
}
