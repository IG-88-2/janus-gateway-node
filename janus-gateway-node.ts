import { JanusInstance } from "./janus-gateway-instance";
import { logger } from "./utils/logger";
const path = require('path');
const equal = require('fast-deep-equal');
const fs = require('fs');
const uuidv1 = require('uuid').v1;
const WebSocket = require("ws");
const url = require("url");
const uniq = (list:string[]) : boolean => list.length===[...new Set(list)].length;


interface JanusRoom {
	room: string,
	description: string,
	pin_required: boolean,
	max_publishers: number,
	bitrate: number,
	fir_freq: number,
	require_pvtid: boolean,
	notify_joining: boolean,
	audiocodec: string,
	videocodec: string,
	record: boolean,
	num_participants: number
}



interface Logger {
	info : (message:string) => void,
	error : (error:any) => void,
	json : (json:any) => void
}



interface RoomState extends JanusRoom {
	room_id: string,
	instance_id: string,
	secret: string,
	pin?: string,
	participants?
}



interface JanusInstanceOptions {
	protocol: string,
	address: string,
	port: number,
	adminPort: number,
	adminKey: string,
	server_name: string
}



interface JanusOptions {
	instances: JanusInstanceOptions[],
	selectInstance?: (instances:JanusInstance[]) => JanusInstance,
	onError?: (error:any) => void,
	keepAliveTimeout?: number,
	syncInterval?: number,
	logger?: Logger,
	webSocketOptions?: any
}



interface Response {
	type: string,
	load: any,
	transaction?: string
}



export class Janus {
	options:JanusOptions
	rooms:{ [id:string] : RoomState }
	handles:{ [id:number] : any }
	instances:{ [id:string] : JanusInstance }
	connections:{ [id:string] : any }
	sync:NodeJS.Timer
	listening:boolean
	statePath:string
	keepAliveTimeout:number
	syncInterval:number
	count:number
	notifyConnected:() => void
	defaultWebSocketOptions:any
	shouldDetach:boolean
	logger:any
	wss:any
	t:any
	
	constructor(options:JanusOptions) {
		
		this.options = options;

		this.statePath = path.resolve('state.json');
		
		if (this.options.logger) {
			this.logger = this.options.logger;
		} else {
			this.logger = logger;
		}

		this.defaultWebSocketOptions = {
			port: 8080,
			backlog: 10,
			clientTracking: false,
			perMessageDeflate: false,
			maxPayload: 10000
		};

		this.rooms = {};
		
		this.handles = {};

		this.instances = {};

		this.connections = {};

		this.keepAliveTimeout = this.options.keepAliveTimeout || 30000;

		this.syncInterval = this.options.syncInterval || 10000;

		this.shouldDetach = true;
		
	}


	
	public initialize = async () : Promise<void> => {
		
		this.instances = {};

		for(let i = 0; i < this.options.instances.length; i++) {
			const { protocol, address, port, adminPort, adminKey, server_name } = this.options.instances[i];
			
			this.logger.info(`ready to connect instance ${i}`);

			const instance = new JanusInstance({
				options: {
					protocol,
					address,
					port,
					adminPort,
					adminKey,
					server_name,
					adminSecret: "janusoverlord" //TODO
				},
				onDisconnected: () => {

					this.logger.info(`${server_name} disconnected`);
					
				},
				onConnected: () => {
					
					this.logger.info(`${server_name} connected`);

				},
				onMessage: (json) => {
					
					this.onJanusEvent(instance.id, json);
					
				},
				onError: (error) => {
					
					this.onError(error);

				},
				logger:this.logger
			});
			
			try {

				await instance.connect();

				this.logger.info(`${server_name} (await) connected`);
				
				this.instances[instance.id] = instance;

			} catch(error) {

				this.onError(error);
				
			}
		}

		const instances = Object.values(this.instances);
		
		const ids = instances.map(({ id }) => id);

		if (!uniq(ids)) {
			throw new Error('Instance identifier is not unique');
		}

		await this.synchronize();
		
		this.sync = setInterval(() => {

			this.synchronize()
			.catch((error) => {

				this.onError(error);

			});

		}, this.syncInterval);
		
		await this.transport();

		this.logger.info(`initialized...`);

	}



