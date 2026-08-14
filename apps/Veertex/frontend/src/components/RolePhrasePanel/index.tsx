'use client';

import { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { PermissionDecision, PermissionPhraseReading, Role } from 'src/types/admin';

/**
 * A LEITURA DA FRASE (§5.1) — a tradução linha a linha, com estado e com o porquê.
 *
 * > "A Ana pode vender, mas não pode mexer em preço nem dar desconto."
 *
 * Três coisas que este painel faz e que não são decoração:
 *
 * **1. "A decidir" sobe e trava.** As permissões que a frase não mencionou aparecem PRIMEIRO, e o
 * botão de aplicar fica desabilitado enquanto restar uma. É a regra de não-default-silencioso
 * renderizada em UI: o silêncio da frase não vira permitido nem negado — vira uma pergunta ao
 * humano. Enterrar essas linhas no fim da lista seria o mesmo que resolvê-las por omissão.
 *
 * **2. Toda decisão mostra o trecho que a originou**, entre aspas, literal. O backend descarta
 * citação que não aparece na frase (o modelo não pode inventar evidência), então o que está entre
 * aspas aqui é sempre algo que o usuário escreveu — e é o que permite a ele discordar da tradução
 * em vez de aceitá-la por não ter como conferir.
 *
 * **3. "Manter como está" é uma opção de primeira classe** para papel existente. Uma permissão que
 * a frase não citou não deveria mudar só porque outra mudou — e obrigar o usuário a escolher entre
 * permitir e negar transformaria a omissão numa escolha forçada, que é o defeito ao contrário.
 */
export function RolePhrasePanel({
  role,
  reading,
  saving,
  onApply,
  onDiscard,
}: {
  role: Role;
  reading: PermissionPhraseReading;
  saving: boolean;
  onApply: (permissions: string[]) => void;
  onDiscard: () => void;
}) {
  /**
   * As decisões do HUMANO, por permissão. Começam vazias: nada aqui é pré-preenchido pela leitura.
   *
   * O que o tradutor decidiu vive em `reading`; o que a pessoa decidiu vive aqui. Misturar os dois
   * num estado só apagaria a distinção que a tela existe para mostrar — e o "ajustado por você"
   * viraria indistinguível do "a IA entendeu assim".
   */
  const [resolved, setResolved] = useState<Record<string, PermissionDecision>>({});

  const ordered = useMemo(() => {
    const weight = (decision: PermissionDecision) => (decision === 'undecided' ? 0 : 1);
    return [...reading.verdicts].sort(
      (a, b) =>
        weight(effective(a.decision, resolved[a.permission])) -
        weight(effective(b.decision, resolved[b.permission])),
    );
  }, [reading.verdicts, resolved]);

  const pending = ordered.filter(
    (verdict) => effective(verdict.decision, resolved[verdict.permission]) === 'undecided',
  );

  /**
   * O resultado: a lista de permissões que o papel passa a ter.
   *
   * `denied` e "não decidido" produzem o mesmo efeito na persistência — a permissão fica fora da
   * lista —, e é justamente por isso que a tela não deixa salvar com pendência: no banco os dois
   * são indistinguíveis, então a distinção precisa acontecer ANTES, com o humano.
   */
  const nextPermissions = useMemo(() => {
    const result = new Set<string>();
    for (const verdict of reading.verdicts) {
      const decision = effective(verdict.decision, resolved[verdict.permission]);
      if (decision === 'granted') {
        result.add(verdict.permission);
      }
    }
    // O curinga não é traduzível por frase: ele concede tudo o que existe HOJE e tudo o que for
    // criado amanhã. Se o papel já o tem, ele é preservado — tirá-lo por silêncio da frase seria a
    // maior mudança possível feita por omissão.
    if (role.permissions.includes('*')) {
      result.add('*');
    }
    return [...result];
  }, [reading.verdicts, resolved, role.permissions]);

  /**
   * O papel administra papéis HOJE e deixaria de administrar depois de aplicar.
   *
   * `grants()` do backend aceita curinga por segmento; aqui basta o caso literal e o global, que são
   * os dois que a tela de papéis produz — o catálogo não gera `roles.*` por si.
   */
  const administersRoles = (permissions: readonly string[]) =>
    permissions.includes('*') || permissions.includes('roles.update');
  const losesRoleAdministration =
    administersRoles(role.permissions) && !administersRoles(nextPermissions);

  /**
   * O papel tem o curinga `*`, e por isso a frase não muda nada de efetivo.
   *
   * Preservar o `*` em silêncio é a decisão certa — tirá-lo porque a frase não o mencionou seria a
   * maior alteração possível feita por omissão. Mas silêncio na TELA sobre uma aplicação que não
   * altera nada parece defeito: o usuário decide oito permissões, clica em aplicar, e nada acontece.
   * Então a tela diz o que está acontecendo e o que fazer se for isso que ele quer de fato.
   */
  const hasWildcard = role.permissions.includes('*');

  return (
    <Paper
      variant="outlined"
      component="section"
      aria-label="Tradução da frase"
      sx={{ p: 3, bgcolor: 'vx.panel', borderColor: 'vx.accent.300' }}
    >
      <Typography variant="h2" sx={{ fontSize: '1.0625rem' }}>
        O que eu entendi para {role.name}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        Nada é gravado antes de você aplicar.
      </Typography>

      {hasWildcard ? (
        <Alert severity="info" role="status" sx={{ mt: 2 }}>
          <strong>{role.name} tem acesso total (curinga “*”), e a frase não vai mudar isso.</strong>{' '}
          O curinga concede tudo o que existe hoje e tudo o que for criado depois, então ele
          continua valendo mesmo que você negue permissões abaixo — e eu não o removo por conta
          própria, porque sua frase não falou dele. Para de fato limitar este papel, tire o acesso
          total pela lista completa de permissões, abaixo nesta página.
        </Alert>
      ) : null}

      <Box sx={{ mt: 2.5 }}>
        <Typography variant="overline" component="h3">
          Sua frase, linha a linha
        </Typography>
        <Stack component="ol" spacing={0.5} sx={{ pl: 2.5, mt: 0.5, mb: 0 }}>
          {reading.lines.map((line, index) => (
            <Typography component="li" variant="body2" key={`${line}-${index}`}>
              {line}
            </Typography>
          ))}
        </Stack>
      </Box>

      <Divider sx={{ my: 2.5 }} />

      {pending.length > 0 ? (
        <Alert severity="warning" role="status" sx={{ mb: 2 }}>
          <strong>
            {pending.length === 1
              ? '1 permissão que sua frase não mencionou.'
              : `${pending.length} permissões que sua frase não mencionaram.`}
          </strong>{' '}
          Eu não vou supor — decida cada uma antes de aplicar.
        </Alert>
      ) : null}

      {/*
       * O RISCO DE TRANCAR A CONTA, dito ANTES da ação (§5.1).
       *
       * A trava anti-lockout é do backend: uma alteração que deixe a conta sem nenhum usuário ativo
       * capaz de administrar papéis é recusada lá. A tela **não recalcula essa regra** — para isso
       * precisaria saber quantos usuários ativos existem em cada papel, e uma segunda implementação
       * da regra divergiria da primeira exatamente no caso raro em que ela importa.
       *
       * O que dá para dizer sem duplicar nada é o que está aqui: este papel administra papéis hoje,
       * e a alteração tira isso dele. Avisar do risco é honesto; afirmar que vai ser recusado seria
       * afirmar o que a tela não sabe.
       */}
      {losesRoleAdministration ? (
        <Alert severity="warning" role="status" sx={{ mb: 2 }}>
          <strong>Atenção: este papel administra papéis hoje.</strong> Você está tirando dele a
          permissão <code>roles.update</code>. Se ninguém mais na conta puder administrar papéis, o
          sistema vai recusar a alteração — e é assim mesmo: sem isso a conta ficaria trancada, sem
          ninguém capaz de devolver a permissão a quem quer que seja.
        </Alert>
      ) : null}

      <Stack spacing={1.5}>
        {ordered.map((verdict) => (
          <VerdictRow
            key={verdict.permission}
            permission={verdict.permission}
            quote={verdict.quote}
            reason={verdict.reason}
            decision={effective(verdict.decision, resolved[verdict.permission])}
            fromPhrase={verdict.decision !== 'undecided'}
            currentlyGranted={role.permissions.includes(verdict.permission)}
            adjusted={resolved[verdict.permission] !== undefined}
            onDecide={(decision) =>
              setResolved((current) => ({ ...current, [verdict.permission]: decision }))
            }
          />
        ))}
      </Stack>

      <Stack direction="row" spacing={1.5} sx={{ mt: 3, alignItems: 'center' }}>
        <Button
          variant="contained"
          color="secondary"
          disabled={pending.length > 0 || saving}
          onClick={() => onApply(nextPermissions)}
        >
          {saving ? 'Aplicando…' : 'Aplicar ao papel'}
        </Button>
        <Button onClick={onDiscard} disabled={saving}>
          Descartar
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Typography variant="caption" color="text.secondary">
          {pending.length > 0
            ? `${pending.length} a decidir`
            : `${nextPermissions.length} permissão(ões) no papel depois de aplicar`}
        </Typography>
      </Stack>
    </Paper>
  );
}

/** A decisão do humano vence a do tradutor — e só existe quando ele decidiu de fato. */
function effective(
  fromPhrase: PermissionDecision,
  fromHuman: PermissionDecision | undefined,
): PermissionDecision {
  return fromHuman ?? fromPhrase;
}

function VerdictRow({
  permission,
  quote,
  reason,
  decision,
  fromPhrase,
  currentlyGranted,
  adjusted,
  onDecide,
}: {
  permission: string;
  quote: string | null;
  reason: string;
  decision: PermissionDecision;
  fromPhrase: boolean;
  currentlyGranted: boolean;
  adjusted: boolean;
  onDecide: (decision: PermissionDecision) => void;
}) {
  const undecided = decision === 'undecided';

  return (
    <Box
      sx={{
        p: 1.75,
        borderRadius: 1,
        border: '1px solid',
        borderColor: undecided ? 'vx.warn' : 'vx.neutral.400',
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
              {permission}
            </Typography>
            {currentlyGranted ? (
              <Chip size="small" variant="outlined" label="o papel já tem hoje" />
            ) : null}
            {adjusted ? <Chip size="small" variant="outlined" label="ajustado por você" /> : null}
          </Stack>

          {/* A evidência. Entre aspas e literal — o backend recusa citação que não está na frase. */}
          {quote ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              “{quote}” — {reason}
            </Typography>
          ) : (
            <Typography
              variant="body2"
              sx={{ mt: 0.5, color: fromPhrase ? 'text.secondary' : 'vx.warn' }}
            >
              {reason}
            </Typography>
          )}
        </Box>

        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexShrink: 0 }}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={undecided ? null : decision}
            onChange={(_event, value: PermissionDecision | null) => {
              if (value) {
                onDecide(value);
              }
            }}
            aria-label={`Decisão para ${permission}`}
          >
            <ToggleButton value="granted" aria-label="Permitir">
              Permitir
            </ToggleButton>
            <ToggleButton value="denied" aria-label="Negar">
              Negar
            </ToggleButton>
          </ToggleButtonGroup>

          {/*
           * "Manter como está" resolve a pendência SEM mudar nada, e é uma decisão explícita — não
           * um pulo. Para papel existente costuma ser a resposta certa: a frase falava de outra
           * coisa. Fica FORA do grupo de propósito: ele é um atalho para um dos dois estados, não um
           * terceiro estado — dentro do grupo, "manter" apareceria selecionado junto com "permitir",
           * e dois botões acesos numa escolha exclusiva é uma tela mentindo sobre o próprio estado.
           */}
          {undecided ? (
            <Button
              size="small"
              onClick={() => onDecide(currentlyGranted ? 'granted' : 'denied')}
              sx={{ whiteSpace: 'nowrap' }}
            >
              Manter como está
            </Button>
          ) : null}
        </Stack>
      </Stack>
    </Box>
  );
}
