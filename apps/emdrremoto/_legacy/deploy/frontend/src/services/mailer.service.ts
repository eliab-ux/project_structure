import MasterService from "./master.service";

export default class MailerService extends MasterService {
    constructor() {
        super('mailer');
    }

    public sendEmail = async (data: any) => {
        const response = await this.api_service.RequestData('POST', `${this.endpoint}/send-link-email`, data, '');
        return response;
    }

    public sendVerificationEmail = async (data: any) => {
        const response = await this.api_service.RequestData('POST', `${this.endpoint}/send-verification-link`, data, '');
        return response;
    }

    public sendCode = async (data: any): Promise<{ error: boolean; error_message?: string }> => {
        const response = await this.api_service.RequestData('POST', `${this.endpoint}/send-code`, data, '');
        return response as any;
    }
}
