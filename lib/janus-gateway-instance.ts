import { v1 as uuidv1 } from 'uuid';
import { logger } from './logger';
import ReconnectingWebSocket from 'reconnecting-websocket';
const WebSocket = require('ws');



class JanusInstance {
	id:string
	localHandleId:number
	handles:{ [handle_id:number]: string }
	calls:{ [id:string]: (response:any) => void }
	adminCalls:{ [id:string]: (response:any) => void }
	ws:ReconnectingWebSocket
	adminWs:ReconnectingWebSocket
	keepAlive:NodeJS.Timer
	ps:NodeJS.Process
	protocol:string
	address:string
	port:number
	connected:boolean
	adminConnected:boolean
	sessionId:number
	keepAliveInterval:number
	transactionTimeout:number
	adminPort:number
	adminKey:string
	adminSecret:string
	activeHandles:number
	server:string
	notifyConnected:() => void
	notifyAdminConnected:() => void
	onDisconnected:() => void
	onConnected:() => void
	onMessage:(message:any) => void
	_onError:(error:any) => void
	logger

	

	constructor({
		options,
		onMessage,
		onDisconnected,
		onConnected,
		onError
	}) {
		
		this.onMessage = onMessage;
		this.onDisconnected = onDisconnected;
		this.onConnected = onConnected;
		this._onError = onError;
		
		const {
			protocol,
			address,
			port,
			adminPort,
			adminKey,
			adminSecret,
			server_name,
			ps
		} = options;
		
		this.id = server_name;
		this.ps = ps;
		
		this.adminKey = adminKey;
		this.adminSecret = adminSecret;
		this.handles = {};
		this.calls = {};
		this.adminCalls = {};
		this.protocol = protocol;
		this.address = address;
		this.port = port;
		this.sessionId = null;
		this.ws = null;
		this.connected = false;
		this.keepAliveInterval = 5000;
		this.transactionTimeout = 10000;
		this.adminPort = adminPort;
		this.server = `${this.protocol}://${this.address}:${this.port}`;
		this.logger = logger;
	}



	private onError = (error, location) => {

		if (this._onError) {
			this._onError(error); 
		}

		this.logger.error(`${location} ${error.message}`);

	}



	public connect = () : Promise<void> => {
		
		this.ws = new ReconnectingWebSocket(
			this.server , 
			'janus-protocol',
			{
				WebSocket,
				connectionTimeout: 3000,
				maxRetries: 100
			}
		);

		this.ws.addEventListener('message', (response:MessageEvent) => {
			
			let message = null;
			
			try {
				message = JSON.parse(response.data);
			} catch(error) {}

			if (message) { 
				const id = message.transaction;
				const resolve = this.calls[id];

				if (resolve) {
					resolve(message);
				}
				this.onMessage(message);
			}

		});
		
        this.ws.addEventListener('close', () => {
			
			this._onDisconnected();

		});

		this.ws.addEventListener('open', () => {
			
			this._onConnected();
			
		});

		this.ws.addEventListener('error', error => {
			
			this.onError(error, 'ws error');

		});

		return new Promise((resolve) => {

			this.notifyConnected = () => {
				
				resolve();
				
			};

		});
		
	}



	public disconnect = () => {
		
		this.handles = {};

		this.calls = {};

		this.disconnectAdmin();

		return this.destroySession();

	}



	public connectAdmin = () : Promise<void> => {
		
		const server = `${this.protocol}://${this.address}:${this.adminPort}`;
		
		this.adminWs = new ReconnectingWebSocket(
			server, 
			'janus-admin-protocol',
			{
				WebSocket,
				connectionTimeout: 3000,
				maxRetries: 100
			}
		);

		this.adminWs.addEventListener('message', (response:MessageEvent) => {
			
			let message = null;

			try {
				message = JSON.parse(response.data);
			} catch(error) {}

			if (message) { 
				const id = message.transaction;
				const resolve = this.adminCalls[id];
				if (resolve) {
					resolve(message);
				}
			}

		});
		
        this.adminWs.addEventListener('close', () => {
			
			this.adminConnected = false;

		});

		this.adminWs.addEventListener('open', () => {
			
			this.adminConnected = true;

			if (this.notifyAdminConnected) {
				this.notifyAdminConnected();
				delete this.notifyAdminConnected;
			}

		});

		this.adminWs.addEventListener('error', error => {
			
			this.onError(error, 'admin ws error');

		});

		return new Promise((resolve) => {

			this.notifyAdminConnected = () => {
				
				resolve();

			};

		});
		
	}



