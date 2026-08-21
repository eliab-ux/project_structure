'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useSnackbar } from 'notistack';
import { RequireAuth } from 'src/components/RequireAuth';
import preOrderService, { CustomerForModelista } from 'src/services/preOrderService';
import catalogService from 'src/services/catalogService';
import { apiErrorMessage } from 'src/services/api';
import {
  MatrizFormValue,
  MatrizList,
  emptyMatriz,
  matrizPreenchida,
} from 'src/components/MatrizList';
import { Fabric, ProductType } from 'src/types/customer';
import { numericSx } from 'src/theme/theme';

/** Alvo de toque do app do Modelista: ele opera de pé, ao lado da máquina (spec §8). */
const TOUCH = { minHeight: 56 };

interface Form {
  customerId: string;
  /** Ao menos uma. Cada uma vira exatamente um apontamento na reserva (§4.10). */
  matrizes: MatrizFormValue[];
  /** Do pedido inteiro — o cliente compra um bloco de máquina, não uma hora por matriz. */
  estimatedHours: number;
  notes: string;
}

function emptyForm(): Form {
  return { customerId: '', matrizes: [emptyMatriz()], estimatedHours: 1, notes: '' };
}

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
  const [form, setForm] = useState<Form>(emptyForm);

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

  async function submit() {
    setSaving(true);
    try {
      await preOrderService.createPreOrder({
        customerId: form.customerId,
        matrizes: form.matrizes.map((matriz) => ({
          fabricId: matriz.fabricId,
          productTypeId: matriz.productTypeId,
          estimatedPieces: Number(matriz.estimatedPieces),
          metersPerPiece: matriz.metersPerPiece
            ? Number(matriz.metersPerPiece.replace(',', '.'))
            : null,
          rolls: matriz.rolls ? Number(matriz.rolls) : null,
          estimatedLayers: matriz.estimatedLayers ? Number(matriz.estimatedLayers) : null,
          estimatedLayoutType: matriz.estimatedLayoutType || null,
        })),
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

  const ready = Boolean(form.customerId) && form.matrizes.every(matrizPreenchida);

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
          Modelista
        </Typography>
        <Typography variant="h2" component="h1" gutterBottom>
          Pré-pedido
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

            <Divider />

            {/* Uma matriz é o caso comum; o cliente que traz dois materiais na mesma reserva
                declara as duas aqui, e o app dele terá exatamente duas contagens. */}
            <MatrizList
              variant="touch"
              matrizes={form.matrizes}
              fabrics={fabrics}
              productTypes={productTypes}
              onChange={(matrizes) => set('matrizes', matrizes)}
            />

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
