/**
 * Formata uma data de expiração no formato MM/AA
 * @param value - A data no formato MM/AA ou MMAA
 * @returns A data formatada como MM/AA
 */
export const formatExpiryDate = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  
  if (cleaned.length >= 3) {
    return `${cleaned.substring(0, 2)}/${cleaned.substring(2, 4)}`;
  }
  
  return cleaned;
};

/**
 * Valida uma data de expiração no formato MM/AA
 * @param expiry - A data no formato MM/AA
 * @returns true se a data for válida, false caso contrário
 */
export const validateExpiryDate = (expiry: string): boolean => {
  if (!expiry) return false;
  
  const [month, year] = expiry.split('/').map(Number);
  
  if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
    return false;
  }
  
  // Obtém os dois últimos dígitos do ano atual
  const currentYear = new Date().getFullYear() % 100;
  const currentMonth = new Date().getMonth() + 1; // Janeiro é 0
  
  // Verifica se a data é futura
  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return false;
  }
  
  return true;
};

/**
 * Valida um código de segurança (CVV)
 * @param cvv - O código de segurança
 * @param cardType - O tipo de cartão (para verificar o comprimento)
 * @returns true se o CVV for válido, false caso contrário
 */
export const validateCVV = (cvv: string, cardType: string | null = null): boolean => {
  const cleaned = cvv.replace(/\D/g, '');
  
  // American Express geralmente tem 4 dígitos, outros têm 3
  const expectedLength = cardType === 'amex' ? 4 : 3;
  
  return /^\d{3,4}$/.test(cleaned) && cleaned.length === expectedLength;
};
