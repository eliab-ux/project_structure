import { Server as SocketServer, Socket } from "socket.io";
import SessionRepository from "../repository/session-repository";
import ChatWebSocketEvents from "./chat/chat.websocket-events";

import MovementWebSocketEvents from "./frontend/events/movement.websocket-events";
import { SessionListeners, iListener } from "./websocket.listeners-list";

export class WebSocket {
    private io: SocketServer;
    private ws_listeners: iListener;
    private sessionRepository: SessionRepository;
    private socket_session_id: string;
    private socket: Socket;
    public messages: any
    private connections: any

    constructor(io: SocketServer) {
        this.io = io;
        this.ws_listeners = SessionListeners;
        this.sessionRepository = new SessionRepository();
        this.connections = []
    }

    start() {
        console.log(`👾 [websocket - start]: Start.`);

        this.messages = {}
        this.io.on(
            "connection",
            (socket: Socket) => {
                console.log(`👾 [websocket - start connection]: Connected on Websocket Server.`);

                this.socket = socket;
                const { id } = this.socket;

                console.log(`👾 [websocket - start connection]: User '${id}' connected on Websocket Server.`);

                /**
                 * * Join Session
                 */
                this.socket.on(
                    "join-session",
                    async ({session_code, user}) => {
                        const type = user?.type || ""

                        try {
                            console.log(`👾 [websocket - start join-session]: Session '${session_code}' and User type '${type}'`, user);

                            if (!session_code || !user) {
                                console.log(`🚪 [websocket - start join-session]: No session_code or user`, session_code, user);
                                return false;
                            }

                            if (type != "paciente" && type != "psicologo") {
                                console.log(`🚪 [websocket - start join-session]: User type '${type}' not allowed`, session_code, user);
                                return false;
                            }

                            const session: any = await this.sessionRepository.readOneBySessionCode(session_code);
                            if (!session || !session?.id) {
                                console.log(`🚪 [websocket - start join-session]: No session with code '${session_code}'`);
                                return false;
                            }

                            const body = {}
                            body[`${user.type}_in`] = new Date(new Date().getTime() - (3 * 60 * 60 * 1000))
                            await this.sessionRepository.updateOneBySessionId(session_code, body);

                            await this.sessionRepository.update(session.id, { [`${type}_socket_id`]: id });
                            console.log(`👾 [websocket - start join-session]: Updated session '${session_code}' to session_id '${session?.session_id}'`, session.id);

                            this.listenEvents(session_code, this.messages)
                        } catch (search_session_error) {
                            console.log(`🚪 [websocket - start join-session]: Error session_code '${session_code}' user type '${type}'`, search_session_error);
                        }
                    }
                );

                this.socket.on('user-joined', async ({codigo}) => {
                    try {
                        console.log(`👾 [websocket - start user-joined]: Session '${codigo}'`);

                        if (!codigo) {
                            console.log(`🚪 [websocket - start user-joined]: No code`, codigo);
                            return false;
                        }

                        const daily_api = process.env.DAILY_CO_API
                        const code = codigo.replace(`${daily_api}/`, "")
                        console.log(`👾 [websocket - start user-joined]: code '${code}'`);

                        if (!this.connections[code])
                            this.connections[code] = []

                        const session: any = await this.sessionRepository.readOneBySessionCode(code);
                        if (!session) {
                            console.log(`🚪 [websocket - start user-joined]: No session with code '${code}'`);
                            return false;
                        }

                        this.connections[code].push(id)
                        if (this.connections[code].length < 2) {
                            console.log(`🚪 [websocket - start user-joined]: No minimum user code '${code}'`, this.connections[code]);
                            return false;
                        }

                        this.io.to(session.psicologo_socket_id).emit('start-cron', {paciente: session.paciente.nome})
                        this.io.to(session.paciente_socket_id).emit('start-cron')
                    } catch (error) {
                        console.log(`🚪 [websocket - start user-joined]: Error session_code '${codigo}'`, error);
                    }
                })

                this.socket.on('end-call', async ({code}) => {
                    try {
                        console.log(`👾 [websocket - start end-call]: Session '${code}'`);

                        if (!code) {
                            console.log(`🚪 [websocket - start end-call]: No code`, code);
                            return false;
                        }
                        const session: any = await this.sessionRepository.readOneBySessionCode(code);
                        if (!session || !session?.id) {
                            console.error("not found");
                            console.log(`🚪 [websocket - start end-call]: No session with code '${code}'`);
                            return false;
                        }

                        console.log(`👾 [websocket - start end-call]: End session '${code}'`, session);
                        const data = {
                            session_out: new Date(new Date().getTime() - (3 * 60 * 60 * 1000)),
                        }
                        await this.sessionRepository.updateOneBySessionId(code, data);

                        this.io.to(session.psicologo_socket_id).emit('end-call')
                        this.io.to(session.paciente_socket_id).emit('end-call')
                    } catch (error) {
                        console.log(`🚪 [websocket - start end-call]: Error session_code '${code}'`, error);
                    }
                })

                this.socket.on("disconnect", () => {
                    this.messages = []
                    this.connections = {}
                    console.log(`👾 [websocket - start disconnect]: User ${id} disconnected from Websocket Server.`)
                });
            }
        );
    }

    listenEvents(socket_session_id, messages) {
        console.log(`👾 [websocket listenEvents]: Socket '${this.socket?.id}' socket_session_id '${socket_session_id}' messages`, messages)
        /**
         * * Chat Events Listeners
         */
        new ChatWebSocketEvents(
            this.io,
            this.socket,
            socket_session_id,
            messages
        ).listenEvents();
        
        /**
         * * Movement Events Listeners
         */

        new MovementWebSocketEvents(
            this.io,
            this.socket,
            socket_session_id
        ).listenEvents();
    }
}