	public disconnectAdmin = () => {
		
		this.adminCalls = {};

		if (this.adminWs) {
			this.adminWs.close();
		}

	}



	private _onConnected = async () => {
		
		this.connected = true;
		
		let response = null;

		if (this.sessionId) {
			response = await this.claimSession();
		} else {
			response = await this.createSession();
		}

		this.onSession(response);

		const handleId = await this.attach();

		this.localHandleId = handleId;
		
		await this.connectAdmin();

		const { name } = await this.info();

		this.id = name;

		if (this.notifyConnected) {
			this.notifyConnected();
			delete this.notifyConnected;
		}

		this.onConnected();

	}



	private _onDisconnected = () => {
		
		this.connected = false;

		this.onDisconnected();

	}



	private transaction = (request) => {
		
		const timeout = this.transactionTimeout;

		const id = uuidv1();

		request.transaction = id;
		
		if (this.sessionId) {
			request.session_id = this.sessionId;
		}

		let r = null;
		let p = null;
		
		try {
			r = JSON.stringify(request);
		} catch(error) {
			return Promise.reject(error);
		}
		
		p = new Promise((resolve, reject) => {
			
			let t = null;

			if (timeout) {
				t = setTimeout(() => {
					delete this.calls[id];
					const error = new Error(`${request.janus} - timeout`);
					reject(error);
				}, timeout);
			}

			const f = (message:any) => {
				
				let done = this.transactionMatch(id, request, message);
				
				if (done) {
					if (timeout){
						clearTimeout(t);
					}
					
					delete this.calls[id];

					const error = this.getJanusError(request, message);
					
					if (error) {
						this.logger.error(`transaction ${id} failed ${error.message}`);
						reject(error);
					} else {
						resolve(message);
					}
				}

			};
			
			this.calls[id] = f;

		});
		
		this.ws.send(r);

		return p;

	}



	private adminTransaction = (request) => {

		const timeout = this.transactionTimeout;

		const id = uuidv1();

		request.transaction = id;
		
		request.admin_secret = this.adminSecret;

		let r = null;
		let p = null;
		
		try {
			r = JSON.stringify(request);
		} catch(error) {
			return Promise.reject(error);
		}
		
		p = new Promise((resolve, reject) => {
			
			let t = null;

			if (timeout) {
				t = setTimeout(() => {
					delete this.adminCalls[id];
					const error = new Error(`${request.janus} - timeout`);
					reject(error);
				}, timeout);
			}

			const f = (message:any) => {
				
				let done = this.transactionMatch(id, request, message);
				
				if (done) {
					if (timeout){
						clearTimeout(t);
					}
					
					delete this.adminCalls[id];
					
					const error = this.getJanusError(request, message);
					
					if (error) {
						this.logger.error(`admin transaction ${id} failed ${error.message}`);
						reject(error);
					} else {
						resolve(message);
					}
					
				}

			};
			
			this.adminCalls[id] = f;
			

		});
		
		this.adminWs.send(r);
		
		return p;

	}



	private transactionMatch = (id:string, request:any, response:any) => {

		let done = false;

		if (request.janus==="keepalive") {
			done = response.transaction === id;
		} else if (request.janus==="trickle") {
			done = response.transaction === id;
		} else {
			done = response.transaction===id && response.janus!=="ack";
		}

		return done;

	}



	private getJanusError = (request, response) => {

		let error = `${request.janus} \n`;

		if (this.sessionId) {
			error += this.sessionId;
			error += `\n`;
		}

		if (request.body && request.body.request) {
			error += request.body.request;
			error += `\n`;
		} 

		if (response.janus===`error`) {
			error += `${response.error.code} \n ${response.error.reason} \n`;
			const e = new Error(error);
			return e;
		} else if(
			response.plugindata && 
			response.plugindata.data &&
			response.plugindata.data.error
		) {
			error += `${response.plugindata.data.error_code} \n ${response.plugindata.data.error} \n`;
			const e = new Error(error);
			return e;
		} else if(response.janus===`timeout`) {
			error += `timeout`;
			const e = new Error(error);
			return e;
		}
		
		return null;

	}



	private createSession = () : Promise<any> => {
		
		const request : any = {
			janus : "create"
		};
		
		return this.transaction(request);

	}



	private claimSession = () => {
		
		const request : any = {
			janus : "claim",
			session_id : this.sessionId
		};
		
		return this.transaction(request);

	}



