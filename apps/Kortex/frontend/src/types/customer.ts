export type DocumentType = 'cnpj' | 'cpf';
export type CustomerStatus = 'active' | 'inactive';
export type CompanySize = 'mei' | 'me' | 'epp' | 'other';
export type RepresentativeRole = 'president' | 'partner' | 'owner' | 'other';

export const COMPANY_SIZE_LABELS: Record<CompanySize, string> = {
  mei: 'MEI',
  me: 'ME',
  epp: 'EPP',
  other: 'Outro',
};

export const REPRESENTATIVE_ROLE_LABELS: Record<RepresentativeRole, string> = {
  president: 'Presidente',
  partner: 'Sócio',
  owner: 'Proprietário',
  other: 'Outro',
};

/** O que a listagem recebe. Sem número de documento — ver o DTO do backend. */
export interface CustomerListItem {
  id: string;
  tradeName: string;
  documentType: DocumentType;
  city: string;
  state: string;
  whatsapp: string;
  isMember: boolean;
  status: CustomerStatus;
}

export interface CustomerDetail {
  id: string;
  legalName: string;
  tradeName: string;
  documentType: DocumentType;
  document: string;
  documentFormatted: string;
  stateRegistration: string | null;
  companySize: CompanySize | null;
  employeesCount: number | null;
  status: CustomerStatus;
  address: {
    zipCode: string | null;
    street: string | null;
    number: string | null;
    complement: string | null;
    district: string | null;
    city: string;
    state: string;
  };
  representative: {
    name: string;
    role: RepresentativeRole | null;
    cpf: string;
    cpfFormatted: string;
    phone: string;
    email: string;
  };
  contact: {
    whatsapp: string;
    email: string | null;
    phone: string | null;
  };
  isMember: boolean;
  memberSince: string | null;
  notes: string | null;
}

export interface Fabric {
  id: string;
  name: string;
  /** Altura máxima do enfesto inteiro — a restrição física da mesa. */
  maxLayerHeightCm: number;
  /** Espessura de UMA camada. `null` = ainda não medida, e aí não há aviso de altura. */
  layerThicknessCm: number | null;
  /** `altura ÷ espessura`, calculado no backend. `null` sem espessura. */
  maxLayers: number | null;
  notes: string | null;
}

export interface ProductType {
  id: string;
  name: string;
}

export const UF_LIST = [
  'AC',
  'AL',
  'AM',
  'AP',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MG',
  'MS',
  'MT',
  'PA',
  'PB',
  'PE',
  'PI',
  'PR',
  'RJ',
  'RN',
  'RO',
  'RR',
  'RS',
  'SC',
  'SE',
  'SP',
  'TO',
];

/** '11222333000181' → '11.222.333/0001-81'; CPF → '529.982.247-25'. */
export function formatDocument(digits: string): string {
  const value = digits.replace(/\D/g, '');
  if (value.length === 14) {
    return `${value.slice(0, 2)}.${value.slice(2, 5)}.${value.slice(5, 8)}/${value.slice(8, 12)}-${value.slice(12)}`;
  }
  if (value.length === 11) {
    return `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`;
  }
  return digits;
}
