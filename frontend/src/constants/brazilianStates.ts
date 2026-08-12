/**
 * As 27 unidades federativas, na mesma ordem e com os mesmos valores que o backend valida.
 *
 * Duplicada aqui de propósito, e vale dizer por quê — a regra deste projeto é o oposto disto. A
 * lista de UFs não muda: a última alteração no conjunto foi em 1988, com a criação do Tocantins.
 * Buscá-la por HTTP custaria uma requisição em cada abertura de formulário para receber sempre a
 * mesma resposta, e ainda faria o `<select>` de UF depender de a API estar no ar.
 *
 * O critério que separa este caso do catálogo de permissões (que NÃO é duplicado, e é buscado em
 * `/roles/catalog`): permissão nova entra a cada módulo, e uma cópia desatualizada ofereceria
 * caixinhas que não concedem nada. UF nova exigiria emenda constitucional — e, se vier, o
 * `@IsIn(BRAZILIAN_STATES)` do backend recusa qualquer valor que esta lista tenha a mais.
 */
export const BRAZILIAN_STATES = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const;

export type BrazilianState = (typeof BRAZILIAN_STATES)[number];
