'use client';

import { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import Button from '@mui/material/Button';
import TranslateIcon from '@mui/icons-material/Translate';
import Check from '@mui/icons-material/Check';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { useI18n } from 'src/i18n/I18nProvider';
import { LOCALE_LABELS, type Locale } from 'src/i18n/dictionaries';

const LOCALES: Locale[] = ['en', 'pt'];

interface LanguageSwitcherProps {
  /** 'icon' for the app bar (compact), 'button' for auth screens (shows current language). */
  variant?: 'icon' | 'button';
}

/** Language selector (English / Português). Persists the choice via the i18n provider. */
export function LanguageSwitcher({ variant = 'icon' }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const open = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const close = () => setAnchorEl(null);
  const pick = (next: Locale) => {
    setLocale(next);
    close();
  };

  return (
    <>
      {variant === 'button' ? (
        <Button
          onClick={open}
          size="small"
          startIcon={<TranslateIcon />}
          aria-label={t('common.language')}
          sx={{ color: 'text.secondary' }}
        >
          {LOCALE_LABELS[locale]}
        </Button>
      ) : (
        <Tooltip title={t('common.language')}>
          <IconButton onClick={open} aria-label={t('common.language')}>
            <TranslateIcon />
          </IconButton>
        </Tooltip>
      )}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={close}>
        {LOCALES.map((code) => (
          <MenuItem key={code} selected={code === locale} onClick={() => pick(code)}>
            <ListItemIcon>{code === locale ? <Check fontSize="small" /> : null}</ListItemIcon>
            <ListItemText>{LOCALE_LABELS[code]}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
