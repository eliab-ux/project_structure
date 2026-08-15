/**
 * O CATÁLOGO DE CAMPOS DO CONTATO — fixo em código, como o §3.6 do CORE exige.
 *
 * > *"Catálogo de campos por entidade é FIXO em código (colunas reais); a config só governa
 * > exibição/obrigatoriedade — **nunca cria campo novo**."*
 *
 * É por isso que o Contato pôde ser construído **sem** `field_config`: as colunas existem
 * independentemente dele. O que `field_config` acrescentará é a capacidade de a CONTA sobrescrever
 * `visible`, `required`, `label` e `order` — nunca a de inventar campo.
 *
 * ## O default é DECLARADO, nunca inferido (decisão de Eliab, 14/08/2026)
 *
 * A pergunta que o §3.6 não respondia: o que acontece com um campo que não tem linha de config?
 * Duas leituras davam telas opostas — "não configurado = visível" encheria o formulário de Suframa e
 * GLN para toda conta; "não configurado = oculto" esconderia campos sem ninguém saber por quê.
 *
 * A decisão foi a segunda, **com o default escrito campo a campo aqui**. A diferença entre "oculto
 * por regra implícita" e "oculto porque esta linha diz `defaultVisible: false`" é a diferença entre
 * um default silencioso e uma decisão revisável: dá para ler, dá para discordar, e um `git blame`
 * responde quem escolheu.
 *
 * ## Como isto é consumido HOJE, e como será depois
 *
 * Hoje o frontend lê este catálogo (via `GET /contacts/field-catalog`) e monta o formulário. Quando
 * `field_config` existir, o backend passará a devolver o catálogo **já mesclado** com a configuração
 * da conta — mesma rota, mesmo formato, e a tela não muda. É o motivo de o contrato já ter os campos
 * `visible` e `required` em vez de só a lista de nomes.
 */

/** Campo que sempre existe e nunca some — a config poderá mudar rótulo e ordem, nunca ocultar. */
export type FieldRule = 'base' | 'optional';

export interface ContactFieldDefinition {
  /** O nome da propriedade no DTO, e a chave que `field_config` usará. */
  field: string;
  label: string;
  rule: FieldRule;
  /**
   * O default de exibição, na ausência de configuração da conta.
   *
   * `false` não significa "campo morto": significa "existe como coluna, não aparece no formulário
   * até alguém pedir". Suframa é real para o cliente que exporta e ruído para os outros 95%.
   */
  defaultVisible: boolean;
  /** Obrigatório por REGRA DE DOMÍNIO — a config da conta poderá exigir mais, nunca menos. */
  defaultRequired: boolean;
  /** Texto de apoio que a tela mostra abaixo do campo. Ver `creditLimit`. */
  hint?: string;
}

export const CONTACT_FIELD_CATALOG: readonly ContactFieldDefinition[] = [
  // ── Identificação ────────────────────────────────────────────────────────────────────────────
  { field: 'types', label: 'Tipos', rule: 'base', defaultVisible: true, defaultRequired: true },
  {
    field: 'personKind',
    label: 'Pessoa',
    rule: 'base',
    defaultVisible: true,
    defaultRequired: true,
  },
  {
    field: 'legalName',
    label: 'Nome / Razão social',
    rule: 'base',
    defaultVisible: true,
    defaultRequired: true,
  },
  {
    field: 'tradeName',
    label: 'Nome fantasia',
    rule: 'base',
    defaultVisible: true,
    defaultRequired: false,
  },
  {
    field: 'document',
    label: 'CPF / CNPJ',
    rule: 'base',
    defaultVisible: true,
    defaultRequired: false,
  },
  {
    field: 'stateRegistration',
    label: 'Inscrição Estadual',
    rule: 'base',
    defaultVisible: true,
    defaultRequired: false,
  },
  { field: 'code', label: 'Código', rule: 'base', defaultVisible: true, defaultRequired: false },

  // ── Comercial ────────────────────────────────────────────────────────────────────────────────
  {
    field: 'creditLimit',
    label: 'Limite de crédito',
    rule: 'base',
    defaultVisible: true,
    defaultRequired: false,
    /*
     * O AVISO VIVE AQUI, e não só num comentário de código (correção de Eliab, 14/08/2026).
     *
     * O §3.4 diz que o limite "bloqueia venda acima — módulos VND/COB aplicam", e esses módulos não
     * existem. Guardar o número sem dizer nada seria uma promessa: quem preenche R$ 5.000 acredita
     * que o sistema vai impedir a venda de R$ 6.000. Ninguém lê comentário de código; o operador lê
     * a tela. Por isso o texto viaja no CONTRATO — some no dia em que o VND aplicar de verdade, e a
     * remoção desta linha é o lembrete de que o comportamento mudou.
     */
    hint: 'Registrado para consulta. Ainda NÃO bloqueia venda — o bloqueio chega com o módulo de Vendas.',
  },
  {
    field: 'notes',
    label: 'Observações',
    rule: 'base',
    defaultVisible: true,
    defaultRequired: false,
  },

  // ── Opcionais: colunas reais, ocultas até a conta pedir ───────────────────────────────────────
  {
    field: 'municipalRegistration',
    label: 'Inscrição Municipal',
    rule: 'optional',
    defaultVisible: false,
    defaultRequired: false,
  },
  {
    field: 'suframa',
    label: 'Suframa',
    rule: 'optional',
    defaultVisible: false,
    defaultRequired: false,
  },
  { field: 'gln', label: 'GLN', rule: 'optional', defaultVisible: false, defaultRequired: false },
  {
    field: 'pixKey',
    label: 'Chave Pix',
    rule: 'optional',
    defaultVisible: false,
    defaultRequired: false,
  },
  {
    field: 'website',
    label: 'Site',
    rule: 'optional',
    defaultVisible: false,
    defaultRequired: false,
  },
] as const;

/*
 * ⚠️ O QUE ESTÁ FORA DESTE CATÁLOGO, e por quê. Cada ausência é decisão, não esquecimento:
 *
 *  - **vendedor vinculado (carteirização)** — fora POR INTEIRO, nem a coluna. Ver o docblock da
 *    entidade `Contact`: visibilidade de dado neste sistema mora em RLS e guard, e coluna sem o
 *    filtro é a pior configuração possível, porque alguém depois supõe que ela restringe algo.
 *  - **tabela de preço** — `Product` não existe. FK para tabela inexistente é pior que ausência.
 *  - **lat/lng do endereço** — as colunas EXISTEM (nullable) na tabela de endereço; a
 *    geocodificação assíncrona exige BullMQ e Redis, que são dependências novas. Coluna nula é dado
 *    ausente, não promessa.
 *  - **campos de revendedor** (% de comissão, rota, representante) — o §3.4 remete ao
 *    `04_Veertex_Rot.md`, que não foi lido. Não se implementa requisito por dedução.
 */

export function isKnownContactField(field: string): boolean {
  return CONTACT_FIELD_CATALOG.some((definition) => definition.field === field);
}
