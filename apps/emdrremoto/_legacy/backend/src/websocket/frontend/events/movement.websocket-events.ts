import { Server as SocketServer, Socket } from "socket.io";
import SessionRepository from "../../../repository/session-repository";
import { MovementListeners, iListener, iAction } from "../../websocket.listeners-list";

export default class MovementWebSocketEvents {
    private io: SocketServer;
    private sessionRepository: SessionRepository;
    private ws_listeners: iListener;
    private socket: Socket;
    private socket_session_id: any
    constructor(
        io: SocketServer,
        socket: Socket,
        socket_session_id: string | boolean
    ) {
        this.io = io;
        this.ws_listeners = MovementListeners;
        this.socket = socket;
        this.sessionRepository = new SessionRepository();
        this.socket_session_id = socket_session_id;
    }
    listenEvents() {
        console.log(`👾 [MovementWebSocketEvents - listenEvents]: Socket`, this.socket?.id);
        /**
         * * Ball Handler
         */
        this.socket.on(
            "ball-handler",
            async (action: iAction) => {
                console.log(`👾 [MovementWebSocketEvents - listenEvents ball-handler]: Socket_session_id ${this.socket_session_id} connected.`, action);

                try {
                    if (!this.socket_session_id) {
                        console.log(`🚪 [MovementWebSocketEvents - listenEvents ball-handler]: No socket_session_id`, this.socket_session_id);
                        return false;
                    }

                    const session: any = await this.sessionRepository.readOneBySessionCode(this.socket_session_id);
                    if (!session || !session?.id) {
                        console.log(`🚪 [MovementWebSocketEvents - listenEvents ball-handler]: No session with code '${this.socket_session_id}'`);
                        return false;
                    }

                    this.io.to(session.paciente_socket_id).emit("ball-handler", action);
                } catch (search_session_error) {
                    console.log(`🚪 [MovementWebSocketEvents - listenEvents ball-handler]: Error socket_session_id '${this.socket_session_id}'`, search_session_error);
                }
            }
        );

        /**
         * * Audio Handler
         */
        this.socket.on(
            "audio-handler",
            async (action: iAction) => {
                console.log(`👾 [MovementWebSocketEvents - listenEvents audio-handler]: Socket_session_id ${this.socket_session_id} connected.`, action);

                try {
                    if (!this.socket_session_id) {
                        console.log(`🚪 [MovementWebSocketEvents - listenEvents audio-handler]: No socket_session_id`, this.socket_session_id);
                        return false;
                    }

                    const session: any = await this.sessionRepository.readOneBySessionCode(this.socket_session_id);
                    if (!session) {
                        console.error("not found");
                        console.log(`🚪 [MovementWebSocketEvents - listenEvents audio-handler]: No session with code '${this.socket_session_id}'`);
                        return false;
                    }
                    this.io
                        .to(session.paciente_socket_id)
                        .emit("audio-handler", action);
                } catch (search_session_error) {
                    console.error(search_session_error); // TODO emit not found session;
                    console.log(`🚪 [MovementWebSocketEvents - listenEvents audio-handler]: Error socket_session_id '${this.socket_session_id}'`, search_session_error);
                }
            }
        );
    }
}
