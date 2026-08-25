import models from '../models/init'
import MasterRepository from './master-repository'
import { getRepository } from "typeorm";

export default class PacienteRepository extends MasterRepository {

    constructor(){
        super(models.Paciente);
        this.relations = ['pacient_sessions']
    }

    searchForHash = async (hash: string) => {
      const repo = getRepository(this.model, "default");
  
      const all_data = await repo.findOne({
        where: {
          hash,
        },
      });
  
      return all_data;
    };
}