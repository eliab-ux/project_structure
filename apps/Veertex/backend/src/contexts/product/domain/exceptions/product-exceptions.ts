import { DomainException } from '@gitspread/domain-primitives';

export class ProductNotFoundException extends DomainException {
  constructor(id: string) {
    // O id só é conhecido por quem já tem acesso à conta, e o escopo de tenant faz um id de outra
    // conta responder "não encontrado" do mesmo jeito.
    super(`Produto ${id} não encontrado.`);
  }
}

/**
 * SKU repetido na mesma conta.
 *
 * O §3.5 diz "SKU (manual/sequencial)". A numeração ficou **manual** (decisão de Eliab, 19/08/2026,
 * a mesma do código do Contato), e manual sem unicidade é convite a dois produtos com o mesmo
 * código — que é o começo de duas verdades sobre o mesmo item.
 */
export class DuplicateProductSkuException extends DomainException {
  constructor(sku: string) {
    super(`Já existe um produto com o SKU ${sku} nesta conta.`);
  }
}

export class DuplicateProductBarcodeException extends DomainException {
  constructor(barcode: string) {
    super(`Já existe um produto com o GTIN/EAN ${barcode} nesta conta.`);
  }
}

export class InvalidProductNameException extends DomainException {}

export class InvalidProductPriceException extends DomainException {}

export class InvalidProductMeasureException extends DomainException {}

export class InvalidProductStockParamsException extends DomainException {}

/** Fornecedor do produto precisa ser um contato com o tipo `supplier`. */
export class SupplierMustBeContactException extends DomainException {}

export class DuplicateDefaultSupplierException extends DomainException {
  constructor() {
    super('Apenas um fornecedor pode ser o padrão do produto.');
  }
}

export class DuplicateProductSupplierException extends DomainException {
  constructor() {
    super('O mesmo fornecedor não pode ser vinculado duas vezes ao produto.');
  }
}
