'use client';

import { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useSnackbar } from 'notistack';
import { PageHeader } from 'src/components/PageHeader';
import preOrderService from 'src/services/preOrderService';
import catalogService from 'src/services/catalogService';
import { apiErrorMessage } from 'src/services/api';
import { CustomerListItem, Fabric } from 'src/types/customer';
import {
  SlotNotice,
  WAITING_LIST_STATUS_LABELS,
  WaitingListEntry,
  formatDate,
  formatDateTime,
} from 'src/types/preOrder';
import { numericSx } from 'src/theme/theme';

interface EntryForm {
  customerId: string;
  fabricId: string;
  hoursNeeded: string;
  technicalNotes: string;
  wantsEarlier: boolean;
  desiredUntil: string;
}

const EMPTY: EntryForm = {
  customerId: '',
  fabricId: '',
  hoursNeeded: '2',
  technicalNotes: '',
  wantsEarlier: false,
  desiredUntil: '',
};

export default function WaitingListPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<WaitingListEntry[]>([]);
  const [notices, setNotices] = useState<SlotNotice[]>([]);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<EntryForm>(EMPTY);

  const load = useCallback(async () => {
    try {
      const [loadedEntries, loadedNotices, loadedCustomers, loadedFabrics] = await Promise.all([
        preOrderService.listWaitingList(),
        preOrderService.listSlotNotices(),
        preOrderService.listCustomersForAdmin(),
        catalogService.listFabrics(),
      ]);
      setEntries(loadedEntries);
      setNotices(loadedNotices);
      setCustomers(loadedCustomers.filter((customer) => customer.status === 'active'));
      setFabrics(loadedFabrics);
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

  async function act(action: () => Promise<unknown>, ok: string) {
    try {
      await action();
      enqueueSnackbar(ok, { variant: 'success' });
      await load();
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível concluir.'), { variant: 'error' });
    }
  }

  async function create() {
    await act(
      () =>
        preOrderService.createWaitingListEntry({
          customerId: form.customerId,
          fabricId: form.fabricId || null,
          hoursNeeded: Number(form.hoursNeeded),
          technicalNotes: form.technicalNotes.trim() || null,
          wantsEarlier: form.wantsEarlier,
          desiredUntil: form.desiredUntil || null,
        }),
      'Entrada adicionada à fila.',
    );
    setOpen(false);
    setForm(EMPTY);
  }

  if (loading) {
    return (
      <Box
        role="status"
        aria-label="Carregando"
        sx={{ display: 'flex', justifyContent: 'center', py: 8 }}
      >
        <CircularProgress />
      </Box>
    );
  }

  const openNotices = notices.filter((notice) => notice.status === 'open');
  const active = entries.filter((e) => e.status === 'waiting' || e.status === 'offered');

  return (
    <>
      <PageHeader
        title="Fila de espera"
        description="O encaixe vem sempre daqui — nunca antecipando quem já está agendado."
        action={
          <Button
            onClick={() => {
              setForm(EMPTY);
              setOpen(true);
            }}
          >
            + Nova entrada
          </Button>
        }
      />

      {openNotices.length > 0 && (
        <Paper
          variant="outlined"
          component="section"
          aria-label="Avisos de horário vago"
          sx={{ p: 2, mb: 2.5, borderColor: 'error.main', borderWidth: 2 }}
        >
          <Typography variant="h4" component="h2" gutterBottom>
            Avisos do Modelista ({openNotices.length})
          </Typography>
          <Stack spacing={1}>
            {openNotices.map((notice) => (
              <Stack
                key={notice.id}
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                gap={2}
              >
                <Box>
                  <Typography variant="body2">{notice.note}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={numericSx}>
                    {notice.createdBy.name} · {formatDateTime(notice.createdAt)}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() =>
                    act(() => preOrderService.markNoticeHandled(notice.id), 'Aviso resolvido.')
                  }
                >
                  Resolvido
                </Button>
              </Stack>
            ))}
          </Stack>
        </Paper>
      )}

      <Paper variant="outlined" component="section" aria-label="Fila de espera" sx={{ p: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Cliente</TableCell>
              <TableCell align="right">Horas</TableCell>
              <TableCell>Tecido</TableCell>
              <TableCell>Quer até</TableCell>
              <TableCell>Situação</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {active.map((entry) => (
              <TableRow
                key={entry.id}
                // Destaque de quem quer antecipar: é a primeira pergunta quando vaga um horário.
                sx={entry.wantsEarlier ? { bgcolor: 'error.light' } : undefined}
              >
                <TableCell sx={{ fontWeight: 600 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <span>{entry.customer.name}</span>
                    {entry.wantsEarlier && (
                      <Chip size="small" color="error" label="Quer antecipar" />
                    )}
                  </Stack>
                  {entry.technicalNotes && (
                    <Typography variant="body2" color="text.secondary">
                      {entry.technicalNotes}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right" sx={numericSx}>
                  {entry.hoursNeeded}h
                </TableCell>
                <TableCell>{entry.fabric?.name ?? '—'}</TableCell>
                <TableCell sx={numericSx}>{formatDate(entry.desiredUntil)}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={WAITING_LIST_STATUS_LABELS[entry.status]}
                  />
                  {entry.customerAcceptedAt && (
                    <Typography variant="body2" color="success.main">
                      aceitou e está vindo
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    {entry.status === 'waiting' && (
                      <Button
                        size="small"
                        onClick={() =>
                          act(() => preOrderService.offerSlot(entry.id), 'Vaga oferecida.')
                        }
                      >
                        Ofereci a vaga
                      </Button>
                    )}
                    {entry.status === 'offered' && !entry.customerAcceptedAt && (
                      <Button
                        size="small"
                        onClick={() =>
                          act(
                            () => preOrderService.registerAcceptance(entry.id),
                            'Aceite registrado. Cobre e registre o pagamento para criar a reserva.',
                          )
                        }
                      >
                        Aceitou e está vindo
                      </Button>
                    )}
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() =>
                        act(() => preOrderService.dropEntry(entry.id), 'Saiu da fila.')
                      }
                    >
                      Remover
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {active.length === 0 && (
          <Stack sx={{ p: 3 }} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Ninguém na fila.
            </Typography>
          </Stack>
        )}
      </Paper>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 2, maxWidth: '80ch' }}>
        Registrar o aceite não cria reserva: o pagamento é a catraca. A reserva nasce quando você
        registra o pagamento — e só então ela aparece para o Modelista.
      </Typography>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Nova entrada na fila</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            A fila é sua. O Modelista só lê — o conhecimento técnico já veio no pré-pedido que ele
            avaliou.
          </Alert>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Cliente"
              fullWidth
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
            >
              {customers.map((customer) => (
                <MenuItem key={customer.id} value={customer.id}>
                  {customer.tradeName} · {customer.city}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Horas necessárias"
                sx={{ minWidth: 160 }}
                inputProps={{ inputMode: 'numeric' }}
                value={form.hoursNeeded}
                onChange={(e) =>
                  setForm({ ...form, hoursNeeded: e.target.value.replace(/\D/g, '') })
                }
              />
              <TextField
                select
                label="Tecido"
                fullWidth
                value={form.fabricId}
                onChange={(e) => setForm({ ...form, fabricId: e.target.value })}
              >
                <MenuItem value="">Não informado</MenuItem>
                {fabrics.map((fabric) => (
                  <MenuItem key={fabric.id} value={fabric.id}>
                    {fabric.name}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <Stack direction="row" spacing={2} alignItems="center">
              <FormControlLabel
                control={
                  <Switch
                    checked={form.wantsEarlier}
                    onChange={(e) => setForm({ ...form, wantsEarlier: e.target.checked })}
                  />
                }
                label="Quer antecipar se vagar"
              />
              <TextField
                label="Quer cortar até"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={form.desiredUntil}
                onChange={(e) => setForm({ ...form, desiredUntil: e.target.value })}
              />
            </Stack>
            <TextField
              label="Particularidade do material"
              fullWidth
              multiline
              minRows={2}
              value={form.technicalNotes}
              onChange={(e) => setForm({ ...form, technicalNotes: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={create} disabled={!form.customerId || !form.hoursNeeded}>
            Adicionar à fila
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
