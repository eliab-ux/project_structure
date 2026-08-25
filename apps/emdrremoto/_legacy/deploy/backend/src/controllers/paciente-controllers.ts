import repositories from "../repository/init";
import MasterController from "./master-controllers";

export default class PacienteControllers extends MasterController{
    constructor(){
        super(new repositories.PacienteRepository());
    }

    public verificarHash = async (req, res) => {
        const { hash } = req.params;

        const paciente = await this.repository.searchForHash(hash);
        if (!paciente)
        return res
            .status(200)
            .send({ error: true, error_message: "Hash incorreta" });

        return res.status(200).send({ error: false, paciente });
  };
}