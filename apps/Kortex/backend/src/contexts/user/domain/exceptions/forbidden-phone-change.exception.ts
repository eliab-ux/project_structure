import { DomainException } from '@gitspread/domain-primitives';

/** Vira 403 no GlobalExceptionFilter (o nome casa com /Forbidden/). */
export class ForbiddenPhoneChangeException extends DomainException {
  constructor() {
    // Spec §6.12: sem esta trava, a regra "ninguém redefine a senha de terceiro" teria uma porta
    // dos fundos de dois passos — mudo o número, peço o código no WhatsApp, entro como ele.
    super(
      'Somente o dono pode alterar o telefone de outro usuário. ' +
        'Cada pessoa altera o próprio telefone no seu perfil.',
    );
  }
}
