'use client';

import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { IMaskInput } from 'react-imask';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { BRAZILIAN_STATES } from 'src/constants/brazilianStates';
import { Company, CreateCompanyPayload, TAX_REGIME_LABEL, TaxRegime } from 'src/types/admin';

/**
 * Cadastro e edição de empresa no mesmo diálogo.
 *
 * Um componente para as duas operações porque os campos são os mesmos — dois arquivos teriam de ser
 * mantidos em paralelo a cada campo novo, e o esquecido seria sempre o de edição, que é o menos
 * usado no dia a dia do desenvolvimento.
 *
 * O CNPJ some na edição: o backend não aceita trocá-lo, e um campo desabilitado que o usuário tenta
 * editar três vezes antes de desistir é pior do que um campo ausente.
 */

const onlyDigits = (value: string | undefined | null) => (value ?? '').replace(/\D/g, '');

/**
 * Validação alinhada ao Request DTO do backend — não uma versão simplificada.
 *
 * O objetivo aqui não é substituir a validação do servidor (que é a que vale), e sim evitar o
 * round-trip para dizer o que dá para saber no navegador. Onde as duas discordarem, quem ganha é o
 * backend: por isso os limites de tamanho abaixo repetem os `@MaxLength` de lá.
 */
const schema = yup.object({
  legalName: yup.string().trim().required('Razão social é obrigatória.').max(200),
  tradeName: yup.string().trim().max(200).nullable(),
  document: yup
    .string()
    .transform((_, original: string) => onlyDigits(original))
    .required('CNPJ é obrigatório.')
    .matches(/^\d{14}$/, 'CNPJ deve ter 14 dígitos.'),
  taxRegime: yup.string().oneOf(['SIMPLES', 'NORMAL', 'MEI']).required(),
  stateRegistrationExempt: yup.boolean().required(),
  stateRegistration: yup.string().trim().max(30).nullable(),
  municipalRegistration: yup.string().trim().max(30).nullable(),
  cnae: yup.string().trim().max(10).nullable(),
  contactEmail: yup.string().trim().email('E-mail de contato inválido.').max(255).nullable(),
  billingEmail: yup.string().trim().email('E-mail de cobrança inválido.').max(255).nullable(),
  phone: yup.string().trim().max(20).nullable(),
  address: yup.object({
    street: yup.string().trim().required('Logradouro é obrigatório.').max(200),
    number: yup.string().trim().required('Número é obrigatório.').max(20),
    complement: yup.string().trim().max(100).nullable(),
    district: yup.string().trim().required('Bairro é obrigatório.').max(100),
    city: yup.string().trim().required('Cidade é obrigatória.').max(120),
    state: yup.string().oneOf(BRAZILIAN_STATES, 'UF inválida.').required('UF é obrigatória.'),
    zipCode: yup
      .string()
      .transform((_, original: string) => onlyDigits(original))
      .required('CEP é obrigatório.')
      .matches(/^\d{8}$/, 'CEP deve ter 8 dígitos.'),
    ibgeCityCode: yup
      .string()
      .transform((_, original: string) => onlyDigits(original) || '')
      .matches(/^(\d{7})?$/, 'Código IBGE deve ter 7 dígitos.')
      .nullable(),
  }),
});

type FormValues = yup.InferType<typeof schema>;

const EMPTY: FormValues = {
  legalName: '',
  tradeName: '',
  document: '',
  taxRegime: 'SIMPLES',
  stateRegistrationExempt: true,
  stateRegistration: '',
  municipalRegistration: '',
  cnae: '',
  contactEmail: '',
  billingEmail: '',
  phone: '',
  address: {
    street: '',
    number: '',
    complement: '',
    district: '',
    city: '',
    state: 'GO',
    zipCode: '',
    ibgeCityCode: '',
  },
};

/** `''` vira `null`: string vazia num campo opcional é ruído que o backend guardaria como valor. */
const orNull = (value: string | null | undefined) => {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
};

function toPayload(values: FormValues): CreateCompanyPayload {
  return {
    legalName: values.legalName.trim(),
    tradeName: orNull(values.tradeName),
    document: onlyDigits(values.document),
    taxRegime: values.taxRegime as TaxRegime,
    stateRegistrationExempt: values.stateRegistrationExempt,
    stateRegistration: values.stateRegistrationExempt ? null : orNull(values.stateRegistration),
    municipalRegistration: orNull(values.municipalRegistration),
    cnae: orNull(values.cnae),
    contactEmail: orNull(values.contactEmail),
    billingEmail: orNull(values.billingEmail),
    phone: orNull(values.phone),
    address: {
      street: values.address.street.trim(),
      number: values.address.number.trim(),
      complement: orNull(values.address.complement),
      district: values.address.district.trim(),
      city: values.address.city.trim(),
      state: values.address.state,
      zipCode: onlyDigits(values.address.zipCode),
      ibgeCityCode: orNull(values.address.ibgeCityCode),
    },
  };
}