	public terminate = async () => {

		this.logger.info(`terminate...`);

		const instances : JanusInstance[] = Object.values(this.instances);

		if (this.sync) {
			clearInterval(this.sync);
			this.sync = undefined;
		}

		for(let i = 0; i < instances.length; i++) {
			const next = instances[i];
			this.logger.info(`disconnect instance ${next.id}`);
			await next.disconnect();
		}
		
		this.instances = {};

		this.wss.close((...args) => {

			for(const id in this.connections) {
				const { t } = this.connections[id];
				clearTimeout(t);
			}

			this.connections = {};
			
		});

	}



	private getDuplicateIds = async () => {

		const instances = Object.values(this.instances);

		const acc = {};
		
		for(let i = 0; i < instances.length; i++) {
			const instance = instances[i];
			
			if (!instance) {
				continue;
			}

			const result : any = await instance.listRooms();
			const rooms : JanusRoom[] = result.plugindata.data.list;

			for(let j = 0; j < rooms.length; j++) {
				const { room } = rooms[j];
				
				if (!acc[room]) {
					acc[room] = 1;
				} else {
					acc[room] += 1;
				}
			}
		}

		let result = [];

		for(let room in acc) {
			const count = acc[room];
			if (count && count > 1) {
				result.push(room);
			}
		}

		return result;

	}


	//TODO pass keys info in a different way
	private synchronize = async (instance_id?:string) : Promise<void> => {
		
		let duplicates = [];
		
		try {
			duplicates = await this.getDuplicateIds();
		} catch(error) {
			this.onError(error);
		}

		/*
		if (duplicates.length > 0) {
			const error = new Error(`rooms ids duplicated across instances - ${JSON.stringify(duplicates)}`);
			this.onError(error);
		}
		*/

		const acc = {};

		const instances = Object.values(this.instances);
		
		for(let i = 0; i < instances.length; i++) {
			const instance = instances[i];
			
			if (!instance || (instance_id && instance.id!=instance_id)) {
				continue;
			}

			const result : any = await instance.listRooms();
			const rooms : JanusRoom[] = result.plugindata.data.list;
			const handles = await instance.listHandles();
			
			this.logger.info(instance.stats);
			
			
			if (handles.handles) {
				instance.activeHandles = handles.handles.length;
				for(let k = 0; k < handles.handles.length; k++) {
					const handle_id = handles.handles[k];
					const info = await instance.handleInfo(handle_id);
					if (info.info) {
						this.handles[handle_id] = info.info;
					}
				}
			}
			
			for(let j = 0; j < rooms.length; j++) {
				const { room } = rooms[j];
				const d = duplicates.findIndex((e) => e===room);

				if (d!==-1) {
					continue;
				}

				const participants = await instance.listParticipants(room);
				const instance_id = instance.id;
				const state : RoomState = {
					room_id: room,
					instance_id,
					pin: undefined,
					secret: undefined,
					participants,
					...rooms[j]
				};
				
				const target = this.rooms[room];
				
				if (target) {
					if (target.pin) {
						state.pin = target.pin;
					}
					if (target.secret) {
						state.secret = target.secret;
					}
				}

				acc[room] = state;
			}
		}
		
		if (!equal(acc, this.rooms) && Object.keys(acc).length != 0) {
			this.rooms = acc;
			await this.writeState(this.rooms);
		}
		
	}



	private transport = () => {

		this.logger.info(`launching transport...`);

		let options = this.defaultWebSocketOptions;
		
		if (this.options.webSocketOptions) {
			options = this.options.webSocketOptions;
		}

		if (this.connections) {
			for(const id in this.connections) {
				const { t } = this.connections[id];
				clearTimeout(t);
			}
		}

		this.connections = {};
		
		this.wss = new WebSocket.Server(options);
		
		this.wss.on('connection', this.onConnection);
		
		this.wss.on('listening', () => this.onListening());

		this.t = setTimeout(() => this.onListening(), 3000);
		
		this.wss.on('close', (error) => {

			this.logger.info(`websocket transport is closed!`);

			this.listening = false;

			if (this.t) {
				clearTimeout(this.t);
				this.t = undefined;
			}
			
		});
		
		return new Promise((resolve) => {

			this.notifyConnected = () => resolve(0);

		});

	}



	private onListening = () => {

		if (this.listening) {
			return;
		}

		this.logger.info(`websocket transport is launched!`);

		this.listening = true;

		if (this.notifyConnected) {
			this.notifyConnected();
			delete this.notifyConnected;
		}

	}



