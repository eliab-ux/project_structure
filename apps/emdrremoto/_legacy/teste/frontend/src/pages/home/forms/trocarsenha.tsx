import React from "react";
import { toast } from "react-toastify";
import Cookies from "universal-cookie";
import InputCustom from "../../../components/inputs/input-custom";
import PsicologoService from "../../../services/psicologo.service";
interface TrocarSenhaState {
  senha: string;
}
export default class TrocarSenha extends React.Component<
  any,
  TrocarSenhaState
> {
  constructor(props: any) {
    super(props);
    this.state = {
      senha: "",
    };
    this.changePassword = this.changePassword.bind(this);
    this.handleChange = this.handleChange.bind(this);
  }

  changePassword = async (event: any) => {
    event.preventDefault();
    const psicologo_service = new PsicologoService();
    const cookie = new Cookies();
    const id = cookie.get("rec-psicologo-id");
    const password_changing: any = await psicologo_service.changePassword({
      id,
      senha: this.state.senha,
    });

    if (!password_changing.updated)
      toast.error(
        "Erro ao mudar a senha. Entre em contato com os desenvolvedores."
      );
    else {
      toast.success("Senha atualizada. Aguarde o redirecionamento...");
      setTimeout(() => (window.location.href = "/"), 5000);
    }
  };
  handleChange = (event: any) =>
    this.setState({ [event.target.name]: event.target.value } as any);
  render(): React.ReactNode {
    return (
      <div className="min-h-screen w-full p-10 bg-gray-50 grid items-center">
        <form className="lg:w-1/2 lg:mx-auto" onChange={this.handleChange}>
          <InputCustom
            type="password"
            name="senha"
            label="Digite uma nova senha"
            placeholder="Senha"
          ></InputCustom>
          <button
            className="w-full lg:mt-5 mt-2 text-white font-light text-xl p-3 bg-yellow-500 rounded hover:bg-yellow-600 hover:shadow-xl"
            onClick={this.changePassword}
          >
            Salvar nova senha
          </button>
        </form>
      </div>
    );
  }
}
