'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSnackbar } from 'notistack';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { DataState } from 'src/components/DataState';
import { PageHeader } from 'src/components/PageHeader';
import { useAuth } from 'src/contexts/AuthContext';
import { apiErrorMessage } from 'src/services/api';
import salesConfigService from 'src/services/salesConfigService';
import {
  PAYMENT_CONDITION_KIND_LABEL,
  PAYMENT_CONDITION_KINDS,
  PaymentCondition,
  PaymentConditionKind,
} from 'src/types/sales';

const ADMIN_MAX_WIDTH = 1200;

/**
 * Condições de pagamento (02 §3.6): o cadastro nomeado que o pedido referencia — o contato tem um
 * default, o pedido herda e pode trocar. A data do cheque pré-datado vive no pagamento, não aqui.
 */
export default function PaymentConditionsPage() {
  const { can } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const [conditions, setConditions] = useState<PaymentCondition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentCondition | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<PaymentConditionKind>('a_vista');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setConditions(await salesConfigService.listPaymentConditions(includeInactive));
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Não foi possível carregar as condições.'));
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => {
    void load();
  }, [load]);

  function openDialog(condition: PaymentCondition | null) {
    setEditing(condition);
    setName(condition?.name ?? '');
    setKind(condition?.kind ?? 'a_vista');
    setDialogOpen(true);
  }

  async function save() {
    if (!name.trim()) {
      enqueueSnackbar('Dê um nome à condição.', { variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await salesConfigService.updatePaymentCondition(editing.id, { name: name.trim(), kind });
        enqueueSnackbar('Condição atualizada.', { variant: 'success' });
      } else {
        await salesConfigService.createPaymentCondition({ name: name.trim(), kind });
        enqueueSnackbar('Condição cadastrada.', { variant: 'success' });
      }
      setDialogOpen(false);
      setEditing(null);
      await load();
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(condition: PaymentCondition) {
    try {
      await salesConfigService.updatePaymentCondition(condition.id, { active: !condition.active });
      enqueueSnackbar(condition.active ? 'Condição desativada.' : 'Condição reativada.', {
        variant: 'success',
      });
      await load();
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError), { variant: 'error' });
    }
  }

  const isEmpty = conditions.length === 0;

  return (
    <Box
      component="section"
      aria-label="Condições de pagamento"
      sx={{ maxWidth: ADMIN_MAX_WIDTH, mx: 'auto' }}
    >
      <PageHeader
        title="Condições de pagamento"
        description="As condições que o pedido referencia — o contato tem um default e o pedido pode trocar."
        action={
          can('sales.settings.manage') ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => openDialog(null)}>
              Nova condição
            </Button>
          ) : null
        }
      />

      <FormControlLabel
        sx={{ mb: 2 }}
        control={
          <Switch
            checked={includeInactive}
            onChange={(event) => setIncludeInactive(event.target.checked)}
          />
        }
        label="Incluir inativas"
      />

      {loading || error || isEmpty ? (
        <DataState
          loading={loading}
          error={error}
          empty={isEmpty}
          emptyMessage="Nenhuma condição de pagamento cadastrada."
        />
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table aria-label="Lista de condições de pagamento">
            <TableHead>
              <TableRow>
                <TableCell>Condição</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Situação</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {conditions.map((condition) => (
                <TableRow key={condition.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {condition.name}
                    </Typography>
                  </TableCell>
                  <TableCell>{condition.kindLabel}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={condition.active ? 'Ativa' : 'Inativa'}
                      color={condition.active ? 'success' : 'default'}
                      variant={condition.active ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      {can('sales.settings.manage') ? (
                        <>
                          <Tooltip title="Editar">
                            <IconButton
                              size="small"
                              aria-label={`Editar ${condition.name}`}
                              onClick={() => openDialog(condition)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={condition.active ? 'Desativar' : 'Reativar'}>
                            <Switch
                              size="small"
                              checked={condition.active}
                              onChange={() => void toggleActive(condition)}
                              inputProps={{
                                'aria-label': `${condition.active ? 'Desativar' : 'Reativar'} ${condition.name}`,
                              }}
                            />
                          </Tooltip>
                        </>
                      ) : null}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog
        open={dialogOpen}
        onClose={saving ? undefined : () => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{editing ? 'Editar condição' : 'Nova condição'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Nome"
              value={name}
              onChange={(event) => setName(event.target.value)}
              inputProps={{ maxLength: 120 }}
              fullWidth
              helperText='Ex.: "30/60/90", "À vista com 5%", "Promissória da rota".'
            />
            <TextField
              select
              label="Tipo"
              value={kind}
              onChange={(event) => setKind(event.target.value as PaymentConditionKind)}
              fullWidth
            >
              {PAYMENT_CONDITION_KINDS.map((value) => (
                <MenuItem key={value} value={value}>
                  {PAYMENT_CONDITION_KIND_LABEL[value]}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={() => void save()} disabled={saving}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
