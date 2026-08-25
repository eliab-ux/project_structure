import MasterService from "./master.service";

export default class CallService extends MasterService {
    constructor() {
        super('/daily');
    }
}
