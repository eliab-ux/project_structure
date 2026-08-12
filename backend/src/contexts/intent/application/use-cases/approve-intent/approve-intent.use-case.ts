import { Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  CreateRoleCommand,
  CreateRoleUseCase,
} from '../../../../role/application/use-cases/create-role/create-role.use-case';
import {
  UpdateRoleCommand,
  UpdateRoleUseCase,
} from '../../../../role/application/use-cases/update-role/update-role.use-case';
import {
  CreateUserCommand,
  CreateUserUseCase,
} from '../../../../user/application/use-cases/create-user/create-user.use-case';
import {
  UpdateUserCommand,
  UpdateUserUseCase,
} from '../../../../user/application/use-cases/update-user/update-user.use-case';
import {
  ToggleModuleCommand,
  ToggleModuleUseCase,
} from '../../../../module/application/use-cases/toggle-module/toggle-module.use-case';
import { CreateCompanyUseCase } from '../../../../company/application/use-cases/create-company/create-company.use-case';
import {
  CreateCompanyAddressInput,
  CreateCompanyCommand,
} from '../../../../company/application/use-cases/create-company/create-company.command';
import {
  UpdateCompanyCommand,
  UpdateCompanyUseCase,
} from '../../../../company/application/use-cases/update-company/update-company.use-case';
import { IntentField } from '../../../domain/intent-command';
import { IncompleteIntentDraftException } from '../../../domain/intent-exceptions';
import {
  AuthorizeIntentCommandQuery,
  AuthorizeIntentCommandUseCase,
} from '../authorize-intent-command/authorize-intent-command.use-case';

export class ApproveIntentCommand {
  constructor(
    public readonly draftId: string,
    public readonly command: string,
    public readonly fields: Record<string, IntentField>,
    /** Do TOKEN. */
    public readonly accountId: string,
    /** Do TOKEN. */
    public readonly actingUserId: string,
    /** Do TOKEN. */
    public readonly permissions: readonly string[],
    /** Do TOKEN. */
    public readonly activeModules: readonly string[],
  ) {}
}

export interface ApproveIntentResult {
  draftId: string;
  command: string;
  /** O que foi criado ou alterado, para a tela confirmar o que aconteceu. */
  resourceId: string | null;
  summary: string;
}

/**
 * Executa o comando aprovado. **É o único caminho de escrita da intenção**, e o único ponto em que
 * algo é gravado.
 *
 * ⚠️ **Revalida TUDO, e o rascunho é entrada NÃO CONFIÁVEL.** Condição registrada por Eliab em
 * 12/08/2026: *"Rascunho vindo do cliente é entrada não confiável como qualquer outra; nada nele é
 * presumido válido por ter passado pelo /draft."* O motivo é concreto — o rascunho não é persistido,
 * então o que chega aqui é o que o navegador mandar, e um navegador pode mandar qualquer coisa.
 *
 * O que é reverificado, e não herdado do `/draft`:
 *
 *  1. **Autorização** — módulo ativo e permissão, com `grants()`, contra o TOKEN desta requisição.
 *     Entre o rascunho e a aprovação o papel pode ter mudado, e um papel alterado é justamente o caso
 *     que a trava anti-lockout existe para permitir.
 *  2. **Campos obrigatórios** — ausência recusa nomeando o que falta, nunca preenche com padrão.
 *  3. **Regras da entidade** — delegadas ao Use Case real, que valida VOs e invariantes. É o mesmo Use
 *     Case que o controller HTTP chama; não há caminho alternativo mais permissivo.
 *
 * O `accountId` vem do TOKEN e nunca do rascunho. Se viesse do corpo, quem chamasse escolheria em que
 * conta escrever — e nenhuma quantidade de RLS ajuda contra um id legítimo de outra conta pedido por
 * um usuário autenticado.
 */
@Injectable()
export class ApproveIntentUseCase implements UseCase<ApproveIntentCommand, ApproveIntentResult> {
  private readonly logger = new Logger(ApproveIntentUseCase.name);

  constructor(
    private readonly authorize: AuthorizeIntentCommandUseCase,
    private readonly createRole: CreateRoleUseCase,
    private readonly updateRole: UpdateRoleUseCase,
    private readonly createUser: CreateUserUseCase,
    private readonly updateUser: UpdateUserUseCase,
    private readonly toggleModule: ToggleModuleUseCase,
    private readonly createCompany: CreateCompanyUseCase,
    private readonly updateCompany: UpdateCompanyUseCase,
  ) {}

