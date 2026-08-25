export interface Ddi {
  /** Código de discagem, ex.: "+55". */
  dial: string;
  /** Nome do país (armazenado em `pais`). */
  country: string;
  flag: string;
}

/** DDI = país. Usado no cadastro de psicólogo e paciente (prefixo do telefone + país). */
export const DDIS: Ddi[] = [
  { dial: '+55', country: 'Brasil', flag: '🇧🇷' },
  { dial: '+351', country: 'Portugal', flag: '🇵🇹' },
  { dial: '+1', country: 'Estados Unidos', flag: '🇺🇸' },
  { dial: '+1', country: 'Canadá', flag: '🇨🇦' },
  { dial: '+44', country: 'Reino Unido', flag: '🇬🇧' },
  { dial: '+34', country: 'Espanha', flag: '🇪🇸' },
  { dial: '+33', country: 'França', flag: '🇫🇷' },
  { dial: '+49', country: 'Alemanha', flag: '🇩🇪' },
  { dial: '+39', country: 'Itália', flag: '🇮🇹' },
  { dial: '+54', country: 'Argentina', flag: '🇦🇷' },
  { dial: '+56', country: 'Chile', flag: '🇨🇱' },
  { dial: '+57', country: 'Colômbia', flag: '🇨🇴' },
  { dial: '+52', country: 'México', flag: '🇲🇽' },
  { dial: '+598', country: 'Uruguai', flag: '🇺🇾' },
  { dial: '+595', country: 'Paraguai', flag: '🇵🇾' },
  { dial: '+591', country: 'Bolívia', flag: '🇧🇴' },
  { dial: '+58', country: 'Venezuela', flag: '🇻🇪' },
  { dial: '+351', country: 'Angola', flag: '🇦🇴' },
  { dial: '+258', country: 'Moçambique', flag: '🇲🇿' },
  { dial: '+81', country: 'Japão', flag: '🇯🇵' },
  { dial: '+61', country: 'Austrália', flag: '🇦🇺' },
];

/** Valor único para o <Select> (dial+country podem repetir dial, ex.: +1). */
export function ddiKey(d: Ddi): string {
  return `${d.dial}|${d.country}`;
}

export const DEFAULT_DDI_KEY = ddiKey(DDIS[0]); // Brasil
