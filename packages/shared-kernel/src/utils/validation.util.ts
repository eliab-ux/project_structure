export class ValidationUtil {
  static isEmail(email: string): boolean {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  static isUUID(uuid: string): boolean {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return regex.test(uuid);
  }

  static isEmpty(value: string | null | undefined): boolean {
    return value === null || value === undefined || value.trim() === '';
  }

  static isNotEmpty(value: string | null | undefined): boolean {
    return !this.isEmpty(value);
  }

  static minLength(value: string, min: number): boolean {
    return value.length >= min;
  }

  static maxLength(value: string, max: number): boolean {
    return value.length <= max;
  }

  static isNumeric(value: string): boolean {
    return /^\d+$/.test(value);
  }

  static isAlphanumeric(value: string): boolean {
    return /^[a-zA-Z0-9]+$/.test(value);
  }

  /**
   * CPF com dígito verificador conferido. Aceita com ou sem máscara.
   *
   * Rejeita as sequências repetidas (`111.111.111-11` e as outras nove) explicitamente: elas
   * passam no cálculo do dígito por coincidência aritmética, e é justamente esse tipo de valor que
   * alguém digita para "preencher depois".
   */
  static isValidCPF(value: string): boolean {
    const cpf = (value ?? '').replace(/\D/g, '');

    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
      return false;
    }

    const digit = (length: number): number => {
      let sum = 0;
      for (let i = 0; i < length; i += 1) {
        sum += Number(cpf[i]) * (length + 1 - i);
      }
      const rest = (sum * 10) % 11;
      return rest === 10 ? 0 : rest;
    };

    return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
  }

  /** CNPJ com dígito verificador conferido. Aceita com ou sem máscara. */
  static isValidCNPJ(value: string): boolean {
    const cnpj = (value ?? '').replace(/\D/g, '');

    if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) {
      return false;
    }

    const digit = (length: number): number => {
      // Pesos do CNPJ: 5,4,3,2,9,8,7,6,5,4,3,2 — reiniciam em 9 depois de chegar a 2.
      let weight = length - 7;
      let sum = 0;
      for (let i = 0; i < length; i += 1) {
        sum += Number(cnpj[i]) * weight;
        weight -= 1;
        if (weight < 2) {
          weight = 9;
        }
      }
      const rest = sum % 11;
      return rest < 2 ? 0 : 11 - rest;
    };

    return digit(12) === Number(cnpj[12]) && digit(13) === Number(cnpj[13]);
  }
}
