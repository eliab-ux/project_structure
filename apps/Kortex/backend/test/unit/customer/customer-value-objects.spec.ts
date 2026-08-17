import { CPF } from '../../../src/shared/domain/value-objects/cpf.vo';
import { CNPJ } from '../../../src/shared/domain/value-objects/cnpj.vo';
import { InvalidValueException } from '../../../src/shared/domain/exceptions/invalid-value.exception';
import { CustomerDocument } from '../../../src/contexts/customer/domain/value-objects/customer-document.vo';
import { Address } from '../../../src/contexts/customer/domain/value-objects/address.vo';
import { LegalRepresentative } from '../../../src/contexts/customer/domain/value-objects/legal-representative.vo';

const CPF_VALIDO = '529.982.247-25';
const CNPJ_VALIDO = '11.222.333/0001-81';

describe('CPF', () => {
  it('aceita com e sem máscara e guarda só dígitos', () => {
    expect(CPF.create(CPF_VALIDO).value).toBe('52998224725');
    expect(CPF.create('52998224725').value).toBe('52998224725');
  });

  it('recusa dígito verificador errado', () => {
    expect(() => CPF.create('529.982.247-24')).toThrow(InvalidValueException);
  });

  it('recusa sequência repetida — passa na conta por coincidência, não é CPF', () => {
    for (const digit of '0123456789') {
      expect(() => CPF.create(digit.repeat(11))).toThrow(InvalidValueException);
    }
  });

  it.each(['', '123', 'abcdefghijk', '5299822472'])('recusa %p', (invalid) => {
    expect(() => CPF.create(invalid)).toThrow(InvalidValueException);
  });

  it('não repete o número na mensagem de erro', () => {
    expect(() => CPF.create('529.982.247-24')).toThrow('CPF inválido.');
  });

  it('não vaza o número em serialização acidental', () => {
    const cpf = CPF.create(CPF_VALIDO);
    expect(JSON.stringify({ cpf })).not.toContain('52998224725');
    expect(String(cpf)).not.toContain('52998224725');
  });

  it('formata para a tela de detalhe', () => {
    expect(CPF.create('52998224725').formatted).toBe('529.982.247-25');
  });
});

describe('CNPJ', () => {
  it('aceita com e sem máscara e guarda só dígitos', () => {
    expect(CNPJ.create(CNPJ_VALIDO).value).toBe('11222333000181');
    expect(CNPJ.create('11222333000181').value).toBe('11222333000181');
  });

  it('recusa dígito verificador errado', () => {
    expect(() => CNPJ.create('11222333000182')).toThrow(InvalidValueException);
  });

  it('recusa sequência repetida', () => {
    expect(() => CNPJ.create('11111111111111')).toThrow(InvalidValueException);
  });

  it('formata para a tela de detalhe', () => {
    expect(CNPJ.create('11222333000181').formatted).toBe('11.222.333/0001-81');
  });
});

describe('CustomerDocument', () => {
  it('valida como CNPJ quando o tipo é cnpj', () => {
    const doc = CustomerDocument.create('cnpj', CNPJ_VALIDO);
    expect(doc.type).toBe('cnpj');
    expect(doc.value).toBe('11222333000181');
  });

  it('valida como CPF quando o tipo é cpf — a costureira autônoma sem CNPJ', () => {
    const doc = CustomerDocument.create('cpf', CPF_VALIDO);
    expect(doc.type).toBe('cpf');
    expect(doc.value).toBe('52998224725');
  });

  it('recusa o par inconsistente (tipo cnpj com 11 dígitos)', () => {
    expect(() => CustomerDocument.create('cnpj', CPF_VALIDO)).toThrow(InvalidValueException);
    expect(() => CustomerDocument.create('cpf', CNPJ_VALIDO)).toThrow(InvalidValueException);
  });

  it('recusa tipo desconhecido', () => {
    expect(() => CustomerDocument.create('rg', '123456789')).toThrow(InvalidValueException);
  });

  it('compara por tipo e dígitos', () => {
    const a = CustomerDocument.create('cnpj', CNPJ_VALIDO);
    const b = CustomerDocument.create('cnpj', '11222333000181');
    expect(a.equals(b)).toBe(true);
  });
});

describe('Address', () => {
  const base = { city: 'Ceres', state: 'GO' };

  it('exige cidade — é coluna do relatório do governo', () => {
    expect(() => Address.create({ ...base, city: '' })).toThrow(InvalidValueException);
  });

  it('normaliza a UF para maiúscula', () => {
    expect(Address.create({ ...base, state: 'go' }).state).toBe('GO');
  });

  it.each(['XX', 'G', 'GOI', ''])('recusa UF %p', (state) => {
    expect(() => Address.create({ ...base, state })).toThrow(InvalidValueException);
  });

  it('aceita endereço só com cidade e UF — o resto se completa depois', () => {
    const address = Address.create(base);
    expect(address.street).toBeNull();
    expect(address.zipCode).toBeNull();
  });

  it('guarda o CEP só com dígitos e recusa comprimento errado', () => {
    expect(Address.create({ ...base, zipCode: '76300-000' }).zipCode).toBe('76300000');
    expect(() => Address.create({ ...base, zipCode: '7630' })).toThrow(InvalidValueException);
  });
});

describe('LegalRepresentative', () => {
  const base = {
    name: 'Gleidson Dantas',
    cpf: CPF_VALIDO,
    phone: '62996010090',
    email: 'gleidson@corteceres.com.br',
  };

  it('monta com os obrigatórios e cargo opcional', () => {
    const rep = LegalRepresentative.create(base);
    expect(rep.name).toBe('Gleidson Dantas');
    expect(rep.role).toBeNull();
    expect(rep.phone.value).toBe('+5562996010090');
  });

  it('exige nome — é a coluna "EMPRESÁRIO" do relatório', () => {
    expect(() => LegalRepresentative.create({ ...base, name: '' })).toThrow(InvalidValueException);
  });

  it('recusa CPF inválido', () => {
    expect(() => LegalRepresentative.create({ ...base, cpf: '111.111.111-11' })).toThrow(
      InvalidValueException,
    );
  });

  it('recusa cargo fora da lista', () => {
    expect(() => LegalRepresentative.create({ ...base, role: 'gerente' })).toThrow(
      InvalidValueException,
    );
  });
});
