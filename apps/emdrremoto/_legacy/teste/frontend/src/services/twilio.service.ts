import MasterService from "./master.service";

export default class TwilioService extends MasterService {
    constructor() {
        super('twilio');
    }
    public sendWhatsappMessage = async (data:any) => {
        const response = await this.api_service.RequestData('POST', `${this.endpoint}/new-whatsapp-message`, data, '')
        return response
    }
}