	private onError = (error) => {

		if (this.options.onError) {
			this.options.onError(error);
		}

	}



	private onTimeout = (user_id:string, detach:boolean) => {
		
		this.logger.info(`timeout called for user ${user_id}`);

		if (!this.connections[user_id]) {
			this.logger.info(`user ${user_id} is not registered...`);
			return;
		}

		const { ws, t } = this.connections[user_id];

		clearTimeout(t);

		ws.removeListener('message', this.onMessage);

		ws.close();

		delete this.connections[user_id];

		if (detach) {
			this.detachUserHandles(user_id)
			.then(() => {
				this.logger.info(`cleared for user ${user_id}`);
			});
		}

	}



	private onConnection = async (ws, req) => {

		this.logger.info(`new connection attempt`);

		let user_id = this.getUserId(req);
		
		if (!user_id) {
			this.logger.error(`new connection attempt - user id is missing! closing...`);
			ws.close();
			return;
		}

		this.logger.info(`new connection from ${user_id}`);
		
		if (this.connections[user_id]) {
			this.logger.info(`connection from ${user_id} already exist - cleanup`);

			this.connections[user_id].ws.removeListener('message', this.onMessage);

			clearTimeout(this.connections[user_id].t);
			
			this.connections[user_id] = undefined;

			if (this.shouldDetach) {
				await this.detachUserHandles(user_id);
			}
			
			this.logger.info(`connection from ${user_id} cleared`);
		}
		
		///WHAT ??? review
		if (this.connections[user_id]) {
			this.logger.info(`connection from ${user_id} already exist`);
			return;
		}

		const t = setTimeout(() => {
			
			this.onTimeout(user_id, this.shouldDetach);

		}, this.keepAliveTimeout);

		this.connections[user_id] = { ws, t };

		ws.on('message', this.onMessage(user_id));

		ws.send('connected');
		
	}



	private onKeepAlive = (user_id:string) : Response => {

		if (!this.connections[user_id]) {
			return {
				type: 'error',
				load: `missing ${user_id}`
			};
		}

		clearTimeout(this.connections[user_id].t);

		const t = setTimeout(() => {

			this.onTimeout(user_id, this.shouldDetach);
			
		}, this.keepAliveTimeout);

		this.connections[user_id].t = t;

		return {
			type: 'keepalive',
			load: user_id
		};

	}

	

	private onMessage = (user_id) => async (data) => {
		let message = null;
		
		try {
			message = JSON.parse(data);
		} catch(error) {
			const response = {
				type: 'error',
				load: error.message
			};
			this.onError(error);
			this.notify(user_id)(response);
			return;
		}

 		try {
			const response = await this.onUserMessage(user_id, message);
			this.notify(user_id)(response);
		} catch(error) {
			const response = {
				type: 'error',
				load: error.message,
				transaction: message.transaction
			};
			this.onError(error);
			this.notify(user_id)(response);
		}
	}



	private notify = (user_id:string) => (response) => {

		try {

			if (!this.connections[user_id]) {
				throw new Error(`connection ${user_id} already terminated`);
			}

			const { ws } = this.connections[user_id];

			const message = JSON.stringify(response);

			ws.send(message);

		} catch(error) {

			this.onError(error);

		}

	}



	//TODO improve
	private detachUserHandles = async (user_id:string, ignoreHandle?) => {

		const instances = Object.values(this.instances);

		for(let i = 0;  i < instances.length; i++) {
			const instance = instances[i];
			for(const handle_id in instance.handles) {
				if (handle_id==ignoreHandle) {
					continue;
				}
				if (instance.handles[handle_id]===user_id) {
					try {
						await instance.leave(handle_id);
					} catch(error) {
						this.onError(error);
					}
					try {
						await instance.detach(handle_id);
					} catch(error) {
						this.onError(error);
					}
				}
			}
		}

	}



