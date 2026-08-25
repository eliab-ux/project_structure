import React from "react";
import { InviteProps, InviteState } from "./homeInterfaces";
import { copyIcon, emailIcon, telegramIcon, whatsappIcon } from "./mocks/icons";
import TwilioService from "../../services/twilio.service";
import MailerService from "../../services/mailer.service";
import { toast } from "react-toastify";

export default class Invite extends React.Component<InviteProps, InviteState> {
  constructor(props: InviteProps) {
    super(props);
    this.state = {
      linkSessao: `https://${window.location.host}/emdr/paciente/sala/${this.props.hash_paciente}`,
    };
    this.copyToClipboard = this.copyToClipboard.bind(this);
  }

  copyToClipboard() {
    const copyTextarea: any = document.querySelector(".js-copytextarea");
    copyTextarea.focus();
    copyTextarea.select();
    try {
      var successful = document.execCommand("copy", false, "texto");
      var msg = successful ? "successful" : "unsuccessful";
      console.log("Copying text command was " + msg);
    } catch (err) {
      console.log("Oops, unable to copy");
    }
  }
  async sendWhatsappMessage(to: any, message: any) {
    /*const twilio_services = new TwilioService()
        try {
          const twilio_response = await twilio_services.sendWhatsappMessage({to, message})
          toast.success(`Link de sessão enviado para ${this.props.nome} (${this.props.whatsapp})`)
        } catch (error) {
          toast.error(`Erro ao enviar mensagem com link para ${this.props.nome} (${this.props.whatsapp} `)
        }*/
    toast.info("Em Breve.");
  }

  async sendMail(to: any, subject: string, message: any) {
    toast.info("Enviando e-mail...");
    const mailer_services = new MailerService();
    try {
      const mailer_response = await mailer_services.sendEmail({
        to,
        subject,
        nome_paciente: this.props.nome,
        link: this.state.linkSessao,
      });
      toast.success(
        `Link de sessão enviado para ${this.props.nome} (${this.props.email})`
      );
    } catch (error) {
      toast.error(
        `Erro ao enviar mensagem com link para ${this.props.nome} (${this.props.email}) `
      );
    }
  }
  render() {
    return (
      <div className="p-5 px-5 bg-gray-200">
        <h1 className="text-center text-black">Convidar paciente</h1>
        <span className="justify-start text-sm text-gray-600">
          Link da sessão
        </span>{" "}
        <br />
        <textarea
          value={this.state.linkSessao}
          className="w-full px-3 py-3 my-3 text-gray-700 bg-gray-200 border border-gray-400 rounded js-copytextarea"
        >
          {this.state.linkSessao}
        </textarea>
        <div className="flex justify-around gap-4">
          {this.props.whatsapp ? (
            <button
              className="text-sm text-black"
              onClick={() =>
                this.sendMail(
                  this.props.email,
                  `${this.props.nome} - EMDR Consulta`,
                  `Seu link de acesso para a sessão com o psicólogo é ${this.state.linkSessao}`
                )
              }
            >
              {" "}
              Email
              {emailIcon}
            </button>
          ) : null}
          <button
            onClick={this.copyToClipboard}
            className="text-sm font-semibold js-textareacopybtn text-black"
          >
            {" "}
            Copiar
            {copyIcon}
          </button>
          {/* {this.props.whatsapp ? (
            <button
              className="text-sm text-black"
              onClick={() =>
                this.sendWhatsappMessage(
                  this.props.whatsapp,
                  `Olá ${this.props.nome}, Seu link de acesso para a sessão com o psicólogo é Link`
                )
              }
            >
              {" "}
              Whatsapp
              {whatsappIcon}
            </button>
          ) : null} */}
          {this.props.telegram ? (
            <a
              target="_blank"
              rel="noreferrer"
              className="text-sm text-black"
              href={`https://telegram.me/${this.props.telegram}`}
            >
              {" "}
              Telegram
              {telegramIcon}
            </a>
          ) : null}
        </div>
      </div>
    );
  }
}
