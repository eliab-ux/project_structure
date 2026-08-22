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
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await accountService.updatePreferences({
        contactCodeMode,
        productSkuMode,
        contactCarteirizacao,
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