  async execute(command: ApproveIntentCommand): Promise<ApproveIntentResult> {
    // (1) Autorização, de novo. Ver o docblock — não é redundância.
    const name = this.authorize.execute(
      new AuthorizeIntentCommandQuery(command.command, command.permissions, command.activeModules),
    );

    const reader = new FieldReader(command.fields ?? {});

    let resourceId: string | null = null;
    let summary: string;

    switch (name) {
      case 'CreateRole': {
        const role = await this.createRole.execute(
          new CreateRoleCommand(
            command.accountId,
            reader.text('code'),
            reader.text('name'),
            reader.list('permissions'),
            reader.optionalText('description'),
          ),
        );
        resourceId = role.id;
        summary = `Papel "${role.name}" criado.`;
        break;
      }

      case 'SetRolePermissions': {
        const role = await this.updateRole.execute(
          new UpdateRoleCommand(
            reader.text('roleId'),
            undefined,
            undefined,
            reader.list('permissions'),
          ),
        );
        resourceId = role.id;
        summary = `Permissões de "${role.name}" atualizadas.`;
        break;
      }

      case 'InviteUser': {
        const user = await this.createUser.execute(
          new CreateUserCommand(
            command.accountId,
            reader.text('name'),
            reader.text('email'),
            reader.text('phone'),
            reader.text('password'),
            reader.text('roleId'),
          ),
        );
        resourceId = user.id;
        summary = `Usuário "${user.name}" criado.`;
        break;
      }

      case 'UpdateUser':
      case 'AssignRole': {
        // Os dois caem no mesmo Use Case: trocar papel É alterar usuário. O que os separa é a
        // intenção declarada, não o efeito — e por isso os dois exigem `users.update`.
        const user = await this.updateUser.execute(
          new UpdateUserCommand(
            reader.text('userId'),
            reader.optionalText('name') ?? undefined,
            reader.optionalText('email') ?? undefined,
            reader.optionalText('phone') ?? undefined,
            name === 'AssignRole'
              ? reader.text('roleId')
              : (reader.optionalText('roleId') ?? undefined),
          ),
        );
        resourceId = user.id;
        summary = `Usuário "${user.name}" atualizado.`;
        break;
      }

      case 'ToggleModule': {
        const result = await this.toggleModule.execute(
          new ToggleModuleCommand(
            command.accountId,
            reader.text('moduleCode'),
            reader.flag('active'),
          ),
        );
        resourceId = result.moduleCode;
        summary = `Módulo ${result.moduleCode} ${result.active ? 'ativado' : 'desativado'}.`;
        break;
      }

      case 'CreateCompany': {
        const company = await this.createCompany.execute(
          new CreateCompanyCommand(
            command.accountId,
            reader.text('legalName'),
            reader.text('document'),
            reader.text('taxRegime'),
            reader.address('address'),
            reader.flag('stateRegistrationExempt'),
            reader.optionalText('tradeName'),
            reader.optionalText('stateRegistration'),
            reader.optionalText('municipalRegistration'),
            reader.optionalText('suframa'),
            reader.optionalText('cnae'),
            reader.optionalText('contactEmail'),
            reader.optionalText('billingEmail'),
            reader.optionalText('phone'),
          ),
        );
        resourceId = company.id;
        summary = `Empresa "${company.displayName}" cadastrada.`;
        break;
      }

      case 'UpdateCompany': {
        // Sem `document`: CNPJ de empresa existente não se edita, cria-se outra. É a mesma regra que o
        // `update()` do service do frontend respeita, e que o `forbidNonWhitelisted` do
        // `PATCH /companies/:id` já recusa.
        const company = await this.updateCompany.execute(
          new UpdateCompanyCommand(
            reader.text('companyId'),
            reader.optionalText('legalName') ?? undefined,
            reader.optionalText('tradeName'),
            reader.optionalText('taxRegime') ?? undefined,
            reader.optionalText('stateRegistration'),
            reader.optionalFlag('stateRegistrationExempt'),
            reader.optionalText('municipalRegistration'),
            reader.optionalText('suframa'),
            reader.optionalText('cnae'),
            reader.optionalAddress('address'),
            reader.optionalText('contactEmail'),
            reader.optionalText('billingEmail'),
            reader.optionalText('phone'),
          ),
        );
        resourceId = company.id;
        summary = `Empresa "${company.displayName}" atualizada.`;
        break;
      }

      default: {
        // Sem `default` silencioso: um comando novo no catálogo sem `case` aqui quebra o `switch` em
        // tempo de compilação (`name` é união literal e o TypeScript exige exaustividade quando o
        // retorno é usado). É o que impede um comando de ser reconhecido pela Mesa e não executável —
        // a dívida que o §10 nomeia.
        return assertExhaustive(name);
      }
    }

    this.logger.log('Intenção aprovada e executada', {
      command: name,
      draftId: command.draftId,
      actingUserId: command.actingUserId,
    });

    return { draftId: command.draftId, command: name, resourceId, summary };
  }
}

