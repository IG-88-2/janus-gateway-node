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
}
interface JanusOptions {
    generateId: () => string;
    retrieveContext: () => any;
    updateContext: (context: any) => any;
    selectInstance?: (instances: JanusInstance[]) => JanusInstance;
    generateInstances?: () => Promise<JanusInstanceOptions[]>;
    onError: (error: any) => void;
    keepAliveTimeout: number;
    syncInterval: number;
    logger: {
        info: (message: string) => void;
        error: (error: any) => void;
        json: (json: any) => void;
    };
    instancesAmount?: number;
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
    instancesAmount: number;
    dockerJanusImage: string;
    containersLaunched: boolean;
    notifyConnected: () => void;
    defaultWebSocketOptions: any;
    context: any;
    wss: any;
    constructor(options: JanusOptions);
    generateInstances: () => Promise<JanusInstanceOptions[]>;
    initialize: () => Promise<void>;
    terminate: () => Promise<void>;
    private launchContainers;
    private terminateContainers;
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
    private _selectInstance;
    private selectInstance;
    private getHandleUser;
    private isLocalHandle;
    private getPin;
    private getRoomId;
    private getSecret;
    private getUserId;
}
export {};
