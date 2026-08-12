'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSnackbar } from 'notistack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { IntentDraftPanel } from 'src/components/IntentDraftPanel';
import { useAuth } from 'src/contexts/AuthContext';
import { apiErrorMessage } from 'src/services/api';
import intentService from 'src/services/intentService';
import { IntentDraft, IntentField, IntentPlan, isSupported } from 'src/types/intent';

/**
 * A Mesa — a superfície de intenção (§4 da especificação de frontend).
 *
 * O que ela é: um campo dominante onde o operador escreve o que precisa, e o sistema traz o trabalho
 * montado para ele conferir e aprovar. **Nada é gravado antes da aprovação**, e a tela diz isso com
 * essas palavras porque é a promessa que ela está fazendo.
 *
 * O que ela NÃO tem, e por decisão registrada:
 *
 *  - **Voz.** A Web Speech API do Chrome envia o áudio para servidores do Google, e isso muda a
 *    conversa de LGPD. O parser de texto prova a arquitetura inteira sem esse peso
 *    (`DEPENDENCIAS_EXTERNAS.md` §5).
 *  - **"Feito sozinho hoje".** Não existe fonte de ações automáticas concluídas, e nesta fase nada
 *    acontece sem aprovação humana — então não há o que listar. Ornamento numa interface que pede
 *    confiança é pior que ausência: treina o operador a não ler o que a Mesa afirma.
 *  - **Lista de pendentes com itens.** O rascunho não é persistido, então ele morre ao recarregar — e
 *    isso comunica a verdade do sistema. O que aparece é o estado vazio do §4.2, que é o estado NORMAL
 *    desta fase.
 *  - **Seletor de empresa ativa.** Nenhum endpoint recebe `companyId` ainda; um seletor que não chega
 *    a endpoint nenhum é fachada. A Mesa declara em qual empresa opera, e ponto.
 */
