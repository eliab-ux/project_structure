export interface iListener {
    [key: string]: any;
}

export interface iAction {
    type?: string;
    [key: string]: any;
}

const SessionListeners: iListener = {
    session: {
        connection: "connection",
        join_session: "join-session",
        disconnect: "disconnect",
    },
};
const MovementListeners: iListener = {
    session: SessionListeners.session,
    ball: {
        handler: "ball-handler",
    },
    audio: {
        handler: "audio-handler",
    },
};

const ChatListeners: iListener = {
    session: SessionListeners.session,
    chat: {
        new_message: "new-message",
        update_messages: "update-messages",
    },
};
export { MovementListeners, SessionListeners, ChatListeners };
