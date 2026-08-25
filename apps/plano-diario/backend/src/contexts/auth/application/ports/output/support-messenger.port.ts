export const SUPPORT_MESSENGER = Symbol('SUPPORT_MESSENGER');

export interface PasswordResetMessage {
  /** Destino em E.164 sem `+`. */
  phone: string;
  name: string;
  code: string;
  expiresInMinutes: number;
}

/**
 * O canal pelo qual o sistema fala com o usuário fora do app — hoje, o WhatsApp de suporte.
 *
 * É um port separado do `WhatsappGatewayPort` de propósito: aquele é a conexão **do usuário**,
 * que ele pareia e pode desconectar; este é a conta de suporte da operação. Se a conexão do
 * usuário estivesse fora do ar, ele continuaria conseguindo recuperar a senha.
 *
 * O contrato recebe o código e monta a mensagem no adapter porque o texto é decisão de
 * infraestrutura de comunicação, não de negócio.
 */
export interface SupportMessengerPort {
  /**
   * Lança se o canal não está utilizável (configuração ausente, por exemplo).
   *
   * Existe separado do envio porque precisa ser chamado **antes** de olhar o usuário: se o canal
   * estivesse quebrado e o erro só aparecesse no momento de enviar, a recuperação responderia 200
   * para e-mail inexistente e erro para e-mail real — entregando quais contas existem.
   */
  ensureAvailable(): void;
  sendPasswordResetCode(message: PasswordResetMessage): Promise<void>;
}
