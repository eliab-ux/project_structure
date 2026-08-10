import { loadEnvFiles } from '../../../config/load-env';

loadEnvFiles();

/**
 * `npm run smoke:auth:prod` — o fluxo de autenticação ponta a ponta, contra a API que já está no ar.
 *
 * **Somente leitura, de propósito.** Não troca senha, não cria conta, não escreve nada. Roda contra
 * o backend de produção e uma verificação que muda credencial é uma verificação que pode deixar o
 * operador trancado fora se falhar no meio. A troca de senha é exercitada pelos testes locais.
 *
 * Bate em `127.0.0.1` e não no domínio público: o objetivo é provar que a APLICAÇÃO responde, não
 * que o Traefik e o DNS estão certos — misturar as duas coisas faria uma falha de proxy parecer
 * falha de autenticação.
 *
 * O trecho do WhatsApp (pedido de código, reset) fica de fora até a instância do Evolution existir.
 * Pedir o código sem canal configurado responderia 204 de qualquer forma — a rota não distingue, de
 * propósito — então o teste passaria sem ter testado nada.
 */
interface SmokeStep {
  name: string;
  passed: boolean;
  detail?: string;
}

const BASE_URL = process.env.SMOKE_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3020}/api`;

async function call(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

async function run(): Promise<void> {
  const email = process.env.SMOKE_EMAIL;
  const password = process.env.SMOKE_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'SMOKE_EMAIL e SMOKE_PASSWORD são obrigatórias. Use as credenciais de uma conta já criada ' +
        '(npm run create:account:prod). O smoke NÃO cria conta.',
    );
  }

  const steps: SmokeStep[] = [];
  const record = (name: string, passed: boolean, detail?: string) =>
    steps.push({ name, passed, detail });

  // ── 1. Health ─────────────────────────────────────────────────────────────────────────────
  const health = await call('/health');
  record(
    'GET /health responde 200',
    health.status === 200,
    health.status === 200 ? undefined : `veio ${health.status}`,
  );

  // ── 2. Rota protegida sem token ───────────────────────────────────────────────────────────
  const unauthorized = await call('/auth/me');
  record(
    'GET /auth/me sem token responde 401',
    unauthorized.status === 401,
    unauthorized.status === 401 ? undefined : `veio ${unauthorized.status}`,
  );

  // ── 3. Credencial inválida ────────────────────────────────────────────────────────────────
  const wrongPassword = await call('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'senha-propositalmente-errada' }),
  });
  record(
    'login com senha errada responde 401',
    wrongPassword.status === 401,
    wrongPassword.status === 401 ? undefined : `veio ${wrongPassword.status}`,
  );

  const unknownEmail = await call('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: `nao-existe-${Date.now()}@verify.local`, password }),
  });
  const sameShape =
    unknownEmail.status === wrongPassword.status &&
    JSON.stringify((unknownEmail.body as { message?: string })?.message) ===
      JSON.stringify((wrongPassword.body as { message?: string })?.message);
  record(
    'e-mail inexistente responde igual a senha errada (sem oráculo de enumeração)',
    sameShape,
    sameShape ? undefined : 'as respostas diferem — é possível descobrir quais e-mails existem',
  );

  // ── 4. Login ──────────────────────────────────────────────────────────────────────────────
  const login = await call('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const session = login.body as {
    accessToken?: string;
    refreshToken?: string;
    permissions?: string[];
    modules?: string[];
  };
  const loggedIn = login.status === 200 && !!session?.accessToken && !!session?.refreshToken;
  record(
    'login responde 200 com access e refresh token',
    loggedIn,
    loggedIn ? undefined : `status ${login.status}: ${JSON.stringify(login.body)}`,
  );

  if (!loggedIn) {
    report(steps);
    return;
  }

  // O token nunca é impresso. O que interessa saber é a FORMA do payload, não o valor.
  record(
    'o token traz permissions e modules',
    Array.isArray(session.permissions) && Array.isArray(session.modules),
    `permissions=${session.permissions?.length ?? 'ausente'}, modules=${
      session.modules?.length ?? 'ausente'
    }`,
  );

  // ── 5. /auth/me com o token ───────────────────────────────────────────────────────────────
  const me = await call('/auth/me', {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  const meBody = me.body as { user?: { email?: string }; account?: { id?: string } };
  const meOk = me.status === 200 && meBody?.user?.email === email.toLowerCase();
  record(
    'GET /auth/me devolve o usuário autenticado',
    meOk,
    meOk ? undefined : `status ${me.status}`,
  );

  // Prova que o ResponseDto não vaza o hash — a garantia mais importante da camada HTTP.
  const leaked = JSON.stringify(me.body).match(/passwordHash|password_hash|\$2[aby]\$/);
  record(
    '/auth/me não expõe hash de senha',
    leaked === null,
    leaked === null ? undefined : 'a resposta contém algo com forma de hash',
  );

  // ── 6. Refresh ────────────────────────────────────────────────────────────────────────────
  const refreshed = await call('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });
  const refreshBody = refreshed.body as { accessToken?: string };
  record(
    'refresh troca por um novo access token',
    refreshed.status === 200 && !!refreshBody?.accessToken,
    refreshed.status === 200 ? undefined : `veio ${refreshed.status}`,
  );

  // O access token não serve como refresh: sem esta separação, um token roubado do header viraria
  // sessão permanente.
  const accessAsRefresh = await call('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: session.accessToken }),
  });
  record(
    'access token é recusado como refresh token',
    accessAsRefresh.status === 401,
    accessAsRefresh.status === 401 ? undefined : `veio ${accessAsRefresh.status}`,
  );

  report(steps);
}

function report(steps: SmokeStep[]): void {
  for (const step of steps) {
    // eslint-disable-next-line no-console
    console.log(
      step.passed ? `   ✅ ${step.name}` : `   ❌ ${step.name}\n        ${step.detail ?? ''}`,
    );
  }

  const failed = steps.filter((step) => !step.passed);
  if (failed.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`\n❌ ${failed.length} de ${steps.length} verificações do auth falharam.\n`);
    process.exitCode = 1;
    return;
  }
  // eslint-disable-next-line no-console
  console.log(`\n✅ Auth ponta a ponta: ${steps.length} verificações, todas passando.\n`);
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`❌ ${(error as Error)?.message ?? error}`);
  process.exit(1);
});
