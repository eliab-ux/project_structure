'use client';

import { forwardRef, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { IMaskInput } from 'react-imask';
import {
  Alert,
  Box,
  Button,
  Container,
  Divider,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import resellerService, { ResellerProfileResponse } from '@/services/resellerService';

interface MaskCustomProps {
  onAccept: (value: string) => void;
  name: string;
}

const PhoneMask = forwardRef<HTMLInputElement, MaskCustomProps>(function PhoneMask(props, ref) {
  const { onAccept, ...other } = props;
  return (
    <IMaskInput
      {...other}
      mask="(00) 00000-0000"
      inputRef={ref}
      onAccept={(value: string) => onAccept(value.replace(/\D/g, ''))}
      overwrite
    />
  );
});

const CpfMask = forwardRef<HTMLInputElement, MaskCustomProps>(function CpfMask(props, ref) {
  const { onAccept, ...other } = props;
  return (
    <IMaskInput
      {...other}
      mask="000.000.000-00"
      inputRef={ref}
      onAccept={(value: string) => onAccept(value.replace(/\D/g, ''))}
      overwrite
    />
  );
});

type PersonalFormValues = {
  fullName: string;
  phone: string;
};

type BankFormValues = {
  bankName: string;
  bankCode: string;
  bankAgency: string;
  bankAccount: string;
  bankAccountType: 'checking' | 'savings' | '';
  bankHolderName: string;
  bankHolderCpf: string;
  pixKey: string;
  pixKeyType: 'cpf' | 'email' | 'phone' | 'random' | '';
};

type StatusState = 'idle' | 'saving' | 'success' | 'error';

export default function ResellerProfilePage() {
  const [profile, setProfile] = useState<ResellerProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [personalStatus, setPersonalStatus] = useState<StatusState>('idle');
  const [bankStatus, setBankStatus] = useState<StatusState>('idle');
  const [personalMessage, setPersonalMessage] = useState<string>();
  const [bankMessage, setBankMessage] = useState<string>();

  const personalForm = useForm<PersonalFormValues>({
    defaultValues: { fullName: '', phone: '' },
  });

  const bankForm = useForm<BankFormValues>({
    defaultValues: {
      bankName: '',
      bankCode: '',
      bankAgency: '',
      bankAccount: '',
      bankAccountType: '',
      bankHolderName: '',
      bankHolderCpf: '',
      pixKey: '',
      pixKeyType: '',
    },
  });

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const data = await resellerService.getProfile();
        if (!active) return;
        setProfile(data);
        personalForm.reset({
          fullName: data.reseller.fullName,
          phone: data.reseller.phone ?? '',
        });
        bankForm.reset({
          bankName: data.reseller.bankName ?? '',
          bankCode: data.reseller.bankCode ?? '',
          bankAgency: data.reseller.bankAgency ?? '',
          bankAccount: data.reseller.bankAccount ?? '',
          bankAccountType: data.reseller.bankAccountType ?? '',
          bankHolderName: data.reseller.bankHolderName ?? '',
          bankHolderCpf: data.reseller.bankHolderCpf ?? '',
          pixKey: data.reseller.pixKey ?? '',
          pixKeyType: data.reseller.pixKeyType ?? '',
        });
      } catch (err) {
        if (!active) return;
        setError('NÃƒÆ’Ã‚Â£o foi possÃƒÆ’Ã‚Â­vel carregar os dados do perfil.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [personalForm, bankForm]);

  const handlePersonalSubmit = personalForm.handleSubmit(async (values) => {
    setPersonalStatus('saving');
    setPersonalMessage(undefined);
    try {
      const data = await resellerService.updateProfile({
        fullName: values.fullName,
        phone: values.phone,
      });
      setProfile(data);
      setPersonalStatus('success');
      setPersonalMessage('Dados pessoais atualizados com sucesso.');
      personalForm.reset({
        fullName: data.reseller.fullName,
        phone: data.reseller.phone ?? '',
      });
    } catch (err) {
      setPersonalStatus('error');
      setPersonalMessage('NÃƒÆ’Ã‚Â£o foi possÃƒÆ’Ã‚Â­vel salvar os dados pessoais.');
    }
  });

  const handleBankSubmit = bankForm.handleSubmit(async (values) => {
    setBankStatus('saving');
    setBankMessage(undefined);
    try {
      const data = await resellerService.updateBankInfo({
        bankName: values.bankName || null,
        bankCode: values.bankCode || null,
        bankAgency: values.bankAgency || null,
        bankAccount: values.bankAccount || null,
        bankAccountType: values.bankAccountType || null,
        bankHolderName: values.bankHolderName || null,
        bankHolderCpf: values.bankHolderCpf || null,
        pixKey: values.pixKey || null,
        pixKeyType: values.pixKeyType || null,
      });
      setProfile(data);
      setBankStatus('success');
      setBankMessage('Dados bancÃƒÆ’Ã‚Â¡rios atualizados.');
      bankForm.reset({
        bankName: data.reseller.bankName ?? '',
        bankCode: data.reseller.bankCode ?? '',
        bankAgency: data.reseller.bankAgency ?? '',
        bankAccount: data.reseller.bankAccount ?? '',
        bankAccountType: data.reseller.bankAccountType ?? '',
        bankHolderName: data.reseller.bankHolderName ?? '',
        bankHolderCpf: data.reseller.bankHolderCpf ?? '',
        pixKey: data.reseller.pixKey ?? '',
        pixKeyType: data.reseller.pixKeyType ?? '',
      });
    } catch (err) {
      setBankStatus('error');
      setBankMessage('Erro ao atualizar os dados bancÃƒÆ’Ã‚Â¡rios.');
    }
  });

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Paper elevation={3} sx={{ p: { xs: 3, md: 5 }, borderRadius: 4 }}>
        <Stack spacing={4}>
          <Typography variant="h4">Perfil do revendedor</Typography>
          {loading && <LinearProgress />}
          {error && <Alert severity="error">{error}</Alert>}
          {profile && (
            <Stack spacing={2}>
              <Stack spacing={0.5}>
                <Typography variant="subtitle2">Dados de usuÃƒÆ’Ã‚Â¡rio</Typography>
                <Typography>Nome: {profile.user.name}</Typography>
                <Typography>Email: {profile.user.email}</Typography>
                <Typography>CPF: {profile.reseller.cpf}</Typography>
                <Typography>Link exclusivo: {profile.reseller.uniqueLink}</Typography>
              </Stack>
              <Divider />
              <Box component="form" onSubmit={handlePersonalSubmit} noValidate>
                <Stack spacing={2}>
                  <Typography variant="h6">Dados pessoais</Typography>
                  <TextField
                    label="Nome completo"
                    {...personalForm.register('fullName')}
                    fullWidth
                  />
                  <Controller
                    name="phone"
                    control={personalForm.control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Telefone"
                        fullWidth
                        InputProps={{
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          inputComponent: PhoneMask as any,
                          inputProps: {
                            name: field.name,
                            onAccept: (value: string) => field.onChange(value),
                          },
                        }}
                      />
                    )}
                  />
                  <Stack direction="row" spacing={2}>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={personalStatus === 'saving'}
                    >
                      {personalStatus === 'saving' ? 'Salvando...' : 'Salvar dados pessoais'}
                    </Button>
                    {personalStatus === 'success' && (
                      <Typography color="success.main">Dados salvos</Typography>
                    )}
                    {personalStatus === 'error' && (
                      <Typography color="error.main">Erro ao salvar</Typography>
                    )}
                  </Stack>
                  {personalMessage && <Alert severity="success">{personalMessage}</Alert>}
                </Stack>
              </Box>
              <Divider />
              <Box component="form" onSubmit={handleBankSubmit} noValidate>
                <Stack spacing={2}>
                  <Typography variant="h6">Dados bancÃƒÆ’Ã‚Â¡rios</Typography>
                  <TextField label="Banco" fullWidth {...bankForm.register('bankName')} />
                  <TextField
                    label="CÃƒÆ’Ã‚Â³digo do banco"
                    fullWidth
                    {...bankForm.register('bankCode')}
                  />
                  <TextField
                    label="AgÃƒÆ’Ã‚Âªncia"
                    fullWidth
                    {...bankForm.register('bankAgency')}
                  />
                  <TextField label="Conta" fullWidth {...bankForm.register('bankAccount')} />
                  <TextField label="Titular" fullWidth {...bankForm.register('bankHolderName')} />
                  <Controller
                    name="bankHolderCpf"
                    control={bankForm.control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="CPF do titular"
                        fullWidth
                        InputProps={{
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          inputComponent: CpfMask as any,
                          inputProps: {
                            name: field.name,
                            onAccept: (value: string) => field.onChange(value),
                          },
                        }}
                      />
                    )}
                  />
                  <FormControl fullWidth>
                    <InputLabel>Tipo de conta</InputLabel>
                    <Controller
                      name="bankAccountType"
                      control={bankForm.control}
                      render={({ field }) => (
                        <Select {...field} label="Tipo de conta">
                          <MenuItem value="">NÃƒÆ’Ã‚Â£o informar</MenuItem>
                          <MenuItem value="checking">Conta corrente</MenuItem>
                          <MenuItem value="savings">Conta poupanÃƒÆ’Ã‚Â§a</MenuItem>
                        </Select>
                      )}
                    />
                  </FormControl>
                  <TextField label="PIX" fullWidth {...bankForm.register('pixKey')} />
                  <FormControl fullWidth>
                    <InputLabel>Tipo da chave PIX</InputLabel>
                    <Controller
                      name="pixKeyType"
                      control={bankForm.control}
                      render={({ field }) => (
                        <Select {...field} label="Tipo da chave PIX">
                          <MenuItem value="">NÃƒÆ’Ã‚Â£o informar</MenuItem>
                          <MenuItem value="cpf">CPF</MenuItem>
                          <MenuItem value="email">E-mail</MenuItem>
                          <MenuItem value="phone">Telefone</MenuItem>
                          <MenuItem value="random">AleatÃƒÆ’Ã‚Â³ria</MenuItem>
                        </Select>
                      )}
                    />
                  </FormControl>
                  <Stack direction="row" spacing={2}>
                    <Button type="submit" variant="contained" disabled={bankStatus === 'saving'}>
                      {bankStatus === 'saving' ? 'Salvando...' : 'Salvar dados bancÃƒÂ¡rios'}
                    </Button>
                    {bankStatus === 'success' && (
                      <Typography color="success.main">Dados salvos</Typography>
                    )}
                    {bankStatus === 'error' && (
                      <Typography color="error.main">Erro ao salvar</Typography>
                    )}
                  </Stack>
                  {bankMessage && <Alert severity="success">{bankMessage}</Alert>}
                </Stack>
              </Box>
            </Stack>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}
