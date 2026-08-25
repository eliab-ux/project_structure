import MasterService from "./master.service";

export default class AuthService extends MasterService{
    endpoint:string
    constructor(endpoint:string) {
        super(endpoint);
        this.endpoint = endpoint;
    }
    public login = async (data: any) => {
        const login_response = await this.api_service.RequestData('POST',`${this.endpoint}/login`,data,'')
        return login_response
    }
    public tokenValidation = async (token: any) => {
        const response =  await this.api_service.RequestData('POST',`${this.endpoint}`, token, '')
        return response;
    }
}
