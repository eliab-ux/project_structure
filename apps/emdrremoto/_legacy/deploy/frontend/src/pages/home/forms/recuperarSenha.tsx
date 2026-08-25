import React from "react";
import { toast } from "react-toastify";
import Cookies from "universal-cookie";
import InputCustom from "../../../components/inputs/input-custom";
import PsicologoService from "../../../services/psicologo.service";
interface RecuperarSenhaState {
  codigo: string;
}

export default class RecuperarSenha extends React.Component<
  any,
  RecuperarSenhaState
> {
  constructor(props: any) {
    super(props);
    this.state = {
      codigo: "",
    };
    this.verifyCode = this.verifyCode.bind(this);
    this.handleChange = this.handleChange.bind(this);
  }
  verifyCode = async (event: any) => {
    event.preventDefault();
    const psicologo_service = new PsicologoService();
    const code_verify: any = await psicologo_service.verifyCode({
      code: this.state.codigo,
    });
    if (code_verify.error) toast.error(code_verify.error_message);
    else {
      const cookies = new Cookies();
      await cookies.set("rec-psicologo-id", code_verify.psicologo.id);
      toast.success("Código correto. Aguarde o redirecionamento...");
      setTimeout(
        () => (window.location.href = "/recuperar-senha/nova-senha"),
        5000
      );
    }
  };
  handleChange = (event: any) =>
    this.setState({ [event.target.name]: event.target.value } as any);
  render(): React.ReactNode {
    return (
      <div className="min-h-screen w-full p-10 bg-gray-50 grid items-center">
        <form className="lg:w-1/2 lg:mx-auto" onChange={this.handleChange}>
          <InputCustom
            type="text"
            name="codigo"
            label="Código de recuperação"
            placeholder="Código de recuperação"
          ></InputCustom>
          <button
            className="w-full lg:mt-5 mt-2 text-white font-light text-xl p-3 bg-green-500 rounded hover:bg-green-600 hover:shadow-xl"
            onClick={this.verifyCode}
          >
            Confirmar código
          </button>
        </form>
      </div>
    );
  }
}
