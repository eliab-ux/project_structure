'use client';

import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { CustomerPayload } from 'src/services/customerService';
import {
  COMPANY_SIZE_LABELS,
  CustomerDetail,
  REPRESENTATIVE_ROLE_LABELS,
  UF_LIST,
} from 'src/types/customer';

interface CustomerFormProps {
  open: boolean;
  editing: CustomerDetail | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: CustomerPayload) => void;
}

const EMPTY: CustomerPayload = {
  legalName: '',
  tradeName: '',
  documentType: 'cnpj',
  document: '',
  stateRegistration: '',
  companySize: '',
  employeesCount: null,
  zipCode: '',
  street: '',
  number: '',
  complement: '',
  district: '',
  city: '',
  state: 'GO',
  repName: '',
  repRole: '',
  repCpf: '',
  repPhone: '',
  repEmail: '',
  whatsapp: '',
  email: '',
  phone: '',
  isMember: false,
  memberSince: '',
  notes: '',
};

/**
 * Formulário de cliente. Longo porque o cadastro é longo: a operação é conduzida por uma
 * associação e precisa sustentar prestação de contas (spec §4.4).
 *
 * Os campos aparecem agrupados como a spec os agrupa — identificação, endereço, representante,
 * contato, associação — para que a pessoa que preenche reconheça de onde cada bloco veio.
 */
