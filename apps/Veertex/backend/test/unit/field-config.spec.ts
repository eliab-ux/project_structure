import { FieldConfig } from '../../src/contexts/field-config/domain/entities/field-config.entity';
import { mergeEffectiveFields } from '../../src/contexts/field-config/domain/effective-field';
import {
  CannotRelaxMandatoryFieldException,
  RequiredFieldMissingException,
  UnknownConfigurableEntityException,
  UnknownConfigurableFieldException,
} from '../../src/contexts/field-config/domain/exceptions/field-config-exceptions';
import { RequiredFieldsChecker } from '../../src/contexts/field-config/application/required-fields.checker';
import { FieldConfigRepositoryPort } from '../../src/contexts/field-config/application/ports/output/field-config-repository.port';

const CONTA = '11111111-1111-4111-8111-111111111111';

/**
 * `field_config` — o invariante do §3.6 e a precedência do merge, verificados sem banco.
 *
 * O centro: a config GOVERNA exibição/obrigatoriedade e NUNCA cria campo nem afrouxa o obrigatório
 * por domínio. Os dois lados são testados — o que a guarda impede de passar E o que ela deixa passar.
 */
describe('FieldConfig (escrita) — nunca cria campo, nunca afrouxa obrigatório', () => {
  it('recusa entidade fora do catálogo (inclui `order`, futura)', () => {
    expect(() =>
      FieldConfig.create({
        accountId: CONTA,
        entity: 'order',
        field: 'x',
        visible: true,
        required: false,
      }),
    ).toThrow(UnknownConfigurableEntityException);
  });

  it('recusa campo fora do catálogo da entidade', () => {
    expect(() =>
      FieldConfig.create({
        accountId: CONTA,
        entity: 'contact',
        field: 'campoInventado',
        visible: true,
        required: false,
      }),
    ).toThrow(UnknownConfigurableFieldException);
  });

  it('recusa ocultar um campo obrigatório por domínio (DECISÃO 2.1)', () => {
    expect(() =>
      FieldConfig.create({
        accountId: CONTA,
        entity: 'contact',
        field: 'legalName', // defaultRequired: true → mandatoryByDomain
        visible: false,
        required: true,
      }),
    ).toThrow(CannotRelaxMandatoryFieldException);
  });

  it('recusa tornar opcional um campo obrigatório por domínio (DECISÃO 2.1)', () => {
    expect(() =>
      FieldConfig.create({
        accountId: CONTA,
        entity: 'contact',
        field: 'legalName',
        visible: true,
        required: false,
      }),
    ).toThrow(CannotRelaxMandatoryFieldException);
  });

  it('aceita sobrepor um campo opcional (tornar Suframa visível e obrigatório)', () => {
    const config = FieldConfig.create({
      accountId: CONTA,
      entity: 'contact',
      field: 'suframa',
      visible: true,
      required: true,
      label: 'Suframa (obrigatório)',
      sortOrder: 3,
    });
    expect(config.field).toBe('suframa');
    expect(config.required).toBe(true);
    expect(config.label).toBe('Suframa (obrigatório)');
  });
});

describe('mergeEffectiveFields — precedência do §3.6', () => {
  it('campo sem linha de config usa o default do catálogo', () => {
    const merged = mergeEffectiveFields('contact', []);
    const suframa = merged.find((f) => f.field === 'suframa')!;
    expect(suframa.visible).toBe(false); // defaultVisible do catálogo
    expect(suframa.source).toBe('catalog');
  });

  it('config da conta sobrescreve visible/required/label/order', () => {
    const config = FieldConfig.create({
      accountId: CONTA,
      entity: 'contact',
      field: 'suframa',
      visible: true,
      required: true,
      label: 'SUFRAMA',
      sortOrder: 2,
    });
    const suframa = mergeEffectiveFields('contact', [config]).find((f) => f.field === 'suframa')!;
    expect(suframa.visible).toBe(true);
    expect(suframa.required).toBe(true);
    expect(suframa.label).toBe('SUFRAMA');
    expect(suframa.order).toBe(2);
    expect(suframa.source).toBe('account');
  });

  it('rede de segurança na LEITURA: campo obrigatório por domínio nunca é afrouxado, mesmo com linha inválida', () => {
    // `reconstitute` burla a validação do `create` (como faria uma linha adulterada no banco).
    const adulterada = FieldConfig.reconstitute({
      id: 'x',
      accountId: CONTA,
      entity: 'contact',
      field: 'legalName',
      visible: false,
      required: false,
      label: null,
      sortOrder: null,
      createdAt: new Date(),
    });
    const legalName = mergeEffectiveFields('contact', [adulterada]).find(
      (f) => f.field === 'legalName',
    )!;
    expect(legalName.visible).toBe(true);
    expect(legalName.required).toBe(true);
  });

  it('entidade desconhecida devolve lista vazia', () => {
    expect(mergeEffectiveFields('order', [])).toEqual([]);
  });
});

describe('RequiredFieldsChecker — obrigatório dinâmico (§7.5)', () => {
  function repoCom(configs: FieldConfig[]): FieldConfigRepositoryPort {
    return {
      findByEntity: async () => configs,
      findAll: async () => configs,
      replaceEntityConfigs: async () => undefined,
    };
  }

  const suframaObrigatorio = FieldConfig.create({
    accountId: CONTA,
    entity: 'contact',
    field: 'suframa',
    visible: true,
    required: true,
  });

  it('na CRIAÇÃO, rejeita payload sem o campo que a conta marcou obrigatório', async () => {
    const checker = new RequiredFieldsChecker(repoCom([suframaObrigatorio]));
    await expect(
      checker.assertRequiredPresent('contact', { legalName: 'ACME' }, 'create'),
    ).rejects.toThrow(RequiredFieldMissingException);
  });

  it('na CRIAÇÃO, aceita payload com todos os obrigatórios preenchidos (domínio + config)', async () => {
    const checker = new RequiredFieldsChecker(repoCom([suframaObrigatorio]));
    await expect(
      checker.assertRequiredPresent(
        'contact',
        // types/personKind/legalName são obrigatórios por domínio; suframa, por config.
        { types: ['customer'], personKind: 'company', legalName: 'ACME', suframa: '123' },
        'create',
      ),
    ).resolves.toBeUndefined();
  });

  it('na EDIÇÃO, um obrigatório AUSENTE do payload não é cobrado (significa "não mexa")', async () => {
    const checker = new RequiredFieldsChecker(repoCom([suframaObrigatorio]));
    await expect(
      checker.assertRequiredPresent('contact', { legalName: 'ACME Ltda' }, 'update'),
    ).resolves.toBeUndefined();
  });

  it('na EDIÇÃO, um obrigatório enviado VAZIO é rejeitado', async () => {
    const checker = new RequiredFieldsChecker(repoCom([suframaObrigatorio]));
    await expect(
      checker.assertRequiredPresent('contact', { suframa: '   ' }, 'update'),
    ).rejects.toThrow(RequiredFieldMissingException);
  });
});
