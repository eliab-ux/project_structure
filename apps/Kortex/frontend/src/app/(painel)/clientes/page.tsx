'use client';

import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useSnackbar } from 'notistack';
import { PageHeader } from 'src/components/PageHeader';
import { CustomerForm } from './CustomerForm';
import customerService, { CustomerPayload } from 'src/services/customerService';
import { apiErrorMessage } from 'src/services/api';
import { CustomerDetail, CustomerListItem } from 'src/types/customer';
import { formatPhone } from 'src/types/user';
import { numericSx } from 'src/theme/theme';

export default function CustomersPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerDetail | null>(null);

  const load = useCallback(async () => {
    try {
      setCustomers(await customerService.list());
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível carregar os clientes.'), {
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }

  /**
   * Editar busca o DETALHE, e não reusa a linha da listagem.
   *
   * Não é ida extra ao servidor por descuido: a listagem não traz documento, endereço nem
   * representante — de propósito (spec §4.4). O formulário precisa deles, e é o detalhe que os
   * tem.
   */
  async function openEdit(id: string) {
    try {
      setEditing(await customerService.detail(id));
      setOpen(true);
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível abrir o cliente.'), {
        variant: 'error',
      });
    }
  }

  async function submit(payload: CustomerPayload) {
    setSaving(true);
    try {
      if (editing) {
        await customerService.update(editing.id, payload);
        enqueueSnackbar('Cliente atualizado.', { variant: 'success' });
      } else {
        await customerService.create(payload);
        enqueueSnackbar('Cliente cadastrado.', { variant: 'success' });
      }
      setOpen(false);
      await load();
    } catch (error) {
      // A mensagem do backend é escrita para gente ("Já existe um cliente com este documento
      // nesta conta.") — vale mostrar literal.
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível salvar o cliente.'), {
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(customer: CustomerListItem) {
    try {
      await customerService.setStatus(customer.id, customer.status !== 'active');
      await load();
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível alterar a situação.'), {
        variant: 'error',
      });
    }
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

  const term = search.trim().toLowerCase();
  const visible = term
    ? customers.filter(
        (customer) =>
          customer.tradeName.toLowerCase().includes(term) ||
          customer.city.toLowerCase().includes(term),
      )
    : customers;

  return (
    <>
      <PageHeader
        title="Clientes"
        description="As confecções atendidas. Só o Administrativo cadastra — o Modelista nunca cadastra cliente."
        action={<Button onClick={openCreate}>+ Novo cliente</Button>}
      />

      <TextField
        label="Buscar por nome fantasia ou cidade"
        size="small"
        fullWidth
        sx={{ mb: 2, maxWidth: 420 }}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <Paper variant="outlined" component="section" aria-label="Clientes" sx={{ p: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Nome fantasia</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Cidade/UF</TableCell>
              <TableCell>WhatsApp</TableCell>
              <TableCell>Associado</TableCell>
              <TableCell>Situação</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((customer) => (
              <TableRow key={customer.id} sx={{ opacity: customer.status === 'active' ? 1 : 0.6 }}>
                <TableCell sx={{ fontWeight: 600 }}>{customer.tradeName}</TableCell>
                <TableCell>{customer.documentType.toUpperCase()}</TableCell>
                <TableCell>
                  {customer.city}/{customer.state}
                </TableCell>
                <TableCell sx={numericSx}>{formatPhone(customer.whatsapp)}</TableCell>
                <TableCell>{customer.isMember ? 'Sim' : '—'}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={customer.status === 'active' ? 'Ativo' : 'Inativo'}
                    color={customer.status === 'active' ? 'success' : 'default'}
                    variant={customer.status === 'active' ? 'filled' : 'outlined'}
                  />
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button size="small" variant="outlined" onClick={() => openEdit(customer.id)}>
                      Editar
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => toggleStatus(customer)}>
                      {customer.status === 'active' ? 'Inativar' : 'Reativar'}
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 2, maxWidth: '80ch' }}>
        A listagem não mostra CNPJ, CPF nem endereço — eles ficam no detalhe, ao editar. Inativar
        tira o cliente da lista de trabalho sem apagar o histórico de cortes dele.
      </Typography>

      <CustomerForm
        open={open}
        editing={editing}
        saving={saving}
        onClose={() => setOpen(false)}
        onSubmit={submit}
      />
    </>
  );
}
