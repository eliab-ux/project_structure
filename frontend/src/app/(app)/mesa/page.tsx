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
import {
  IntentDraft,
  IntentField,
  IntentNotSupported,
  IntentPlan,
  isSupported,
} from 'src/types/intent';

/**
 * Exemplos do placeholder — todos são comandos que EXISTEM no catálogo e que o tradutor reconhece.
 *
 * Isto não é detalhe de redação. Um exemplo sugerido pela própria tela que termina em "ainda não sei
 * fazer isso" queima a confiança na primeira tentativa, e é a primeira tentativa que decide se o
 * operador volta ao campo ou vai direto ao menu. Consulta ("quem pode dar desconto") está fora de
 * propósito: o catálogo tem oito comandos de ESCRITA e nenhum de leitura — e, pior, uma pergunta
 * dessas cai na regra de permissões e proporia uma ALTERAÇÃO de papel para quem só perguntou.
 *
 * Ao acrescentar comando ao catálogo, este texto é candidato a mudar; ao remover, é obrigatório.
 */
const PLACEHOLDER_EXAMPLES = [
  'criar papel de supervisor',
  'cadastrar empresa',
  'criar usuário',
  'ativar módulo',
].join(' · ');

/** CORE primeiro; o resto em ordem alfabética. Ver o comentário em `ModuleChips`. */
function orderModules(codes: readonly string[]): string[] {
  return [...codes].sort((a, b) => {
    if (a === 'CORE') return -1;
    if (b === 'CORE') return 1;
    return a.localeCompare(b);
  });
}

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
  // O objeto inteiro, e não só a frase: a recusa carrega a lista do que o sistema sabe fazer, e é
  // nela que o operador descobre o alcance do campo sem ter de adivinhar comando por comando.
  const [rejection, setRejection] = useState<IntentNotSupported | null>(null);

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
    setRejection(null);
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
        setRejection(result);
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
        if (draft || plan || rejection) {
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
  }, [draft, plan, rejection, saving, reset]);

  return (
    <Box
      sx={{
        display: 'grid',
        /*
         * A coluna da direita é CONTEXTO, não conteúdo — por isso ela é a menor e é a que encolhe.
         * Antes eram 320px contra um centro limitado a 1320: numa tela larga sobrava um terço da
         * página vazio, e a lateral (que é curta por natureza) terminava no meio da altura, parecendo
         * interrompida. Três mudanças resolvem, e nenhuma é decoração:
         *
         *  - 280px em vez de 320: o conteúdo dela é chip curto e texto de apoio;
         *  - centro até 1520 no total: a intenção é o elemento dominante do §4, e largura é o que
         *    torna um campo dominante — encolhê-lo para caber uma lateral inverte a hierarquia;
         *  - `alignItems: start` + lateral em painel `sticky`: ela deixa de ser uma coluna que para no
         *    meio e passa a ser um painel que acompanha a leitura e termina onde declara terminar.
         */
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 280px' },
        alignItems: 'start',
        gap: { xs: 4, lg: 5 },
        maxWidth: 1520,
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
          placeholder={PLACEHOLDER_EXAMPLES}
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

        {rejection ? <RejectionPanel rejection={rejection} /> : null}

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

      <Paper
        component="aside"
        aria-label="Contexto da conta"
        variant="outlined"
        sx={{
          p: 2.5,
          bgcolor: 'vx.panel',
          // Acompanha a rolagem: a Mesa cresce para baixo com o rascunho, e o contexto da conta é
          // justamente o que se quer ver enquanto se confere o rascunho.
          position: { lg: 'sticky' },
          top: { lg: 88 },
        }}
      >
        <Typography variant="overline" component="h2">
          Módulos ativos nesta conta
        </Typography>

        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1.5 }}>
          {/*
           * Reais, vindos do token via /auth/me — não uma lista fixa.
           *
           * CORE PRIMEIRO, e visualmente distinto: ele é o único módulo que não se desativa, e em
           * ordem alfabética aparecia no meio, como um entre iguais. Ordem e preenchimento dizem o
           * que ele é sem precisar de legenda.
           */}
          {modules.length > 0 ? (
            orderModules(modules).map((code) => (
              <Chip
                key={code}
                label={code}
                size="small"
                variant={code === 'CORE' ? 'filled' : 'outlined'}
                color={code === 'CORE' ? 'secondary' : 'default'}
                title={code === 'CORE' ? 'Base do sistema — sempre ativa' : undefined}
              />
            ))
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
      </Paper>
    </Box>
  );
}

/**
 * A recusa — "ainda não sei fazer isso" **acompanhada do que eu sei fazer**.
 *
 * Por que a lista vive aqui e não num painel permanente de ajuda: a recusa é o único momento em que a
 * pergunta "então o que você faz?" está de fato na cabeça do operador. Um catálogo sempre visível
 * viraria mobília ignorada; aqui ele é resposta.
 *
 * Os itens NÃO são clicáveis, e isso é decisão, não falta de acabamento. O rótulo de um comando não é
 * uma frase que o tradutor reconheça em todos os casos — "Ativar ou desativar módulo" não é o que se
 * escreve. Um item clicável que preenchesse o campo com texto que volta em recusa seria exatamente o
 * defeito que estamos corrigindo, uma camada mais fundo.
 *
 * `severity="info"`, nunca `error`: a resposta é parte do produto (§2). E `role="status"`, não
 * `alert` — leitor de tela anuncia sem interromper o que o usuário está fazendo.
 */
function RejectionPanel({ rejection }: { rejection: IntentNotSupported }) {
  return (
    <Alert severity="info" role="status" sx={{ mt: 3 }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {rejection.guess
          ? `Entendi que você quer: ${rejection.guess}. Isso eu ainda não sei fazer daqui.`
          : 'Isso eu ainda não sei fazer daqui.'}
      </Typography>

      {rejection.available.length > 0 ? (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            O que eu sei fazer por escrito hoje:
          </Typography>
          <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
            {rejection.available.map((option) => (
              <Typography key={option.command} component="li" variant="body2">
                {option.label}
              </Typography>
            ))}
          </Box>
        </Box>
      ) : (
        // Lista vazia tem significado próprio: o papel deste usuário não tem permissão de escrita
        // nenhuma. Dizer "nada" aqui é mais honesto do que listar o que ele receberia um 403 ao tentar.
        <Typography variant="body2" sx={{ mt: 1.5 }}>
          Seu papel não permite alterações por aqui — fale com quem administra a conta.
        </Typography>
      )}

      <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
        O resto ainda é pelas telas. <strong>Esc</strong> traz você de volta para cá.
      </Typography>
    </Alert>
  );
}