	private onSession = (response:any) => {
			
		this.sessionId = response.data.id;

		if (this.keepAlive) {
			clearInterval(this.keepAlive);
		}
		
		this.keepAlive = setInterval(() => {

			this.transaction({
				janus: "keepalive"
			})
			.catch((error) => {
				this.onError(error, 'keepalive error');
			});
			
		}, this.keepAliveInterval);

	}



	private destroySession = () => {
		
		return this.transaction({
			janus: "destroy"
		})
		.then((response) => {
			
			this.sessionId = null;

			this.handles = {};

			this.ws.close();
			
			if (this.keepAlive) {
				clearInterval(this.keepAlive);
				this.keepAlive = undefined;
			}

			return response;
			
		});
		
	}



	public getStatus = () => {
		
		const request : any = {
			janus: "get_status"
		};
		
		return this.transaction(request);

	}



	public info = () => {

		const request : any = {
			janus: "info"
		};
		
		return this.adminTransaction(request);

	}



	public createRoom = (data : {
		description:string,
		secret:string,
		pin:string,
		room:string
	}) => {

		const {
			secret,
			pin,
			room
		}  = data;

		const request : any = {
			janus: "message",
			handle_id: this.localHandleId,
			description: data.description,
			body: {
				request: "create",
				room,
				permanent: false,
				is_private: false,
				admin_key: this.adminKey
			}
		};

		if (secret) {
			request.body.secret = secret;
		}
		
		if (pin) {
			request.body.pin = pin;
		}

		return this.transaction(request);
		
	}



	public editRoom = (data) => {
		
		const {
			secret,
			new_secret,
			new_pin,
			pin,
			room_id,
			handle_id
		}  = data;

		const request : any = {
			janus: "message", 
			handle_id: handle_id,
			body: {
				request : "edit",
				room : room_id,
				secret,
				new_secret,
				new_pin
			}
		};
		
		return this.transaction(request);
		
	}



	public listHandles = () => {
		
		const request = {
			janus: "list_handles"
		};

		if (this.sessionId) {
			request['session_id'] = this.sessionId;
		}

		return this.adminTransaction(request);

	}



	public handleInfo = (handle_id: string) => {
		
		const request = {
			janus: "handle_info", 
			handle_id
		};

		if (this.sessionId) {
			request['session_id'] = this.sessionId;
		}

		return this.adminTransaction(request);

	}
	

	public listRooms = () => {
		
		const request = {
			janus: "message", 
			handle_id: this.localHandleId,
			body: {
				request : "list"
			}
		};

		return this.transaction(request);

	}



	public listParticipants = (room_id: string) => {
		
		const request = {
			janus: "message", 
			handle_id: this.localHandleId,
			body: {
				request: "listparticipants",
				room: room_id
			}
		};

		return this.transaction(request)
		.then((result:any) => {

			return result.plugindata.data;

		});

	}
	


	public destroyRoom = (data : {
		room:number,
		secret:string,
		handle_id:number
	}) => {

		const {
			room,
			secret,
			handle_id
		} = data;
		
		const request : any = {
			janus: "message",
			handle_id: handle_id,
			body: {
				request: "destroy",
				room,
				secret,
				permanent: true,
				admin_key: this.adminKey
			}
		};
		
		return this.transaction(request);

	}



	public attach = (user_id?:string) : number => {

		const opaqueId = uuidv1();

		return this.transaction({
			janus: "attach",
			plugin: "janus.plugin.videoroom", 
			opaque_id: opaqueId
		})
		.then((response) => {
			
			const handleId = response.data.id;
			
			if (user_id) {
				this.handles[handleId] = user_id;
			}

			return handleId;
			
		});

	};



	public join = (data : {
		room: string, 
		handle_id: number, 
		pin: string, 
		secret: string,
		ptype: "publisher" | "subscriber",
		audiocodec?: string,
		videocodec?: string,
		feed?: number,
		display?: string
	}) => {

		const {
			room,
			handle_id, 
			pin, 
			secret,
			ptype,
			audiocodec,
			videocodec,
			feed,
			display
		} = data;

		const request : any = {
			janus: "message",
			handle_id,
			body: {
				request: "join",
				pin,
				room,
				ptype,
				secret,
				offer_video: true,
				offer_audio: true,
				video: true,
				audio: true,
			}
		};

		if (feed) {
			request.body.feed = feed;
		}

		if (audiocodec) {
			request.body.audiocodec = audiocodec;
		}
		
		if (videocodec) {
			request.body.videocodec = videocodec;
		}

		if (display) {
			request.body.display = display;
		}
		
		return this.transaction(request);
		
	}



