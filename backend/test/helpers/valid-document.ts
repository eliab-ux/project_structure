/**
 * Gera um CNPJ com dígitos verificadores VÁLIDOS, a partir de uma base de 12 dígitos.
 *
 * Existe porque fixtures de teste inseridas por SQL direto contornam o domínio na ESCRITA, mas não
 * na LEITURA: assim que a linha volta pelo repositório, o mapper chama `Document.cnpj(...)`, que
 * confere os dígitos e recusa um número inventado. Um documento sintético qualquer funciona enquanto
 * o teste só faz SQL, e explode no primeiro caso que passa pelo mapper — foi exatamente o que
 * aconteceu com `InvalidDocumentException: CNPJ inválido`.
 *
 * O algoritmo é o mesmo do `Document.isValidCnpj`, aplicado ao contrário. Duplicá-lo aqui é
 * deliberado: um helper de teste que importasse a validação do domínio para gerar dados válidos
 * passaria a testar o gerador contra si mesmo.
 */
export function makeValidCnpj(base12: string): string {
  const base = base12.replace(/\D/g, '').padEnd(12, '0').slice(0, 12);

  // Dígitos todos iguais são rejeitados pelo domínio (é o placeholder clássico), então uma base
  // degenerada precisa ser perturbada antes de virar CNPJ.
  const safeBase = /^(\d)\1{11}$/.test(base)
    ? `${base.slice(0, 11)}${(Number(base[11]) + 1) % 10}`
    : base;

  const digits = safeBase.split('').map(Number);
  const weightsFirst = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weightsSecond = [6, ...weightsFirst];

  const checkDigit = (weights: number[], source: number[]): number => {
    const sum = weights.reduce((acc, weight, i) => acc + source[i] * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const first = checkDigit(weightsFirst, digits);
  const second = checkDigit(weightsSecond, [...digits, first]);

  return `${safeBase}${first}${second}`;
}
