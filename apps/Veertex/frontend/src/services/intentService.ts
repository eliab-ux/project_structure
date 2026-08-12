import api from 'src/services/api';
import { ApproveIntentResult, IntentDraft, IntentField, IntentResult } from 'src/types/intent';

/**
 * Traduz o texto do operador. **Não grava nada** — o backend devolve um plano ou "não sei fazer isso".
 *
 * O frontend NUNCA fala com o Google: fala com o backend, que fala com o provedor por um port (§2 da
 * especificação). Uma chamada direta do navegador exporia a chave e tiraria o backend da decisão —
 * que é onde toda a validação de plano ∩ conta ∩ papel acontece.
 */
async function parse(text: string): Promise<IntentResult> {
  const response = await api.post<IntentResult>('/intent', { text });
  return response.data;
}

/** Monta o rascunho. Continua sem gravar. */
async function draft(command: string, fields: Record<string, IntentField>): Promise<IntentDraft> {
  const response = await api.post<IntentDraft>('/intent/draft', { command, fields });
  return response.data;
}

/**
 * Aprova e executa — **único caminho de escrita**.
 *
 * O `draftId` vai no corpo mesmo o backend ainda não persistir rascunho: o contrato é estável desde já
 * (decisão de 12/08/2026), então a persistência futura não muda este service nem as telas.
 */
async function approve(
  draftId: string,
  command: string,
  fields: Record<string, IntentField>,
): Promise<ApproveIntentResult> {
  const response = await api.post<ApproveIntentResult>('/intent/approve', {
    draftId,
    command,
    fields,
  });
  return response.data;
}

const intentService = { parse, draft, approve };

export default intentService;
