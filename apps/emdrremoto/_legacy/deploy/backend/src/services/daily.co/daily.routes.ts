import { Router } from "express";
import DailyController from "./daily.controller";

export default class DailyRoutes {
  private endpoints: Object;
  public router: Router;
  private daily_controller: DailyController;
  constructor() {
    this.router = Router();
    this.daily_controller = new DailyController();
    this.endpoints = {
      /**
       * * Creates a new Room
       */
      createRoom: this.router.post(
        "/new-room",
        this.daily_controller.createRoom
      ),
      /**
       * * Lists all rooms
       */
      allRooms: this.router.get("/all-rooms", this.daily_controller.allRooms),
      /**
       * * Specific meeting information
       */
      meetingInfo: this.router.get(
        "/meeting-info/:room_name?",
        this.daily_controller.meetingInfo
      ),
      deleteAllRooms: this.router.delete(
        "/delete-all-rooms",
        this.daily_controller.deleteAllRooms
      ),
      deleteRoom: this.router.delete(
        "/rooms/:room_name",
        this.daily_controller.deleteRoom
      )
    };
  }
}
