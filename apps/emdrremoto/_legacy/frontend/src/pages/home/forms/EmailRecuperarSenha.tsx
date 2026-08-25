import React from "react";
import { toast } from "react-toastify";
import InputCustom from "../../../components/inputs/input-custom";
import MailerService from "../../../services/mailer.service";

interface EmailrecState {
  email: string;
}

export default class EmailRecuperarSenha extends React.Component<any, EmailrecState> {
  constructor(props: any) {
    super(props);
    this.state = {
      email: "",
    };
    this.sendCode = this.sendCode.bind(this);
    this.handleChange = this.handleChange.bind(this);
  }

  sendCode = async (event: any) => {
    event.preventDefault();

    try {
      const mailer_services = new MailerService();
      const send_mail = await mailer_services.sendCode({ email: this.state.email });
      if (!send_mail || send_mail.error) {
        const message = `Erro ao enviar código de recuperação de senha: ${send_mail.error_message}`
        toast.error(message);
        return;
      }

      const message = "Código enviado para e-mail. Verifique na sua caixa de entrada. Aguarde o redirecionamento...";
      toast.success(message);
      setTimeout(() => {
        window.location.href = "/recuperar-senha/digitar-codigo"
      }, 1000 * 3);
    } catch (error) {
      console.log(error);
      const message = `Erro ao enviar código de recuperação de senha`
      toast.error(message);
    }
  }

  handleChange = (event: any) => this.setState({ [event.target.name]: event.target.value } as any);

  render(): React.ReactNode {
    return (
      <div className="min-h-screen w-full p-10 bg-gray-50 grid items-center">
        <form className="lg:w-1/2 lg:mx-auto" onChange={this.handleChange}>
          <InputCustom
            type="email"
            name="email"
            label="Digite o email para qual encaminharemos o código de recuperação"
            placeholder="Email de recuperação"
          />

          <button
            className="w-full lg:mt-5 mt-2 text-white font-light text-xl p-3 bg-blue-500 rounded hover:bg-blue-600 hover:shadow-xl"
            onClick={this.sendCode}
          >
            Enviar código para o email
          </button>
        </form>
      </div>
    );
  }
}
