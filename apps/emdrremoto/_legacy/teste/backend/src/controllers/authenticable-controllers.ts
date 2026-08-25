import MasterController from "./master-controllers";
import { hash } from "bcrypt";
import { Response } from "express";

export default class AuthenticableControllers extends MasterController {
  constructor(repository) {
    super(repository);
  }

  create = async (req, res): Promise<Response> => {
    const body = req.body;

    if (body.senha != body.confsenha) {
      return res.status(400).json({
        created: false,
        message: "O campo senha e o campo confirmar senha devem ser iguais.",
      });
    }

    if (!body.email) {
      return res.status(400).json({
        created: false,
        message: "O e-mail é obrigatório!",
      });
    }

    const user = await this.repository.searchForEmail(body.email);
    if (user) {
      return res.status(400).json({
        created: false,
        message: "Email já cadastrado.",
      })
    };

    body.senha = await hash(body.senha, 10);
    const new_user = await this.repository.create(body);

    res.status(!new_user ? 500 : 200).json(new_user);
  };

  login = async (req, res): Promise<Response> => {
    const retorno = await this.repository.login(req.body);
    if (!retorno.auth) {
      return res
        .status(200)
        .json(retorno);
    }

    res
      .status(200)
      .json({ auth: true, token: retorno.token, user: retorno.user });
  };
}
