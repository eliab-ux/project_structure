export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

export interface EmailSenderPort {
  sendPasswordReset(to: string, name: string, resetLink: string): Promise<void>;
}
