import { getRepository } from "typeorm";
import models from "../models/init";
import Psicologo from "../models/Psicologo";
import Sessions from "../models/Sessions";
import MasterRepository from "./master-repository";

export default class SessionRepository extends MasterRepository {
  constructor() {
    super(models.Sessions);
    this.relations = ['psicologo','paciente']
  }

  create = async (data: any): Promise<Object> => {
    console.log(data)
    const repo = getRepository(this.model, "default");

    let new_data = {};
    let existing: any = {}
    try {
      existing = await repo.findOne({where: {
        paciente: data.paciente,
        psicologo: data.psicologo
      }})
    }catch(err){

      console.log(err)
    }
    if(existing)
      await repo.delete(existing.id)
   try {
      new_data = await repo.save(data);
    } catch (error) {
      console.log(error)
      return { created: false, error: error.message, repository: this.model };
    }
    return { created: true, new_data: new_data };
  };

  updateOneBySessionId = async (session_code: any, new_data: any): Promise<Object> => {
    return new Promise((resolve, reject) => {
      const repo = getRepository(this.model, "default");

      repo
        .update({session_code}, new_data)
        .then((data) => resolve(data))
        .catch((update_one_by_session_id_error) =>
          reject(update_one_by_session_id_error.error)
        );
    });
  };

  readOneBySessionId = async (session_code: string, new_data: any): Promise<Object> => {
    return new Promise((resolve, reject) => {
      const repo = getRepository(this.model, "default");

      repo
        .update(new_data, {where: {session_code}})
        .then((data) => resolve(data))
        .catch((read_by_session_code_error) =>
          reject(read_by_session_code_error.error)
        );

    });
  };

  readOneBySessionCode = async(session_code:string) => {
    return new Promise((resolve,reject) => {
      const repo = getRepository(this.model, 'default')
      repo.findOne({where: {
        session_code
        }, relations:this.relations}).then((data) =>resolve(data)).catch((read_by_session_code_error) => reject(read_by_session_code_error.error))
    })
  }

  deleteByRoomName = async (daily_co_name: string) => {
    const repo = getRepository(this.model, 'default');
    try {
      const result = await repo.delete({ daily_co_name });
      return { deleted: true, affected: result.affected };
    } catch (error) {
      return { deleted: false, error: error.message };
    }
  };

}
