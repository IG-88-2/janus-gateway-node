/// <reference types="node" />
import ReconnectingWebSocket from 'reconnecting-websocket';
export declare class JanusInstance {
    id: string;
    localHandleId: number;
    handles: {
        [handle_id: number]: string;
    };
    calls: {
        [id: string]: (response: any) => void;
    };
    adminCalls: {
        [id: string]: (response: any) => void;
    };
    ws: ReconnectingWebSocket;
    adminWs: ReconnectingWebSocket;
    keepAlive: NodeJS.Timer;
    usageMonitor: NodeJS.Timer;
    protocol: string;
    address: string;
    port: number;
    connected: boolean;
    adminConnected: boolean;
    sessionId: number;
    keepAliveInterval: number;
    usageMonitorInterval: number;
    transactionTimeout: number;
    adminPort: number;
    adminKey: string;
    adminSecret: string;
    activeHandles: number;
    server: string;
    logger: any;
    stats: {
        container: string;
        memusage: string;
        memperc: string;
        cpuperc: string;
    };
    notifyConnected: (error?: any) => void;
    notifyAdminConnected: (error?: any) => void;
    onDisconnected: () => void;
    onConnected: () => void;
    onMessage: (message: any) => void;
    _onError: (error: any) => void;
    constructor({ options, logger, onMessage, onDisconnected, onConnected, onError }: {
        options: any;
        logger: any;
        onMessage: any;
        onDisconnected: any;
        onConnected: any;
        onError: any;
    });
    private onError;
    connect: () => Promise<void>;
    disconnect: () => Promise<any>;
    private onAdminMessage;
    connectAdmin: () => Promise<void>;
    disconnectAdmin: () => void;
    private _onConnected;
    private _onDisconnected;
    private transaction;
    private adminTransaction;
    private transactionMatch;
    private getJanusError;
    private createSession;
    private claimSession;
    private onSession;
    private destroySession;
    private getStats;
    getStatus: () => Promise<any>;
    info: () => any;
    createRoom: (data: {
        description: string;
        secret: string;
        pin: string;
        bitrate: number;
        bitrate_cap: boolean;
        permanent: boolean;
        fir_freq: number;
        videocodec: string;
        vp9_profile: string;
        room: string;
    }) => Promise<any>;
    editRoom: (data: any) => Promise<any>;
    listHandles: () => any;
    handleInfo: (handle_id: string) => any;
    listRooms: () => Promise<any>;
    listParticipants: (room_id: string) => Promise<any>;
    destroyRoom: (data: {
        room: number;
        secret: string;
        handle_id: number;
    }) => Promise<any>;
    attach: (user_id?: string) => Promise<number>;
    join: (data: {
        user_id: string;
        room: string;
        handle_id: number;
        pin: string;
        secret: string;
        ptype: "publisher" | "subscriber";
        audiocodec?: string;
        videocodec?: string;
        feed?: number;
        display?: string;
    }) => Promise<any>;
    joinandconfigure: (data: {
        user_id: string;
        jsep: any;
        room: string;
        handle_id: number;
        pin: string;
        secret: string;
        ptype: "publisher" | "subscriber";
        audiocodec?: string;
        videocodec?: string;
        feed?: number;
    }) => Promise<any>;
    kick: (room: any, user_id: any, handle_id: any) => any;
    publish: (data: {
        jsep: any;
        room: string;
        handle_id: number;
        pin: string;
        secret: string;
        audiocodec?: string;
        videocodec?: string;
    }) => Promise<any>;
    start: (data: {
        answer: any;
        room: number;
        pin: string;
        secret: string;
        handle_id: number;
    }) => Promise<any>;
    configure: (data: {
        jsep?: any;
        room: number;
        handle_id: number;
        pin: string;
        secret: string;
        audiocodec?: string;
        videocodec?: string;
        ptype: "publisher" | "subscriber";
        audio: boolean;
        video: boolean;
    }) => Promise<any>;
    unpublish: (data: {
        handle_id: number;
        pin: string;
        secret: string;
    }) => Promise<any>;
    hangup: (handle_id: any) => Promise<any>;
    detach: (handle_id: any) => Promise<void>;
    leave: (handle_id: any) => Promise<any>;
    trickle: (candidate: any, handle_id: number) => Promise<any>;
    pause: ({}: {}) => Promise<any>;
}
