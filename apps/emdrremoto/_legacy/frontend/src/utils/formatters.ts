/**
 * Valida um CPF verificando seus dígitos verificadores
 * @param cpf - O CPF a ser validado (com ou sem formatação)
 * @returns true se o CPF for válido, false caso contrário
 */
export const validateCPF = (cpf: string): boolean => {
  // Remove caracteres não numéricos
  const cleaned = cpf.replace(/\D/g, '');
  
  // Verifica se tem 11 dígitos e não é uma sequência de números iguais
  if (cleaned.length !== 11 || /^(\d)\1+$/.test(cleaned)) {
    return false;
  }
  
  // Validação do primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let remainder = 11 - (sum % 11);
  const firstDigit = remainder >= 10 ? 0 : remainder;
  
  if (firstDigit !== parseInt(cleaned.charAt(9))) {
    return false;
  }
  
  // Validação do segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  remainder = 11 - (sum % 11);
  const secondDigit = remainder >= 10 ? 0 : remainder;
  
  return secondDigit === parseInt(cleaned.charAt(10));
};

/**
 * Formata um CPF no formato 000.000.000-00
 * @param value - O valor do CPF a ser formatado
 * @returns O CPF formatado
 */
export const formatCPF = (value: string): string => {
  if (!value) return '';
  
  // Remove caracteres não numéricos
  const cleaned = value.replace(/\D/g, '');
  
  // Aplica a máscara: 000.000.000-00
  if (cleaned.length <= 3) {
    return cleaned;
  } else if (cleaned.length <= 6) {
    return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
  } else if (cleaned.length <= 9) {
    return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
  } else {
    return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9, 11)}`;
  }
};

/**
 * Verifica se um CPF é válido e retorna uma mensagem de erro se aplicável
 * @param cpf - O CPF a ser validado
 * @returns Uma string vazia se válido, ou uma mensagem de erro
 */
export const getCPFValidationError = (cpf: string): string => {
  if (!cpf) return 'CPF é obrigatório';
  
  const cleaned = cpf.replace(/\D/g, '');
  
  if (cleaned.length < 11) return 'CPF incompleto';
  if (cleaned.length > 11) return 'CPF inválido';
  if (!validateCPF(cpf)) return 'CPF inválido';
  
  return '';
};
