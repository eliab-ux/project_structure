'use client';

import { ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import { Fabric, ProductType } from 'src/types/customer';
import { LAYOUT_TYPE_LABELS, LayoutType } from 'src/types/preOrder';

/** Uma matriz em edição. Números como texto: o campo é do usuário, a conversão é no envio. */
export interface MatrizFormValue {
  /** Chave estável de renderização — não vai para o backend. */
  key: string;
  fabricId: string;
  productTypeId: string;
  estimatedPieces: string;
  metersPerPiece: string;
  rolls: string;
  estimatedLayers: string;
  estimatedLayoutType: LayoutType | '';
}

let contador = 0;

export function emptyMatriz(): MatrizFormValue {
  contador += 1;
  return {
    key: `matriz-${contador}`,
    fabricId: '',
    productTypeId: '',
    estimatedPieces: '',
    metersPerPiece: '',
    rolls: '',
    estimatedLayers: '',
    estimatedLayoutType: '',
  };
}

/** Toda matriz precisa de tecido, produto e quantidade — o resto é opcional. */
export function matrizPreenchida(matriz: MatrizFormValue): boolean {
  return Boolean(matriz.fabricId && matriz.productTypeId && Number(matriz.estimatedPieces) > 0);
}

interface Props {
  matrizes: MatrizFormValue[];
  fabrics: Fabric[];
  productTypes: ProductType[];
  onChange: (matrizes: MatrizFormValue[]) => void;
  /**
   * `touch` é o app do Modelista — alvos grandes, campos de enfesto e metragem. `compact` é o
   * diálogo do Administrativo, que declara tecido, produto e quantidade e nada mais.
   */
  variant?: 'touch' | 'compact';
  /** Conteúdo extra por matriz (o Administrativo põe aqui o histórico do tecido escolhido). */
  renderExtra?: (matriz: MatrizFormValue, index: number) => ReactNode;
  /** Chamado quando o tecido ou as peças de uma matriz mudam — para recarregar histórico. */
  onMatrizChanged?: (matriz: MatrizFormValue, index: number) => void;
  maxMatrizes?: number;
}

/**
 * As matrizes declaradas do pedido.
 *
 * O pedido **declara** o que vai ser cortado antes de qualquer apontamento: matriz 1 tecido X
 * calça, matriz 2 tecido Y camiseta. Cada matriz declarada rende exatamente um apontamento na
 * tela do Modelista — nem mais, nem menos. Por isso esta lista existe: sem ela, o segundo
 * material não teria onde ser declarado, e o cronômetro passaria a inventar matrizes.
 *
 * As **horas ficam de fora**, no pedido: o cliente compra um bloco de máquina, não uma hora por
 * matriz. O tempo por matriz é medido no apontamento e serve a métrica, não a cobrança.
 */
export function MatrizList({
  matrizes,
  fabrics,
  productTypes,
  onChange,
  variant = 'compact',
  renderExtra,
  onMatrizChanged,
  maxMatrizes = 20,
}: Props) {
  const touch = variant === 'touch';
  const TOUCH = touch ? { minHeight: 56 } : {};

  function alterar(index: number, patch: Partial<MatrizFormValue>) {
    const atualizadas = matrizes.map((matriz, i) =>
      i === index ? { ...matriz, ...patch } : matriz,
    );
    onChange(atualizadas);
    onMatrizChanged?.(atualizadas[index], index);
  }

  function remover(index: number) {
    onChange(matrizes.filter((_matriz, i) => i !== index));
  }

  return (
    <Stack spacing={2} component="section" aria-label="Matrizes do pedido">
      {matrizes.map((matriz, index) => {
        const fabric = fabrics.find((item) => item.id === matriz.fabricId);

        /**
         * `camadas × espessura` dá centímetros — é isso que se compara com a altura máxima.
         * **Sem espessura cadastrada não há aviso**: presumir uma espessura qualquer produziria
         * alerta em todo corte, e alerta que sempre aparece é alerta que ninguém lê.
         */
        const avisoDeAltura =
          fabric?.layerThicknessCm && matriz.estimatedLayers
            ? Number(matriz.estimatedLayers) * fabric.layerThicknessCm > fabric.maxLayerHeightCm
            : false;

        return (
          <Paper key={matriz.key} variant="outlined" sx={{ p: touch ? 2 : 1.75 }}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 1.5 }}
            >
              <Typography variant="overline" component="h3">
                Matriz {index + 1}
              </Typography>
              {matrizes.length > 1 && (
                <IconButton
                  size="small"
                  aria-label={`Remover matriz ${index + 1}`}
                  onClick={() => remover(index)}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>

            <Stack spacing={touch ? 2.5 : 2}>
              <TextField
                select
                label="Tecido"
                fullWidth
                required
                value={matriz.fabricId}
                onChange={(event) => alterar(index, { fabricId: event.target.value })}
                helperText={
                  fabric
                    ? `Altura máxima de enfesto: ${fabric.maxLayerHeightCm.toFixed(2).replace('.', ',')} cm` +
                      // Só mostra o teto de camadas quando ele é calculável; sem espessura, a
                      // tela não inventa um número.
                      (fabric.layerThicknessCm
                        ? ` · cabem ~${Math.floor(fabric.maxLayerHeightCm / fabric.layerThicknessCm)} camadas`
                        : '')
                    : 'A altura máxima do tecido é o que limita as camadas.'
                }
              >
                {fabrics.map((item) => (
                  <MenuItem key={item.id} value={item.id} sx={TOUCH}>
                    {item.name}
                  </MenuItem>
                ))}
              </TextField>

              {renderExtra?.(matriz, index)}

              <TextField
                select
                label="Produto"
                fullWidth
                required
                value={matriz.productTypeId}
                onChange={(event) => alterar(index, { productTypeId: event.target.value })}
              >
                {productTypes.map((type) => (
                  <MenuItem key={type.id} value={type.id} sx={TOUCH}>
                    {type.name}
                  </MenuItem>
                ))}
              </TextField>

              <Stack direction="row" spacing={2}>
                <TextField
                  label="Peças"
                  fullWidth
                  required
                  inputProps={{ inputMode: 'numeric' }}
                  value={matriz.estimatedPieces}
                  onChange={(event) =>
                    alterar(index, { estimatedPieces: event.target.value.replace(/\D/g, '') })
                  }
                />
                <TextField
                  label="Rolos"
                  fullWidth
                  inputProps={{ inputMode: 'numeric' }}
                  value={matriz.rolls}
                  onChange={(event) =>
                    alterar(index, { rolls: event.target.value.replace(/\D/g, '') })
                  }
                />
              </Stack>

              {touch && (
                <>
                  <Stack direction="row" spacing={2}>
                    <TextField
                      label="Metros por peça"
                      fullWidth
                      inputProps={{ inputMode: 'decimal' }}
                      value={matriz.metersPerPiece}
                      onChange={(event) => alterar(index, { metersPerPiece: event.target.value })}
                    />
                    <TextField
                      label="Camadas"
                      fullWidth
                      inputProps={{ inputMode: 'numeric' }}
                      value={matriz.estimatedLayers}
                      onChange={(event) =>
                        alterar(index, { estimatedLayers: event.target.value.replace(/\D/g, '') })
                      }
                    />
                  </Stack>

                  {avisoDeAltura && (
                    <Alert severity="warning">
                      As camadas passam da altura máxima do tecido. Só um aviso — quem está na
                      máquina decide.
                    </Alert>
                  )}

                  <Box>
                    <Typography variant="overline" component="p" sx={{ mb: 1 }}>
                      Tipo de enfesto
                    </Typography>
                    <ToggleButtonGroup
                      exclusive
                      fullWidth
                      value={matriz.estimatedLayoutType}
                      onChange={(_event, value) =>
                        alterar(index, { estimatedLayoutType: (value as LayoutType) ?? '' })
                      }
                    >
                      {(Object.keys(LAYOUT_TYPE_LABELS) as LayoutType[]).map((type) => (
                        <ToggleButton key={type} value={type} sx={TOUCH}>
                          {LAYOUT_TYPE_LABELS[type]}
                        </ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                  </Box>
                </>
              )}
            </Stack>
          </Paper>
        );
      })}

      {matrizes.length < maxMatrizes && (
        <>
          {touch && <Divider />}
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            fullWidth={touch}
            sx={TOUCH}
            onClick={() => onChange([...matrizes, emptyMatriz()])}
          >
            Adicionar matriz
          </Button>
          <Typography variant="body2" color="text.secondary">
            Cada matriz declarada aqui vira uma contagem de tempo na tela do Modelista — nem uma a
            mais.
          </Typography>
        </>
      )}
    </Stack>
  );
}
