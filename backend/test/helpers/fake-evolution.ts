import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';

export interface CapturedRequest {
  method: string;
  path: string;
  apikey: string | undefined;
  /** A chave global JAMAIS deve aparecer; guardamos o header inteiro para poder afirmar isso. */
  headers: Record<string, string | string[] | undefined>;
  body: { number?: string; text?: string } & Record<string, unknown>;
}

export interface FakeEvolution {
  url: string;
  requests: CapturedRequest[];
  /** Faz a PRÓXIMA requisição falhar com este status. Volta ao normal depois de uma. */
  failNextWith(status: number): void;
  close(): Promise<void>;
}

/**
 * Um servidor Evolution de mentira, para exercitar o adapter REAL até o fio.
 *
 * **Por que não um mock do axios.** Um mock afirma que o adapter chamou uma função com certos
 * argumentos — o que é uma paráfrase do próprio código do adapter, e continua verde se a URL
 * estiver malformada, se o header tiver o nome errado ou se o corpo não for JSON válido. Aqui a
 * requisição sai pela rede de verdade e é inspecionada como o Evolution a receberia: método,
 * caminho, header `apikey` e corpo já desserializado.
 *
 * O que continua não coberto é só o que está do outro lado: o Evolution de verdade entregar a
 * mensagem ao WhatsApp. Esse é o elo bloqueado até existir instância de sistema — ver
 * `Requisitos/DEPENDENCIAS_EXTERNAS.md`.
 */
export async function startFakeEvolution(port: number): Promise<FakeEvolution> {
  const requests: CapturedRequest[] = [];
  let failNext: number | null = null;

  const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      let body: Record<string, unknown> = {};
      try {
        body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      } catch {
        body = { __unparseable: raw };
      }

      requests.push({
        method: req.method ?? '',
        path: req.url ?? '',
        apikey: typeof req.headers.apikey === 'string' ? req.headers.apikey : undefined,
        headers: req.headers as Record<string, string | string[] | undefined>,
        body,
      });

      if (failNext !== null) {
        const status = failNext;
        failNext = null;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'falha simulada' }));
        return;
      }

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ key: { id: 'FAKE' }, status: 'PENDING' }));
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', (error: NodeJS.ErrnoException) => {
      reject(
        error.code === 'EADDRINUSE'
          ? new Error(
              `A porta ${port} do Evolution de teste está ocupada. Ela é fixa por necessidade de ` +
                'ordem de import (ver evolution-test-env.ts); libere a porta ou troque a constante ' +
                'nos dois arquivos.',
            )
          : error,
      );
    });
    server.listen(port, '127.0.0.1', resolve);
  });
  const bound = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${bound.port}`,
    requests,
    failNextWith(status: number) {
      failNext = status;
    },
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

/** O código de seis dígitos que o texto da mensagem carrega, entre asteriscos do WhatsApp. */
export function extractCode(text: string): string {
  const match = text.match(/\*(\d{6})\*/);
  if (!match) {
    throw new Error(`Nenhum código de 6 dígitos no texto:\n${text}`);
  }
  return match[1];
}
