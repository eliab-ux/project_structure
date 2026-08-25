'use client';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from 'src/components/AppShell/AppShell';
import { errorMessage } from 'src/services/api';
import catalogService from 'src/services/catalogService';
import { CatalogDay, CatalogList } from 'src/types';

const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** Só a referência bíblica — o "Dia N -" do título vira a coluna própria. */
function passage(title: string): string {
  return title.replace(/^.*?(?:dia|v[íi]deo)\s*0*\d{1,3}\s*[-–]?\s*/i, '').trim() || title;
}

function weekday(isoDate: string): string {
  return WEEKDAYS[new Date(`${isoDate}T12:00:00Z`).getUTCDay()];
}

/**
 * Converte a data como o usuário escreve (`28/10/2026`, `28/10`, `28-10-2026`) para o pedaço
 * ISO correspondente, que é o formato guardado. Sem isso, buscar "28/10/2026" não achava nada —
 * e é justamente assim que se escreve data em português.
 */
function brazilianDateToIso(term: string): string | null {
  const match = /^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?$/.exec(term.trim());
  if (!match) {
    return null;
  }
  const [, d, m, y] = match;
  const day = d.padStart(2, '0');
  const month = m.padStart(2, '0');
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) {
    return null;
  }
  // Sem ano: devolve `-MM-DD`, que casa com qualquer ano presente no catálogo.
  return y ? `${y.length === 2 ? `20${y}` : y}-${month}-${day}` : `-${month}-${day}`;
}

interface Annotated extends CatalogDay {
  duplicated: boolean;
  jump: boolean;
}

