import AuthService from "./auth.service";

export default class PsicologoService extends AuthService {
    constructor() {
        super('psicologo');
    }
    public verifyCode = async (data:any) => {
        const response = await this.api_service.RequestData('POST', `${this.endpoint}/verificar-codigo`, data, '');
        return response;
    }

    public verifyEmail = async (data:any) => {
        const response = await this.api_service.RequestData('PATCH', `${this.endpoint}/validar-email`, '', data);
        return response;
    }

    public changePassword = async (data:any) => {
        const response = await this.api_service.RequestData('POST', `${this.endpoint}/recuperar-senha`, data, '');
        return response;
    }

    public buscarPacientes = async (id: any) => {
        const response = await this.api_service.RequestData('GET', `${this.endpoint}/${id}`)
        return response;
    }
}
