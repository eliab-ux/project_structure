import io, { Socket } from "socket.io-client";
import {serverConnectionConfigProduction} from "../config/server-connection.config";


export default class WebsocketServer {
  private ws_url: any;
  public socket: Socket;
  public current_user_type: null | string = null;

  constructor() {
    this.ws_url = serverConnectionConfigProduction.websocket_url;
    this.socket = io(this.ws_url, {
      transports: ["websocket"],
    });
  }

  run = (user_type: string, code:string) => {
    console.log(`WebsocketServer run user_type '${user_type}' code '${code}'`, this.socket)
    this.socket.on("connect", () => console.log(`[IO] ${user_type}  conectado`));
    this.socket.on("connect_error", (err:any) => {
      console.log(`WebsocketServer run connect_error ${err?.message}`, err);
    });

    this.current_user_type = user_type;
    const data_to_send = {
      session_code: code,
      user: {
        type: user_type,
      },
    };
    console.log(`WebsocketServer run user_type '${user_type}' code '${code}'`, data_to_send)
    this.socket.emit("join-session", data_to_send);
  };
}
