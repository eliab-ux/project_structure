declare interface iWebSocketUser {
    id: string;
    type: string; //* psychologist | patient
}
declare interface iWebsocketRoom {
    id: string;
    psychologist: iWebSocketUser;
    patient: iWebSocketUser;
}

declare interface iAction {
    property: string;
    value: string;
}

declare interface iChatAction {
    message: string;
}

declare interface iListener {
    session: {
        connection: string;
        join_session: string;
        disconnect;
    };
    ball?: {
        handler: string;
    };
    chat?: {
        new_message: string;
        update_messages:string
    };
    audio?: {
        handler: string;
    };
}
