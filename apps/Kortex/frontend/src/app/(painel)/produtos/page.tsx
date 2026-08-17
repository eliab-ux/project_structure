'use client';

import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useSnackbar } from 'notistack';
import { PageHeader } from 'src/components/PageHeader';
import catalogService from 'src/services/catalogService';
import { apiErrorMessage } from 'src/services/api';
import { ProductType } from 'src/types/customer';

/**
 * Tipos de produto. Cadastro simples de propósito (spec §4.6): é só o nome, e ele alimenta o
 * campo "tipos de produtos cortados" do relatório mensal.
 *
 * Sem diálogo: um campo só cabe na própria linha, e abrir um modal para digitar "Camiseta" seria
 * cerimônia sem função.
 */
export default function ProductTypesPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [types, setTypes] = useState<ProductType[]>([]);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const load = useCallback(async () => {
    try {
      setTypes(await catalogService.listProductTypes());
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível carregar os produtos.'), {
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    try {
      await catalogService.createProductType(newName);
      setNewName('');
      enqueueSnackbar('Produto cadastrado.', { variant: 'success' });
      await load();
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível cadastrar.'), { variant: 'error' });
    }
  }

  async function save(id: string) {
    try {
      await catalogService.updateProductType(id, editingName);
      setEditingId(null);
      await load();
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Não foi possível salvar.'), { variant: 'error' });
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
        title="Tipos de produto"
        description="Camisa, camiseta, pijama, scrub, maiô, calça, jaleco, avental cirúrgico, macacão…"
      />

      <Paper variant="outlined" component="section" aria-label="Tipos de produto" sx={{ p: 2 }}>
        <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
          <TextField
            label="Novo tipo de produto"
            size="small"
            sx={{ maxWidth: 320 }}
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
          <Button onClick={create} disabled={newName.trim().length < 2}>
            Adicionar
          </Button>
        </Stack>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Produto</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {types.map((type) => (
              <TableRow key={type.id}>
                <TableCell sx={{ fontWeight: 600 }}>
                  {editingId === type.id ? (
                    <TextField
                      size="small"
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                    />
                  ) : (
                    type.name
                  )}
                </TableCell>
                <TableCell align="right">
                  {editingId === type.id ? (
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button size="small" variant="outlined" onClick={() => setEditingId(null)}>
                        Cancelar
                      </Button>
                      <Button size="small" onClick={() => save(type.id)}>
                        Salvar
                      </Button>
                    </Stack>
                  ) : (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setEditingId(type.id);
                        setEditingName(type.name);
                      }}
                    >
                      Editar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 2, maxWidth: '80ch' }}>
        Os três papéis cadastram tecido e tipo de produto — inclusive o Modelista, que é quem
        descobre a particularidade do material na máquina.
      </Typography>
    </>
  );
}