export default function ProgramacaoPage() {
  const [data, setData] = useState<CatalogList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState('');
  const todayRef = useRef<HTMLTableRowElement | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    catalogService
      .days()
      .then(setData)
      .catch((err) => setError(errorMessage(err, 'Não foi possível carregar a programação')))
      .finally(() => setLoading(false));
  }, []);

  /**
   * Anota cada dia com as anomalias da origem: número repetido no canal (o "218") e salto de
   * numeração. Calculado aqui porque é apresentação — o backend entrega os dados crus.
   */
  const annotated = useMemo<Annotated[]>(() => {
    if (!data) return [];
    const counts = new Map<number, number>();
    for (const e of data.entries) {
      counts.set(e.titleDayNumber, (counts.get(e.titleDayNumber) ?? 0) + 1);
    }
    let previous: number | null = null;
    return data.entries.map((e) => {
      const jump = previous !== null && e.titleDayNumber > previous + 1;
      previous = e.titleDayNumber;
      return { ...e, duplicated: (counts.get(e.titleDayNumber) ?? 0) > 1, jump };
    });
  }, [data]);

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return annotated;
    const asIso = brazilianDateToIso(q);
    return annotated.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.scheduledDate.includes(q) ||
        (asIso !== null && e.scheduledDate.includes(asIso)),
    );
  }, [annotated, term]);

  // Agrupa por mês para dar pontos de referência ao percorrer 365 linhas.
  const months = useMemo(() => {
    const map = new Map<string, Annotated[]>();
    for (const e of filtered) {
      const key = e.scheduledDate.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return [...map.entries()];
  }, [filtered]);

  function goToToday() {
    setTerm('');
    // Espera o filtro limpar antes de rolar.
    setTimeout(() => todayRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60);
  }

  return (
    <AppShell>
      <Typography component="h1" variant="h2" gutterBottom>
        Programação
      </Typography>

      {loading ? (
        <Box
          role="status"
          aria-label="Carregando"
          sx={{ display: 'flex', justifyContent: 'center', py: 8 }}
        >
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert role="alert" severity="error">
          {error}
        </Alert>
      ) : !data || data.entries.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            O catálogo está vazio. Rode a sincronização para importar as leituras do canal.
          </Typography>
        </Card>
      ) : (
        <Stack spacing={2}>
          <Card component="section">
            <CardContent>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                divider={<Divider orientation="vertical" flexItem />}
              >
                <Fact label="Leituras" value={String(data.total)} />
                <Fact label="Primeira" value={formatShort(data.planStartDate)} />
                <Fact
                  label="Última"
                  value={formatShort(data.entries[data.entries.length - 1].scheduledDate)}
                />
                <Fact label="Dias sem envio" value="0" />
              </Stack>
            </CardContent>
          </Card>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField
              size="small"
              fullWidth
              type="search"
              label="Buscar por livro ou data"
              placeholder="Salmos, Jeremias, 28/10/2026, 2026-10…"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
            <Button onClick={goToToday} sx={{ whiteSpace: 'nowrap' }}>
              Ir para hoje
            </Button>
          </Stack>

          <Typography variant="body2" color="text.secondary">
            {filtered.length} de {annotated.length} leituras · a coluna <strong>Dia</strong> é a
            posição no plano; <strong>nº no YouTube</strong> é o número escrito no título do vídeo.
          </Typography>

          {months.length === 0 ? (
            <Card sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Nenhuma leitura encontrada para essa busca.
              </Typography>
            </Card>
          ) : (
            months.map(([key, entries]) => (
              <Card component="section" key={key}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="baseline"
                  sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }}
                >
                  <Typography component="h2" variant="h5">
                    {MONTHS[Number(key.slice(5, 7)) - 1]} {key.slice(0, 4)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {entries.length} leituras
                  </Typography>
                </Stack>
                <TableContainer sx={{ overflowX: 'auto' }}>
                  <Table size="small" sx={{ minWidth: 560 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Data</TableCell>
                        <TableCell align="right">Dia</TableCell>
                        <TableCell>Passagem</TableCell>
                        <TableCell align="right">nº no YouTube</TableCell>
                        <TableCell>Vídeo</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {entries.map((e) => {
                        const isToday = e.scheduledDate === today;
                        return (
                          <TableRow
                            key={e.dayNumber}
                            hover
                            ref={isToday ? todayRef : undefined}
                            sx={
                              isToday
                                ? {
                                    bgcolor: 'action.selected',
                                    boxShadow: (t) => `inset 3px 0 0 ${t.palette.primary.main}`,
                                  }
                                : undefined
                            }
                          >
                            <TableCell
                              sx={{
                                fontFamily: 'ui-monospace, monospace',
                                fontVariantNumeric: 'tabular-nums',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {Number(e.scheduledDate.slice(8, 10))}
                              <Box
                                component="span"
                                sx={{ color: 'text.secondary', ml: 0.75, fontSize: '.8em' }}
                              >
                                {weekday(e.scheduledDate)}
                              </Box>
                              {isToday && (
                                <Chip
                                  size="small"
                                  label="hoje"
                                  color="primary"
                                  sx={{ ml: 1, height: 18 }}
                                />
                              )}
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{
                                fontFamily: 'ui-monospace, monospace',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {e.dayNumber}
                            </TableCell>
                            <TableCell sx={{ fontWeight: isToday ? 600 : 400 }}>
                              {passage(e.title)}
                              {e.duplicated && (
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  color="warning"
                                  label={`nº ${e.titleDayNumber} repetido no canal`}
                                  sx={{ ml: 1, height: 20 }}
                                />
                              )}
                              {e.jump && (
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  color="warning"
                                  label="salto na numeração"
                                  sx={{ ml: 1, height: 20 }}
                                />
                              )}
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{
                                fontFamily: 'ui-monospace, monospace',
                                fontVariantNumeric: 'tabular-nums',
                                color: 'text.secondary',
                              }}
                            >
                              {e.titleDayNumber}
                            </TableCell>
                            <TableCell>
                              <Link
                                href={e.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{ fontSize: '.85rem' }}
                              >
                                assistir
                              </Link>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Card>
            ))
          )}
        </Stack>
      )}
    </AppShell>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={0.25} sx={{ minWidth: 96 }}>
      <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4 }}>
        {label}
      </Typography>
      <Typography sx={{ fontFamily: 'ui-monospace, monospace', fontSize: '1.1rem' }}>
        {value}
      </Typography>
    </Stack>
  );
}

function formatShort(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}
