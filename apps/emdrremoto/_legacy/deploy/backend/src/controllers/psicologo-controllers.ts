import repositories from "../repository/init";
import AuthenticableControllers from "./authenticable-controllers";
import { hash } from "bcrypt";

export default class PsicologoControllers extends AuthenticableControllers {
  constructor() {
    super(new repositories.PsicologoRepository());
  }
  public verificarCodigo = async (req, res) => {
    const { code } = req.body;

    const psicologo = await this.repository.searchForCode(code);
    console.log(code);
    if (!psicologo)
      return res
        .status(200)
        .send({ error: true, error_message: "Código incorreto" });

    await this.repository.update(psicologo.id, { codigo_recuperacao: null });
    return res.status(200).send({ error: false, psicologo });
  };

  public recuperarSenha = async (req, res) => {
    const { id, senha } = req.body;

    const password = await hash(senha, 10);
    const password_update = await this.repository.update(id, {
      senha: password,
    });
    return res.status(200).send(password_update);
  };

  public validarEmail =  async(req, res) => {
    const {id} = req.params;

    let user = await this.repository.readOne(id);
    if(!user) return res.status(200).send({error: true, message: 'Usuário não encontrado.'})
    const user_email_verified = await this.repository.update(id, {email_verificado:true});
    if(!user_email_verified.updated) return res.status(500).send({error: true, message: user_email_verified})
    return res.status(200).send({error: false, message: 'E-mail verificado com sucesso.'});
  }
}
