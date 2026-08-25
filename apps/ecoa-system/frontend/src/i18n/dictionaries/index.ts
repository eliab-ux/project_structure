import { en } from './en';
import { pt } from './pt';

export type Locale = 'en' | 'pt';

export const dictionaries: Record<Locale, typeof en> = {
  en,
  pt,
};

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  pt: 'Português',
};
