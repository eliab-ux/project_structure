import CookiesProvider from "../providers/Cookies.provider";
import TokenService from "../services/token.service";

export default class MasterMiddleware {
  protected cookie_provider: CookiesProvider;
  protected entity: String;
  constructor(entity: string) {
    this.cookie_provider = new CookiesProvider();
    this.entity = entity;
  }
  public autenticar = async (to: any, from: any, next: any) => {
    const cookie = new CookiesProvider();
    const user_cookie = cookie.getUserData() || false;
    const token = user_cookie.token ?? false;
    if (token) {
      const auth = new TokenService();
      const validation: any = await auth.tokenValidation(token);
      if (validation.auth) {
        next();
      } else {
        next.redirect("/login");
      }
    }
    next.redirect("/login");
  };
}
