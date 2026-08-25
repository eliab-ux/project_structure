import MasterService from "./master.service";

export default class PacienteService extends MasterService {
    constructor() {
        super('paciente');
    }

    public verifyHash = async (hash:any) => {
        const response = await this.api_service.RequestData('GET', `${this.endpoint}/verify-hash/${hash}`);
        return response;
    }
}
