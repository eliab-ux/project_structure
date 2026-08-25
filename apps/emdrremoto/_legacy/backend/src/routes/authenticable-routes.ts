import MasterRoutes from "./master-routes";

export default class AuthenticableRoutes extends MasterRoutes {
  constructor(controller: any) {
    super(controller);

    this.endpoints["login"] = {
      login: {
        endpoint: this.router.post("/login", this.controller.login),
      },
    };
  }
}
