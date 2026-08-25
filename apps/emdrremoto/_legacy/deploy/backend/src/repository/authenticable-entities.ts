import { getRepository } from "typeorm";
import MasterRepository from "./master-repository";
import { compare } from "bcrypt";
import createNewToken from "../token/token-handler";

const moment = require("moment");

/**
 * * Classe com login comum para entidades autenticaveis
 */
export default class AuthenticableEntities extends MasterRepository {
  constructor(model) {
    super(model);
  }
  login = async (data: any): Promise<Object> => {
    const repo = getRepository(this.model, "default");

    const user: any = await repo.findOne({
      where: {
        email: data.email,
      },
    });
    if (user && (await compare(data.senha, user.senha))) {
    if(!user.email_verificado) return {auth: false, message: 'E-mail não verificado.' }
      const token = await createNewToken({
        userID: user.id,
      });
      const date = moment().format();
      const save_data = {
        id: user.id,
        last_login: date,
      };
      user.last_login = date;
      await repo.save(save_data);
      const retorno = { auth: true, token: token, user: user };
      return retorno;
    } else return {auth: false, message: 'Usuário e/ou senha incorreto(s).'};
  };
}
