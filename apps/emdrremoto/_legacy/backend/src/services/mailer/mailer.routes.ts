import { Router } from "express";
import MailerController from "./mailer.controller";

export default class MailerRoutes {
    private endpoints: Object;
    public router: Router;
    private mailer_controller: MailerController;
    constructor() {
        this.router = Router();
        this.mailer_controller = new MailerController();
        this.endpoints = {
            /**
             * * Send Whatsapp Message
             */
            sendMessage: this.router.post(
                "/send-email",
                this.mailer_controller.sendMail
            ),
            /**
             * Send email link
             */
            sendSessionLinkMessage: this.router.post(
                "/send-link-email",
                this.mailer_controller.sendMailLink
            ),
              /**
             * * Send Whatsapp Message
             */
               sendPassCode: this.router.post(
                "/send-code",
                this.mailer_controller.sendPasswordCode
            ),
            /**
             * * Send Verification mail
             */
            sendVerificationLink: this.router.post(
                "/send-verification-link",
                this.mailer_controller.sendVerificationLink
            ),
        };
    }
}
