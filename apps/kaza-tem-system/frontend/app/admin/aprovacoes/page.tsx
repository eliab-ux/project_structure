'use client';

import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdminAuthContext } from '@/contexts/AdminAuthContext';
import {
  AdminResellerSummary,
  approveReseller,
  getPendingResellers,
  rejectReseller,
} from '@/services/adminResellerService';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

export default function AdminPendingResellersPage() {
  const { accessToken, user } = useAdminAuthContext();
  const [resellers, setResellers] = useState<AdminResellerSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<AdminResellerSummary | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!accessToken) {
      setResellers([]);
      return;
    }
    setLoading(true);
    try {
      const entries = await getPendingResellers(accessToken);
      setResellers(entries);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleApprove = async () => {
    if (!selected || !accessToken || !user) return;
    try {
      await approveReseller(accessToken, selected.id, user.id);
      setFeedback('Cadastro aprovado com sucesso');
      setDialogOpen(false);
      refresh();
    } catch (error) {
      setFeedback('Erro ao aprovar');
    }
  };

  const handleReject = async () => {
    if (!selected || !accessToken || !user) return;
    try {
      await rejectReseller(accessToken, selected.id, rejectReason);
      setFeedback('Cadastro rejeitado');
      setDialogOpen(false);
      refresh();
    } catch (error) {
      setFeedback('Erro ao rejeitar');
    }
  };

  const summary = useMemo(() => resellers.length, [resellers]);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4">Cadastros pendentes</Typography>
          <Typography color="text.secondary">
            Acompanhe os cadastros novos e valide dados pessoais e bancários antes de aprovar.
          </Typography>
        </Box>

        {loading && <LinearProgress />}

        <Paper sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="subtitle1">
            <strong>{summary}</strong> cadastro(s) aguardando análise
          </Typography>
          <Chip label="Pendentes" color="warning" icon={<HourglassEmptyIcon />} />
        </Paper>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>CPF</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Telefone</TableCell>
                <TableCell>Banco</TableCell>
                <TableCell>Cadastro</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resellers.map((reseller) => (
                <TableRow key={reseller.id} hover>
                  <TableCell>{reseller.userName ?? reseller.uniqueLink}</TableCell>
                  <TableCell>{reseller.cpf}</TableCell>
                  <TableCell>{reseller.userEmail}</TableCell>
                  <TableCell>{reseller.phone ?? '—'}</TableCell>
                  <TableCell>
                    {reseller.bankName
                      ? `${reseller.bankName} · Ag ${reseller.bankAgency ?? '—'} · C ${reseller.bankAccount ?? '—'}`
                      : 'Dados bancários incompletos'}
                  </TableCell>
                  <TableCell>
                    {new Date(reseller.createdAt).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => {
                        setSelected(reseller);
                        setDialogOpen(true);
                        setRejectReason('');
                      }}
                    >
                      Analisar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {feedback && (
          <Alert severity="success" onClose={() => setFeedback(null)}>
            {feedback}
          </Alert>
        )}
      </Stack>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Analisar cadastro</DialogTitle>
        <DialogContent dividers>
          <DialogContentText>
            Confirme os dados pessoais e bancários abaixo antes de aprovar ou rejeitar o cadastro.
          </DialogContentText>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <Typography variant="subtitle2">Nome</Typography>
            <Typography>{selected?.userName ?? '—'}</Typography>
            <Typography variant="subtitle2">CPF</Typography>
            <Typography>{selected?.cpf}</Typography>
            <Typography variant="subtitle2">Email</Typography>
            <Typography>{selected?.userEmail}</Typography>
            <Typography variant="subtitle2">Banco</Typography>
            <Typography>
              {selected?.bankName
                ? `${selected.bankName} · Ag ${selected.bankAgency ?? '—'} · Conta ${selected.bankAccount ?? '—'}`
                : 'Não informado'}
            </Typography>
          </Stack>
          <TextField
            label="Motivo da rejeição"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            multiline
            minRows={3}
            sx={{ mt: 3 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} color="inherit">
            Cancelar
          </Button>
          <Button onClick={handleReject} color="error" disabled={rejectReason.length < 5}>
            Rejeitar
          </Button>
          <Button onClick={handleApprove} variant="contained" startIcon={<CheckCircleOutlineIcon />}>
            Aprovar
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
