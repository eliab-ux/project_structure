'use client';

import { useState, useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  InputAdornment,
  Link,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
  MenuItem,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { Search } from '@mui/icons-material';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

type BankingInfo = {
  bankName: string;
  bankCode: string;
  bankAgency: string;
  bankAccount: string;
  accountType: 'checking' | 'savings';
  holderName: string;
  holderCpf: string;
};

type FormData = {
  type: 'pf' | 'pj';
  name: string;
  document: string;
  email: string;
  phone: string;
  birthDate: string;
  password: string;
  passwordConfirmation: string;
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  acceptedTerms: boolean;
  banking: BankingInfo;
  pixKey: string;
  pixKeyType: 'cpf' | 'email' | 'phone' | 'random';
};

const steps = [
  'Tipo de cadastro',
  'Dados pessoais',
  'Endereço',
  'Dados bancários',
  'Senha',
];

const initialForm: FormData = {
  type: 'pf',
  name: '',
  document: '',
  email: '',
  phone: '',
  birthDate: '',
  password: '',
  passwordConfirmation: '',
  zipCode: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  acceptedTerms: false,
  banking: {
    bankName: '',
    bankCode: '',
    bankAgency: '',
    bankAccount: '',
    accountType: 'checking',
    holderName: '',
    holderCpf: '',
  },
  pixKey: '',
  pixKeyType: 'cpf',
};

export function ResellerSignup() {
  const [formData, setFormData] = useState<FormData>(initialForm);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);

  useEffect(() => {
    if (formData.zipCode.replace(/\D/g, '').length === 8) {
      fetchAddress(formData.zipCode);
    }
  }, [formData.zipCode]);

  function updateField<K extends keyof FormData>(field: K, value: FormData[K]) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function updateBanking(field: keyof BankingInfo, value: string) {
    setFormData((prev) => ({
      ...prev,
      banking: {
        ...prev.banking,
        [field]: value,
      },
    }));
  }

  function maskDigits(value: string) {
    return value.replace(/\D/g, '');
  }

  function maskDocument(value: string, type: 'pf' | 'pj') {
    const digits = maskDigits(value);
    if (type === 'pf') {
      return digits
        .replace(/^(\d{3})(\d)/, '$1.$2')
        .replace(/^(\d{3}\.\d{3})(\d)/, '$1.$2')
        .replace(/^(\d{3}\.\d{3}\.\d{3})(\d)/, '$1-$2')
        .slice(0, 14);
    }
    return digits
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2}\.\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{2}\.\d{3}\.\d{3})(\d)/, '$1/$2')
      .replace(/^(\d{2}\.\d{3}\.\d{3}\/\d{4})(\d)/, '$1-$2')
      .slice(0, 18);
  }

  function maskPhone(value: string) {
    const digits = maskDigits(value);
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .slice(0, 15);
  }

  function maskZipCode(value: string) {
    const digits = maskDigits(value);
    return digits.replace(/^(\d{5})(\d)/, '$1-$2').slice(0, 9);
  }

  async function fetchAddress(zip: string) {
    const cleanZip = maskDigits(zip);
    if (cleanZip.length !== 8) {
      return;
    }
    setCepLoading(true);
    setCepError(null);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanZip}/json/`);
      const data = await response.json();
      if (data.erro) {
        setCepError('CEP não encontrado');
        return;
      }
      setFormData((prev) => ({
        ...prev,
        street: data.logradouro || prev.street,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
      }));
    } catch (error) {
      setCepError('Falha ao buscar CEP');
    } finally {
      setCepLoading(false);
    }
  }

  function isStepValid(step: number) {
    switch (step) {
      case 1:
        return formData.type === 'pf' || formData.type === 'pj';
      case 2:
        return (
          formData.name.trim().length >= 2 &&
          maskDigits(formData.document).length >= 11 &&
          formData.email.includes('@') &&
          formData.phone.trim().length >= 10 &&
          !!formData.birthDate
        );
      case 3:
        return (
          maskDigits(formData.zipCode).length === 8 &&
          formData.street.trim() &&
          formData.number.trim() &&
          formData.neighborhood.trim() &&
          formData.city.trim() &&
          formData.state.trim().length === 2
        );
      case 4:
        return (
          formData.banking.bankName.trim() &&
          formData.banking.bankCode.trim() &&
          formData.banking.bankAgency.trim() &&
          formData.banking.bankAccount.trim() &&
          formData.banking.holderName.trim() &&
          maskDigits(formData.banking.holderCpf).length >= 11
        );
      case 5:
        return (
          formData.password.length >= 8 &&
          formData.password === formData.passwordConfirmation &&
          formData.acceptedTerms
        );
      default:
        return false;
    }
  }

  async function handleSubmit() {
    if (!isStepValid(5)) {
      setAlert({ message: 'Preencha os campos obrigatórios antes de enviar.', severity: 'error' });
      return;
    }
    setLoading(true);
    setAlert(null);
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          name: formData.name,
          cpf: maskDigits(formData.document),
          password: formData.password,
          type: formData.type,
          birthDate: formData.birthDate,
          phone: maskDigits(formData.phone),
          zipCode: maskDigits(formData.zipCode),
          street: formData.street,
          number: formData.number,
          complement: formData.complement,
          neighborhood: formData.neighborhood,
          city: formData.city,
          state: formData.state,
          bankName: formData.banking.bankName,
          bankCode: formData.banking.bankCode,
          bankAgency: formData.banking.bankAgency,
          bankAccount: formData.banking.bankAccount,
          bankAccountType: formData.banking.accountType,
          bankHolderName: formData.banking.holderName,
          bankHolderCpf: maskDigits(formData.banking.holderCpf),
          pixKey: formData.pixKey,
          pixKeyType: formData.pixKeyType,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message ?? 'Erro ao enviar inscrição');
      }
      setAlert({ message: 'Cadastro enviado. Verifique seu email em até 24h.', severity: 'success' });
      setFormData(initialForm);
      setCurrentStep(1);
    } catch (error: any) {
      setAlert({ message: error?.message ?? 'Erro inesperado', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Paper id="revendedores" elevation={3} sx={{ p: { xs: 3, md: 5 }, borderRadius: 4 }}>
      <Stack spacing={4}>
        <Box>
          <Typography variant="h4">Cadastre-se como revendedor</Typography>
          <Typography color="text.secondary">
            Complete suas informações para entrarmos em contato em até 24h úteis.
          </Typography>
        </Box>

        <Stepper activeStep={currentStep - 1} alternativeLabel>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {alert && (
          <Alert severity={alert.severity} onClose={() => setAlert(null)}>
            {alert.message}
          </Alert>
        )}

        <Box>
          {currentStep === 1 && (
            <Stack spacing={2}>
              <FormControl component="fieldset">
                <FormLabel>Tipo de cadastro</FormLabel>
                <RadioGroup
                  row
                  value={formData.type}
                  onChange={(event) => updateField('type', event.target.value as 'pf' | 'pj')}
                >
                  <FormControlLabel value="pf" control={<Radio />} label="Pessoa Física" />
                  <FormControlLabel value="pj" control={<Radio />} label="Pessoa Jurídica" />
                </RadioGroup>
              </FormControl>
              <Typography color="text.secondary" variant="body2">
                Escolha o tipo para desbloquear os campos corretos nas próximas etapas.
              </Typography>
            </Stack>
          )}

          {currentStep === 2 && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label={formData.type === 'pf' ? 'Nome completo' : 'Razão social'}
                  value={formData.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={formData.type === 'pf' ? 'CPF' : 'CNPJ'}
                  value={maskDocument(formData.document, formData.type)}
                  onChange={(event) => updateField('document', event.target.value)}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Telefone/Celular"
                  value={maskPhone(formData.phone)}
                  onChange={(event) => updateField('phone', event.target.value)}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={formData.type === 'pf' ? 'Data de nascimento' : 'Data de abertura'}
                  type="date"
                  value={formData.birthDate}
                  onChange={(event) => updateField('birthDate', event.target.value)}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
            </Grid>
          )}

          {currentStep === 3 && (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="CEP"
                  value={maskZipCode(formData.zipCode)}
                  onChange={(event) => updateField('zipCode', event.target.value)}
                  fullWidth
                  helperText={cepError || '00000-000'}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        {cepLoading ? <CircularProgress size={18} /> : <Search />}
                      </InputAdornment>
                    ),
                  }}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Rua/Logradouro"
                  value={formData.street}
                  onChange={(event) => updateField('street', event.target.value)}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Número"
                  value={formData.number}
                  onChange={(event) => updateField('number', event.target.value)}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Complemento (opcional)"
                  value={formData.complement}
                  onChange={(event) => updateField('complement', event.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Bairro"
                  value={formData.neighborhood}
                  onChange={(event) => updateField('neighborhood', event.target.value)}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Cidade"
                  value={formData.city}
                  onChange={(event) => updateField('city', event.target.value)}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <TextField
                  label="UF"
                  value={formData.state}
                  onChange={(event) => updateField('state', event.target.value.toUpperCase())}
                  inputProps={{ maxLength: 2 }}
                  fullWidth
                  required
                />
              </Grid>
            </Grid>
          )}

          {currentStep === 4 && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Banco"
                  value={formData.banking.bankName}
                  onChange={(event) => updateBanking('bankName', event.target.value)}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Agência (com dígito)"
                  value={formData.banking.bankAgency}
                  onChange={(event) => updateBanking('bankAgency', event.target.value)}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Conta (com dígito)"
                  value={formData.banking.bankAccount}
                  onChange={(event) => updateBanking('bankAccount', event.target.value)}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth required>
                  <Select
                    value={formData.banking.accountType}
                    onChange={(event) =>
                      updateBanking('accountType', event.target.value as 'checking' | 'savings')
                    }
                  >
                    <MenuItem value="checking">Corrente</MenuItem>
                    <MenuItem value="savings">Poupança</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Nome do titular"
                  value={formData.banking.holderName}
                  onChange={(event) => updateBanking('holderName', event.target.value)}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="CPF do titular"
                  value={maskDocument(formData.banking.holderCpf, 'pf')}
                  onChange={(event) => updateBanking('holderCpf', event.target.value)}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Chave PIX (opcional)"
                  value={formData.pixKey}
                  onChange={(event) => updateField('pixKey', event.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <Select
                    value={formData.pixKeyType}
                    onChange={(event) =>
                      updateField('pixKeyType', event.target.value as FormData['pixKeyType'])
                    }
                  >
                    <MenuItem value="cpf">CPF</MenuItem>
                    <MenuItem value="email">Email</MenuItem>
                    <MenuItem value="phone">Telefone</MenuItem>
                    <MenuItem value="random">Aleatória</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          )}

          {currentStep === 5 && (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Senha"
                  type="password"
                  value={formData.password}
                  onChange={(event) => updateField('password', event.target.value)}
                  fullWidth
                  helperText="Mínimo 8 caracteres"
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Confirmar senha"
                  type="password"
                  value={formData.passwordConfirmation}
                  onChange={(event) => updateField('passwordConfirmation', event.target.value)}
                  fullWidth
                  required
                  error={
                    formData.passwordConfirmation.length > 0 &&
                    formData.password !== formData.passwordConfirmation
                  }
                  helperText={
                    formData.passwordConfirmation.length > 0 &&
                    formData.password !== formData.passwordConfirmation
                      ? 'Senhas não coincidem'
                      : ''
                  }
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.acceptedTerms}
                      onChange={(event) => updateField('acceptedTerms', event.target.checked)}
                    />
                  }
                  label={
                    <Typography variant="body2">
                      Li e aceito os{' '}
                      <Link href="/termos" target="_blank" rel="noreferrer">
                        Termos de Uso
                      </Link>{' '}
                      e a{' '}
                      <Link href="/privacidade" target="_blank" rel="noreferrer">
                        Política de Privacidade
                      </Link>
                      .
                    </Typography>
                  }
                />
              </Grid>
            </Grid>
          )}
        </Box>

        <Divider />

        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          {currentStep > 1 ? (
            <Button onClick={() => setCurrentStep((prev) => prev - 1)} variant="outlined">
              Voltar
            </Button>
          ) : (
            <Box />
          )}

          <Box sx={{ display: 'flex', gap: 2 }}>
            {currentStep < steps.length && (
              <Button
                variant="contained"
                color="primary"
                disabled={!isStepValid(currentStep)}
                onClick={() => setCurrentStep((prev) => prev + 1)}
              >
                Próximo
              </Button>
            )}
            {currentStep === steps.length && (
              <Button
                variant="contained"
                color="primary"
                endIcon={<SendIcon />}
                onClick={handleSubmit}
                disabled={!isStepValid(5) || loading}
              >
                {loading ? <CircularProgress size={20} /> : 'Enviar inscrição'}
              </Button>
            )}
          </Box>
        </Box>
      </Stack>
    </Paper>
  );
}
