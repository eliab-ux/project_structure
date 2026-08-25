export interface InviteProps{
  email?: string;
  nome: string;
  whatsapp?: any;
  telegram?: string;
  url_sessao: string;
  hash_paciente?: string;
}

export interface InviteState{
  linkSessao: string
}
