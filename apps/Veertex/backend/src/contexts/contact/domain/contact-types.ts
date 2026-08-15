import { DomainException } from '@veertex/domain-primitives';

/**
 * Os quatro tipos de contato — §3.4 do CORE, decisão fechada.
 *
 * **Um cadastro único com tipos MÚLTIPLOS** (modelo Bling): o mesmo contato pode ser cliente e
 * fornecedor ao mesmo tempo, e o critério de aceite §7.6 exige exatamente isso — *"contato com 2
 * tipos (cliente+fornecedor) funciona nos dois fluxos sem duplicar"*.
 *
 * É o oposto de um campo `type` único, que obrigaria a cadastrar a mesma empresa duas vezes e a
 * manter os dois cadastros em dia à mão — e, quando divergissem, ninguém saberia qual está certo.
 */
export const CONTACT_TYPES = ['customer', 'supplier', 'carrier', 'reseller'] as const;

export type ContactType = (typeof CONTACT_TYPES)[number];

export const CONTACT_TYPE_LABEL: Record<ContactType, string> = {
  customer: 'Cliente',
  supplier: 'Fornecedor',
  carrier: 'Transportadora',
  reseller: 'Revendedor',
};

/** Pessoa física ou jurídica. Decide qual documento é aceito e como o formulário se comporta. */
export const PERSON_KINDS = ['individual', 'company'] as const;

export type PersonKind = (typeof PERSON_KINDS)[number];

export class InvalidContactTypesException extends DomainException {}

export class InvalidPersonKindException extends DomainException {}

/**
 * Normaliza e valida a lista de tipos.
 *
 * Ordena e remove duplicatas para que a comparação de dois contatos não dependa da ordem em que o
 * operador clicou nos checkboxes — `['supplier','customer']` e `['customer','supplier']` são o
 * mesmo contato, e um índice ou um teste que os trate como diferentes mente.
 *
 * Lista vazia é recusada: contato sem tipo nenhum não aparece em nenhuma listagem filtrada, e é o
 * cadastro que se descobre perdido meses depois.
 */
export function normalizeContactTypes(types: readonly string[]): ContactType[] {
  const unique = [...new Set(types.map((type) => type.trim().toLowerCase()))];

  const invalid = unique.filter((type) => !CONTACT_TYPES.includes(type as ContactType));
  if (invalid.length > 0) {
    throw new InvalidContactTypesException(`Tipo de contato desconhecido: ${invalid.join(', ')}.`);
  }
  if (unique.length === 0) {
    throw new InvalidContactTypesException('Informe ao menos um tipo para o contato.');
  }

  return CONTACT_TYPES.filter((type) => unique.includes(type));
}

export function parsePersonKind(value: string): PersonKind {
  const normalized = value.trim().toLowerCase();
  if (!PERSON_KINDS.includes(normalized as PersonKind)) {
    throw new InvalidPersonKindException('Pessoa deve ser "individual" ou "company".');
  }
  return normalized as PersonKind;
}
