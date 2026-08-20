import api from 'src/services/api';

/** Contagens de pendência do painel — o que alimenta os balões e o sino. */
export interface PendingSummary {
  preOrders: number;
  waitingList: number;
  slotNotices: number;
}

const VAZIO: PendingSummary = { preOrders: 0, waitingList: 0, slotNotices: 0 };

/**
 * Uma requisição para as três contagens.
 *
 * Nunca lança: aviso é acessório, e o menu tem que continuar funcionando quando a rede falha.
 * Devolver zeros esconde a pendência por um instante — mostrar um erro no lugar do menu
 * atrapalharia quem está tentando fazer outra coisa.
 */
async function summary(): Promise<PendingSummary> {
  try {
    const response = await api.get<PendingSummary>('/pending-summary');
    return response.data ?? VAZIO;
  } catch {
    return VAZIO;
  }
}

const pendingService = { summary };
export default pendingService;
