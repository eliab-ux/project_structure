'use client';

import { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import { useSnackbar } from 'notistack';
import { PageHeader } from 'src/components/PageHeader';
import catalogService from 'src/services/catalogService';
import { apiErrorMessage } from 'src/services/api';
import { Fabric } from 'src/types/customer';
import { numericSx } from 'src/theme/theme';

interface FabricForm {
  name: string;
  maxLayerHeightCm: string;
  layerThicknessCm: string;
  notes: string;
}

const EMPTY: FabricForm = { name: '', maxLayerHeightCm: '', layerThicknessCm: '', notes: '' };

/** Vírgula na tela, ponto na API — é assim que o operador digita. */
const paraNumero = (value: string): number => Number(value.replace(',', '.'));

export default function FabricsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Fabric | null>(null);
  const [form, setForm] = useState<FabricForm>(EMPTY);

  const load = useCallback(async () => {
    try {
      setFabrics(await catalogService.listFabrics());
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível carregar os tecidos.'), {
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(fabric: Fabric) {
    setEditing(fabric);
    setForm({
      name: fabric.name,
      maxLayerHeightCm: String(fabric.maxLayerHeightCm).replace('.', ','),
      layerThicknessCm:
        fabric.layerThicknessCm === null ? '' : String(fabric.layerThicknessCm).replace('.', ','),
      notes: fabric.notes ?? '',
    });
    setOpen(true);
  }

  async function submit() {
    const payload = {
      name: form.name,
      maxLayerHeightCm: paraNumero(form.maxLayerHeightCm),
      // Campo vazio vira `null`, não zero: "não medido" é um estado, e nele o sistema fica quieto.
      layerThicknessCm: form.layerThicknessCm.trim() ? paraNumero(form.layerThicknessCm) : null,
      notes: form.notes.trim() || null,
    };

    try {
      if (editing) {
        await catalogService.updateFabric(editing.id, payload);
        enqueueSnackbar('Tecido atualizado.', { variant: 'success' });
      } else {
        await catalogService.createFabric(payload);
        enqueueSnackbar('Tecido cadastrado.', { variant: 'success' });
      }
      setOpen(false);
      await load();
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível salvar o tecido.'), {
        variant: 'error',
      });
    }
  }

  if (loading) {
    return (
      <Box
        role="status"
        aria-label="Carregando"
        sx={{ display: 'flex', justifyContent: 'center', py: 8 }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <PageHeader
        title="Tecidos"
        description="A altura máxima de enfesto é o que limita as camadas — e as camadas determinam o tempo."
        action={<Button onClick={openCreate}>+ Novo tecido</Button>}
      />

      <Paper variant="outlined" component="section" aria-label="Tecidos" sx={{ p: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Tecido</TableCell>
              <TableCell align="right">Altura máx. de enfesto</TableCell>
              <TableCell align="right">Espessura da camada</TableCell>
              <TableCell align="right">Camadas que cabem</TableCell>
              <TableCell>Particularidade</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {fabrics.map((fabric) => (
              <TableRow key={fabric.id}>
                <TableCell sx={{ fontWeight: 600 }}>{fabric.name}</TableCell>
                <TableCell align="right" sx={numericSx}>
                  {fabric.maxLayerHeightCm.toFixed(2).replace('.', ',')} cm
                </TableCell>
                <TableCell align="right" sx={numericSx}>
                  {fabric.layerThicknessCm === null
                    ? '—'
                    : `${fabric.layerThicknessCm.toFixed(3).replace('.', ',')} cm`}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    ...numericSx,
                    color: fabric.maxLayers === null ? 'text.secondary' : undefined,
                  }}
                >
                  {/* Sem espessura não há teto calculável — e a tela diz isso, em vez de mostrar
                      um número que ninguém poderia justificar. */}
                  {fabric.maxLayers ?? 'sem medida'}
                </TableCell>
                <TableCell>{fabric.notes ?? '—'}</TableCell>
                <TableCell align="right">
                  <Button size="small" variant="outlined" onClick={() => openEdit(fabric)}>
                    Editar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? 'Editar tecido' : 'Novo tecido'}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            São duas medidas diferentes: a <strong>altura máxima</strong> é o limite do enfesto
            inteiro (mesa, lâmina, material empilhado); a <strong>espessura</strong> é de uma camada
            só. As camadas que cabem saem da divisão das duas. Passar do limite não trava o corte —
            o sistema avisa e deixa seguir.
          </Alert>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nome"
              fullWidth
              placeholder="Malha, TNT, Jeans, Tricoline…"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <TextField
              label="Altura máxima de enfesto (cm)"
              fullWidth
              required
              placeholder="2,5"
              value={form.maxLayerHeightCm}
              onChange={(e) => setForm({ ...form, maxLayerHeightCm: e.target.value })}
            />
            <TextField
              label="Espessura da camada (cm)"
              fullWidth
              placeholder="0,035"
              helperText={
                form.layerThicknessCm.trim() && paraNumero(form.maxLayerHeightCm) > 0
                  ? `Cabem ~${Math.floor(paraNumero(form.maxLayerHeightCm) / paraNumero(form.layerThicknessCm))} camadas.`
                  : 'Opcional. Sem ela o sistema não avisa nada sobre altura — melhor o silêncio que um aviso baseado em chute.'
              }
              value={form.layerThicknessCm}
              onChange={(e) => setForm({ ...form, layerThicknessCm: e.target.value })}
            />
            <TextField
              label="Particularidade"
              fullWidth
              multiline
              minRows={2}
              placeholder="Ex.: cola se passar de 2,5 cm"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>{editing ? 'Salvar' : 'Cadastrar'}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
