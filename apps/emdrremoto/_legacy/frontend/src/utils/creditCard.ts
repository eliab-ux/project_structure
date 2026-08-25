export interface CardType {
  type: string | null;
  name: string;
}

/**
 * Detecta o tipo de cartão de crédito com base no número
 * @param number - O número do cartão (com ou sem formatação)
 * @returns Um objeto contendo o tipo e o nome do cartão
 */
export const detectCardType = (number: string): CardType => {
  const cleaned = number.replace(/\s+/g, '');
  
  // Visa: começa com 4
  if (cleaned.startsWith('4')) return { type: 'visa', name: 'Visa' };
  
  // Mastercard: começa com 51-55
  if (/^5[1-5]/.test(cleaned)) return { type: 'mastercard', name: 'Mastercard' };
  
  // American Express: começa com 34 ou 37
  if (cleaned.startsWith('34') || cleaned.startsWith('37')) return { type: 'amex', name: 'American Express' };
  
  // Discover: começa com 6011, 644-649, 65 ou 622126-622925
  if (
    cleaned.startsWith('6011') ||
    cleaned.startsWith('65') ||
    /^64[4-9]/.test(cleaned) ||
    (cleaned.length >= 6 && 
     Number(cleaned.substring(0, 6)) >= 622126 && 
     Number(cleaned.substring(0, 6)) <= 622925)
  ) {
    return { type: 'discover', name: 'Discover' };
  }
  
  // Diners Club: começa com 300-305, 36 ou 38-39
  if (
    /^3(0[0-5]|[68][0-9])/.test(cleaned) ||
    cleaned.startsWith('36')
  ) {
    return { type: 'diners', name: 'Diners Club' };
  }
  
  // JCB: começa com 3528-3589
  if (
    cleaned.length >= 4 &&
    Number(cleaned.substring(0, 4)) >= 3528 &&
    Number(cleaned.substring(0, 4)) <= 3589
  ) {
    return { type: 'jcb', name: 'JCB' };
  }
  
  return { type: null, name: 'Cartão' };
};

/**
 * Formata um número de cartão de crédito adicionando espaços a cada 4 dígitos
 * @param number - O número do cartão a ser formatado
 * @returns O número do cartão formatado
 */
export const formatCreditCardNumber = (number: string): string => {
  const cleaned = number.replace(/\s+/g, '');
  const parts = [];
  
  for (let i = 0; i < cleaned.length; i += 4) {
    parts.push(cleaned.slice(i, i + 4));
  }
  
  return parts.join(' ').trim();
};

/**
 * Valida um número de cartão de crédito usando o algoritmo de Luhn
 * @param number - O número do cartão a ser validado
 * @returns true se o número for válido, false caso contrário
 */
export const validateCreditCardNumber = (number: string): boolean => {
  const cleaned = number.replace(/\s+/g, '');
  
  // Verifica se o número contém apenas dígitos e tem comprimento razoável
  if (!/^\d{13,19}$/.test(cleaned)) {
    return false;
  }
  
  // Algoritmo de Luhn
  let sum = 0;
  let shouldDouble = false;
  
  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned.charAt(i), 10);
    
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit = (digit % 10) + 1;
      }
    }
    
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  
  return sum % 10 === 0;
};
