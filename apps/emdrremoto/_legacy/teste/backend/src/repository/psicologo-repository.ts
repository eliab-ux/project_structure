import { getRepository } from "typeorm";
import models from "../models/init";
import AuthenticableEntities from "./authenticable-entities";

export default class PsicologoRepository extends AuthenticableEntities {
  constructor() {
    super(models.Psicologo);
  }

  searchForEmail = async (email: string) => {
    const repo = getRepository(this.model, "default");

    const all_data = await repo.findOne({
      where: {
        email: email,
      },
    });

    return all_data;
  };

  searchForCode = async (code: string) => {
    const repo = getRepository(this.model, "default");

    const all_data = await repo.findOne({
      where: {
        codigo_recuperacao: code,
      },
    });

    return all_data;
  };
}
