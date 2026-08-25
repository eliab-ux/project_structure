export class RegisterUserCommand {
  constructor(
    public readonly name: string,
    public readonly email: string,
    public readonly password: string,
    /** WhatsApp como o usuário digitou; quem normaliza é o `PhoneNumber`. */
    public readonly phone: string,
  ) {}
}
