import { Customer } from '../../../src/contexts/customer/domain/entities/customer.entity';
import { AccountId } from '../../../src/contexts/account/domain/value-objects/account-id.vo';
import { CustomerDocument } from '../../../src/contexts/customer/domain/value-objects/customer-document.vo';
import { Address } from '../../../src/contexts/customer/domain/value-objects/address.vo';
import { LegalRepresentative } from '../../../src/contexts/customer/domain/value-objects/legal-representative.vo';
import { PhoneE164 } from '../../../src/shared/domain/value-objects/phone-e164.vo';
import { Email } from '../../../src/shared/domain/value-objects/email.vo';
import {
  CustomerDetailDto,
  CustomerForModelistaDto,
  CustomerListDto,
} from '../../../src/contexts/customer/application/dto/customer.dto';
import { InvalidValueException } from '../../../src/shared/domain/exceptions/invalid-value.exception';

const REP_CPF_DIGITS = '52998224725';
const CNPJ_DIGITS = '11222333000181';

function buildCustomer(documentType: 'cnpj' | 'cpf' = 'cnpj'): Customer {
  return Customer.create({
    accountId: AccountId.create(),
    legalName: 'Malharia São Bento LTDA',
    tradeName: 'Malharia São Bento',
    document: CustomerDocument.create(
      documentType,
      documentType === 'cnpj' ? CNPJ_DIGITS : REP_CPF_DIGITS,
    ),
    stateRegistration: '10.123.456-7',
    companySize: 'me',
    employeesCount: 12,
    address: Address.create({
      zipCode: '76300-000',
      street: 'Rua das Malhas',
      number: '145',
      district: 'Centro',
      city: 'Ceres',
      state: 'GO',
    }),
    representative: LegalRepresentative.create({
      name: 'Maria Aparecida Souza',
      role: 'owner',
      cpf: REP_CPF_DIGITS,
      phone: '62998887766',
      email: 'maria@saobento.com.br',
    }),
    contact: {
      whatsapp: PhoneE164.create('62998887766'),
      email: Email.create('contato@saobento.com.br'),
      phone: null,
    },
    membership: { isMember: true, memberSince: new Date('2024-03-01T00:00:00.000Z') },
    notes: 'Costuma cortar malha em enfesto alto.',
  });
}

describe('Customer', () => {
  it('nasce ativo', () => {
    expect(buildCustomer().status).toBe('active');
  });

  it('inativa sem apagar — os cortes dele são histórico', () => {
    const customer = buildCustomer();
    customer.deactivate();
    expect(customer.status).toBe('inactive');
    expect(customer.id.value).toBeTruthy();
  });

  it('recusa data de associação em quem não é associado — dado órfão que ninguém explica', () => {
    const modelo = buildCustomer();

    expect(() =>
      Customer.create({
        accountId: AccountId.create(),
        legalName: modelo.legalName,
        tradeName: modelo.tradeName,
        document: modelo.document,
        address: modelo.address,
        representative: modelo.representative,
        contact: modelo.contact,
        membership: { isMember: false, memberSince: new Date('2024-03-01T00:00:00.000Z') },
      }),
    ).toThrow(InvalidValueException);
  });
});

describe('CustomerListDto — o que a listagem NÃO mostra', () => {
  it('não contém CPF do representante', () => {
    const dto = CustomerListDto.fromDomain(buildCustomer());
    const serialized = JSON.stringify(dto);

    expect(Object.keys(dto)).not.toContain('representative');
    expect(Object.keys(dto)).not.toContain('repCpf');
    expect(serialized).not.toContain(REP_CPF_DIGITS);
    expect(serialized).not.toContain('529.982.247-25');
  });

  it('não contém número de documento — nem quando o documento do cliente É um CPF', () => {
    // O caso que uma regra ingênua ("mostra só o CNPJ") deixaria passar.
    const dto = CustomerListDto.fromDomain(buildCustomer('cpf'));
    const serialized = JSON.stringify(dto);

    expect(Object.keys(dto)).not.toContain('document');
    expect(serialized).not.toContain(REP_CPF_DIGITS);
    expect(serialized).not.toContain(CNPJ_DIGITS);
  });

  it('não contém endereço além de cidade e UF', () => {
    const dto = CustomerListDto.fromDomain(buildCustomer());
    const serialized = JSON.stringify(dto);

    expect(Object.keys(dto)).not.toContain('address');
    expect(serialized).not.toContain('Rua das Malhas');
    expect(serialized).not.toContain('76300000');
  });

  it('expõe exatamente os campos da tela de Clientes', () => {
    expect(Object.keys(CustomerListDto.fromDomain(buildCustomer())).sort()).toEqual([
      'city',
      'documentType',
      'id',
      'isMember',
      'state',
      'status',
      'tradeName',
      'whatsapp',
    ]);
  });
});

describe('CustomerForModelistaDto — quatro campos e nada além', () => {
  it('expõe só nome fantasia, cidade, WhatsApp e observações', () => {
    expect(Object.keys(CustomerForModelistaDto.fromDomain(buildCustomer())).sort()).toEqual([
      'city',
      'id',
      'notes',
      'tradeName',
      'whatsapp',
    ]);
  });

  it('não contém CPF, CNPJ, endereço nem representante', () => {
    const serialized = JSON.stringify(CustomerForModelistaDto.fromDomain(buildCustomer()));

    expect(serialized).not.toContain(REP_CPF_DIGITS);
    expect(serialized).not.toContain(CNPJ_DIGITS);
    expect(serialized).not.toContain('Rua das Malhas');
    expect(serialized).not.toContain('Maria Aparecida Souza');
    expect(serialized).not.toContain('Malharia São Bento LTDA'); // razão social também não
  });
});

describe('CustomerDetailDto — o único lugar com o CPF do representante', () => {
  it('traz o representante completo', () => {
    const dto = CustomerDetailDto.fromDomain(buildCustomer());
    expect(dto.representative.cpf).toBe(REP_CPF_DIGITS);
    expect(dto.representative.cpfFormatted).toBe('529.982.247-25');
  });

  it('traz endereço e documento formatados', () => {
    const dto = CustomerDetailDto.fromDomain(buildCustomer());
    expect(dto.documentFormatted).toBe('11.222.333/0001-81');
    expect(dto.address.city).toBe('Ceres');
    expect(dto.memberSince).toBe('2024-03-01');
  });
});
