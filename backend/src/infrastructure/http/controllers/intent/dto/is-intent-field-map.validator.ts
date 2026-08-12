import {
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';

const ORIGINS = ['ditado', 'consulta', 'padrao', 'ajustado', 'externo'];

/**
 * Valida um mapa `{ nome: { value, origin, review } }`.
 *
 * **Por que um validador próprio, e não `@ValidateNested({ each: true })`.** Esse decorator é para
 * ARRAY. Aplicado a um objeto de chaves dinâmicas, o `class-validator` valida o objeto INTEIRO como se
 * fosse um campo — e a mensagem que sai é `fields.property roleId should not exist,
 * fields.value should not be null or undefined`, que não descreve erro nenhum do cliente. Foi o que
 * aconteceu na primeira execução do teste: quatro casos vermelhos, todos pela mesma causa, e nenhum
 * deles pelo motivo que o teste queria verificar.
 *
 * A alternativa era trocar o contrato para um array de campos, que o `each: true` validaria de graça.
 * Não foi escolhida porque o §2 da especificação define o formato como MAPA — e o mapa é a forma certa
 * para o que isto é: um conjunto de campos identificados por nome, sem ordem significativa. Ajustar o
 * validador é mais barato do que ajustar o contrato e o cliente.
 *
 * **O que se valida aqui é o ENVELOPE, não o valor.** O tipo de cada `value` depende do comando, e
 * quem sabe qual comando está executando é o `ApproveIntentUseCase`. Um envelope frouxo, porém,
 * deixaria passar `origin: "confiavel"` inventado pelo cliente — e a tela exibiria procedência falsa
 * ao operador, que é pior do que não exibir procedência.
 */
@ValidatorConstraint({ name: 'isIntentFieldMap', async: false })
export class IsIntentFieldMapConstraint implements ValidatorConstraintInterface {
  private problems: string[] = [];

  validate(value: unknown): boolean {
    this.problems = [];

    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      this.problems.push('fields deve ser um objeto de campos');
      return false;
    }

    for (const [name, raw] of Object.entries(value as Record<string, unknown>)) {
      if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        this.problems.push(`${name} deve ser um objeto`);
        continue;
      }

      const field = raw as Record<string, unknown>;

      // `value` precisa ESTAR presente, e pode ser `null` — é justamente assim que o §2 manda
      // representar "a frase não disse". Ausente é diferente de nulo: ausente é campo que o cliente
      // esqueceu de mandar.
      if (!Object.prototype.hasOwnProperty.call(field, 'value')) {
        this.problems.push(`${name}.value é obrigatório (use null quando não houver valor)`);
      }

      if (
        field.origin !== undefined &&
        field.origin !== null &&
        !ORIGINS.includes(String(field.origin))
      ) {
        this.problems.push(`${name}.origin inválida`);
      }

      if (field.review !== undefined && typeof field.review !== 'boolean') {
        this.problems.push(`${name}.review deve ser booleano`);
      }
    }

    return this.problems.length === 0;
  }

  defaultMessage(_args: ValidationArguments): string {
    return this.problems.join('; ');
  }
}

export function IsIntentFieldMap(validationOptions?: ValidationOptions) {
  return function decorate(object: object, propertyName: string): void {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsIntentFieldMapConstraint,
    });
  };
}
