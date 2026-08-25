import controllers from "../../controllers/init";
import AuthenticableRoutes from "../authenticable-routes";

export default class PsicologoRoutes extends AuthenticableRoutes {
  constructor() {
    super(new controllers.PsicologoControllers());
    this.endpoint = '/psicologo';

    this.endpoints["verificar-codigo"] = {
      verificar_codigo: {
        endpoint: this.router.post("/verificar-codigo", this.controller.verificarCodigo),
      },
    };

    this.endpoints["recuperarSenha"] = {
      recuperar_senha: {
        endpoint: this.router.post("/recuperar-senha", this.controller.recuperarSenha),
      },
    };

    this.endpoints["validar-email"] = {
      validar_email: {
        endpoint: this.router.patch("/validar-email/:id", this.controller.validarEmail),
      },
    };

  }

}