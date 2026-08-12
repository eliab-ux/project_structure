'use client';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { FIELD_LABEL, IntentDraft, IntentField, ORIGIN_LABEL } from 'src/types/intent';

/**
 * O rascunho: o que entendemos, campo por campo, com procedência e o que falta decidir.
 *
 * Três regras da especificação vivem aqui, e nenhuma é enfeite:
 *
 * **§6.2 — campos a revisar sobem.** A ordem é `review` primeiro, e não a ordem do formulário. O
 * usuário precisa ver primeiro o que exige decisão; enterrar isso no meio de doze campos preenchidos é
 * como uma tela treina a rolar sem ler.
 *
 * **§6.1 — procedência por campo.** Todo campo diz de onde veio. Editar troca a procedência para
 * "ajustado por você" e limpa o estado de revisão — porque a partir daí o valor é escolha do operador,
 * não dedução do sistema.
 *
 * **§6.4 — atrito calibrado.** Enquanto houver campo em revisão, o botão de aprovar fica DESABILITADO
 * e o `⏎` não aprova. Uma interface que traz tudo pronto e oferece um atalho fácil treina o usuário a
 * aprovar sem ler; o atrito é o antídoto. Com confiança baixa, o aviso aparece mesmo sem campo pendente.
 */
export function IntentDraftPanel({
  draft,
  confidence,
  unresolved,
  saving,
  onChangeField,
  onApprove,
  onDiscard,
}: {
  draft: IntentDraft;
  confidence: number;
  unresolved: string[];
  saving: boolean;
  onChangeField: (field: string, value: string) => void;
  onApprove: () => void;
  onDiscard: () => void;
}) {
  const entries = Object.entries(draft.fields);
  // Revisão primeiro (§6.2). `sort` estável no V8, então a ordem original é preservada dentro de cada
  // grupo — o que evita os campos dançarem na tela a cada tecla digitada.
  const ordered = [...entries].sort((a, b) => Number(b[1].review) - Number(a[1].review));

  const pending = ordered.filter(([, field]) => field.review).length;
  const lowConfidence = confidence < 0.7;
  const blocked = pending > 0;

  return (
    <Paper
      variant="outlined"
      component="section"
      aria-label="Plano entendido"
      sx={{ p: 3, bgcolor: 'vx.panel', borderColor: 'vx.accent.300' }}
    >
      <Stack direction="row" spacing={2} sx={{ alignItems: 'baseline', mb: 0.5 }}>
        <Typography variant="h2">{draft.label}</Typography>
        <Chip
          size="small"
          variant="outlined"
          label={draft.approvals === 1 ? '1 aprovação' : `${draft.approvals} aprovações`}
        />
      </Stack>

      {/* A frase do §4, item 3 — literal, porque é a promessa que a tela está fazendo. */}
      <Typography variant="body2" color="text.secondary">
        Nada é gravado antes da sua aprovação em cada etapa.
      </Typography>

      {unresolved.length > 0 ? (
        <Alert severity="warning" role="status" sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Sua frase não disse — e eu não vou supor:
          </Typography>
          {unresolved.map((question) => (
            <Typography key={question} variant="body2" component="div">
              · {question}
            </Typography>
          ))}
        </Alert>
      ) : null}

      {lowConfidence && !blocked ? (
        <Alert severity="info" role="status" sx={{ mt: 2 }}>
          Entendi com pouca certeza. Confira os campos antes de aprovar.
        </Alert>
      ) : null}

      <Divider sx={{ my: 2.5 }} />

      <Stack spacing={2.5}>
        {ordered.map(([name, field]) => (
          <FieldRow
            key={name}
            name={name}
            field={field}
            onChange={(value) => onChangeField(name, value)}
          />
        ))}
      </Stack>

      <Stack direction="row" spacing={1.5} sx={{ mt: 3, alignItems: 'center' }}>
        <Button
          variant="contained"
          color="secondary"
          onClick={onApprove}
          disabled={blocked || saving}
        >
          {saving ? 'Aprovando…' : 'Aprovar e fazer'}
        </Button>
        <Button onClick={onDiscard} disabled={saving}>
          Descartar
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Typography variant="caption" color="text.secondary">
          {blocked
            ? `${pending} campo(s) a decidir antes de aprovar`
            : 'Enter aprova · Esc descarta'}
        </Typography>
      </Stack>
    </Paper>
  );
}

function FieldRow({
  name,
  field,
  onChange,
}: {
  name: string;
  field: IntentField;
  onChange: (value: string) => void;
}) {
  const label = FIELD_LABEL[name] ?? name;
  // Objeto (endereço) não é editável nesta fatia: um formulário aninhado dentro do rascunho é a tela
  // de Empresas de novo, e o §10 diz para não antecipar. Fica visível como texto, e a alternativa é
  // usar a tela.
  const isObject = field.value !== null && typeof field.value === 'object';

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 700 }}>
          {label}
        </Typography>
        {field.review ? (
          <Chip size="small" label="a decidir" sx={{ bgcolor: 'vx.warn', color: '#061a30' }} />
        ) : null}
        <Typography variant="caption" color="text.secondary">
          {field.origin ? ORIGIN_LABEL[field.origin] : 'sem procedência'}
        </Typography>
      </Stack>

      {isObject ? (
        <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
          {JSON.stringify(field.value)}
        </Typography>
      ) : (
        <TextField
          value={field.value === null || field.value === undefined ? '' : String(field.value)}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.review ? 'preencha para poder aprovar' : ''}
          inputProps={{ 'aria-label': label }}
          // A borda de atenção repete o que o chip já diz. Redundância deliberada: cor sozinha não
          // serve a quem não distingue matiz, e chip sozinho passa desapercebido numa lista longa.
          sx={
            field.review
              ? { '& .MuiOutlinedInput-notchedOutline': { borderColor: 'vx.warn' } }
              : undefined
          }
        />
      )}
    </Box>
  );
}