	private onJanusEvent = async (instance_id:string, json) : Promise<void> => {
		
		if (!json.sender) {
			if (json.janus!=="ack") {
				
			}
			return;
		}

		const handle_id = json.sender;

		const user_id = this.getHandleUser(instance_id, handle_id);

		if (!user_id) {
			if (!this.isLocalHandle(instance_id, handle_id)) {
				this.logger.info(`[${handle_id}] ${instance_id} user_id not found - ${JSON.stringify(json)}`);
			}
			return;
		}
		
		const notify = this.notify(user_id);
		
		if (json.janus==='trickle') {
			const { sender, candidate } = json;
			notify({
				sender,
				data: candidate,
				type: 'trickle'
			});
		} else if (json.janus==='media') {
			const {
				sender,
				type,
				receiving,
				session_id
			} = json;
			notify({
				sender,
				data: {
					type,
					receiving
				},
				type: 'media'
			});
		} else if(
			json.janus==='event' && 
			json.plugindata.data && 
			json.plugindata.data.videoroom==='event' &&
			json.plugindata.data.hasOwnProperty("leaving")
		) {
			notify({
				data: { 
					leaving: json.plugindata.data.leaving, 
					sender: handle_id 
				},
				type: 'leaving'
			});
		} else if (
			json.janus==='event' && 
			json.plugindata.data && 
			(json.plugindata.data.videoroom==='joined' || json.plugindata.data.videoroom==='event') &&
			json.plugindata.data.publishers
		) {
			notify({
				data: json.plugindata.data.publishers,
				type: 'publishers'
			});
		} else {
			notify({
				data: json,
				type: 'internal'
			});
		}
		
	}



	private onUserMessage = async (
		user_id: string, 
		message: any
	) : Promise<Response> => {
		
		let response : Response = null;
		
		switch(message.type) {
			case 'keepalive': 
				response = this.onKeepAlive(user_id);
				break;
			case 'create_room':
				response = await this.createRoom(message);
				break;
			case 'destroy_room':
				response = await this.destroyRoom(message);
				break;
			case 'attach':
				response = await this.getIceHandle(user_id, message.load.room_id);
				break;
			case 'rooms':
				response = await this.getRooms();
				break;
			case 'join':
				response = await this.joinRoom(user_id, message);
				break;
			case 'configure':
				response = await this.onConfigure(message);
				break;
			case 'joinandconfigure':
				try {
					response = await this.onJoinAndConfigure(user_id, message);
				} catch(error) {
					if (error.code===436) {
						await this.detachUserHandles(user_id, message.load.handle_id);
						response = await this.onJoinAndConfigure(user_id, message);
					} else {
						throw new Error(error);
					}
				}
				break;
			case 'publish':
				response = await this.onPublish(message);
				break;
			case 'unpublish':
				response = await this.onUnpublish(message);
				break;
			case 'start':
				response = await this.onStart(message);
				break;
			case 'leave':
				response = await this.onLeave(message);
				break;
			case 'hangup':
				response = await this.onHangup(message);
				break;
			case 'detach':
				response = await this.onDetach(message);
				break;
			case 'candidate':
				response = await this.onTrickle(message);
				break;
			default:
				response = {
					type: "unknown",
					load: null
				};
				break;
		}

		response.transaction = message.transaction;

		return response;
		
	}



	public getRooms = async () => {

		await this.synchronize();

		const rooms = Object.values(this.rooms);

		return {
			type: 'rooms',
			load: rooms.map((data) => {
				const room = {
					...data
				};
				room.pin = undefined;
				room.secret = undefined;
				return data;
			})
		};
		
	}



	public createRoom = async (message:any) : Promise<Response> => {
		
		const { 
			description, 
			bitrate,
			bitrate_cap,
			fir_freq,
			videocodec,
			permanent,
			id,
			vp9_profile
		} = message.load;
		
		const instance : JanusInstance = this.selectInstance();

		if (!instance) {
			throw new Error(`No instance available`);
		}
		
		const room_id = id ? id : this.getRoomId();

		const secret = this.getSecret();

		const pin = this.getPin();
		
		const result : any = await instance.createRoom({
			description,
			secret,
			pin,
			bitrate,
			bitrate_cap,
			permanent,
			fir_freq,
			videocodec,
			vp9_profile,
			room: room_id
		});

		const data = result.plugindata.data;

		const { room } = data;

		const state : RoomState = {
			room_id: room,
			instance_id: instance.id,
			pin,
			secret,
			participants : [],
			...data
		};
		
		this.rooms[room] = state;
		
		await this.writeState(this.rooms);

		const response = {
			type:'create_room',
			load: {
				context: state, //TODO modify
				result
			}
		};

		return response;

	}


	
	public destroyRoom = async (message:any) : Promise<Response> => {
		
		const { room_id } = message.load;

		const state = this.rooms[room_id];

		const instance = this.instances[state.instance_id];

		const result = await instance.destroyRoom({
			handle_id: instance.localHandleId,
			room: room_id,
			secret: state.secret
		});

		delete this.rooms[room_id];
		
		const response = {
			type: 'destroy_room',
			load: result
		};

		return response;
		
	}
	