export function CustomerForm({ open, editing, saving, onClose, onSubmit }: CustomerFormProps) {
  const [form, setForm] = useState<CustomerPayload>(EMPTY);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (!editing) {
      setForm(EMPTY);
      return;
    }
    setForm({
      legalName: editing.legalName,
      tradeName: editing.tradeName,
      documentType: editing.documentType,
      document: editing.documentFormatted,
      stateRegistration: editing.stateRegistration ?? '',
      companySize: editing.companySize ?? '',
      employeesCount: editing.employeesCount,
      zipCode: editing.address.zipCode ?? '',
      street: editing.address.street ?? '',
      number: editing.address.number ?? '',
      complement: editing.address.complement ?? '',
      district: editing.address.district ?? '',
      city: editing.address.city,
      state: editing.address.state,
      repName: editing.representative.name,
      repRole: editing.representative.role ?? '',
      repCpf: editing.representative.cpfFormatted,
      repPhone: editing.representative.phone,
      repEmail: editing.representative.email,
      whatsapp: editing.contact.whatsapp,
      email: editing.contact.email ?? '',
      phone: editing.contact.phone ?? '',
      isMember: editing.isMember,
      memberSince: editing.memberSince ?? '',
      notes: editing.notes ?? '',
    });
  }, [open, editing]);

  function set<K extends keyof CustomerPayload>(key: K, value: CustomerPayload[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    // Campos opcionais vazios viram null: string vazia passaria pelo `@IsOptional` e falharia no
    // `@MinLength` do DTO, com uma mensagem que não ajuda ninguém.
    const clean = (value: string | null | undefined) => (value?.trim() ? value.trim() : null);

    onSubmit({
      ...form,
      stateRegistration: clean(form.stateRegistration),
      companySize: clean(form.companySize),
      employeesCount: form.employeesCount ?? null,
      zipCode: clean(form.zipCode),
      street: clean(form.street),
      number: clean(form.number),
      complement: clean(form.complement),
      district: clean(form.district),
      repRole: clean(form.repRole),
      email: clean(form.email),
      phone: clean(form.phone),
      memberSince: form.isMember ? clean(form.memberSince) : null,
      notes: clean(form.notes),
    });
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{editing ? 'Editar cliente' : 'Novo cliente'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <Typography variant="overline" sx={{ color: 'info.main' }}>
            Identificação
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Razão social"
              fullWidth
              required
              value={form.legalName}
              onChange={(e) => set('legalName', e.target.value)}
            />
            <TextField
              label="Nome fantasia"
              fullWidth
              required
              helperText="É o que aparece na agenda e no relatório."
              value={form.tradeName}
              onChange={(e) => set('tradeName', e.target.value)}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              select
              label="Tipo"
              sx={{ minWidth: 140 }}
              value={form.documentType}
              onChange={(e) => set('documentType', e.target.value)}
            >
              <MenuItem value="cnpj">CNPJ</MenuItem>
              <MenuItem value="cpf">CPF</MenuItem>
            </TextField>
            <TextField
              label={form.documentType === 'cnpj' ? 'CNPJ' : 'CPF'}
              fullWidth
              required
              value={form.document}
              onChange={(e) => set('document', e.target.value)}
            />
            <TextField
              label="Inscrição estadual"
              fullWidth
              value={form.stateRegistration ?? ''}
              onChange={(e) => set('stateRegistration', e.target.value)}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              select
              label="Porte"
              fullWidth
              value={form.companySize ?? ''}
              onChange={(e) => set('companySize', e.target.value)}
            >
              <MenuItem value="">Não informado</MenuItem>
              {Object.entries(COMPANY_SIZE_LABELS).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Funcionários"
              type="number"
              fullWidth
              value={form.employeesCount ?? ''}
              onChange={(e) =>
                set('employeesCount', e.target.value === '' ? null : Number(e.target.value))
              }
            />
          </Stack>

          <Divider />
          <Typography variant="overline" sx={{ color: 'info.main' }}>
            Endereço
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="CEP"
              sx={{ minWidth: 160 }}
              value={form.zipCode ?? ''}
              onChange={(e) => set('zipCode', e.target.value)}
            />
            <TextField
              label="Rua"
              fullWidth
              value={form.street ?? ''}
              onChange={(e) => set('street', e.target.value)}
            />
            <TextField
              label="Número"
              sx={{ minWidth: 120 }}
              value={form.number ?? ''}
              onChange={(e) => set('number', e.target.value)}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Complemento"
              fullWidth
              value={form.complement ?? ''}
              onChange={(e) => set('complement', e.target.value)}
            />
            <TextField
              label="Bairro"
              fullWidth
              value={form.district ?? ''}
              onChange={(e) => set('district', e.target.value)}
            />
            <TextField
              label="Cidade"
              fullWidth
              required
              helperText="Coluna do relatório mensal."
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
            />
            <TextField
              select
              label="UF"
              sx={{ minWidth: 110 }}
              value={form.state}
              onChange={(e) => set('state', e.target.value)}
            >
              {UF_LIST.map((uf) => (
                <MenuItem key={uf} value={uf}>
                  {uf}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          <Divider />
          <Typography variant="overline" sx={{ color: 'info.main' }}>
            Representante legal
          </Typography>
          <Alert severity="info">
            É a coluna &quot;EMPRESÁRIO&quot; do relatório do governo. O CPF fica visível só aqui,
            no detalhe — nunca na listagem.
          </Alert>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Nome"
              fullWidth
              required
              value={form.repName}
              onChange={(e) => set('repName', e.target.value)}
            />
            <TextField
              select
              label="Cargo"
              sx={{ minWidth: 180 }}
              value={form.repRole ?? ''}
              onChange={(e) => set('repRole', e.target.value)}
            >
              <MenuItem value="">Não informado</MenuItem>
              {Object.entries(REPRESENTATIVE_ROLE_LABELS).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="CPF"
              fullWidth
              required
              value={form.repCpf}
              onChange={(e) => set('repCpf', e.target.value)}
            />
            <TextField
              label="WhatsApp do responsável"
              fullWidth
              required
              value={form.repPhone}
              onChange={(e) => set('repPhone', e.target.value)}
            />
            <TextField
              label="E-mail do responsável"
              fullWidth
              required
              value={form.repEmail}
              onChange={(e) => set('repEmail', e.target.value)}
            />
          </Stack>

          <Divider />
          <Typography variant="overline" sx={{ color: 'info.main' }}>
            Contato da empresa
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="WhatsApp"
              fullWidth
              required
              helperText="Canal principal de contato."
              value={form.whatsapp}
              onChange={(e) => set('whatsapp', e.target.value)}
            />
            <TextField
              label="E-mail"
              fullWidth
              value={form.email ?? ''}
              onChange={(e) => set('email', e.target.value)}
            />
            <TextField
              label="Telefone fixo"
              fullWidth
              value={form.phone ?? ''}
              onChange={(e) => set('phone', e.target.value)}
            />
          </Stack>

          <Divider />
          <Typography variant="overline" sx={{ color: 'info.main' }}>
            Associação
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
            <FormControlLabel
              control={
                <Switch
                  checked={form.isMember ?? false}
                  onChange={(e) => set('isMember', e.target.checked)}
                />
              }
              label="É associado"
            />
            <TextField
              label="Associado desde"
              type="date"
              disabled={!form.isMember}
              InputLabelProps={{ shrink: true }}
              value={form.memberSince ?? ''}
              onChange={(e) => set('memberSince', e.target.value)}
            />
          </Stack>
          <TextField
            label="Observações"
            fullWidth
            multiline
            minRows={2}
            value={form.notes ?? ''}
            onChange={(e) => set('notes', e.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="outlined" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={saving}>
          {saving ? 'Salvando…' : editing ? 'Salvar' : 'Criar cliente'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
