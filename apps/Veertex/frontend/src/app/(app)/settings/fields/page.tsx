'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSnackbar } from 'notistack';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import LockIcon from '@mui/icons-material/Lock';
import { DataState } from 'src/components/DataState';
import { PageHeader } from 'src/components/PageHeader';
import { useAuth } from 'src/contexts/AuthContext';
import { apiErrorMessage } from 'src/services/api';
import fieldConfigService from 'src/services/fieldConfigService';
import { EffectiveField } from 'src/types/fieldConfig';

const ENTITY_LABEL: Record<string, string> = {
  contact: 'Contatos',
  product: 'Produtos',
};

/**
 * PERSONALIZAR CAMPOS (§3.6). A conta governa visível/obrigatório/rótulo de cada campo que JÁ existe
 * — o catálogo é fixo em código e esta tela nunca cria campo.
 *
 * Campo obrigatório por regra de domínio aparece com cadeado no lugar dos interruptores: como os
 * módulos CORE, ele não é "um toggle travado", é uma coisa que não tem toggle. Ocultá-lo faria a tela
 * impedir o cadastro que o backend exige.
 */
export default function FieldConfigPage() {
  const { can } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const canEdit = can('fields.update');

  const [entities, setEntities] = useState<string[] | null>(null);
  const [entity, setEntity] = useState<string | null>(null);
  const [fields, setFields] = useState<EffectiveField[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadEntities = useCallback(async () => {
    try {
      const list = await fieldConfigService.entities();
      setEntities(list);
      setEntity((current) => current ?? list[0] ?? null);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Não foi possível carregar as entidades.'));
    }
  }, []);

  const loadFields = useCallback(async (target: string) => {
    setFields(null);
    setError(null);
    try {
      const config = await fieldConfigService.get(target);
      setFields(config.fields);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Não foi possível carregar os campos.'));
    }
  }, []);

  useEffect(() => {
    void loadEntities();
  }, [loadEntities]);

  useEffect(() => {
    if (entity) {
      void loadFields(entity);
    }
  }, [entity, loadFields]);

  function patch(field: string, changes: Partial<EffectiveField>) {
    setFields(
      (current) =>
        current?.map((item) => (item.field === field ? { ...item, ...changes } : item)) ?? current,
    );
  }

  async function save() {
    if (!entity || !fields) {
      return;
    }
    setSaving(true);
    try {
      // Só os campos configuráveis vão no payload; os obrigatórios por domínio não têm o que gravar.
      const overrides = fields
        .filter((field) => !field.mandatoryByDomain)
        .map((field) => ({
          field: field.field,
          visible: field.visible,
          required: field.required,
          label: field.label,
          order: field.order,
        }));
      const updated = await fieldConfigService.set(entity, overrides);
      setFields(updated.fields);
      enqueueSnackbar('Configuração de campos salva.', { variant: 'success' });
    } catch (requestError) {
      enqueueSnackbar(apiErrorMessage(requestError, 'Não foi possível salvar.'), {
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  const grouped = useMemo(() => groupByBlock(fields ?? []), [fields]);

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <PageHeader
        title="Personalizar campos"
        description="O que aparece e o que é obrigatório em cada cadastro. Não cria campos — governa os que existem."
      />

      {!canEdit ? (
        <Alert severity="info" role="status" sx={{ mb: 3 }}>
          Você pode ver esta configuração, mas não alterá-la. Alterar exige a permissão{' '}
          <strong>fields.update</strong>.
        </Alert>
      ) : null}

      {entities && entities.length > 0 ? (
        <Tabs
          value={entity ?? false}
          onChange={(_event, value) => setEntity(value)}
          sx={{ mb: 2 }}
          aria-label="Entidade a configurar"
        >
          {entities.map((name) => (
            <Tab key={name} value={name} label={ENTITY_LABEL[name] ?? name} />
          ))}
        </Tabs>
      ) : null}

      <DataState
        loading={entities === null || fields === null}
        error={error}
        empty={fields !== null && fields.length === 0}
        emptyMessage="Nenhum campo neste cadastro."
      />

      {fields && fields.length > 0 && !error ? (
        <>
          <Stack spacing={3}>
            {grouped.map(({ group, items }) => (
              <Box key={group ?? 'default'}>
                {group ? (
                  <Typography variant="overline" color="text.secondary">
                    {group}
                  </Typography>
                ) : null}
                <Stack spacing={1} component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
                  {items.map((field) => (
                    <FieldRow
                      key={field.field}
                      field={field}
                      canEdit={canEdit}
                      onChange={(changes) => patch(field.field, changes)}
                    />
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>

          {canEdit ? (
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="contained" onClick={() => void save()} disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar'}
              </Button>
            </Box>
          ) : null}
        </>
      ) : null}
    </Box>
  );
}

function groupByBlock(
  fields: EffectiveField[],
): { group: string | null; items: EffectiveField[] }[] {
  const order: (string | null)[] = [];
  const map = new Map<string | null, EffectiveField[]>();
  for (const field of fields) {
    const key = field.group;
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(field);
  }
  return order.map((group) => ({ group, items: map.get(group)! }));
}

function FieldRow({
  field,
  canEdit,
  onChange,
}: {
  field: EffectiveField;
  canEdit: boolean;
  onChange: (changes: Partial<EffectiveField>) => void;
}) {
  return (
    <Paper component="li" variant="outlined" sx={{ p: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: 'flex-start' }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {field.label}
            </Typography>
            <Chip size="small" variant="outlined" label={field.field} />
            {field.mandatoryByDomain ? (
              <Chip size="small" color="secondary" label="obrigatório do sistema" />
            ) : null}
          </Stack>
          {field.hint ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {field.hint}
            </Typography>
          ) : null}
          {!field.mandatoryByDomain && canEdit ? (
            <TextField
              label="Rótulo personalizado"
              value={field.label}
              onChange={(event) => onChange({ label: event.target.value })}
              size="small"
              sx={{ mt: 1.5, maxWidth: 360 }}
              fullWidth
            />
          ) : null}
        </Box>

        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', pt: 0.5 }}>
          {field.mandatoryByDomain ? (
            <Tooltip title="Campo exigido pelo sistema — sempre visível e obrigatório">
              <LockIcon fontSize="small" sx={{ color: 'text.disabled' }} aria-label="Fixo" />
            </Tooltip>
          ) : (
            <>
              <Stack sx={{ alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Visível
                </Typography>
                <Switch
                  checked={field.visible}
                  onChange={(event) =>
                    onChange({
                      visible: event.target.checked,
                      // Um campo oculto não pode ser obrigatório — seria impossível de preencher.
                      required: event.target.checked ? field.required : false,
                    })
                  }
                  disabled={!canEdit}
                  inputProps={{ 'aria-label': `${field.label} visível` }}
                />
              </Stack>
              <Stack sx={{ alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Obrigatório
                </Typography>
                <Switch
                  checked={field.required}
                  onChange={(event) => onChange({ required: event.target.checked })}
                  disabled={!canEdit || !field.visible}
                  inputProps={{ 'aria-label': `${field.label} obrigatório` }}
                />
              </Stack>
            </>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}
