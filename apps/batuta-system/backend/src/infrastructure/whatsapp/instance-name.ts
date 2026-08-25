import { ValidationUtil } from '@gitspread/shared-kernel';

const INSTANCE_NAME = /^acct-([0-9a-f-]{36})-ch-([0-9a-f-]{36})$/i;

export interface ParsedInstanceName {
  accountId: string;
  channelId: string;
}

/**
 * Parses `acct-{account_id}-ch-{channel_id}` back into its parts (§5, FASE 2 item 2).
 *
 * This is how an inbound webhook learns WHICH TENANT it belongs to. The tenant therefore comes from
 * the instance name — a value we generated — and never from a field in the payload body, which an
 * attacker with the shared webhook token could otherwise set to any account.
 *
 * Returns null for anything that does not match, including other systems sharing the same Evolution
 * server: an unrecognised instance is ignored, not guessed at.
 */
export function parseInstanceName(instanceName: string): ParsedInstanceName | null {
  const match = INSTANCE_NAME.exec((instanceName ?? '').trim());
  if (!match) {
    return null;
  }

  const [, accountId, channelId] = match;
  if (!ValidationUtil.isUUID(accountId) || !ValidationUtil.isUUID(channelId)) {
    return null;
  }

  return { accountId: accountId.toLowerCase(), channelId: channelId.toLowerCase() };
}
