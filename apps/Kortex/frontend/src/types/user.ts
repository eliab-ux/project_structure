import { UserRole } from './auth';

export interface TeamUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
}

/** '+5562998708893' → '(62) 9 9870-8893'. Só apresentação; o backend guarda em E.164. */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const local = digits.startsWith('55') ? digits.slice(2) : digits;

  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 3)} ${local.slice(3, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return phone;
}

/** 'hoje 07:12', 'ontem 19:40', '12/06' — o formato da coluna "Último acesso" do protótipo. */
export function formatLastLogin(iso: string | null): string {
  if (!iso) {
    return 'nunca';
  }

  const date = new Date(iso);
  const today = new Date();
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (sameDay(date, today)) {
    return `hoje ${time}`;
  }

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(date, yesterday)) {
    return `ontem ${time}`;
  }

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
