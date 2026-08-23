/**
 * Valor monetário POR EXTENSO em pt-BR (§3.1 do 04 — a promissória impressa exige). Função pura,
 * cobre até centenas de milhões (muito além de qualquer promissória de rota).
 */

const UNIDADES = [
  '',
  'um',
  'dois',
  'três',
  'quatro',
  'cinco',
  'seis',
  'sete',
  'oito',
  'nove',
  'dez',
  'onze',
  'doze',
  'treze',
  'quatorze',
  'quinze',
  'dezesseis',
  'dezessete',
  'dezoito',
  'dezenove',
];
const DEZENAS = [
  '',
  '',
  'vinte',
  'trinta',
  'quarenta',
  'cinquenta',
  'sessenta',
  'setenta',
  'oitenta',
  'noventa',
];
const CENTENAS = [
  '',
  'cento',
  'duzentos',
  'trezentos',
  'quatrocentos',
  'quinhentos',
  'seiscentos',
  'setecentos',
  'oitocentos',
  'novecentos',
];

function trioPorExtenso(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(CENTENAS[c]);
  if (resto > 0) {
    if (resto < 20) {
      partes.push(UNIDADES[resto]);
    } else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u > 0 ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
    }
  }
  return partes.join(' e ');
}

function inteiroPorExtenso(n: number): string {
  if (n === 0) return 'zero';
  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (milhoes > 0) {
    partes.push(milhoes === 1 ? 'um milhão' : `${trioPorExtenso(milhoes)} milhões`);
  }
  if (milhares > 0) {
    partes.push(milhares === 1 ? 'mil' : `${trioPorExtenso(milhares)} mil`);
  }
  if (resto > 0) {
    partes.push(trioPorExtenso(resto));
  }
  // "e" antes do último bloco quando ele é < 100 ou centena exata (norma usual do extenso).
  if (partes.length > 1 && resto > 0 && (resto < 100 || resto % 100 === 0)) {
    const ultimo = partes.pop() as string;
    return `${partes.join(', ')} e ${ultimo}`;
  }
  return partes.join(', ');
}

/** Ex.: 3692.91 → "três mil, seiscentos e noventa e dois reais e noventa e um centavos". */
export function valorPorExtenso(valor: number): string {
  const total = Math.round((valor + Number.EPSILON) * 100);
  const reais = Math.floor(total / 100);
  const centavos = total % 100;

  // Milhão exato pede "de": "um milhão DE reais" (norma do extenso).
  const conectorReais = reais >= 1_000_000 && reais % 1_000_000 === 0 ? 'de ' : '';
  const parteReais =
    reais === 0
      ? ''
      : `${inteiroPorExtenso(reais)} ${conectorReais}${reais === 1 ? 'real' : 'reais'}`;
  const parteCentavos =
    centavos === 0
      ? ''
      : `${inteiroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`;

  if (parteReais && parteCentavos) return `${parteReais} e ${parteCentavos}`;
  if (parteReais) return parteReais;
  if (parteCentavos) return parteCentavos;
  return 'zero real';
}
