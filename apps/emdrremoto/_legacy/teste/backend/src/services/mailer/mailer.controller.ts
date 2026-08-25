import mailgun from "mailgun-js";
import { config } from "dotenv";
import { Request, Response } from "express";
import { v4 } from "uuid";
import PsicologoRepository from "../../repository/psicologo-repository";

config();

const mg = mailgun({
  apiKey: process.env.MAILGUN_API_KEY!,
  domain: process.env.MAILGUN_DOMAIN!,
});

export default class MailerController {
  static async sendMail(to: string, subject: string, html: string) {
    const data = {
      from: process.env.MAILGUN_FROM!,
      to,
      subject,
      html,
    };

    try {
      const body = await mg.messages().send(data);
      console.log("Resposta do Mailgun:", body);
      return body;
    } catch (error) {
      console.error("Erro detalhado:", error);
      throw error;
    }
  }

  public sendMail = async (request: Request, response: Response) => {
    const { to, subject, code, nome } = request.body;

    const html = `
      <h3>Olá, ${nome}!</h3>
      <h4>Seu código para recuperar a senha é: ${code}</h4>
      <p>Atenciosamente,</p>
      <p>Equipe PSI</p>
    `;

    const responseEmail = await this._sendEmail({ to, subject, html });

    return response.status(responseEmail.error ? 500 : 200).send(responseEmail);
  };

  public sendMailLink = async (request: Request, response: Response) => {
    const { to, subject, nome_paciente, link } = request.body;

    const html = `
      <h3>Olá, ${nome_paciente}!</h3>
      <h4>Seu link de acesso para a sessão com o psicólogo é: <a href="${link}">${link}</a> .</h4>
      <p>Atenciosamente,</p>
      <p>Equipe PSI</p>
    `;

    const responseEmail = await this._sendEmail({ to, subject, html });

    return response.status(responseEmail.error ? 500 : 200).send(responseEmail);
  };

  public sendVerificationLink = async (request: Request, response: Response) => {
    const { to, subject, nome_psicologo, link } = request.body;

    const html = `
      <h3>Olá, ${nome_psicologo}, seja bem vindo(a) ao EMDR Remoto PSI!</h3>
      <h4>Para iniciar o sistema, é necessário validar seu endereço de e-mail: <a href="${link}">Validar meu e-mail</a> .</h4>
      <h4>Caso o link acima não funcione, utilize o endereço abaixo em seu navegador: ${link}</h4>
      <p>Atenciosamente,</p>
      <p>Equipe PSI</p>
    `;

    const responseEmail = await this._sendEmail({ to, subject, html });

    return response.status(responseEmail.error ? 500 : 200).send(responseEmail);
  };

  public sendPasswordCode = async (request: Request, response: Response) => {
    const { email } = request.body;
    const code = v4();
    const psicologo_repository = new PsicologoRepository();

    const psicologo: any = await psicologo_repository.searchForEmail(email);
    if (!psicologo) {
      return response.status(500).send({ error: true, error_message: 'Nenhum usuário com esse e-mail.' })
    }

    try {
      await psicologo_repository.update(psicologo.id, { codigo_recuperacao: code })
    } catch (err) {
      console.log("MailerController sendPasswordCode");
      console.log(err)
      return response.status(500).send({ error: true, error_message: 'Erro ao salvar código de recuperação' })
    }

    const subject = "Código de recuperação de senha";
    const html = `
      <h3>Olá, ${psicologo.nome}!</h3>
      <h4>Seu código para recuperar a senha é: ${code}</h4>
      <p>Atenciosamente,</p>
      <p>Equipe PSI</p>
    `

    const responseEmail = await this._sendEmail({ to: email, subject, html })

    return response.status(responseEmail.error ? 500 : 200).send(responseEmail);
  };

  private _sendEmail = async ({ to, subject, html }) => {
    console.log(`Enviando e-mail para "${to}"`, { subject });

    let mail_response;
    try {
      mail_response = await mg.messages().send({
        to,
        from: process.env.MAILGUN_FROM!,
        subject,
        html,
      });

      if (mail_response && mail_response.id) {
        return { error: false };
      }
    } catch (error) {
      console.log("MailerController _sendEmail");
      console.log(error);
      console.log("MAILGUN_FROM", process.env.MAILGUN_FROM);
      console.log("to", to);
      console.log("html", html);
      mail_response = error;
    };

    return { error: true, error_message: mail_response };
  };
}
