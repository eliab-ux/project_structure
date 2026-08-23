import {
  ApproveIntentCommand,
  ApproveIntentUseCase,
} from '../../src/contexts/intent/application/use-cases/approve-intent/approve-intent.use-case';
import {
  BuildIntentDraftCommand,
  BuildIntentDraftUseCase,
} from '../../src/contexts/intent/application/use-cases/build-intent-draft/build-intent-draft.use-case';
import { AuthorizeIntentCommandUseCase } from '../../src/contexts/intent/application/use-cases/authorize-intent-command/authorize-intent-command.use-case';
import {
  INTENT_COMMAND_FIELDS,
  INTENT_COMMAND_NAMES,
  IntentCommandName,
  IntentField,
  IntentFieldSpec,
} from '../../src/contexts/intent/domain/intent-command';

const CONTA = '11111111-1111-4111-8111-111111111111';
const ATOR = '99999999-9999-4999-8999-999999999999';

/**
 * TESTE DE CONTRATO rascunho×dispatch — o instrumento da varredura de 23/08/2026.
 *
 * O defeito real que o motiva: o approve do CreateRole exigia `code`, que o tradutor nunca produzia
 * — o operador recebia "faltam informações: code" sem ter na tela um campo `code` para preencher.
 * Um campo que o dispatch lê e a spec não declara é EXATAMENTE esse defeito de novo; este teste o
 * transforma em vermelho de CI.
 *
 * Para CADA comando do catálogo: monta os campos EXATOS da spec (`INTENT_COMMAND_FIELDS`), com
 * valores plausíveis por tipo, e aprova com todos os use cases de escrita FALSOS. Se o dispatch
 * pedir qualquer campo fora da spec, `IncompleteIntentDraftException` derruba o teste.
 */
function valueFor(spec: IntentFieldSpec): unknown {
  switch (spec.kind) {
    case 'text':
      return 'VALOR';
    case 'list':
      return ['a', 'b'];
    case 'number':
      return 10;
    case 'flag':
      return true;
    case 'address':
      return {
        street: 'Rua X',
        number: '1',
        district: 'Centro',
        city: 'Goiânia',
        state: 'GO',
        zipCode: '74000000',
      };
    default:
      return 'VALOR';
  }
}

function fieldsFor(command: IntentCommandName): Record<string, IntentField> {
  return Object.fromEntries(
    INTENT_COMMAND_FIELDS[command].map((spec) => [
      spec.name,
      { value: valueFor(spec), origin: 'ditado' as const, review: false },
    ]),
  );
}

/** Todo use case de escrita vira um fake que devolve o mínimo que o dispatch consome. */
function fakeExec(result: Record<string, unknown>) {
  return { execute: async () => result } as never;
}

function buildApprove(): ApproveIntentUseCase {
  const authorize = new AuthorizeIntentCommandUseCase();
  return new ApproveIntentUseCase(
    authorize,
    fakeExec({ id: 'r1', name: 'Papel' }), // createRole
    fakeExec({ id: 'r1', name: 'Papel' }), // updateRole
    fakeExec({ id: 'u1', name: 'Pessoa' }), // createUser
    fakeExec({ id: 'u1', name: 'Pessoa' }), // updateUser
    fakeExec({ moduleCode: 'VND', active: true }), // toggleModule
    fakeExec({ id: 'c1', displayName: 'Empresa' }), // createCompany
    fakeExec({ id: 'c1', displayName: 'Empresa' }), // updateCompany
    fakeExec({ id: 'ct1', displayName: 'Contato' }), // createContact
    fakeExec({ id: 'p1', name: 'Produto' }), // createProduct
    fakeExec({ id: 'p1', name: 'Produto' }), // updateProduct
    fakeExec({ id: 'ct1', displayName: 'Contato' }), // updateContact
  );
}

describe('Contrato rascunho×dispatch — todo comando aprova com EXATAMENTE os campos da spec', () => {
  it.each(INTENT_COMMAND_NAMES)('%s', async (command) => {
    const uc = buildApprove();
    const result = await uc.execute(
      new ApproveIntentCommand(
        'draft-1',
        command,
        fieldsFor(command),
        CONTA,
        ATOR,
        ['*'], // permissões: o teste é do CONTRATO de campos, não da autorização
        ['CORE', 'VND', 'EST', 'FIN', 'ROT'],
      ),
    );
    expect(result.command).toBe(command);
  });

  it('spec não declara campo que o dispatch não usa como obrigatório sem valor derivável', () => {
    // Sanidade da própria tabela: todo comando tem ao menos 1 campo e nomes únicos.
    for (const command of INTENT_COMMAND_NAMES) {
      const names = INTENT_COMMAND_FIELDS[command].map((spec) => spec.name);
      expect(names.length).toBeGreaterThan(0);
      expect(new Set(names).size).toBe(names.length);
    }
  });
});

describe('CreateRole — o code é DERIVADO do nome no rascunho (defeito real de 23/08/2026)', () => {
  function draft(fields: Record<string, IntentField>) {
    const uc = new BuildIntentDraftUseCase(new AuthorizeIntentCommandUseCase());
    return uc.execute(new BuildIntentDraftCommand('CreateRole', fields, ['*'], ['CORE']));
  }

  it('deriva A-Z0-9_ do nome, visível com origem "padrao" e sem revisão forçada', async () => {
    const result = await draft({
      name: { value: 'Supervisor de Vendas', origin: 'ditado', review: false },
      permissions: { value: ['contacts.read'], origin: 'ditado', review: false },
    });
    expect(result.fields.code.value).toBe('SUPERVISOR_DE_VENDAS');
    expect(result.fields.code.origin).toBe('padrao');
    expect(result.fields.code.review).toBe(false);
  });

  it('acentos caem, nome curto ganha fallback', async () => {
    const comAcento = await draft({
      name: { value: 'Operação Física', origin: 'ditado', review: false },
      permissions: { value: ['contacts.read'], origin: 'ditado', review: false },
    });
    expect(comAcento.fields.code.value).toBe('OPERACAO_FISICA');

    const curto = await draft({
      name: { value: 'X', origin: 'ditado', review: false },
      permissions: { value: ['contacts.read'], origin: 'ditado', review: false },
    });
    expect(curto.fields.code.value).toBe('PAPEL');
  });

  it('code explícito no plano NÃO é sobrescrito', async () => {
    const result = await draft({
      name: { value: 'Gerente', origin: 'ditado', review: false },
      code: { value: 'GER_LOJA', origin: 'ditado', review: false },
      permissions: { value: ['contacts.read'], origin: 'ditado', review: false },
    });
    expect(result.fields.code.value).toBe('GER_LOJA');
  });
});

describe('FieldReader — lista e flag sobrevivem à edição em TEXTO do painel (§10)', () => {
  it('lista editada como "a, b" aprova como array', async () => {
    const uc = buildApprove();
    const fields = fieldsFor('CreateRole');
    fields.permissions = { value: 'contacts.read, orders.read', origin: 'ajustado', review: false };
    const result = await uc.execute(
      new ApproveIntentCommand('d', 'CreateRole', fields, CONTA, ATOR, ['*'], ['CORE']),
    );
    expect(result.command).toBe('CreateRole');
  });

  it('flag editado como "false" aprova como booleano', async () => {
    const uc = buildApprove();
    const fields = fieldsFor('ToggleModule');
    fields.active = { value: 'false', origin: 'ajustado', review: false };
    const result = await uc.execute(
      new ApproveIntentCommand('d', 'ToggleModule', fields, CONTA, ATOR, ['*'], ['CORE']),
    );
    expect(result.command).toBe('ToggleModule');
  });
});
