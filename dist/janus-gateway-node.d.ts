/// <reference types="node" />
import { JanusInstance } from "./janus-gateway-instance";
interface RoomContext {
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
    ps: NodeJS.Process;
}
interface JanusOptions {
    instances: JanusInstanceOptions[];
    getId: () => string;
    retrieveContext: () => any;
    updateContext: (context: any) => any;
    selectInstance: (instances: JanusInstance[]) => JanusInstance;
    onError: (error: any) => void;
    logger: {
        info: (message: string) => void;
        error: (error: any) => void;
        json: (json: any) => void;
    };
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
        [id: string]: RoomContext;
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
    stats: {
        [id: string]: any;
    };
    sync: NodeJS.Timer;
    listening: boolean;
    contextPath: string;
    keepAliveTimeout: number;
    syncInterval: number;
    count: number;
    notifyConnected: () => void;
    defaultWebSocketOptions: any;
    context: any;
    wss: any;
    constructor(options: JanusOptions);
    initialize: () => Promise<void>;
    terminate: () => Promise<void>;
    private synchronize;
    private transport;
    private onError;
    private onTimeout;
    private onConnection;
    private onMessage;
    private notify;
    private detachUserHandles;
    private onKeepAlive;
    private onJanusEvent;
    private onUserMessage;
    createRoom: (message: any) => Promise<Response>;
    destroyRoom: (message: any) => Promise<Response>;
    getIceHandle: (user_id: string, room_id: string) => Promise<Response>;
    joinRoom: (message: any) => Promise<Response>;
    onConfigure: (message: any) => Promise<Response>;
    onJoinAndConfigure: (message: any) => Promise<Response>;
    onPublish: (message: any) => Promise<Response>;
    onUnpublish: (message: any) => Promise<Response>;
    onHangup: (message: any) => Promise<Response>;
    onDetach: (message: any) => Promise<Response>;
    onLeave: (message: any) => Promise<Response>;
    onTrickle: (message: any) => Promise<Response>;
    onStart: (message: any) => Promise<Response>;
    private _selectInstance;
    private selectInstance;
    private getHandleUser;
    private getPin;
    private getRoomId;
    private getSecret;
    private getUserId;
}
export {};
