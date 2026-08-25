import MasterService from "./master.service";

export default class DailyService extends MasterService {
    constructor() {
        super('daily');
    }
    public create = async (data:any) => {
        const response = await this.api_service.RequestData('POST', `${this.endpoint}/new-room`, data, '')
        return response
    }
}
