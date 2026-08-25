const dotenv = require("dotenv");
dotenv.config();

const {
  REACT_APP_API_URL,
  REACT_APP_CREATE_ROOM_URL,
  REACT_APP_WEBSOCKET_URL,
  REACT_APP_DAILY_CO_API,
} = process.env;

const serverConnectionConfigProduction = {
  api_url: REACT_APP_API_URL,
  create_room_url: REACT_APP_CREATE_ROOM_URL,
  websocket_url: REACT_APP_WEBSOCKET_URL,
  daily_co_api: REACT_APP_DAILY_CO_API,
};

export { serverConnectionConfigProduction };
