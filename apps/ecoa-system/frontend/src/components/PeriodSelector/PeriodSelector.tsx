'use client';

import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { PeriodDays, usePeriod } from 'src/context/PeriodContext';
import { useI18n } from 'src/i18n/I18nProvider';

const OPTIONS: PeriodDays[] = [7, 30, 90];

/** Global period selector — marketing thinks in time windows, not isolated records. */
export function PeriodSelector() {
  const { days, setDays } = usePeriod();
  const { t } = useI18n();

  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={days}
      onChange={(_e, value) => value && setDays(value as PeriodDays)}
      aria-label={t('components.periodSelectorLabel')}
      color="primary"
    >
      {OPTIONS.map((option) => (
        <ToggleButton
          key={option}
          value={option}
          aria-label={t('components.periodLastDays', { n: option })}
        >
          {option}d
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
