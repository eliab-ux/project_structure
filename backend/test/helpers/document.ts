/**
 * Gera CNPJ fictício com dígito verificador VÁLIDO.
 *
 * Existe porque o VO `Document` valida os dois dígitos no construtor, e um número inventado à mão
 * derruba tudo que dependa dele. Foi exatamente o que aconteceu com o `44555666000172` do
 * `seed-dev.cli.ts`: o seed morria com "CNPJ inválido" antes de criar a segunda conta.
 *
 * Cada spec de execução usa uma BASE própria (os 12 primeiros dígitos), para que dois testes nunca
 * disputem a mesma linha — a unicidade do documento é restrição de banco, e colisão entre specs
 * produziria falha intermitente com cara de bug de produto.
 */
export function cnpjWithCheckDigits(base12: string): string {
  if (!/^\d{12}$/.test(base12)) {
    throw new Error(`Base de CNPJ deve ter exatamente 12 dígitos, recebeu "${base12}".`);
  }

  const digit = (digits: number[], weights: number[]): number => {
    const sum = digits.reduce((acc, value, index) => acc + value * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const digits = base12.split('').map(Number);
  const first = digit(digits, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = digit([...digits, first], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return `${base12}${first}${second}`;
}
