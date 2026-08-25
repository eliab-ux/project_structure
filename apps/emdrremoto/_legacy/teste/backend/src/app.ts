import express from "express";
import { json } from "body-parser";
import cors from "cors";
import DailyRoutes from "./services/daily.co/daily.routes";
import cron from "node-cron";
import axios from "axios";

const app = express();

import routes from "./routes/routes";
import path = require("path");
import AuthControllers from "./controllers/auth-controllers";
import TwilioRoutes from "./services/twilio/twilio.routes";
import MailerRoutes from "./services/mailer/mailer.routes";

import SessionRepository from "./repository/session-repository";
const sessionRepository = new SessionRepository();

app.use(cors());
app.use(json());

// * Alunos files


Object.keys(routes).forEach((route) =>
  app.use('/emdr-api' + routes[route]["endpoint"], routes[route]["router"])
);
const daily_routes: DailyRoutes = new DailyRoutes();
app.use('/emdr-api' + "/daily", daily_routes.router);

const twilio_routes: TwilioRoutes = new TwilioRoutes();
app.use('/emdr-api' + '/twilio', twilio_routes.router);

const mailer_routes: MailerRoutes = new MailerRoutes()
app.use('/emdr-api' + '/mailer', mailer_routes.router)

const auth_controllers = new AuthControllers()
app.post('/emdr-api' + '/auth/token',auth_controllers.verifyToken)
app.post('/emdr-api' + '/auth/token/data',auth_controllers.getTokenData)

cron.schedule('* * * * *', async () => {
  try {
    const roomsData = await axios.get('https://emdrremoto.com.br/emdr-api/daily/all-rooms');
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const oldRooms: any[] = roomsData.data.rooms.filter(room => new Date(room.created_at) <= tenMinutesAgo);
    const meetingInfo = await axios.get('https://emdrremoto.com.br/emdr-api/daily/meeting-info/');

    const oldRoomNames = new Set(oldRooms.map(room => room.name));
    const roomsToDelete = new Set<string>();

    meetingInfo.data.meetings.forEach((meeting: any) => {
      if (!meeting.ongoing && oldRoomNames.has(meeting.room)) {
        roomsToDelete.add(meeting.room);
      }
    });

    const roomsArray = Array.from(roomsToDelete);

    for (let room of roomsArray) {
      try {
        const ret = await sessionRepository.deleteByRoomName(room);
        console.log(`Sala deletada: ${room}, reg. afetados: ${ret.affected}`); 
        await axios.delete(`https://emdrremoto.com.br/emdr-api/daily/rooms/${room}`);
      } catch (error) {
        if (error.response?.status === 404) {
          console.warn(`Sala ${room} já havia sido deletada na Daily.co.`);
        } else {
          console.error(`Erro ao deletar sala ${room}:`, error.message);
        }
      }
    }
  } catch (error) {
    console.error("Erro no cron job:", error.message);
  }
});

export default app;
