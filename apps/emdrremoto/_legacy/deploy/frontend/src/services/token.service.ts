import AuthService from "./auth.service";

export default class TokenService extends AuthService {
    constructor() {
        super('auth/token');
    }
}
