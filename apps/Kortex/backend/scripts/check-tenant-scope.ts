/**
 * Verificador do isolamento multiconta — DoD da Fase 1: "nenhum repositório consulta sem filtro de
 * `account_id`".
 *
 * O Kortex não usa RLS (spec §0.6): o escopo é responsabilidade da aplicação. Isso significa que
 * uma única consulta sem filtro de conta entrega dados de um cliente a outro, e é o tipo de coisa
 * que passa por revisão porque a linha parece certa isoladamente. Este script lê os repositórios,
 * encontra toda chamada de consulta e exige que o filtro carregue a chave de escopo do arquivo.
 *
 *   npm run check:tenant-scope -w apps/Kortex/backend
 *
 * As exceções são declaradas aqui embaixo, com motivo, e aparecem no relatório toda vez que ele
 * roda. Exceção que ninguém vê é exceção que vira regra.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const REPOSITORIES_DIR = join(
  __dirname,
  '..',
  'src',
  'infrastructure',
  'persistence',
  'mikro-orm',
  'repositories',
);

/** Métodos do MikroORM que leem ou escrevem com filtro. */
const QUERY_METHODS = [
  'find',
  'findOne',
  'findOneOrFail',
  'findAll',
  'count',
  'nativeDelete',
  'nativeUpdate',
  // SQL cru também é consulta. Sem isto, um `raw` num repositório passaria sem ninguém conferir
  // o `account_id` — e é justamente onde o filtro é mais fácil de esquecer.
  'raw',
  'execute',
];

/** Chave de escopo aceita por arquivo. */
const SCOPE_KEY_BY_FILE: Record<string, string[]> = {
  // `account` É o tenant: o próprio `id` é a chave de escopo.
  'mikro-orm-account.repository.ts': ['id'],
  'mikro-orm-business-hour.repository.ts': ['accountId'],
  'mikro-orm-machine.repository.ts': ['accountId'],
  'mikro-orm-user.repository.ts': ['accountId'],
  'mikro-orm-phone-change-audit.repository.ts': ['accountId'],
  'mikro-orm-customer.repository.ts': ['accountId'],
  'mikro-orm-catalog.repository.ts': ['accountId'],
  'mikro-orm-pre-order.repository.ts': ['accountId'],
  'mikro-orm-waiting-list.repository.ts': ['accountId'],
  'mikro-orm-schedule.repository.ts': ['accountId'],
  // O SQL cru do histórico filtra por `account_id = ?` — o verificador aceita as duas grafias.
  'mikro-orm-cut.repository.ts': ['accountId', 'account_id'],
  // Lê a tabela `cut` a partir do contexto de pré-pedido — conta cortes concluídos do tecido.
  'mikro-orm-cut-history.repository.ts': ['accountId'],
  // DRE e saldos são agregações em SQL cru; o filtro vai como `e.account_id = ?` / `b.account_id = ?`.
  'mikro-orm-finance.repository.ts': ['accountId', 'account_id'],
  // O fluxo de recuperação começa anônimo, sem token e portanto sem conta. O `userId` é um escopo
  // mais estreito que a conta inteira.
  'mikro-orm-password-reset-code.repository.ts': ['userId', 'id'],
};

/** Exceções conscientes: método → motivo. Aparecem no relatório sempre. */
const ALLOWED_EXCEPTIONS: Record<string, string> = {
  'mikro-orm-user.repository.ts#findByEmailGlobally':
    'Login: descobre a conta a partir do e-mail. Não existe accountId para filtrar antes de saber quem é o usuário.',
};

interface Finding {
  file: string;
  method: string;
  call: string;
  ok: boolean;
  exception?: string;
}

/**
 * Apaga comentários e literais de string, trocando o conteúdo por espaços.
 *
 * Sem isto o verificador acusa o próprio comentário: uma linha que **explica** uma consulta
 * (`// nunca faça this.repo.find(where)`) é lida como a consulta em si, dá FALHA, e a correção
 * óbvia — declarar uma exceção — enfraqueceria a checagem por causa de um texto.
 *
 * Os espaços mantêm o comprimento original, então as posições continuam apontando para as linhas
 * certas. Strings também somem: um `'accountId:'` dentro de uma mensagem não pode passar por
 * filtro de verdade.
 */
function blankCommentsAndStrings(source: string): string {
  const out = source.split('');
  let i = 0;

  const blankUntil = (end: number) => {
    for (let j = i; j < end && j < out.length; j += 1) {
      if (out[j] !== '\n') {
        out[j] = ' ';
      }
    }
  };

  while (i < source.length) {
    const two = source.slice(i, i + 2);

    if (two === '//') {
      const end = source.indexOf('\n', i);
      blankUntil(end === -1 ? source.length : end);
      i = end === -1 ? source.length : end;
      continue;
    }

    if (two === '/*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? source.length : end + 2;
      blankUntil(stop);
      i = stop;
      continue;
    }

    const char = source[i];
    if (char === "'" || char === '"' || char === '`') {
      let j = i + 1;
      while (j < source.length) {
        if (source[j] === '\\') {
          j += 2;
          continue;
        }
        if (source[j] === char) {
          break;
        }
        j += 1;
      }
      // Mantém as aspas e apaga só o miolo, para o balanceamento de parênteses não se perder.
      i += 1;
      blankUntil(j);
      i = j + 1;
      continue;
    }

    i += 1;
  }

  return out.join('');
}

/**
 * Fim do parêntese que abre em `openIndex`.
 *
 * Trabalha sobre a fonte já limpa, para que um parêntese dentro de string ou comentário não
 * desequilibre a contagem.
 */
