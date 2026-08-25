import { Router } from "express";
import TwilioController from "./twilio.controller";

export default class TwilioRoutes {
    private endpoints: Object;
    public router: Router;
    private twilio_controller: TwilioController;
    constructor() {
        this.router = Router();
        this.twilio_controller = new TwilioController();
        this.endpoints = {
            /**
             * * Send Whatsapp Message
             */
            sendMessage: this.router.post(
                "/new-whatsapp-message",
                this.twilio_controller.sendWhatsappMessage
            ),
        };
    }
}
