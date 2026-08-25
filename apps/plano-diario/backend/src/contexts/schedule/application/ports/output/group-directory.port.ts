export const GROUP_DIRECTORY = Symbol('GROUP_DIRECTORY');

export interface DirectoryGroup {
  jid: string;
  name: string;
}

/**
 * Consulta aos grupos que o usuário realmente tem. Existe como port próprio para o context
 * `schedule` não depender do `whatsapp`: a implementação (na infraestrutura) é que faz a ponte.
 *
 * É a barreira de autorização do agendamento — um `group_jid` vindo do body só é aceito se
 * estiver aqui, o que impede o usuário de configurar envio para um grupo que não é dele.
 */
export interface GroupDirectoryPort {
  findByUserAndJid(userId: string, jid: string): Promise<DirectoryGroup | null>;
}
