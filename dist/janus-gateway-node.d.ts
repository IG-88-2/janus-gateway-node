/// <reference types="node" />
import { JanusInstance } from "./janus-gateway-instance";
interface JanusRoom {
    room: string;
    description: string;
    pin_required: boolean;
    max_publishers: number;
    bitrate: number;
    fir_freq: number;
    require_pvtid: boolean;
    notify_joining: boolean;
    audiocodec: string;
    videocodec: string;
    record: boolean;
    num_participants: number;
}
interface Logger {
    info: (message: string) => void;
    error: (error: any) => void;
    json: (json: any) => void;
}
interface RoomState extends JanusRoom {
    room_id: string;
    instance_id: string;
    secret: string;
    pin?: string;
    participants?: any;
}
interface JanusInstanceOptions {
    protocol: string;
    address: string;
    port: number;
    adminPort: number;
    adminKey: string;
    server_name: string;
}
interface JanusOptions {
    instances: JanusInstanceOptions[];
    selectInstance?: (instances: JanusInstance[]) => JanusInstance;
    onError?: (error: any) => void;
    keepAliveTimeout?: number;
    syncInterval?: number;
    logger?: Logger;
    webSocketOptions?: any;
}
interface Response {
    type: string;
    load: any;
    transaction?: string;
}
export declare class Janus {
    options: JanusOptions;
    rooms: {
        [id: string]: RoomState;
    };
    handles: {
        [id: number]: any;
    };
    instances: {
        [id: string]: JanusInstance;
    };
    connections: {
        [id: string]: any;
    };
    sync: NodeJS.Timer;
    listening: boolean;
    statePath: string;
    keepAliveTimeout: number;
    syncInterval: number;
    count: number;
    notifyConnected: () => void;
    defaultWebSocketOptions: any;
    shouldDetach: boolean;
    logger: any;
    wss: any;
    t: any;
    constructor(options: JanusOptions);
    initialize: () => Promise<void>;
    terminate: () => Promise<void>;
    private getDuplicateIds;
    private synchronize;
    private transport;
    private onListening;
    private onError;
    private onTimeout;
    private onConnection;
    private onKeepAlive;
    private onMessage;
    private notify;
    private detachUserHandles;
    private onJanusEvent;
    private onUserMessage;
    getRooms: () => Promise<{
        type: string;
        load: RoomState[];
    }>;
    createRoom: (message: any) => Promise<Response>;
    destroyRoom: (message: any) => Promise<Response>;
    private writeState;
    getIceHandle: (user_id: string, room_id: string) => Promise<Response>;
    joinRoom: (user_id: any, message: any) => Promise<Response>;
    private onKick;
    onJoinAndConfigure: (user_id: any, message: any) => Promise<Response>;
    onConfigure: (message: any) => Promise<Response>;
    onPublish: (message: any) => Promise<Response>;
    onUnpublish: (message: any) => Promise<Response>;
    onHangup: (message: any) => Promise<Response>;
    onDetach: (message: any) => Promise<Response>;
    onLeave: (message: any) => Promise<Response>;
    onTrickle: (message: any) => Promise<Response>;
    onStart: (message: any) => Promise<Response>;
    private selectInstance;
    private getHandleUser;
    private isLocalHandle;
    private getPin;
    private getRoomId;
    private getSecret;
    private getUserId;
}
export {};
