import { Server as SocketServer } from "socket.io";
import { createServer, Server } from "http";
import * as dotenv from "dotenv";
import { WebSocket } from "./websocket";

dotenv.config();

export default class WebsocketServer {
    private server: Server;
    private io: SocketServer;

    constructor() {
        this.server = createServer();
        this.io = new SocketServer(this.server, {
            cors: {
                origin: "*",
                allowedHeaders: "Content-Type"
            },
        });
    }

    run = () => {
        const web_socket = new WebSocket(this.io);
        web_socket.start();

        const port = process.env.WEBSOCKET_PORT;
        this.server.listen(port, () => console.log(`🤝 [websocket server]: WebSocket server running at: ${port}`));
    };
}
