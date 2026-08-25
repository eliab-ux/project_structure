import { Server as SocketServer, Socket } from "socket.io";
import SessionRepository from "../../repository/session-repository";
import { ChatListeners, iListener, iAction } from "../websocket.listeners-list";

export default class ChatWebSocketEvents {
    private io: SocketServer;
    private sessionRepository: SessionRepository;
    private ws_listeners: iListener;
    private socket: Socket;
    private socket_session_id: string;
    private messages: any;
    constructor(io: SocketServer, socket: Socket, socket_session_id: string, messages: any) {
        this.io = io;
        this.ws_listeners = ChatListeners;
        this.socket = socket;
        this.sessionRepository = new SessionRepository();
        this.socket_session_id = socket_session_id;
        this.messages = messages
    }
    listenEvents() {
        console.log(`👾 [ChatWebSocketEvents - listenEvents]: Socket`, this.socket?.id);

        const { id } = this.socket;
        /**
         * * Chat Handler
         */
        this.socket.on("new-message",
            async (action: any) => {
                console.log(`👾 [ChatWebSocketEvents - listenEvents new-message]: Socket_session_id ${this.socket_session_id} connected.`, action);

                try {
                    if (!this.socket_session_id) {
                        console.log(`🚪 [ChatWebSocketEvents - listenEvents new-message]: No socket_session_id`, this.socket_session_id);
                        return false;
                    }

                    const session: any = await this.sessionRepository.readOneBySessionCode(this.socket_session_id);
                    if (!session || !session?.id) {
                        console.log(`🚪 [ChatWebSocketEvents - listenEvents new-message]: No session with code '${this.socket_session_id}'`);
                        return false;
                    }

                    console.log(`👾 [ChatWebSocketEvents - listenEvents new-message]: Socket_session_id ${this.socket_session_id} session.`, session, Object.entries(session));

                    this.messages.push(action);
                    console.log(`👾 [ChatWebSocketEvents - listenEvents new-message]: Socket_session_id ${this.socket_session_id} messages.`, this.messages);

                    const [user_type, recipient_id]: any = Object.entries(session).filter(([key, value]) => value !== id && key.endsWith("_socket_id"))[0];
                    console.log(`👾 [ChatWebSocketEvents - listenEvents new-message]: Socket_session_id ${this.socket_session_id} user_type, recipient_id.`, user_type, recipient_id);
                    let user_category = user_type.split('_')[0]

                    if(user_category == 'paciente'){
                        user_category = 'psicologo'
                    }else{
                        user_category = 'paciente'
                    }
                    action.message['nome'] = user_category
                    this.io
                        .to(recipient_id)
                        .emit("new-message", action);
                } catch (search_session_error) {
                    console.log(`🚪 [ChatWebSocketEvents - listenEvents new-message]: Error socket_session_id '${this.socket_session_id}'`, search_session_error);
                    return false
                }
             
            }
        );

        this.socket.on("update-messages", () => {
            console.log(`👾 [ChatWebSocketEvents - listenEvents update-messages]: Socket_session_id ${this.socket_session_id} messages.`, this.messages);
            this.io.to(id).emit("update-messages", this.messages)
        })

    }
}
