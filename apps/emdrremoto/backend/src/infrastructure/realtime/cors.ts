/**
 * CORS do Gateway lido de CORS_ORIGIN (nunca "*" com credenciais em produção).
 * Em produção o Dokploy define CORS_ORIGIN no ambiente do processo (disponível no import).
 * Em desenvolvimento, sem CORS_ORIGIN, reflete a origem (aceitável só em dev).
 */
export function corsOrigin(): string[] | boolean {
  const raw = process.env.CORS_ORIGIN;
  if (!raw) {
    return true; // dev fallback (reflete origem)
  }
  return raw.split(',').map((o) => o.trim());
}
