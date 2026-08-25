import { getRepository } from "typeorm";

export default class MasterRepository {
  model: any;
  connection: any;
  relations: any;
  constructor(model) {
    this.model = model;
    this.relations = [];
  }

  create = async (data: Object): Promise<Object> => {
    const repo = getRepository(this.model, "default");

    let new_data = {};

    try {
      const entity = this.model.name === 'Paciente' 
      ? repo.create(data) 
      : data; 

      new_data = await repo.save(entity);
    } catch (error) {
      return { created: false, error: error.message, repository: this.model };
    }
    return { created: true, new_data: new_data };
  };

  read = async (): Promise<Object> => {
    const repo = getRepository(this.model, "default");

    const all_data = await repo.find({relations:this.relations});

    return all_data;
  };

  readOne = async (ID: any): Promise<Object> => {
    const repo = getRepository(this.model, "default");

    const all_data = await repo.findOne({ where: { id: ID }, relations: this.relations });

    return all_data;
  };

  update = async (ID: any, new_data: any): Promise<Object> => {
    const repo = getRepository(this.model, "default");
    await repo.findOne({ where: { id: ID } });

    let updated_data = {};
    try {
      updated_data = await repo.update({ id: ID }, new_data);
    } catch (error) {
      return { updated: false, error: error.message, repository: this.model };
    }

    return { updated: true, updated_data: updated_data };
  };

  delete = async (ID: any): Promise<Object> => {
    const repo = getRepository(this.model, "default");
    try {
      await repo.delete(ID);
    } catch (error) {
      return { deleted: false, error: error.message, repository: this.model };
    }

    return { deleted: true };
  };
}
