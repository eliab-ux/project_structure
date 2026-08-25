'use client';

import { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { ErrorState, Loading, formatDateTime } from 'src/components/common/common';
import { apiErrorMessage } from 'src/services/api';
import { publicApprovalService } from 'src/services/services';
import type { ApprovalDecisionResult, ApprovalPage } from 'src/types/api';

/**
 * The public approval page (FASE 10, screen 8; §8 item 4).
 *
 * Mobile-first and login-free, because the person opening it may not be a user of the system at all — a
 * lawyer or a chief of staff who taps a link on their phone (§8 item 2).
 *
 * Three decisions in this screen carry the requirement:
 *
 *  1. **The `content_hash` is shown**, and labelled as the version. §8 explains why: "Ana aprovou às
 *     14h32" is weak; "Ana aprovou a versão a1b2c3… às 14h32" is defensible, and she should be able to see
 *     the same identifier the record will carry.
 *  2. **The rendered samples are shown, not just the template.** The approver is authorising what people
 *     will actually receive, and `{{primeiro_nome|amigo}}` is not that.
 *  3. **No account information anywhere.** No account name, no audience size, no other content. Whoever
 *     holds this link gets exactly one message and nothing that maps the campaign.
 */
export default function PublicApprovalPage({ params }: { params: { token: string } }) {
  const [page, setPage] = useState<ApprovalPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ApprovalDecisionResult | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setPage(await publicApprovalService.page(params.token));
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Este link de aprovação não é mais válido.'));
    }
  }, [params.token]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(decision: 'APPROVE' | 'REJECT') {
    setSubmitting(true);
    try {
      setResult(await publicApprovalService.decide(params.token, decision, comment || undefined));
    } catch (caught) {
      setError(apiErrorMessage(caught, 'Não foi possível registrar sua decisão.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <Container component="main" maxWidth="sm" sx={{ py: 6 }}>
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          {result.decision === 'APPROVED' ? (
            <CheckCircleIcon color="success" sx={{ fontSize: 56 }} />
          ) : (
            <CancelIcon color="error" sx={{ fontSize: 56 }} />
          )}
          <Typography variant="h5" component="h1" sx={{ mt: 2 }}>
            {result.decision === 'APPROVED' ? 'Aprovação registrada' : 'Conteúdo rejeitado'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {result.contentTitle}
          </Typography>
          <Typography variant="body2" sx={{ mt: 2 }}>
            {result.contentApproved
              ? 'Este conteúdo está liberado para distribuição.'
              : result.contentRejected
                ? 'O autor foi informado e vai revisar o texto.'
                : `Faltam ${result.requiredApprovals - result.approvalsSoFar} aprovação(ões) para liberar a distribuição.`}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3 }}>
            Você já pode fechar esta página. O link não funciona uma segunda vez.
          </Typography>
        </Paper>
      </Container>
    );
  }

  if (error) {
    return (
      <Container component="main" maxWidth="sm" sx={{ py: 6 }}>
        <ErrorState message={error} onRetry={load} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Links de aprovação são de uso único e têm prazo. Se o conteúdo foi editado depois do
          envio, o link deixa de valer e um novo é enviado.
        </Typography>
      </Container>
    );
  }

  if (!page) {
    return <Loading label="Carregando conteúdo para aprovação" />;
  }

  return (
    <Container component="main" maxWidth="sm" sx={{ py: { xs: 2, sm: 5 } }}>
      <Box component="header" sx={{ mb: 3 }}>
        <Typography variant="body2" color="text.secondary">
          Olá, {page.approverName}
        </Typography>
        <Typography variant="h5" component="h1" sx={{ mt: 0.5 }}>
          {page.contentTitle}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            label={page.classification === 'ELECTORAL' ? 'Conteúdo eleitoral' : 'Institucional'}
            color={page.classification === 'ELECTORAL' ? 'warning' : 'default'}
          />
          <Chip
            size="small"
            variant="outlined"
            label={`${page.approvalsSoFar} de ${page.requiredApprovals} aprovações`}
          />
          <Chip
            size="small"
            variant="outlined"
            label={`Válido até ${formatDateTime(page.expiresAt)}`}
          />
        </Stack>
      </Box>

      <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
        <Typography variant="overline" color="text.secondary">
          Texto base
        </Typography>
        <Typography sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>{page.bodyBase}</Typography>

        {/*
          Procedência, quando existe. Para conteúdo eleitoral, conferir de onde o texto veio faz
          parte de julgá-lo — e quem decide não tinha como ver isso.
        */}
        {page.sourceUrl ? (
          <Box sx={{ mt: 2 }}>
            <Typography variant="overline" color="text.secondary" component="p">
              {page.includeSourceUrl ? 'Link enviado na mensagem' : 'Origem do texto'}
            </Typography>
            {/*
              A distinção importa para quem decide: um link que vai junto é um destino que está sendo
              aprovado; um link que fica para trás só diz de onde o texto veio.
            */}
            {page.includeSourceUrl ? (
              <Typography variant="body2" color="text.secondary">
                Este link faz parte da mensagem e o contato vai recebê-lo.
              </Typography>
            ) : null}
            <Link
              href={page.sourceUrl}
              target="_blank"
              rel="noreferrer"
              variant="body2"
              sx={{ wordBreak: 'break-all' }}
            >
              {page.sourceUrl}
            </Link>
          </Box>
        ) : null}
      </Paper>

      {page.variants.length > 0 ? (
        <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
          <Typography variant="overline" color="text.secondary">
            Variantes
          </Typography>
          <Stack divider={<Divider />} spacing={1.5} sx={{ mt: 1 }}>
            {page.variants.map((variant) => (
              <Box key={variant.label}>
                <Typography variant="subtitle2">{variant.label}</Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap' }}>{variant.body}</Typography>
              </Box>
            ))}
          </Stack>
        </Paper>
      ) : null}

      <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
        <Typography variant="overline" color="text.secondary">
          Como cada pessoa vai receber
        </Typography>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          {page.renderedSamples.map((sample, index) => (
            <Box key={`${sample.label}-${index}`}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {sample.label}
                </Typography>
                {sample.usedFallback ? (
                  // Named explicitly: the approver should know this is the version for someone whose first
                  // name we do not have, not a mistake in the text.
                  <Chip
                    size="small"
                    label="sem primeiro nome (usa o fallback)"
                    variant="outlined"
                  />
                ) : null}
              </Stack>
              <Typography sx={{ whiteSpace: 'pre-wrap' }}>{sample.renderedBody}</Typography>
            </Box>
          ))}
        </Stack>
      </Paper>

      {/*
        A mídia é RENDERIDA, não linkada.

        O aprovador decide sobre a mensagem inteira, e a imagem é parte dela — um link chamado
        "tela01.png" obriga a abrir outra aba para saber o que se está aprovando, e quem está no
        celular simplesmente não abre. Aprovar texto sem ver a imagem é aprovar às cegas, o que
        esvazia a aprovação: ela existe para alguém olhar antes de milhares de pessoas receberem.
      */}
      {page.media.length > 0 ? (
        <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
          <Typography variant="overline" color="text.secondary">
            Mídias anexadas
          </Typography>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {page.media.map((asset) => (
              <Box key={asset.originalName}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <Chip size="small" label={asset.kind} />
                  {/*
                    O NOME abre o arquivo em tamanho cheio; a IMAGEM abaixo leva ao post de origem.
                    A prévia tem teto de altura, então ver o arquivo inteiro é como se lê o texto
                    miúdo de um card — num conteúdo eleitoral, exatamente onde mora o que precisa
                    ser conferido.
                  */}
                  {asset.downloadUrl ? (
                    <Link
                      href={asset.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      variant="body2"
                      title="Abrir o arquivo em tamanho cheio"
                    >
                      {asset.originalName}
                    </Link>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {asset.originalName}
                    </Typography>
                  )}
                </Stack>

                {!asset.downloadUrl ? (
                  <Alert severity="warning" role="alert">
                    Não foi possível gerar o link desta mídia. Ela existe no conteúdo, mas você não
                    consegue vê-la aqui — considere recusar e pedir para reenviarem.
                  </Alert>
                ) : asset.kind === 'IMAGE' ? (
                  /*
                    Clicar na IMAGEM leva ao post de origem, quando existe. É o que a pessoa espera:
                    o card na tela representa a publicação, e o gesto natural é ir para ela.

                    O arquivo em tamanho cheio continua a um clique de distância — no nome do
                    arquivo, ali em cima. Os dois destinos são úteis e diferentes: um mostra a
                    publicação no contexto dela, o outro mostra exatamente o arquivo que vai ser
                    enviado. A legenda abaixo diz qual é qual, para o clique não ser adivinhação.

                    Sem link de origem, a imagem cai no comportamento anterior e abre o arquivo.
                  */
                  <Box
                    component="a"
                    href={page.sourceUrl ?? asset.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    sx={{ display: 'block' }}
                  >
                    <Box
                      component="img"
                      src={asset.downloadUrl}
                      alt={asset.originalName}
                      sx={{
                        display: 'block',
                        width: '100%',
                        // Teto de altura para uma imagem alta não empurrar os botões de decisão para
                        // fora da tela: o aprovador tem de ver a mídia E decidir sem se perder.
                        maxHeight: 420,
                        objectFit: 'contain',
                        borderRadius: 1,
                        border: 1,
                        borderColor: 'divider',
                        backgroundColor: 'action.hover',
                      }}
                    />
                    <Typography
                      variant="caption"
                      component="span"
                      color="text.secondary"
                      sx={{ display: 'block', mt: 0.5 }}
                    >
                      {page.sourceUrl
                        ? 'Clique na imagem para abrir a publicação de origem.'
                        : 'Clique na imagem para vê-la em tamanho cheio.'}
                    </Typography>
                  </Box>
                ) : asset.kind === 'VIDEO' ? (
                  <Box
                    component="video"
                    src={asset.downloadUrl}
                    controls
                    // Sem autoplay: som inesperado num celular é o tipo de coisa que faz a pessoa
                    // fechar a página antes de decidir.
                    sx={{
                      display: 'block',
                      width: '100%',
                      maxHeight: 420,
                      borderRadius: 1,
                      backgroundColor: 'common.black',
                    }}
                  />
                ) : (
                  // Documento (PDF e afins): não há como pré-visualizar de forma confiável em todo
                  // navegador, então o link honesto é melhor que um iframe que falha em silêncio.
                  <Button
                    variant="outlined"
                    size="small"
                    component="a"
                    href={asset.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir {asset.originalName}
                  </Button>
                )}
              </Box>
            ))}
          </Stack>
        </Paper>
      ) : null}

      <Alert severity="info" sx={{ mb: 2 }}>
        Versão em aprovação: <code>{page.contentHash}</code>
        <Typography variant="caption" component="p" sx={{ mt: 0.5 }}>
          Este código identifica exatamente este texto. Se o conteúdo for editado, este link deixa
          de valer e um novo é enviado.
        </Typography>
      </Alert>

      <TextField
        label="Comentário (opcional — o autor vê)"
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        fullWidth
        multiline
        minRows={2}
        sx={{ mb: 2 }}
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <Button
          variant="contained"
          color="success"
          size="large"
          fullWidth
          disabled={submitting}
          onClick={() => decide('APPROVE')}
          startIcon={<CheckCircleIcon />}
        >
          Aprovar
        </Button>
        <Button
          variant="outlined"
          color="error"
          size="large"
          fullWidth
          disabled={submitting}
          onClick={() => decide('REJECT')}
          startIcon={<CancelIcon />}
        >
          Rejeitar
        </Button>
      </Stack>
    </Container>
  );
}
