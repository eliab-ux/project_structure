'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { useSnackbar } from 'notistack';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import * as yup from 'yup';
import { AppShell } from 'src/components/AppShell/AppShell';
import { ContactPhoneCard } from 'src/components/ContactPhoneCard/ContactPhoneCard';
import { errorMessage } from 'src/services/api';
import dispatchService from 'src/services/dispatchService';
import scheduleService from 'src/services/scheduleService';
import whatsappService from 'src/services/whatsappService';
import { WhatsappGroup } from 'src/types';

/** O catálogo tem 365 leituras; a última cai 364 dias depois do dia 1. */
const TOTAL_READINGS = 365;

function lastReadingHint(planStartDate?: string): string {
  if (!planStartDate || !/^\d{4}-\d{2}-\d{2}$/.test(planStartDate)) {
    return 'Data em que a primeira leitura do plano é enviada.';
  }
  const last = new Date(`${planStartDate}T12:00:00Z`);
  last.setUTCDate(last.getUTCDate() + TOTAL_READINGS - 1);
  const [y, m, d] = last.toISOString().slice(0, 10).split('-');
  return `Com esta data, a última das ${TOTAL_READINGS} leituras cai em ${d}/${m}/${y}.`;
}

const TIMEZONES = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Belem',
  'America/Fortaleza',
  'America/Cuiaba',
  'America/Rio_Branco',
  'Europe/Lisbon',
  'UTC',
];

interface ScheduleForm {
  groupJid: string;
  sendTime: string;
  timezone: string;
  planStartDate: string;
  /** `0` = envia a leitura do próprio dia; `1` = envia na véspera a leitura do dia seguinte. */
  dayOffset: number;
  messageTemplate: string;
}

/** As duas únicas escolhas que fazem sentido na tela — o backend aceita −30..30. */
const DAY_OFFSET_OPTIONS = [
  { value: 0, label: 'No mesmo dia da leitura' },
  { value: 1, label: 'Um dia antes (na véspera)' },
];

/** Descreve o efeito da combinação horário + deslocamento em uma frase concreta. */
function sendMomentHint(values: { sendTime?: string; dayOffset?: number }): string {
  const time = values.sendTime || '00:00';
  return Number(values.dayOffset) === 1
    ? `Todo dia às ${time}, o grupo recebe a leitura do DIA SEGUINTE — com a data do dia seguinte na mensagem.`
    : `Todo dia às ${time}, o grupo recebe a leitura DAQUELE mesmo dia.`;
}

const schema = yup.object({
  groupJid: yup.string().required('Escolha o grupo de destino'),
  sendTime: yup
    .string()
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Use o formato HH:mm')
    .required('Horário obrigatório'),
  timezone: yup.string().required('Fuso obrigatório'),
  dayOffset: yup.number().oneOf([0, 1], 'Escolha quando enviar').required('Escolha quando enviar'),
  planStartDate: yup
    .string()
    .matches(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD')
    .required('Data obrigatória'),
  // Espelha a regra do backend: sem {{url}} a mensagem não teria o link do vídeo.
  messageTemplate: yup
    .string()
    .test('has-url', 'O template precisa conter {{url}}', (v) => !!v && v.includes('{{url}}'))
    // O backend substitui APENAS {{date}} e {{url}} — qualquer outra coisa entre chaves é copiada
    // literalmente e chega no grupo com as chaves à mostra. O erro típico é envolver um link em
    // {{ }} achando que é assim que se escreve URL; barrar aqui evita descobrir isso pelo grupo.
    .test('placeholders-validos', (v, ctx) => {
      const unknown = [...(v ?? '').matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)]
        .map((m) => m[1])
        .filter((name) => name !== 'date' && name !== 'url');
      if (unknown.length === 0) {
        return true;
      }
      return ctx.createError({
        message: `{{${unknown[0]}}} não é um campo — só existem {{date}} e {{url}}. Se é um link fixo, escreva sem as chaves.`,
      });
    })
    .required(),
});