	private writeState = async (rooms) => {

		try {
			
			const file = JSON.stringify(rooms);
			
			const fsp = fs.promises;
	
			await fsp.writeFile(this.statePath, file, 'utf8');
			
		} catch(error) {
			
			this.logger.error(error);
			
		}
	
	}

	

	public getIceHandle = async (user_id:string, room_id:string) : Promise<Response> => {
	
		const room = this.rooms[room_id];

		const instance = this.instances[room.instance_id];

		//TODO
		/*
		optimize
		list all user handles
		check if active publisher handle already exist for this user
		return existing handle
		*/

		const handleId = await instance.attach(user_id);
		
		const response = {
			type: 'attach',
			load: handleId
		};
		
		return response;
		
	}



	public joinRoom = async (user_id, message) : Promise<Response> => {
		
		const { 
			room_id, 
			display, 
			handle_id, 
			feed, 
			ptype 
		} = message.load;

		const room = this.rooms[room_id];

		this.logger.info(`[${handle_id}] ${ptype} ${user_id} is joining room ${room_id} on instance ${room.instance_id}`);

		const instance = this.instances[room.instance_id];
		
		const result = await instance.join({
			user_id,
			room: room.room_id,
			ptype,
			feed,
			handle_id,
			pin: room.pin,
			secret: room.secret,
			display
		}); 
		
		const response = {
			type: 'join',
			load: result
		};
		
		return response;

	}
	


	private onKick = (room_id, user_id, handle_id) => {
		
		const room = this.rooms[room_id];

		const instance = this.instances[room.instance_id];
		
		return instance.kick(room, user_id, handle_id);

	}



	public onJoinAndConfigure = async (user_id, message) : Promise<Response> => {

		const {
			jsep,
			room_id,
			handle_id,
			ptype,
			feed
		} = message.load;

		const room = this.rooms[room_id];

		this.logger.info(`[${handle_id}] ${ptype} ${user_id} is joining (joinandconfigure) room ${room_id} on instance ${room.instance_id}`);

		const instance = this.instances[room.instance_id];
		
		const result : any = await instance.joinandconfigure({
			jsep, 
			room: room.room_id, 
			handle_id, 
			user_id,
			pin: room.pin, 
			secret: room.secret,
			ptype,
			feed
		});
		
		const data = {
			jsep: result.jsep,
			data: result.plugindata.data
		};

		const response = {
			type: 'joinandconfigure',
			load: data
		};
		
		return response;

	} 



	public onConfigure = async (message) : Promise<Response> => {

		const {
			jsep,
			room_id,
			handle_id,
			video,
			audio,
			ptype
		} = message.load;

		const room = this.rooms[room_id];

		this.logger.info(`[${handle_id}] ${ptype} is configuring room ${room_id} on instance ${room.instance_id}`);
		
		const instance = this.instances[room.instance_id];
		
		const request : any = {
			room: room_id,
			pin: room.pin, 
			secret: room.secret,
			handle_id,
			ptype
		};

		if (jsep) {
			request.jsep = jsep;
		}

		if (video!==undefined) {
			request.video = video;
		}

		if (audio!==undefined) {
			request.audio = audio;
		}

		const result : any = await instance.configure(request);
		
		const response = {
			type: 'configure',
			load: {
				jsep: result.jsep,
				data: result.plugindata.data
			}
		};

		return response;
			
	} 



	public onPublish = async (message:any) : Promise<Response> => {

		const {
			jsep,
			room_id,
			handle_id
		} = message.load;

		const room = this.rooms[room_id];

		this.logger.info(`[${handle_id}] user is publishing in room ${room_id} on instance ${room.instance_id}`);
		
		const instance = this.instances[room.instance_id];

		const result : any = await instance.publish({
			jsep, 
			room: room.room_id, 
			handle_id, 
			pin: room.pin, 
			secret: room.secret
		});

		const data = {
			jsep: result.jsep,
			data: result.plugindata.data
		};

		const response = {
			type: 'publish',
			load: data
		};

		return response;
			
	} 



