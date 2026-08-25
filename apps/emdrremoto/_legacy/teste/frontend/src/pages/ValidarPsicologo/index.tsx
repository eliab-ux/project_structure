import React from "react";
import PsicologoService from "../../services/psicologo.service";
import { toast } from "react-toastify";

export default class ValidarPsicologo extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    this.state = {
      text: "Um momento, estamos validando o seu e-mail para você ter acesso...",
    };
  }
  componentDidMount = async () => {
    const { id } = this.props.match.params;
    const psicologo_service = new PsicologoService();
    const verify_email: any = await psicologo_service.verifyEmail(id);
    if (verify_email.error) {
      this.setState({
        text: "Verifique o link novamente ou entre em contato com a plataforma.",
      });
      toast.error(verify_email.message);
      return false;
    }
    toast.success(verify_email.message);
    const url = window.location.href;
    this.setState({
      text: "Redirecionando para o login...",
    });
    const path = url.split("/")[0];
    setInterval(() => {
      window.location.href = `${path}/login`;
    }, 2000);
  };

  render() {
    return (
      <div className="bg-gray-50 min-h-screen grid items-center justify-center">
        <p className="text-xl font-light animate-pulse">{this.state.text}</p>
      </div>
    );
  }
}
