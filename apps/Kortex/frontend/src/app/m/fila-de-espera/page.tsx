'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useSnackbar } from 'notistack';
import { RequireAuth } from 'src/components/RequireAuth';
import preOrderService from 'src/services/preOrderService';
import { apiErrorMessage } from 'src/services/api';
import { WAITING_LIST_STATUS_LABELS, WaitingListEntry, formatDate } from 'src/types/preOrder';
import { numericSx } from 'src/theme/theme';

const TOUCH = { minHeight: 56 };

/**
 * A fila de espera no app do Modelista — **somente leitura** (spec §4.12).
 *
 * A única ação dele aqui é **avisar** o Administrativo de que vagou horário. Ele não liga para o
 * cliente, não oferece vaga e não registra aceite: quem faz isso é o Administrativo, depois de
 * cobrar (regra 6.3). A tela diz isso em texto, para a ausência dos botões não parecer falta.
 */
function WaitingListScreen() {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<WaitingListEntry[]>([]);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      setEntries(await preOrderService.listWaitingList());
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível carregar a fila.'), {
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    void load();
  }, [load]);

  async function sendNotice() {
    setSending(true);
    try {
      await preOrderService.createSlotNotice(note);
      setNote('');
      setNoticeOpen(false);
      enqueueSnackbar('Aviso enviado ao Administrativo.', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível enviar o aviso.'), {
        variant: 'error',
      });
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <Box
        role="status"
        aria-label="Carregando"
        sx={{ display: 'flex', justifyContent: 'center', py: 10 }}
      >
        <CircularProgress />
      </Box>
    );
  }

  const active = entries.filter(
    (entry) => entry.status === 'waiting' || entry.status === 'offered',
  );

  return (
    <Box component="main" sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 3 }}>
      <Container maxWidth="sm">
        <Typography variant="overline" component="p" sx={{ color: 'info.main' }}>
          Fila de espera
        </Typography>
        <Typography variant="h2" component="h1" gutterBottom>
          Quem está esperando
        </Typography>

        <Button fullWidth sx={{ ...TOUCH, mt: 2 }} onClick={() => setNoticeOpen(true)}>
          Avisar que vagou horário
        </Button>

        <Alert severity="info" sx={{ mt: 2 }}>
          Você avisa; o Administrativo escolhe da fila, liga e cobra. A reserva só aparece para você
          depois do pagamento.
        </Alert>

        <Stack spacing={1.5} sx={{ mt: 2 }}>
          {active.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Ninguém na fila agora.
            </Typography>
          )}

          {active.map((entry) => (
            <Paper
              key={entry.id}
              variant="outlined"
              sx={{
                p: 2,
                // Quem quer antecipar é justamente quem se chama quando vaga — o destaque é a
                // informação principal da tela (DoD da Fase 3).
                borderColor: entry.wantsEarlier ? 'error.main' : 'divider',
                borderWidth: entry.wantsEarlier ? 2 : 1,
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                <Box>
                  <Typography variant="h4" component="h2">
                    {entry.customer.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={numericSx}>
                    {entry.hoursNeeded}h{entry.fabric ? ` · ${entry.fabric.name}` : ''}
                    {entry.desiredUntil ? ` · até ${formatDate(entry.desiredUntil)}` : ''}
                  </Typography>
                </Box>
                <Stack spacing={0.5} alignItems="flex-end">
                  {entry.wantsEarlier && <Chip size="small" color="error" label="Quer antecipar" />}
                  <Chip
                    size="small"
                    variant="outlined"
                    label={WAITING_LIST_STATUS_LABELS[entry.status]}
                  />
                </Stack>
              </Stack>

              {entry.technicalNotes && (
                <Typography variant="body2" sx={{ mt: 1.5 }}>
                  {entry.technicalNotes}
                </Typography>
              )}
            </Paper>
          ))}
        </Stack>

        <Button component={Link} href="/m" variant="outlined" fullWidth sx={{ ...TOUCH, mt: 3 }}>
          Voltar
        </Button>
      </Container>

      <Dialog open={noticeOpen} onClose={() => setNoticeOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Avisar o Administrativo</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Diga o que vagou. Isto é um aviso — não agenda ninguém.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            label="Recado"
            placeholder="Vagou das 14h às 17h na máquina 01."
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => setNoticeOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={sendNotice} disabled={sending || note.trim().length < 3}>
            {sending ? 'Enviando…' : 'Enviar aviso'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function Page() {
  return (
    <RequireAuth allow={['modelista', 'owner']}>
      <WaitingListScreen />
    </RequireAuth>
  );
}
