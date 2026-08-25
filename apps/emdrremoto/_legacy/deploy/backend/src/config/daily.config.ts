import { DailyConfig } from "../constants/daily.constants";

export const daily_config: DailyConfig = {
  daily_api_host: "https://api.daily.co/v1",
};

export const daily_room_config: DailyConfig = {
  room_expiration_time: 2, // * hours
  enable_chat: true,
  max_participants: 2,
};

export const daily_endpoints: DailyConfig = {
  meetingTokens: "/meeting-tokens",
  presence: "/presence",
  meetingData: "/meetings",
  logs: "/logs",
  rooms: "/rooms",
};
