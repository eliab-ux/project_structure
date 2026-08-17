'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useSnackbar } from 'notistack';
import { RequireAuth } from 'src/components/RequireAuth';
import preOrderService, { CustomerForModelista } from 'src/services/preOrderService';
import catalogService from 'src/services/catalogService';
import { apiErrorMessage } from 'src/services/api';
import { Fabric, ProductType } from 'src/types/customer';
import { LAYOUT_TYPE_LABELS, LayoutType } from 'src/types/preOrder';
import { numericSx } from 'src/theme/theme';

/** Alvo de toque do app do Modelista: ele opera de pé, ao lado da máquina (spec §8). */
const TOUCH = { minHeight: 56 };

interface Form {
  customerId: string;
  fabricId: string;
  productTypeId: string;
  estimatedPieces: string;
  metersPerPiece: string;
  rolls: string;
  estimatedLayers: string;
  estimatedLayoutType: LayoutType | '';
  estimatedHours: number;
  notes: string;
}

const EMPTY: Form = {
  customerId: '',
  fabricId: '',
  productTypeId: '',
  estimatedPieces: '',
  metersPerPiece: '',
  rolls: '',
  estimatedLayers: '',
  estimatedLayoutType: '',
  estimatedHours: 1,
  notes: '',
};

/**
 * Criar pré-pedido em UMA tela (DoD da Fase 3).
 *
 * Cliente, tecido e produto são seleções — **nenhuma digitação de cliente novo** (regra 6.2: o
 * Modelista nunca cadastra cliente). O resto é número, e as horas são um contador de toque, não
 * um campo de texto: é a decisão mais importante da tela e a que ele toma de pé.
 */
