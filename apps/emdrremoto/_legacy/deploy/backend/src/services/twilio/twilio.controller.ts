import { Twilio } from "twilio";
import {config} from 'dotenv'
import {Request, Response} from "express";
config();

export default class TwilioController{
    private from:string;
    private auth_token:string
    private account_sid:string
    private twilio_client: Twilio
    constructor() {
        this.auth_token = process.env.TWILIO_AUTH_TOKEN;
        this.account_sid = process.env.TWILIO_ACCOUNT_SID;
        this.from = "whatsapp:"+process.env.TWILIO_FROM_NUMBER;
        this.twilio_client = new Twilio(this.account_sid, this.auth_token);
    }

    public sendWhatsappMessage = async (request: Request, response: Response) => {
        let {to, message} = request.body;
        to = "whatsapp:+"+to;
        console.log(to)
        console.log(this.from)
        console.log(message)
        const message_data = {
            from: this.from,
            to,
            body: message
        };
        try{
            await this.twilio_client.messages.create(message_data)
            return response.status(200).send({error:false});
        }catch(twilio_client_err){
            console.log(twilio_client_err)
            return response.status(500).send({error:true, error_message: twilio_client_err});
        }
    }
}