export default function ConfiguracaoPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [groups, setGroups] = useState<WhatsappGroup[]>([]);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [configured, setConfigured] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ScheduleForm>({
    resolver: yupResolver(schema),
    defaultValues: {
      groupJid: '',
      sendTime: '07:00',
      timezone: 'America/Sao_Paulo',
      planStartDate: '2026-01-01',
      // Default: a leitura do próprio dia — é o comportamento que o sistema sempre teve.
      dayOffset: 0,
      messageTemplate: '{{date}}\n{{url}}',
    },
  });

  useEffect(() => {
    async function load() {
      const [sched, groupList] = await Promise.allSettled([
        scheduleService.get(),
        whatsappService.listGroups(),
      ]);

      if (sched.status === 'fulfilled' && sched.value.configured) {
        setConfigured(true);
        setIsActive(sched.value.isActive);
        reset({
          groupJid: sched.value.groupJid ?? '',
          sendTime: sched.value.sendTime ?? '07:00',
          timezone: sched.value.timezone ?? 'America/Sao_Paulo',
          planStartDate: sched.value.planStartDate ?? '2026-01-01',
          dayOffset: sched.value.dayOffset ?? 0,
          messageTemplate: sched.value.messageTemplate ?? '{{date}}\n{{url}}',
        });
      }

      if (groupList.status === 'fulfilled') {
        setGroups(groupList.value.groups);
      } else {
        setGroupsError(errorMessage(groupList.reason, 'Não foi possível carregar os grupos'));
      }
      setLoading(false);
    }
    load();
  }, [reset]);

  async function handleRefreshGroups() {
    setRefreshing(true);
    setGroupsError(null);
    try {
      const list = await whatsappService.listGroups(true);
      setGroups(list.groups);
      enqueueSnackbar(`${list.groups.length} grupos encontrados`, { variant: 'success' });
    } catch (err) {
      setGroupsError(errorMessage(err, 'Não foi possível atualizar os grupos'));
    } finally {
      setRefreshing(false);
    }
  }

  async function onSubmit(values: ScheduleForm) {
    try {
      const saved = await scheduleService.save({ ...values, dayOffset: Number(values.dayOffset) });
      setConfigured(true);
      // Do que o SERVIDOR devolveu, nunca `true` fixo: salvar a configuração não ativa nada, e
      // assumir que ativa fazia a tela mostrar "ativo" com o agendamento pausado no banco — o
      // envio não acontecia e o switch dizia que estava tudo certo.
      setIsActive(saved.isActive);
      enqueueSnackbar('Configuração salva', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(errorMessage(err, 'Não foi possível salvar'), { variant: 'error' });
    }
  }

  async function handleToggle(next: boolean) {
    try {
      await scheduleService.toggle(next);
      setIsActive(next);
      enqueueSnackbar(next ? 'Envio automático ativado' : 'Envio automático pausado', {
        variant: 'success',
      });
    } catch (err) {
      enqueueSnackbar(errorMessage(err), { variant: 'error' });
    }
  }

  async function handleSendNow() {
    const groupName = groups.find((g) => g.jid === watch('groupJid'))?.name ?? 'grupo selecionado';
    if (
      !window.confirm(
        `Isto vai enviar a mensagem de hoje no grupo "${groupName}" AGORA. Confirmar?`,
      )
    ) {
      return;
    }
    setSending(true);
    try {
      const result = await dispatchService.sendNow();
      if (result.status === 'sent') {
        enqueueSnackbar('Mensagem enviada', { variant: 'success' });
      } else {
        enqueueSnackbar(result.reason ?? 'O envio falhou', { variant: 'error' });
      }
    } catch (err) {
      enqueueSnackbar(errorMessage(err, 'Não foi possível enviar'), { variant: 'error' });
    } finally {
      setSending(false);
    }
  }

  return (
    <AppShell>
      <Typography component="h1" variant="h2" gutterBottom>
        Configuração
      </Typography>

      {loading ? (
        <Box
          role="status"
          aria-label="Carregando"
          sx={{ display: 'flex', justifyContent: 'center', py: 8 }}
        >
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={2}>
          {groupsError && (
            <Alert
              role="alert"
              severity="warning"
              action={
                <Button component={Link} href="/whatsapp" size="small">
                  WhatsApp
                </Button>
              }
            >
              {groupsError}
            </Alert>
          )}

          <Card component="section">
            <CardContent>
              <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
                <Stack spacing={2.5}>
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <Controller
                      name="groupJid"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          select
                          label="Grupo de destino"
                          fullWidth
                          error={!!errors.groupJid}
                          helperText={errors.groupJid?.message}
                          disabled={groups.length === 0}
                        >
                          {groups.length === 0 ? (
                            <MenuItem value="">Nenhum grupo carregado</MenuItem>
                          ) : (
                            groups.map((group) => (
                              <MenuItem key={group.jid} value={group.jid}>
                                {group.name}
                                {group.participantsCount ? ` · ${group.participantsCount}` : ''}
                              </MenuItem>
                            ))
                          )}
                        </TextField>
                      )}
                    />
                    {/* O WhatsApp leva ~20s para devolver os metadados de todos os grupos —
                        avisar evita a impressão de que travou. */}
                    <Button
                      onClick={handleRefreshGroups}
                      disabled={refreshing}
                      title="Pode levar até um minuto na primeira vez"
                      sx={{ mt: 1, whiteSpace: 'nowrap' }}
                    >
                      {refreshing ? 'Buscando… (até 1 min)' : 'Atualizar grupos'}
                    </Button>
                  </Stack>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      label="Horário do envio"
                      type="time"
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      error={!!errors.sendTime}
                      helperText={errors.sendTime?.message}
                      {...register('sendTime')}
                    />
                    <Controller
                      name="timezone"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} select label="Fuso horário" fullWidth>
                          {TIMEZONES.map((tz) => (
                            <MenuItem key={tz} value={tz}>
                              {tz}
                            </MenuItem>
                          ))}
                        </TextField>
                      )}
                    />
                  </Stack>

                  <Controller
                    name="dayOffset"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        select
                        label="Quando enviar"
                        fullWidth
                        error={!!errors.dayOffset}
                        // A consequência escrita com o horário que está no campo: "um dia antes"
                        // sozinho não deixa óbvio QUAL leitura vai na mensagem.
                        helperText={errors.dayOffset?.message ?? sendMomentHint(watch())}
                      >
                        {DAY_OFFSET_OPTIONS.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  />

                  <TextField
                    label="Dia 1 do plano"
                    type="date"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    error={!!errors.planStartDate}
                    // Calculado a partir do que está no campo: um texto fixo aqui ficou
                    // desatualizado quando o alinhamento do plano mudou.
                    helperText={
                      errors.planStartDate?.message ?? lastReadingHint(watch('planStartDate'))
                    }
                    {...register('planStartDate')}
                  />

                  <TextField
                    label="Template da mensagem"
                    fullWidth
                    multiline
                    minRows={2}
                    error={!!errors.messageTemplate}
                    helperText={
                      errors.messageTemplate?.message ??
                      'Use {{date}} e {{url}}. O {{url}} é obrigatório.'
                    }
                    {...register('messageTemplate')}
                  />

                  <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
                    {isSubmitting ? 'Salvando…' : 'Salvar configuração'}
                  </Button>
                </Stack>
              </Box>
            </CardContent>
          </Card>

          {configured && (
            <Card component="section">
              <CardContent>
                <Stack spacing={2}>
                  <FormControlLabel
                    control={
                      <Switch checked={isActive} onChange={(e) => handleToggle(e.target.checked)} />
                    }
                    label={isActive ? 'Envio automático ativo' : 'Envio automático pausado'}
                  />
                  <Stack spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                      O envio manual não substitui o envio do dia — e é limitado a 3 por hora.
                    </Typography>
                    <Button
                      color="secondary"
                      variant="outlined"
                      onClick={handleSendNow}
                      disabled={sending}
                    >
                      {sending ? 'Enviando…' : 'Enviar agora'}
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Fora do formulário do agendamento de propósito: é dado da conta, não do envio. */}
          <ContactPhoneCard />
        </Stack>
      )}
    </AppShell>
  );
}