/**
 * Falha em tempo de COMPILAÇÃO se um comando do catálogo ficar sem `case`.
 *
 * É a rede que substitui o `default` que lançava exceção: aquele compilava com qualquer catálogo, e
 * portanto permitia acrescentar comando e esquecer o dispatch — descobrindo em produção, no momento em
 * que um operador aprovasse.
 */
function assertExhaustive(value: never): never {
  throw new IncompleteIntentDraftException([`comando sem dispatch: ${String(value)}`]);
}

/**
 * Lê campos do rascunho com recusa explícita quando falta o obrigatório.
 *
 * Acumular os que faltam e lançar uma vez só, em vez de morrer no primeiro: o operador precisa saber
 * tudo o que falta para preencher de uma vez, não descobrir um campo por tentativa.
 */
class FieldReader {
  private readonly missing: string[] = [];

  constructor(private readonly fields: Record<string, IntentField>) {}

  text(name: string): string {
    const value = this.fields[name]?.value;
    if (typeof value !== 'string' || value.trim() === '') {
      this.missing.push(name);
      this.throwIfMissing();
    }
    return String(value);
  }

  optionalText(name: string): string | null {
    const value = this.fields[name]?.value;
    return typeof value === 'string' && value.trim() !== '' ? value : null;
  }

  list(name: string): string[] {
    const value = this.fields[name]?.value;
    if (!Array.isArray(value) || value.length === 0) {
      this.missing.push(name);
      this.throwIfMissing();
    }
    return (value as unknown[]).filter((item): item is string => typeof item === 'string');
  }

  /**
   * Endereço, com os campos obrigatórios do `AddressRequestDto` conferidos um por um.
   *
   * Nomes qualificados (`address.street`) na mensagem de erro: dizer só "address" mandaria o operador
   * procurar qual das oito partes falta.
   */
  address(name: string): CreateCompanyAddressInput {
    const raw = this.fields[name]?.value;
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      this.missing.push(name);
      this.throwIfMissing();
    }

    const value = raw as Record<string, unknown>;
    const required = ['street', 'number', 'district', 'city', 'state', 'zipCode'];
    const absent = required.filter(
      (field) => typeof value[field] !== 'string' || String(value[field]).trim() === '',
    );
    if (absent.length > 0) {
      this.missing.push(...absent.map((field) => `${name}.${field}`));
      this.throwIfMissing();
    }

    return {
      street: String(value.street),
      number: String(value.number),
      complement: typeof value.complement === 'string' ? value.complement : null,
      district: String(value.district),
      city: String(value.city),
      state: String(value.state),
      zipCode: String(value.zipCode),
      ibgeCityCode: typeof value.ibgeCityCode === 'string' ? value.ibgeCityCode : null,
    };
  }

  optionalAddress(name: string): CreateCompanyAddressInput | undefined {
    return this.fields[name]?.value === undefined || this.fields[name]?.value === null
      ? undefined
      : this.address(name);
  }

  optionalFlag(name: string): boolean | undefined {
    const value = this.fields[name]?.value;
    return typeof value === 'boolean' ? value : undefined;
  }

  flag(name: string): boolean {
    const value = this.fields[name]?.value;
    if (typeof value !== 'boolean') {
      this.missing.push(name);
      this.throwIfMissing();
    }
    return value as boolean;
  }

  private throwIfMissing(): never {
    throw new IncompleteIntentDraftException(this.missing);
  }
}