function NewPreOrderScreen() {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<CustomerForModelista[]>([]);
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [form, setForm] = useState<Form>(EMPTY);

  const load = useCallback(async () => {
    try {
      const [loadedCustomers, loadedFabrics, loadedTypes] = await Promise.all([
        preOrderService.listCustomersForModelista(),
        catalogService.listFabrics(),
        catalogService.listProductTypes(),
      ]);
      setCustomers(loadedCustomers);
      setFabrics(loadedFabrics);
      setProductTypes(loadedTypes);
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível carregar os cadastros.'), {
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    void load();
  }, [load]);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const selectedFabric = fabrics.find((fabric) => fabric.id === form.fabricId);

  /**
   * Aviso, não bloqueio: se o enfesto estimado passar da altura máxima do tecido, a tela avisa e
   * deixa seguir. Mesma regra do apontamento na Fase 5 — quem está na máquina sabe mais que o
   * cadastro.
   *
   * `camadas × espessura` dá centímetros, e é isso que se compara com a altura. **Sem espessura
   * cadastrada não há aviso**: o `* 10` que estava aqui presumia 1 mm por camada para qualquer
   * material, e um palpite escondido numa constante é pior que silêncio.
   */
  const layersWarning =
    selectedFabric?.layerThicknessCm && form.estimatedLayers
      ? Number(form.estimatedLayers) * selectedFabric.layerThicknessCm >
        selectedFabric.maxLayerHeightCm
      : false;

  async function submit() {
    setSaving(true);
    try {
      await preOrderService.createPreOrder({
        customerId: form.customerId,
        fabricId: form.fabricId,
        productTypeId: form.productTypeId,
        estimatedPieces: Number(form.estimatedPieces),
        metersPerPiece: form.metersPerPiece ? Number(form.metersPerPiece.replace(',', '.')) : null,
        rolls: form.rolls ? Number(form.rolls) : null,
        estimatedLayers: form.estimatedLayers ? Number(form.estimatedLayers) : null,
        estimatedLayoutType: form.estimatedLayoutType || null,
        estimatedHours: form.estimatedHours,
        notes: form.notes.trim() || null,
      });
      enqueueSnackbar('Pré-pedido enviado ao Administrativo.', { variant: 'success' });
      router.replace('/m');
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível enviar o pré-pedido.'), {
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  const ready = form.customerId && form.fabricId && form.productTypeId && form.estimatedPieces;

  if (loading) {
    return (
      <Box
        role="status"
        aria-label="Carregando"
        sx={{ display: 'flex', justifyContent: 'center', py: 10 }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box component="main" sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 3 }}>
      <Container maxWidth="sm">
        <Typography variant="overline" component="p" sx={{ color: 'info.main' }}>
          Pré-pedido
        </Typography>
        <Typography variant="h2" component="h1" gutterBottom>
          Avaliar corte
        </Typography>

        <Paper variant="outlined" sx={{ p: 2.5, mt: 2 }}>
          <Stack spacing={2.5}>
            <TextField
              select
              label="Cliente"
              fullWidth
              value={form.customerId}
              onChange={(e) => set('customerId', e.target.value)}
              helperText="Cliente novo é cadastrado pelo Administrativo."
              SelectProps={{ MenuProps: { PaperProps: { style: { maxHeight: 320 } } } }}
            >
              {customers.map((customer) => (
                <MenuItem key={customer.id} value={customer.id} sx={TOUCH}>
                  {customer.tradeName} · {customer.city}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Tecido"
              fullWidth
              value={form.fabricId}
              onChange={(e) => set('fabricId', e.target.value)}
              helperText={
                selectedFabric
                  ? `Altura máxima de enfesto: ${selectedFabric.maxLayerHeightCm.toFixed(2).replace('.', ',')} cm` +
                    // Só mostra o teto de camadas quando ele é calculável; sem espessura, a tela
                    // não inventa um número.
                    (selectedFabric.layerThicknessCm
                      ? ` · cabem ~${Math.floor(selectedFabric.maxLayerHeightCm / selectedFabric.layerThicknessCm)} camadas`
                      : '')
                  : 'A altura máxima do tecido é o que limita as camadas.'
              }
            >
              {fabrics.map((fabric) => (
                <MenuItem key={fabric.id} value={fabric.id} sx={TOUCH}>
                  {fabric.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Produto"
              fullWidth
              value={form.productTypeId}
              onChange={(e) => set('productTypeId', e.target.value)}
            >
              {productTypes.map((type) => (
                <MenuItem key={type.id} value={type.id} sx={TOUCH}>
                  {type.name}
                </MenuItem>
              ))}
            </TextField>

            <Divider />

            <Stack direction="row" spacing={2}>
              <TextField
                label="Peças"
                fullWidth
                inputProps={{ inputMode: 'numeric' }}
                value={form.estimatedPieces}
                onChange={(e) => set('estimatedPieces', e.target.value.replace(/\D/g, ''))}
              />
              <TextField
                label="Rolos"
                fullWidth
                inputProps={{ inputMode: 'numeric' }}
                value={form.rolls}
                onChange={(e) => set('rolls', e.target.value.replace(/\D/g, ''))}
              />
            </Stack>

            <Stack direction="row" spacing={2}>
              <TextField
                label="Metros por peça"
                fullWidth
                inputProps={{ inputMode: 'decimal' }}
                value={form.metersPerPiece}
                onChange={(e) => set('metersPerPiece', e.target.value)}
              />
              <TextField
                label="Camadas"
                fullWidth
                inputProps={{ inputMode: 'numeric' }}
                value={form.estimatedLayers}
                onChange={(e) => set('estimatedLayers', e.target.value.replace(/\D/g, ''))}
              />
            </Stack>

            {layersWarning && (
              <Alert severity="warning">
                As camadas passam da altura máxima do tecido. Só um aviso — quem está na máquina
                decide.
              </Alert>
            )}

            <Box>
              <Typography variant="overline" component="p" sx={{ mb: 1 }}>
                Tipo de enfesto
              </Typography>
              <ToggleButtonGroup
                exclusive
                fullWidth
                value={form.estimatedLayoutType}
                onChange={(_e, value) => set('estimatedLayoutType', (value as LayoutType) ?? '')}
              >
                {(Object.keys(LAYOUT_TYPE_LABELS) as LayoutType[]).map((type) => (
                  <ToggleButton key={type} value={type} sx={TOUCH}>
                    {LAYOUT_TYPE_LABELS[type]}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>

            <Divider />

            <Box>
              <Typography variant="overline" component="p">
                Horas a reservar
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                É a sua decisão — o Administrativo recebe esse número pronto e não o altera.
              </Typography>
              <Stack direction="row" spacing={2} alignItems="center">
                <Button
                  variant="outlined"
                  sx={{ ...TOUCH, minWidth: 64, fontSize: 24 }}
                  onClick={() => set('estimatedHours', Math.max(1, form.estimatedHours - 1))}
                  aria-label="Diminuir uma hora"
                >
                  −
                </Button>
                <Typography
                  sx={{ ...numericSx, flex: 1, textAlign: 'center', fontSize: 40, fontWeight: 600 }}
                >
                  {form.estimatedHours}h
                </Typography>
                <Button
                  variant="outlined"
                  sx={{ ...TOUCH, minWidth: 64, fontSize: 24 }}
                  onClick={() => set('estimatedHours', Math.min(24, form.estimatedHours + 1))}
                  aria-label="Aumentar uma hora"
                >
                  +
                </Button>
              </Stack>
            </Box>

            <TextField
              label="Recado para o Administrativo"
              fullWidth
              multiline
              minRows={2}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />

            <Button fullWidth sx={TOUCH} disabled={!ready || saving} onClick={submit}>
              {saving ? 'Enviando…' : 'Enviar pré-pedido'}
            </Button>
            <Button component={Link} href="/m" variant="outlined" fullWidth sx={TOUCH}>
              Cancelar
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}

export default function Page() {
  return (
    <RequireAuth allow={['modelista', 'owner']}>
      <NewPreOrderScreen />
    </RequireAuth>
  );
}