	public joinandconfigure = (data : {
		jsep: any, 
		room: string, 
		handle_id: number, 
		pin: string, 
		secret: string,
		ptype: "publisher" | "subscriber",
		audiocodec?: string,
		videocodec?: string,
		feed?: number
	}) => {

		const {
			jsep, 
			room,
			handle_id, 
			pin, 
			secret,
			ptype,
			audiocodec,
			videocodec,
			feed
		} = data;

		const request : any = {
			janus: "message", 
			jsep,
			handle_id,
			body: {
				request: "joinandconfigure", 
				room,
				audiocodec: "opus",
				videocodec: "vp8",
				pin,
				ptype,
				offer_video: true,
				offer_audio: true,
				video: true,
				audio: true,
				secret
			}
		};

		if (feed) {
			request.body.feed = feed;
		}

		if (audiocodec) {
			request.body.audiocodec = audiocodec;
		}
		
		if (videocodec) {
			request.body.videocodec = videocodec;
		}

		return this.transaction(request);

	}



	public publish = (data : {
		jsep: any,
		room: string, 
		handle_id: number, 
		pin: string,
		secret: string,
		audiocodec?: string,
		videocodec?: string
	}) => {

		const {
			jsep, 
			room,
			handle_id, 
			pin, 
			secret,
			audiocodec,
			videocodec
		} = data;

		const request : any = {
			janus: "message", 
			jsep,
			handle_id,
			body: {
				request: "publish",
				room,
				pin,
				audio: true,
				video: true,
				secret,
				audiocodec: "opus",
				videocodec: "vp8",
				offer_video: true,
				offer_audio: true
			}
		};

		if (audiocodec) {
			request.body.audiocodec = audiocodec;
		}
		
		if (videocodec) {
			request.body.videocodec = videocodec;
		}

		return this.transaction(request);

	}



	public start = (data : {
		answer: any,
		room: number, 
		pin: string, 
		secret: string, 
		handle_id: number
	}) => {
		
		const {
			answer,
			room, 
			pin, 
			secret, 
			handle_id
		} = data;

		const request : any = {
			janus: "message", 
			handle_id,
			jsep: answer,
			body: {
				request: "start",
				room,
				pin,
				secret
			}
		};
		
		return this.transaction(request);

	}



	public configure = (data : {
		jsep?: any, 
		room: number,
		handle_id: number, 
		pin: string, 
		secret: string,
		audiocodec?: string,
		videocodec?: string,
		ptype: "publisher" | "subscriber",
		audio: boolean,
		video: boolean
	}) => {

		const {
			jsep, 
			room, 
			handle_id, 
			pin, 
			secret,
			audiocodec,
			videocodec,
			ptype,
			audio,
			video
		} = data;

		const request : any = {
			janus: "message",
			handle_id,
			body: { 
				request: "configure",
				pin,
				room,
				ptype,
				secret
			}
		};

		if (jsep) {
			request.jsep = jsep;
		}

		if (audiocodec) {
			request.body.audiocodec = audiocodec;
		}
		
		if (videocodec) {
			request.body.videocodec = videocodec;
		}

		if (audio) {
			request.body.offer_audio = true;
			request.body.audio = true;
		}

		if (video) {
			request.body.offer_video = true;
			request.body.video = true;
		}
		
		return this.transaction(request);

	}


	
	unpublish = (data : {
		handle_id:number, 
		pin:string, 
		secret:string
	}) => {
		
		const {
			handle_id, 
			pin,
			secret
		} = data;

		const request : any = {
			janus: "message", 
			handle_id: handle_id,
			body: {
				request: "unpublish",
				pin,
				secret
			}
		};

		return this.transaction(request);

	}


	
	hangup = (handle_id:number) => {
		
		return this.transaction({
			janus: "hangup",
			handle_id: handle_id
		});
		
	}


	
	detach = (handle_id) => {

		return this.transaction({ 
			janus: "detach",
			handle_id: Number(handle_id)
		})
		.then(() => {

			delete this.handles[handle_id];

		});
		
	}



	leave = (handle_id:number) => {
		
		const request = {
			janus: "message", 
			handle_id,
			body: {
				request: "leave"
			}
		};

		return this.transaction(request);

	}



	trickle = (candidate:any, handle_id:number) => {
		
		const request = {
			janus: "trickle",
			handle_id,
			candidate
		};

		return this.transaction(request);

	}
	

	
	pause = ({}) => {

		const request : any = {
			janus: "message", 
			body: {
				request : "pause"
			}
		};

		return this.transaction(request);

	}

}



export default JanusInstance;
