import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import { FabricId } from '../../../../catalog/domain/value-objects/fabric-id.vo';

export const CUT_HISTORY = Symbol('CUT_HISTORY');

/**
 * Quantos cortes concluídos já existem para um tecido.
 *
 * É o que decide se o Administrativo pode abrir um pedido sozinho (regra 6.1): sem histórico, a
 * estimativa de horas só existe na cabeça de quem opera a máquina; com histórico, ela está no
 * sistema — mediana de camadas, de peças encaixadas e de minutos por 100 peças, tudo da Fase 5.
 *
 * O port vive no contexto de **pré-pedido**, que é quem precisa da informação, e a implementação
 * lê a tabela `cut` direto. O caminho óbvio — importar o `CutModule` — fecharia um ciclo, porque o
 * corte já importa o pré-pedido para herdar tecido e produto.
 */
export interface CutHistoryPort {
  countFinished(accountId: AccountId, fabricId: FabricId): Promise<number>;
}
