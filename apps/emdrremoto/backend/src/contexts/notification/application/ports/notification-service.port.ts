export const NOTIFICATION_SERVICE = Symbol('NOTIFICATION_SERVICE');

/**
 * Outbound notification boundary (e-mail via nodemailer, SMS via Twilio).
 * The application layer depends only on this port; concrete adapters live in infrastructure.
 */
export interface NotificationServicePort {
  /** Envia o e-mail de verificação de conta para o psicólogo. */
  sendEmailVerification(to: string, nome: string, verificationUrl: string): Promise<void>;

  /** Envia o código de recuperação de senha. */
  sendPasswordRecovery(to: string, nome: string, code: string): Promise<void>;

  /** Envia (e-mail e/ou SMS) o convite de sessão com o link de acesso do paciente. */
  sendSessionInvite(params: {
    email: string;
    phone?: string;
    nome: string;
    sessionLink: string;
  }): Promise<void>;
}
