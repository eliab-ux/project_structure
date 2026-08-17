'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import {
  RESERVATION_STATUS_LABELS,
  ScheduleEntry,
  hhmm,
  layoutOverlaps,
  minutesOfDay,
} from 'src/types/schedule';
import { numericSx } from 'src/theme/theme';

interface Column {
  key: string;
  label: string;
  entries: ScheduleEntry[];
}

interface AgendaGridProps {
  columns: Column[];
  /** Primeira e última hora exibidas — derivadas das janelas de funcionamento da conta. */
  fromHour: number;
  toHour: number;
  onSelect: (entry: ScheduleEntry) => void;
}

const ROW_HEIGHT = 56;

/** Cor da faixa por situação. Pré-reservada é hachurada: segura o horário sem estar paga. */
function appearance(entry: ScheduleEntry) {
  if (entry.type === 'consultation') {
    return { bg: '#EEF0EC', border: '#6B7A8C', style: 'dotted' as const };
  }
  if (entry.reservationStatus === 'pre_reserved') {
    return { bg: '#FDEEE9', border: '#F04E23', style: 'dashed' as const };
  }
  if (entry.reservationStatus === 'in_progress') {
    return { bg: '#FDEEE9', border: '#F04E23', style: 'solid' as const };
  }
  return { bg: '#E8EFFB', border: '#1E63D0', style: 'solid' as const };
}

/**
 * Grade horas × colunas da agenda.
 *
 * **Compromissos sobrepostos ficam lado a lado**, dividindo a faixa — o padrão de calendário do
 * Teams/Outlook (spec §4.8). Não empilha um sobre o outro nem esconde o de baixo: os dois
 * precisam ser vistos, porque é o Administrativo quem decide o que fazer com a sobreposição.
 *
 * O card reduzido mostra **só nome e horário**. Tecido, produto, peças, pagamento, valor e
 * matrizes ficam na tela de detalhe, ao clicar — forçar tudo num espaço menor é o que a spec
 * proíbe explicitamente.
 */
export function AgendaGrid({ columns, fromHour, toHour, onSelect }: AgendaGridProps) {
  const hours = Array.from({ length: Math.max(1, toHour - fromHour) }, (_, i) => fromHour + i);
  const totalMinutes = (toHour - fromHour) * 60;

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `72px repeat(${columns.length}, minmax(180px, 1fr))`,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
          overflow: 'hidden',
          minWidth: 72 + columns.length * 180,
        }}
      >
        <Box
          sx={{ bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider' }}
        />
        {columns.map((column) => (
          <Typography
            key={column.key}
            variant="overline"
            component="div"
            sx={{
              p: 1,
              textAlign: 'center',
              bgcolor: 'background.default',
              borderLeft: '1px solid',
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            {column.label}
          </Typography>
        ))}

        <Box>
          {hours.map((hour) => (
            <Box
              key={hour}
              sx={{
                height: ROW_HEIGHT,
                borderBottom: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                justifyContent: 'flex-end',
                pr: 1,
                pt: 0.5,
                ...numericSx,
                fontSize: 11,
                color: 'text.secondary',
              }}
            >
              {String(hour).padStart(2, '0')}:00
            </Box>
          ))}
        </Box>

        {columns.map((column) => (
          <Box
            key={column.key}
            sx={{
              position: 'relative',
              borderLeft: '1px solid',
              borderColor: 'divider',
              height: hours.length * ROW_HEIGHT,
            }}
          >
            {hours.map((hour) => (
              <Box
                key={hour}
                sx={{ height: ROW_HEIGHT, borderBottom: '1px solid', borderColor: 'divider' }}
              />
            ))}

            {layoutOverlaps(column.entries).map(({ entry, left, width }) => {
              const start = minutesOfDay(entry.startsAt) - fromHour * 60;
              const end = minutesOfDay(entry.endsAt) - fromHour * 60;
              const look = appearance(entry);
              const reduzido = width < 1;

              return (
                <Box
                  key={entry.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(entry)}
                  onKeyDown={(event) => event.key === 'Enter' && onSelect(entry)}
                  sx={{
                    position: 'absolute',
                    top: `${(start / totalMinutes) * 100}%`,
                    height: `${((end - start) / totalMinutes) * 100}%`,
                    // A fração da largura vem de `layoutOverlaps`: dois dividem ao meio, três em
                    // três. É o que mantém os dois visíveis.
                    left: `calc(${left * 100}% + 2px)`,
                    width: `calc(${width * 100}% - 4px)`,
                    bgcolor: look.bg,
                    border: `1.5px ${look.style} ${look.border}`,
                    borderRadius: 1.5,
                    p: 0.75,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    '&:hover': { filter: 'brightness(0.97)' },
                  }}
                >
                  <Typography
                    variant="h6"
                    component="p"
                    sx={{
                      fontSize: reduzido ? 10.5 : 12,
                      lineHeight: 1.15,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {entry.customer?.name ?? entry.title ?? 'Atendimento'}
                  </Typography>
                  <Typography
                    component="p"
                    sx={{ ...numericSx, fontSize: reduzido ? 9 : 10, color: 'text.secondary' }}
                  >
                    {hhmm(entry.startsAt)}–{hhmm(entry.endsAt)}
                  </Typography>
                  {/* Só quando há espaço: o card reduzido é nome + horário e nada mais. */}
                  {!reduzido && entry.reservationStatus && (
                    <Typography
                      component="p"
                      sx={{ fontSize: 9.5, color: 'text.secondary', mt: 0.25 }}
                    >
                      {RESERVATION_STATUS_LABELS[entry.reservationStatus]}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
