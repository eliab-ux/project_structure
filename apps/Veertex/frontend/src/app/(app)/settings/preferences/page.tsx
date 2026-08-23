'use client';

import { useState } from 'react';
import { useSnackbar } from 'notistack';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { PageHeader } from 'src/components/PageHeader';
import { useAuth } from 'src/contexts/AuthContext';
import { apiErrorMessage } from 'src/services/api';
import accountService from 'src/services/accountService';

/**
 * PREFERÊNCIAS DA CONTA (§1 do 01A) — as regras que antes viviam fixas em código.
 *
 * Duas ainda não têm o valor não-padrão implementado, e a tela DIZ isso em vez de oferecer um toggle
 * inerte (o projeto recusa configuração que não faz nada): permitir documento duplicado depende de
 * relaxar o índice único (decisão pendente); a numeração sequencial depende do gerador, que não
 * existe. O padrão de cada uma funciona por inteiro.
 */
export default function PreferencesPage() {
  const { account, can, refreshSession } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const canEdit = can('account.update');

  const prefs = account?.preferences;
  const [contactCodeMode, setContactCodeMode] = useState(prefs?.contactCodeMode ?? 'manual');
  const [productSkuMode, setProductSkuMode] = useState(prefs?.productSkuMode ?? 'manual');
  const [contactCarteirizacao, setContactCarteirizacao] = useState(
    prefs?.contactCarteirizacao ?? false,
  );
  const [stockAllowNegative, setStockAllowNegative] = useState(prefs?.stockAllowNegative ?? false);
  const [commissionDueRule, setCommissionDueRule] = useState(
    prefs?.commissionDueRule ?? 'last_day_of_period',
  );
  const [commissionDueDay, setCommissionDueDay] = useState(
    String(prefs?.commissionDueDay ?? 5),
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await accountService.updatePreferences({
        contactCodeMode,
        productSkuMode,
        contactCarteirizacao,
        stockAllowNegative,
        commissionDueRule,
        commissionDueDay: Math.min(28, Math.max(1, Number(commissionDueDay) || 5)),
      });
      await refreshSession();
      enqueueSnackbar('Preferências salvas.', { variant: 'success' });
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError, 'Não foi possível salvar.'), {
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  if (!prefs) {
    return null;
  }

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto' }}>
      <PageHeader
        title="Preferências da conta"
        description="Regras de cadastro que valem para toda a conta."
      />

      {!canEdit ? (
        <Alert severity="info" role="status" sx={{ mb: 3 }}>
          Você pode ver as preferências, mas não alterá-las. Alterar exige a permissão{' '}
          <strong>account.update</strong>.
        </Alert>
      ) : null}

      <Stack spacing={2}>
        {/* Documento duplicado — o valor `true` ainda não está disponível (índice único do banco). */}
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            Permitir CPF/CNPJ duplicado
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Um mesmo documento não pode se repetir na conta — é o índice único do banco que garante
            isso, e ele não será relaxado sem necessidade. Esta opção permanece desabilitada; volta
            se um cliente precisar.
          </Typography>
          <FormControlLabel
            sx={{ mt: 1 }}
            control={<Switch checked={prefs.allowDuplicateDocument} disabled />}
            label={prefs.allowDuplicateDocument ? 'Permitido' : 'Não permitido'}
          />
        </Paper>

        <NumberingPreference
          title="Numeração do código do contato"
          value={contactCodeMode}
          onChange={setContactCodeMode}
          canEdit={canEdit}
        />

        <NumberingPreference
          title="Numeração do SKU do produto"
          value={productSkuMode}
          onChange={setProductSkuMode}
          canEdit={canEdit}
        />

        {/* Carteirização (§2.3 / ADR-0007) — preferência REAL e disponível (diferente das acima). */}
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            Carteirização de contatos
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Quando ligada, cada vendedor vê apenas os contatos da própria carteira (o vendedor
            vinculado ao contato). Quem administra a conta continua vendo todos. O contato sem
            vendedor vinculado fica visível só para quem não é vendedor.
          </Typography>
          <FormControlLabel
            sx={{ mt: 1 }}
            control={
              <Switch
                checked={contactCarteirizacao}
                onChange={(event) => setContactCarteirizacao(event.target.checked)}
                disabled={!canEdit}
              />
            }
            label={contactCarteirizacao ? 'Ligada' : 'Desligada'}
          />
        </Paper>

        {/* Estoque negativo (§3.2 do 03) — preferência real e disponível. */}
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            Permitir estoque negativo
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Desligado (padrão), uma saída que deixaria o saldo negativo é bloqueada — evita vender o
            que não existe. Ligado, a saída passa (venda com mercadoria a caminho, divergência de
            inventário).
          </Typography>
          <FormControlLabel
            sx={{ mt: 1 }}
            control={
              <Switch
                checked={stockAllowNegative}
                onChange={(event) => setStockAllowNegative(event.target.checked)}
                disabled={!canEdit}
              />
            }
            label={stockAllowNegative ? 'Permitido' : 'Bloqueado'}
          />
        </Paper>

        {/* Vencimento das comissões (registro de 23/08/2026) — vale para o Modelo A e para a folha
            da viagem (Modelo B). */}
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            Vencimento das comissões
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Quando a comissão apurada (loja ou viagem) vence como conta a pagar: no fim do próprio
            período (padrão) ou num dia fixo do mês seguinte — o formato de folha.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 1.5 }}>
            <TextField
              select
              label="Regra"
              value={commissionDueRule}
              onChange={(event) =>
                setCommissionDueRule(
                  event.target.value as 'last_day_of_period' | 'day_n_next_month',
                )
              }
              size="small"
              sx={{ minWidth: 260 }}
              disabled={!canEdit}
            >
              <MenuItem value="last_day_of_period">Último dia do período apurado</MenuItem>
              <MenuItem value="day_n_next_month">Dia fixo do mês seguinte</MenuItem>
            </TextField>
            {commissionDueRule === 'day_n_next_month' ? (
              <TextField
                label="Dia (1–28)"
                type="number"
                value={commissionDueDay}
                onChange={(event) => setCommissionDueDay(event.target.value)}
                inputProps={{ min: 1, max: 28 }}
                size="small"
                sx={{ width: 120 }}
                disabled={!canEdit}
              />
            ) : null}
          </Stack>
        </Paper>

        {canEdit ? (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" onClick={() => void save()} disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </Box>
        ) : null}
      </Stack>
    </Box>
  );
}

/**
 * `manual` é o único modo disponível hoje: a geração sequencial depende de um gerador que ainda não
 * existe. `sequential` aparece desabilitado e explicado — não é escondido, para o requisito ficar
 * visível, nem oferecido como se funcionasse.
 */
function NumberingPreference({
  title,
  value,
  onChange,
  canEdit,
}: {
  title: string;
  value: 'manual' | 'sequential';
  onChange: (value: 'manual' | 'sequential') => void;
  canEdit: boolean;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Typography variant="body1" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
        Manual: o código é digitado no cadastro. A numeração sequencial automática ainda não está
        disponível.
      </Typography>
      <FormControl size="small" sx={{ minWidth: 220 }} disabled={!canEdit}>
        <InputLabel>Modo</InputLabel>
        <Select
          label="Modo"
          value={value}
          onChange={(event) => onChange(event.target.value as 'manual' | 'sequential')}
        >
          <MenuItem value="manual">Manual</MenuItem>
          <MenuItem value="sequential" disabled>
            Sequencial (em breve)
          </MenuItem>
        </Select>
      </FormControl>
    </Paper>
  );
}
