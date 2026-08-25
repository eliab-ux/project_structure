import {
  daily_config,
  daily_room_config,
  daily_endpoints,
} from "../../config/daily.config";
import * as short_uuid from "short-uuid";

import "../../config/daily.config";
import ApiService from "../api.service";
import TimeHandler from "../../utils/timehandler.utils";

export interface iDailyServiceReturn {
  error: boolean;
  data: any;
}

export default class DailyService {
  private apiService: ApiService;
  private timeHandler: TimeHandler;
  constructor() {
    this.apiService = new ApiService();
    this.timeHandler = new TimeHandler();
  }
  /**
   * * Create a new room
   * @returns Created Room information
   */
  async createRoom(): Promise<iDailyServiceReturn> {
    const expires: number = this.timeHandler.dateToTimestamp(
      daily_config.room_time_expiration
    );
    const room_name: string = short_uuid.generate();
    const properties: object = {
      exp: expires,
      enable_chat: daily_room_config.chat,
      max_participants: daily_room_config.max_participants,
    };
    try {
      const daily_create_room_response: any = await this.apiService.RequestData(
        "POST",
        daily_endpoints.rooms,
        "",
        { name: room_name, properties }
      );
      return { error: false, data: daily_create_room_response };
    } catch (daily_create_room_response_error) {
      console.error(daily_create_room_response_error);
      return { error: true, data: daily_create_room_response_error.error };
    }
  }
  /**
   * Lists all created rooms
   * @returns All created Rooms
   */
  async allRooms(): Promise<iDailyServiceReturn> {
    try {
      const all_created_rooms: any = await this.apiService.RequestData(
        "GET",
        daily_endpoints.rooms
      );
      return {
        error: false,
        data: {
          total_rooms: all_created_rooms.total_count,
          rooms: all_created_rooms.data,
        },
      };
    } catch (daily_all_rooms_response_error) {
      return { error: true, data: daily_all_rooms_response_error.error };
    }
  }
  /**
   *
   * @param room_name short uuid generated name
   * @param exp unix timestamp token expiration
   * @returns created token information
   */
  async createRoomToken(
    room_name: string,
    exp: number
  ): Promise<iDailyServiceReturn> {
    try {
      const properties: { [key: string]: string | number } = {
        room_name,
        exp,
      };
      const { token }: any = await this.apiService.RequestData(
        "POST",
        daily_endpoints.meetingTokens,
        "",
        { properties }
      );
      return { error: false, data: token };
    } catch (daily_create_room_token_response_erro) {
      console.error(daily_create_room_token_response_erro);
      return { error: true, data: daily_create_room_token_response_erro.error };
    }
  }
  /**
   *
   * @param room_name short uuid generated name
   * @returns specific room information
   */
  async meetingInfo(room_name: string = ""): Promise<iDailyServiceReturn> {
    if (room_name !== "") room_name = `room=${room_name}`;
    try {
      const all_meetings: any = await this.apiService.RequestData(
        "GET",
        daily_endpoints.meetingData,
        "",
        "",
        room_name
      );
      return {
        error: false,
        data: {
          total_meetings: all_meetings.total_count,
          meetings: all_meetings.data,
        },
      };
    } catch (daily_all_mettings_response_error) {
      return { error: true, data: daily_all_mettings_response_error.error };
    }
  }

  async deleteRoom(room_name: string): Promise<iDailyServiceReturn> {
    try {
      const delete_room = await this.apiService.RequestData(
        "DELETE",
        daily_endpoints.rooms,
        room_name
      );
      return { error: false, data: delete_room };
    } catch (daily_delete_room_error) {
      return { error: true, data: daily_delete_room_error.error };
    }
  }
}