function findBalancedEnd(source: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < source.length; i += 1) {
    const char = source[i];
    if (char === '(') depth += 1;
    if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }
  return source.length;
}

/**
 * Métodos cujo filtro de escopo vive DENTRO de uma string — o SQL cru.
 *
 * Para eles o verificador lê o argumento na fonte ORIGINAL, não na limpa: apagar a string
 * apagaria justamente o `account_id = ?` que se quer conferir. Para todo o resto continua lendo a
 * fonte limpa, senão um `'accountId:'` escrito numa mensagem passaria por filtro de verdade.
 */
const RAW_SQL_METHODS = new Set(['raw', 'execute']);

function analyze(file: string, rawSource: string): Finding[] {
  // Só o código, sem comentários nem strings — ver `blankCommentsAndStrings`.
  const source = blankCommentsAndStrings(rawSource);
  const scopeKeys = SCOPE_KEY_BY_FILE[file];
  if (!scopeKeys) {
    return [
      {
        file,
        method: '(arquivo)',
        call: '—',
        ok: false,
        exception: 'Repositório sem chave de escopo declarada em SCOPE_KEY_BY_FILE.',
      },
    ];
  }

  const findings: Finding[] = [];
  const methodPattern = /^\s{2}(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/gm;

  // Mapeia [posição no arquivo] → nome do método, para saber a que método pertence cada consulta.
  const methods: { name: string; start: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = methodPattern.exec(source)) !== null) {
    if (!['constructor', 'if', 'for', 'while', 'catch', 'switch'].includes(match[1])) {
      methods.push({ name: match[1], start: match.index });
    }
  }

  const methodAt = (index: number): string => {
    let current = '(fora de método)';
    for (const method of methods) {
      if (method.start <= index) current = method.name;
      else break;
    }
    return current;
  };

  for (const queryMethod of QUERY_METHODS) {
    const callPattern = new RegExp(`\\.${queryMethod}\\s*\\(`, 'g');
    while ((match = callPattern.exec(source)) !== null) {
      const openIndex = match.index + match[0].length - 1;
      const closeIndex = findBalancedEnd(source, openIndex);
      // As posições são preservadas pelo `blankCommentsAndStrings` (ele troca por espaços do
      // mesmo comprimento), então o mesmo recorte serve nas duas fontes.
      const args = RAW_SQL_METHODS.has(queryMethod)
        ? rawSource.slice(openIndex + 1, closeIndex)
        : source.slice(openIndex + 1, closeIndex);
      const method = methodAt(match.index);
      const key = `${file}#${method}`;

      if (ALLOWED_EXCEPTIONS[key]) {
        findings.push({
          file,
          method,
          call: queryMethod,
          ok: true,
          exception: ALLOWED_EXCEPTIONS[key],
        });
        continue;
      }

      /**
       * `array.find((x) => ...)` não é consulta — e acusá-lo seria pior que não acusar nada.
       *
       * O `Array.prototype.find` tem o mesmo nome do `find` do MikroORM, e um repositório
       * legitimamente usa os dois. Ferramenta de segurança que aponta o dedo para código correto
       * treina quem lê a ignorá-la; a distinção é segura porque o MikroORM **nunca** recebe
       * callback como primeiro argumento — ele recebe o objeto de filtro.
       */
      if (/^\s*(\(?\s*[A-Za-z_$][\w$]*\s*(:[^)]*)?\)?\s*=>|function\b)/.test(args)) {
        continue;
      }

      // `accountId:` no objeto de filtro do MikroORM, ou `account_id =` / `account_id in` no
      // SQL cru. As duas formas contam como escopo declarado.
      const scoped = scopeKeys.some((scopeKey) =>
        new RegExp(`\\b${scopeKey}\\s*(:|=|\\bin\\b)`).test(args),
      );
      findings.push({ file, method, call: queryMethod, ok: scoped });
    }
  }

  return findings;
}

function main(): void {
  const files = readdirSync(REPOSITORIES_DIR).filter((file) => file.endsWith('.repository.ts'));
  const findings = files.flatMap((file) =>
    analyze(file, readFileSync(join(REPOSITORIES_DIR, file), 'utf8')),
  );

  const violations = findings.filter((finding) => !finding.ok);
  const exceptions = findings.filter((finding) => finding.ok && finding.exception);

  /* eslint-disable no-console */
  console.log(`\nEscopo multiconta — ${files.length} repositórios, ${findings.length} consultas\n`);

  for (const finding of findings) {
    const mark = finding.ok ? '  ok  ' : ' FALHA';
    console.log(`${mark}  ${finding.file} → ${finding.method}() → .${finding.call}()`);
  }

  if (exceptions.length > 0) {
    console.log('\nExceções declaradas (revise se ainda se justificam):');
    for (const finding of exceptions) {
      console.log(`  • ${finding.file}#${finding.method}: ${finding.exception}`);
    }
  }

  if (violations.length > 0) {
    console.error(`\n❌ ${violations.length} consulta(s) sem filtro de escopo:`);
    for (const violation of violations) {
      console.error(
        `  • ${violation.file} → ${violation.method}() → .${violation.call}()` +
          `${violation.exception ? ` — ${violation.exception}` : ''}`,
      );
    }
    console.error(
      '\nToda consulta precisa filtrar pela chave de escopo do repositório. Se houver um motivo ' +
        'real para não filtrar, declare-o em ALLOWED_EXCEPTIONS com a justificativa.\n',
    );
    process.exit(1);
  }

  console.log('\n✅ Todas as consultas estão escopadas.\n');
  /* eslint-enable no-console */
}

main();
