import { DomainException } from '@gitspread/domain-primitives';

/**
 * Preferência cujo valor pedido ainda não está implementado — recusa LOUD, nunca toggle inerte.
 *
 * O projeto recusa configuração que não faz nada (a família da coluna de carteirização). Duas
 * preferências têm hoje um valor que a implementação ainda não sustenta, e cada uma é rejeitada com o
 * motivo em vez de aceita e ignorada:
 *
 *  - **numeração `sequential`** (contato/SKU): a geração automática não existe (o default decidido é
 *    `manual`). Aceitar `sequential` faria o próximo cadastro esperar um número que ninguém gera.
 *  - **`allowDuplicateDocument = true`**: a unicidade do documento é garantida também pelo índice
 *    único no banco (ver `CreateContactUseCase`). Permitir duplicado exigiria RELAXAR esse índice —
 *    e Eliab decidiu (22/08/2026) **não relaxá-lo**: é ele quem fecha a corrida entre requisições
 *    simultâneas, e trocar isso por flexibilidade que ninguém pediu não se justifica. Volta se um
 *    cliente precisar. O default decidido é `false`, e ele funciona por inteiro.
 */
export class PreferenceNotAvailableException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}