export default function MesaPage() {
  const { user, account, role, modules } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [plan, setPlan] = useState<IntentPlan | null>(null);
  const [draft, setDraft] = useState<IntentDraft | null>(null);
  const [notSupported, setNotSupported] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const firstName = user?.name?.split(' ')[0] ?? '';

  /** "Quinta, 12 de agosto · 09:41" — como no protótipo, em pt-BR. */
  const stamp = useMemo(() => {
    const now = new Date();
    const day = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${time}`;
  }, []);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }, []);

  const reset = useCallback(() => {
    setPlan(null);
    setDraft(null);
    setNotSupported(null);
  }, []);

  async function handleSubmit() {
    const trimmed = text.trim();
    if (trimmed.length < 2 || parsing) {
      return;
    }

    setParsing(true);
    reset();
    try {
      const result = await intentService.parse(trimmed);

      if (!isSupported(result)) {
        // "Ainda não sei fazer isso" é **parte do produto, não falha** (§2) — e é o estado mais
        // frequente nesta fase de oito comandos. Por isso vai em `info`, não em `error`.
        setNotSupported(
          result.guess
            ? `Entendi que você quer: ${result.guess}. Isso eu ainda não sei fazer daqui.`
            : 'Isso eu ainda não sei fazer daqui.',
        );
        return;
      }

      setPlan(result);
      // O rascunho vem do backend, e é ele que decide o que precisa de revisão — o cliente não tem
      // voto nisso. Ver o docblock do BuildIntentDraftUseCase.
      setDraft(await intentService.draft(result.command, result.fields));
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível interpretar sua solicitação.'), {
        variant: 'error',
      });
    } finally {
      setParsing(false);
    }
  }

  function handleChangeField(field: string, value: string) {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      const updated: Record<string, IntentField> = {
        ...current.fields,
        // §6.1: editar troca a procedência para "ajustado por você" e limpa a revisão. O valor passa a
        // ser escolha do operador, e a tela precisa dizer isso — senão a procedência mente.
        [field]: { value: value === '' ? null : value, origin: 'ajustado', review: value === '' },
      };
      return {
        ...current,
        fields: updated,
        reviewFields: Object.entries(updated)
          .filter(([, item]) => item.review)
          .map(([name]) => name),
      };
    });
  }

  async function handleApprove() {
    if (!draft || saving) {
      return;
    }
    setSaving(true);
    try {
      const result = await intentService.approve(draft.draftId, draft.command, draft.fields);
      enqueueSnackbar(result.summary, { variant: 'success' });
      setText('');
      reset();
      inputRef.current?.focus();
    } catch (error) {
      // A mensagem do backend é preferida: ela sabe dizer qual campo falta ou por que o papel não
      // permite, e trocar isso por texto genérico jogaria fora a única parte útil.
      enqueueSnackbar(apiErrorMessage(error), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  /**
   * Teclado: `⏎` aprova (quando permitido), `Esc` limpa (§6.3).
   *
   * `⏎` só aprova se não houver campo em revisão — é o atrito calibrado do §6.4 aplicado ao atalho, e
   * não só ao botão. Um atalho que aprova o que o botão bloqueia seria uma porta lateral para a
   * aprovação cega que o desenho existe para evitar.
   */
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (draft || plan || notSupported) {
          event.preventDefault();
          reset();
        }
        return;
      }
      if (event.key === 'Enter' && draft && draft.reviewFields.length === 0 && !saving) {
        // Não intercepta o Enter enquanto o foco está num campo do rascunho: ali ele é digitação.
        const target = event.target as HTMLElement | null;
        if (target?.tagName === 'INPUT' && target !== inputRef.current) {
          return;
        }
        event.preventDefault();
        void handleApprove();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, plan, notSupported, saving, reset]);

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 320px' },
        gap: { xs: 4, lg: 6 },
        maxWidth: 1320,
        mx: 'auto',
        pt: { xs: 2, md: 5 },
      }}
    >
      <Box component="section" aria-label="Superfície de intenção">
        <Typography variant="overline" component="p">
          {stamp} · CORE
        </Typography>

        <Typography variant="h1" sx={{ mt: 1 }}>
          {greeting}, {firstName}.
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mt: 1.5, maxWidth: 560 }}>
          Escreva o que você precisa. Eu monto o trabalho — você corrige o que quiser e aprova.
        </Typography>

        {/* O elemento dominante da tela (§4, item 2). */}
        <TextField
          inputRef={inputRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !draft) {
              event.preventDefault();
              void handleSubmit();
            }
          }}
          placeholder="criar papel · quem pode dar desconto · ativar módulo · cadastrar empresa"
          size="medium"
          autoFocus
          inputProps={{ 'aria-label': 'O que você precisa' }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                {parsing ? (
                  <CircularProgress size={22} role="status" aria-label="Interpretando" />
                ) : (
                  <IconButton
                    onClick={() => void handleSubmit()}
                    aria-label="Interpretar"
                    disabled={text.trim().length < 2}
                  >
                    <ArrowForwardIcon />
                  </IconButton>
                )}
              </InputAdornment>
            ),
          }}
          sx={{
            mt: 4,
            '& .MuiOutlinedInput-root': {
              bgcolor: 'vx.panel',
              fontSize: '1.0625rem',
              py: 0.75,
              '& fieldset': { borderColor: 'vx.accent.300' },
            },
          }}
        />

        {notSupported ? (
          <Alert severity="info" role="status" sx={{ mt: 3 }}>
            {notSupported} Use o menu de telas — <strong>Esc</strong> traz você de volta para cá.
          </Alert>
        ) : null}

        {draft ? (
          <Box sx={{ mt: 3 }}>
            <IntentDraftPanel
              draft={draft}
              confidence={plan?.confidence ?? 0}
              unresolved={plan?.unresolved ?? []}
              saving={saving}
              onChangeField={handleChangeField}
              onApprove={() => void handleApprove()}
              onDiscard={reset}
            />
          </Box>
        ) : null}

        <Divider sx={{ my: 5 }} />

        <Typography variant="overline" component="h2">
          Já preparei — falta você olhar
        </Typography>

        {/*
         * O estado vazio do §4.2 é OBRIGATÓRIO, e é o estado normal desta fase: com o rascunho não
         * persistido, não há pendência que sobreviva a um recarregamento. Ele convida à intenção em vez
         * de pedir desculpas — "nenhuma pendência" descrito como sistema quebrado seria mentira sobre
         * um dia comum.
         */}
        <Paper
          variant="outlined"
          sx={{ mt: 1.5, p: 4, textAlign: 'center', borderStyle: 'dashed', bgcolor: 'transparent' }}
          role="status"
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Nada esperando por você.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Escreva ali em cima o que precisa — eu monto e você aprova.
          </Typography>
        </Paper>
      </Box>

      <Box component="aside" aria-label="Contexto da conta">
        <Typography variant="overline" component="h2">
          Módulos ativos nesta conta
        </Typography>

        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1.5 }}>
          {/* Reais, vindos do token via /auth/me — não uma lista fixa. */}
          {modules.length > 0 ? (
            modules.map((code) => <Chip key={code} label={code} size="small" variant="outlined" />)
          ) : (
            <Typography variant="body2" color="text.secondary">
              Nenhum módulo ativo além do CORE.
            </Typography>
          )}
        </Stack>

        {/* A nota do §3, com estas palavras — ela é o que sustenta a tese da navegação. */}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2.5, lineHeight: 1.7 }}>
          Módulo inativo nunca é proposto e não gera tela de operação. As telas de cadastro e
          configuração são CORE — fixas, não derivam de módulo. Desligar VND não tira Contato ou
          Produto daqui; tira o pedido das minhas propostas.
        </Typography>

        <Divider sx={{ my: 3 }} />

        <Typography variant="overline" component="h2">
          Conta
        </Typography>
        <Typography variant="body2" sx={{ mt: 1.5, fontWeight: 600 }}>
          {account?.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {account?.documentFormatted}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {user?.name}
          {role ? ` · ${role.name}` : ''}
        </Typography>

        {/*
         * A declaração de empresa, no lugar do seletor. Empresa é dimensão obrigatória (§3.2 do CORE:
         * estoque, numeração fiscal e emissão são POR empresa), e escolher a empresa ativa exige
         * endpoints que a recebam — nenhum recebe hoje. Declarar é honesto; um seletor que não muda
         * nada seria fachada.
         */}
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          As ações operam na empresa da conta. A escolha de empresa ativa chega com a fatia que
          fizer os endpoints receberem a empresa.
        </Typography>
      </Box>
    </Box>
  );
}
