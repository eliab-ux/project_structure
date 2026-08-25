export class RegisterPsicologoCommand {
  constructor(
    public readonly email: string,
    public readonly nome: string,
    public readonly telefone: string,
    public readonly senha: string,
  ) {}
}
