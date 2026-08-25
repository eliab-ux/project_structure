import DailyService, { iDailyServiceReturn } from "./daily.service";
import { Request, Response } from "express";
import repositories from "../../repository/init";
import {config} from 'dotenv'

config();

export default class DailyController {
  private daily_service: DailyService;
  constructor() {
    this.daily_service = new DailyService();
  }
  createRoom = async (req: Request, res: Response) => {
    const { error, data }: iDailyServiceReturn =
      await this.daily_service.createRoom();
    
    const session_repo = new repositories.SessionRepository();
    const session_code = data.url.split('/')[3]
    const session_data = {
      session_id: data.id,
      psicologo: req.body.psicologo,
      paciente: req.body.paciente,
      session_code,
      daily_co_name: data.name
    }
    const new_session = await session_repo.create(session_data);

    return res.status(error ? 500 : 200).send(new_session);
  };

  allRooms = async (req: Request, res: Response) => {
    const { error, data }: iDailyServiceReturn =
      await this.daily_service.allRooms();

    return res.status(error ? 500 : 200).send(data);
  };
  meetingInfo = async (req: Request, res: Response) => {
    const { error, data }: iDailyServiceReturn =
      await this.daily_service.meetingInfo();

    return res.status(error ? 500 : 200).send(data);
  };
  deleteAllRooms = async (req: Request, res: Response) => {
    const { error, data }: iDailyServiceReturn =
      await this.daily_service.allRooms();
    for (const { name } of data.rooms) {
      try {
        await this.daily_service.deleteRoom(name);
        console.log(`room ${name} deleted`);
      } catch (delete_room_error) {
        console.error(delete_room_error.error);
      }
    }
    return res.status(error ? 500 : 200).send(data);
  };
  deleteRoom = async (req: Request, res: Response) => {
    const { error, data }: iDailyServiceReturn =
      await this.daily_service.deleteRoom(req.params.room_name);

      return res.status(error ? 500 : 200).send(data);
  };
}
