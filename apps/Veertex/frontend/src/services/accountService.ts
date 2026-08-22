import api from 'src/services/api';
import { AuthAccount, AccountPreferences } from 'src/types/auth';

/** Grava as preferências da conta (§1 do 01A). PATCH parcial: só o que veio é alterado. */
async function updatePreferences(changes: Partial<AccountPreferences>): Promise<AuthAccount> {
  const response = await api.patch<AuthAccount>('/account/preferences', changes);
  return response.data;
}

const accountService = { updatePreferences };

export default accountService;