	public onUnpublish = async (message:any) : Promise<Response> => {
		
		const { room_id, handle_id } = message.load;
		
		const room = this.rooms[room_id];

		this.logger.info(`[${handle_id}] user is unpublishing in room ${room_id} on instance ${room.instance_id}`);

		const instance = this.instances[room.instance_id];

		const result = await instance.unpublish({
			handle_id, 
			pin: room.pin, 
			secret: room.secret
		});

		const response = {
			type: 'unpublish',
			load: result
		};
		
		return response;
			
	} 



	public onHangup = async (message:any) : Promise<Response> => {
	
		const { room_id, handle_id } = message.load;

		const room = this.rooms[room_id];

		this.logger.info(`[${handle_id}] user is hanging up in room ${room_id} on instance ${room.instance_id}`);
		
		const instance = this.instances[room.instance_id];

		const result = await instance.hangup(handle_id);

		const response = {
			type: 'hangup',
			load: result
		};
		
		return response;
			
	} 



	public onDetach = async (message:any) : Promise<Response> => {
		
		const { room_id, handle_id } = message.load;

		const room = this.rooms[room_id];

		this.logger.info(`[${handle_id}] user detaching in room ${room_id} on instance ${room.instance_id}`);
		
		const instance = this.instances[room.instance_id];

		const result = await instance.detach(handle_id);

		const response = {
			type: 'detach',
			load: result
		};
		
		return response;
			
	}



	public onLeave = async (message:any) : Promise<Response> => {
		
		const { room_id, handle_id } = message.load;

		const room = this.rooms[room_id];

		this.logger.info(`[${handle_id}] user leaving room ${room_id} on instance ${room.instance_id}`);
		
		const instance = this.instances[room.instance_id];

		const result = await instance.leave(handle_id);

		const response = {
			type: 'leave',
			load: result
		};
		
		return response;
			
	} 



	public onTrickle = async (message:any) : Promise<Response> => {
		
		const { room_id, candidate, handle_id } = message.load;

		const room = this.rooms[room_id];

		this.logger.info(`[${handle_id}] got trickle in room ${room_id} on instance ${room.instance_id}`);
		
		const instance = this.instances[room.instance_id];

		const result = await instance.trickle(candidate, handle_id);

		const response = {
			type: 'trickle',
			load: result
		};

		return response;
			
	}



	public onStart = async (message:any) : Promise<Response> => {
		
		const { room_id, handle_id, answer } = message.load;

		const room = this.rooms[room_id];

		this.logger.info(`[${handle_id}] start in room ${room_id} on instance ${room.instance_id}`);
		
		const instance = this.instances[room.instance_id];

		const result = await instance.start({
			answer,
			room: room_id, 
			pin: room.pin, 
			secret: room.secret, 
			handle_id
		});

		const response = {
			type: 'start',
			load: result
		};
		
		return response;

	}



	private selectInstance = () => {
		
		let instances : JanusInstance[] = Object.values(this.instances);

		instances = instances.filter((instance) => instance.connected);
		
		if (instances.length===0) {
			return null;
		}

		if (this.options.selectInstance) {
			return this.options.selectInstance(instances);
		}

		let instance = instances[this.count];
						
		if (!instance) {
			this.count = 0;
			instance = instances[this.count];
		}

		this.count += 1;

		return instance;
		
	}



	private getHandleUser = (instance_id:string, handle_id:number) : string => {

		const instance = this.instances[instance_id];

		if (instance) {

			const user_id = instance.handles[handle_id];

			return user_id;

		}
		
	}



	private isLocalHandle = (instance_id:string, handle_id:number) : boolean => {
		
		const instance = this.instances[instance_id];
		
		if (instance) {

			return handle_id==instance.localHandleId;

		}

		return false;
		
	}



	private getPin = () : string => {

		const pin = uuidv1();

		return pin;

	}



	private getRoomId = () : string => {

		const id = uuidv1();

		return id;

	}



	private getSecret = () => {

		const secret = uuidv1();

		return secret;

	}



	private getUserId = (req) : string => {

		let user_id;

		try {

			const data = url.parse(req.url, true).query;

			user_id = data.id;

		} catch(error) {}

		return user_id;

	}
	
}