export function CompanyFormDialog({
  open,
  company,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  /** `null` cria; preenchido edita. */
  company: Company | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateCompanyPayload) => Promise<void>;
}) {
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: yupResolver(schema), defaultValues: EMPTY });

  const exempt = watch('stateRegistrationExempt');

  useEffect(() => {
    if (!open) {
      return;
    }
    reset(
      company
        ? {
            legalName: company.legalName,
            tradeName: company.tradeName ?? '',
            document: company.document,
            taxRegime: company.taxRegime,
            stateRegistrationExempt: company.stateRegistrationExempt,
            stateRegistration: company.stateRegistration ?? '',
            municipalRegistration: company.municipalRegistration ?? '',
            cnae: company.cnae ?? '',
            contactEmail: company.contactEmail ?? '',
            billingEmail: company.billingEmail ?? '',
            phone: company.phone ?? '',
            address: {
              ...company.address,
              complement: company.address.complement ?? '',
              ibgeCityCode: company.address.ibgeCityCode ?? '',
            },
          }
        : EMPTY,
    );
  }, [open, company, reset]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <form onSubmit={handleSubmit((values) => onSubmit(toPayload(values)))} noValidate>
        <DialogTitle>{company ? 'Editar empresa' : 'Nova empresa'}</DialogTitle>

        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={8}>
              <Controller
                name="legalName"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Razão social"
                    fullWidth
                    required
                    error={!!errors.legalName}
                    helperText={errors.legalName?.message}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <Controller
                name="tradeName"
                control={control}
                render={({ field }) => (
                  <TextField {...field} value={field.value ?? ''} label="Nome fantasia" fullWidth />
                )}
              />
            </Grid>

            {!company ? (
              <Grid item xs={12} sm={4}>
                <Controller
                  name="document"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="CNPJ"
                      fullWidth
                      required
                      error={!!errors.document}
                      helperText={errors.document?.message}
                      InputProps={{
                        inputComponent: IMaskInput as never,
                        inputProps: { mask: '00.000.000/0000-00', unmask: true },
                      }}
                    />
                  )}
                />
              </Grid>
            ) : null}

            <Grid item xs={12} sm={4}>
              <Controller
                name="taxRegime"
                control={control}
                render={({ field }) => (
                  <TextField {...field} select label="Regime tributário" fullWidth required>
                    {(Object.keys(TAX_REGIME_LABEL) as TaxRegime[]).map((regime) => (
                      <MenuItem key={regime} value={regime}>
                        {TAX_REGIME_LABEL[regime]}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <Controller
                name="cnae"
                control={control}
                render={({ field }) => (
                  <TextField {...field} value={field.value ?? ''} label="CNAE" fullWidth />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <Controller
                name="stateRegistrationExempt"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch {...field} checked={!!field.value} />}
                    label="Isenta de Inscrição Estadual"
                  />
                )}
              />
            </Grid>

            {!exempt ? (
              <Grid item xs={12} sm={4}>
                <Controller
                  name="stateRegistration"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      value={field.value ?? ''}
                      label="Inscrição Estadual"
                      fullWidth
                    />
                  )}
                />
              </Grid>
            ) : null}

            <Grid item xs={12} sm={4}>
              <Controller
                name="municipalRegistration"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ''}
                    label="Inscrição Municipal"
                    fullWidth
                  />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mt: 1 }}>
                Endereço
              </Typography>
            </Grid>

            <Grid item xs={12} sm={3}>
              <Controller
                name="address.zipCode"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="CEP"
                    fullWidth
                    required
                    error={!!errors.address?.zipCode}
                    helperText={errors.address?.zipCode?.message}
                    InputProps={{
                      inputComponent: IMaskInput as never,
                      inputProps: { mask: '00000-000', unmask: true },
                    }}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={7}>
              <Controller
                name="address.street"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Logradouro"
                    fullWidth
                    required
                    error={!!errors.address?.street}
                    helperText={errors.address?.street?.message}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={2}>
              <Controller
                name="address.number"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Número"
                    fullWidth
                    required
                    error={!!errors.address?.number}
                    helperText={errors.address?.number?.message}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <Controller
                name="address.complement"
                control={control}
                render={({ field }) => (
                  <TextField {...field} value={field.value ?? ''} label="Complemento" fullWidth />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <Controller
                name="address.district"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Bairro"
                    fullWidth
                    required
                    error={!!errors.address?.district}
                    helperText={errors.address?.district?.message}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={3}>
              <Controller
                name="address.city"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Cidade"
                    fullWidth
                    required
                    error={!!errors.address?.city}
                    helperText={errors.address?.city?.message}
                  />
                )}
              />
            </Grid>

            <Grid item xs={6} sm={1}>
              <Controller
                name="address.state"
                control={control}
                render={({ field }) => (
                  <TextField {...field} select label="UF" fullWidth required>
                    {BRAZILIAN_STATES.map((state) => (
                      <MenuItem key={state} value={state}>
                        {state}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <Controller
                name="address.ibgeCityCode"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ''}
                    label="Código IBGE do município"
                    fullWidth
                    error={!!errors.address?.ibgeCityCode}
                    helperText={errors.address?.ibgeCityCode?.message}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mt: 1 }}>
                Contato
              </Typography>
            </Grid>

            <Grid item xs={12} sm={4}>
              <Controller
                name="contactEmail"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ''}
                    label="E-mail de contato"
                    fullWidth
                    error={!!errors.contactEmail}
                    helperText={errors.contactEmail?.message}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <Controller
                name="billingEmail"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ''}
                    label="E-mail de cobrança"
                    fullWidth
                    error={!!errors.billingEmail}
                    helperText={errors.billingEmail?.message}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <Controller
                name="phone"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ''}
                    label="Telefone"
                    fullWidth
                    InputProps={{
                      inputComponent: IMaskInput as never,
                      inputProps: { mask: '(00) 00000-0000', unmask: false },
                    }}
                  />
                )}
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
