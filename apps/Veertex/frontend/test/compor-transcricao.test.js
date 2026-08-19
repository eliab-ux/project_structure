/**
 * Teste de `src/hooks/comporTranscricao.ts` — a composição do texto do ditado em tempo real.
 *
 *   cd apps/Veertex/frontend && npm test
 *
 * ## Por que existe, e por que é assim
 *
 * `CLAUDE.md`, regra 6: **código que produz o texto que alguém vai aprovar precisa de teste
 * próprio.** A página de medição do microfone errou três vezes exatamente onde deveria medir, e nas
 * três o número errado tinha a aparência do certo. O ditado em tempo real é a mesma família de
 * problema: reemite o texto inteiro a cada 200 ms, e um erro de composição produz uma frase
 * plausível — que o operador aprovaria.
 *
 * **Sem framework, de propósito.** O frontend não tem infraestrutura de teste, e trazer jest +
 * testing-library é dependência nova (gatilho de parada do `CLAUDE.md`). Isto usa só o `tsc` que já
 * está no repositório: compila o módulo puro num diretório temporário e o executa. É o módulo REAL —
 * se ele mudar, o teste vê. Reimplementar a lógica aqui seria criar a segunda fonte de verdade que
 * este projeto recusa em toda parte.
 *
 * Quando o frontend ganhar suíte de verdade, estes casos migram como estão.
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const APP = path.resolve(__dirname, '..');
const FONTE = path.join(APP, 'src/hooks/comporTranscricao.ts');
const SAIDA = fs.mkdtempSync(path.join(os.tmpdir(), 'compor-'));

// O typescript é hoisted para a raiz do monorepo. `.bin/tsc.cmd` não é executável direto pelo spawn
// do Node no Windows (EINVAL), então chamamos o JS do compilador com o próprio node.
function acharTsc() {
  let dir = APP;
  for (let i = 0; i < 6; i += 1) {
    const candidato = path.join(dir, 'node_modules/typescript/lib/tsc.js');
    if (fs.existsSync(candidato)) {
      return candidato;
    }
    dir = path.dirname(dir);
  }
  throw new Error('typescript não encontrado — rode `npm install` na raiz do monorepo');
}

execFileSync(
  process.execPath,
  [acharTsc(), FONTE, '--outDir', SAIDA, '--module', 'commonjs', '--target', 'ES2020', '--strict'],
  { stdio: 'inherit' },
);

const { comporTranscricao } = require(path.join(SAIDA, 'comporTranscricao.js'));

const seg = (transcript, isFinal) => ({ isFinal, 0: { transcript } });
const ev = (...segmentos) => ({ results: segmentos });

const casos = [];
const checar = (nome, obtido, esperado) => {
  casos.push({ nome, igual: JSON.stringify(obtido) === JSON.stringify(esperado), obtido, esperado });
};

// 1. Só hipótese: o campo NÃO muda. O provisório não pode entrar no texto que será aprovado.
checar('parcial não entra no campo', comporTranscricao('', ev(seg('ativar', false))), {
  texto: '',
  parcial: 'ativar',
});

// 2. A hipótese vira definitiva: agora sim o campo recebe.
checar('final entra no campo', comporTranscricao('', ev(seg('ativar módulo VND', true))), {
  texto: 'ativar módulo VND',
  parcial: '',
});

// 3. Definitivo e nova hipótese no mesmo evento — o caso mais comum durante a fala.
checar(
  'final firmado e parcial em curso convivem',
  comporTranscricao('', ev(seg('ativar módulo VND', true), seg('criar', false))),
  { texto: 'ativar módulo VND', parcial: 'criar' },
);

// 4. REEMISSÃO do mesmo evento não duplica. É o defeito que a página de medição cometeu duas vezes,
//    e a razão de a composição RECONSTRUIR em vez de acumular.
const eventoRepetido = ev(seg('ativar módulo VND', true), seg('criar papel', true));
checar('reemissão não duplica (1ª vez)', comporTranscricao('', eventoRepetido), {
  texto: 'ativar módulo VND criar papel',
  parcial: '',
});
checar('reemissão não duplica (2ª vez, mesmo evento)', comporTranscricao('', eventoRepetido), {
  texto: 'ativar módulo VND criar papel',
  parcial: '',
});

// 5. A base é preservada: ditar duas vezes complementa o que já estava escrito, não apaga.
checar('base preservada', comporTranscricao('cadastrar cliente', ev(seg('Nilton', true))), {
  texto: 'cadastrar cliente Nilton',
  parcial: '',
});

// 6. Base com espaço sobrando não produz espaço duplo. ESTE CASO ACHOU UM DEFEITO REAL: a versão
//    inicial usava `${base} ${firmado}`.trim(), e o trim não corta o meio.
checar(
  'base com espaço não duplica espaço',
  comporTranscricao('  cadastrar cliente  ', ev(seg('Nilton', true))),
  { texto: 'cadastrar cliente Nilton', parcial: '' },
);

// 7. Evento sem resultado (acontece no fim da sessão) não apaga o que estava no campo.
checar('evento sem resultado preserva a base', comporTranscricao('já escrito', ev()), {
  texto: 'já escrito',
  parcial: '',
});

// 8. Vários parciais no mesmo evento: o motor divide a hipótese em pedaços.
checar(
  'parciais múltiplos são unidos',
  comporTranscricao('', ev(seg('desativar módulo', false), seg('cobre', false))),
  { texto: '', parcial: 'desativar módulo cobre' },
);

// 9. Sequência REAL da medição de 19/08/2026: o parcial crescendo e firmando no fim.
let ultimo = null;
for (const evento of [
  ev(seg('desativar modo', false)),
  ev(seg('desativar modo cobre', false)),
  ev(seg('desativar modo cobre para conta casa tem', false)),
  ev(seg('desativar modo cobre para conta casa tem', true)),
]) {
  ultimo = comporTranscricao('', evento);
}
checar('sequência real firma no fim, sem repetir', ultimo, {
  texto: 'desativar modo cobre para conta casa tem',
  parcial: '',
});

const falhas = casos.filter((c) => !c.igual);
for (const c of casos) {
  console.log(`${c.igual ? 'ok  ' : 'FALHA'} ${c.nome}`);
  if (!c.igual) {
    console.log(`      esperado: ${JSON.stringify(c.esperado)}`);
    console.log(`      obtido:   ${JSON.stringify(c.obtido)}`);
  }
}
console.log(`\n${casos.length - falhas.length}/${casos.length} casos`);
fs.rmSync(SAIDA, { recursive: true, force: true });
process.exit(falhas.length ? 1 : 0);
