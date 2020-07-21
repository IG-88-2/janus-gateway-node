import { v1 as uuidv1 } from "uuid";
import WebSocket = require("ws");
import JanusInstance from "./janus-gateway-instance";
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



interface RoomContext {
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
	server_name: string,
	ps: NodeJS.Process
}



interface JanusOptions {
	instances: JanusInstanceOptions[],
	retrieveContext: () => any,
	updateContext: (context:any) => any,	
	onConnected: () => void,
	onDisconnected: () => void,
	onError: (error:any) => void,
	logger?: {
		info? : (message:string) => void,
		error? : (error:any) => void,
		json? : (json:any) => void
	},
	selectInstance?: (instances:JanusInstance[]) => JanusInstance,
	webSocketOptions?: any
}



interface Response {
	type: string,
	load: any,
	transaction?: string
}



class Janus {
	options:JanusOptions
	rooms:{ [id:string] : RoomContext }
	handles: { [id:number] : any }
	instances:{ [id:string] : JanusInstance }
	connections:{ [id:string] : any }
	stats:{ [id:string] : any }
	sync:NodeJS.Timer
	listening:boolean
	contextPath:string
	keepAliveTimeout:number
	syncInterval:number
	count:number
	notifyConnected:() => void
	defaultWebSocketOptions:any
	context:any
	wss:any
	
	constructor(options:JanusOptions) {
		
		this.options = options;

		this.rooms = {};
		
		this.handles = {};

		this.instances = {};

		this.connections = {};

		this.stats = {};

		this.keepAliveTimeout = 30000;

		this.syncInterval = 30000;
		
		this.defaultWebSocketOptions = {
			host: '127.0.0.1',
			port: 8080,
			backlog: 10,
			clientTracking: false,
			perMessageDeflate: false,
			maxPayload: 10000
		};

		this.context = this.options.retrieveContext();

	}


	
	public initialize = async () : Promise<void> => {
		
		this.instances = {};

		for(let i = 0; i < this.options.instances.length; i++) {
			const { protocol, address, port, adminPort, adminKey, server_name, ps } = this.options.instances[i];
			
			this.options.logger.info(`ready to connect instance ${i}`);

			this.options.logger.json(this.options.instances);

			const instance = new JanusInstance({
				options: {
					protocol,
					address,
					port,
					adminPort,
					adminKey,
					ps,
					server_name,
					adminSecret: "janusoverlord"
				},
				onDisconnected: () => {



				},
				onConnected: () => {
					
					

				},
				onMessage: (json) => {
					
					this.onJanusEvent(instance.id, json);
					
				},
				onError: (error) => {
					


				},
				logger:this.options.logger
			});
			
			await instance.connect();

			this.instances[instance.id] = instance;
			
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

		if (this.options.onConnected) {
			this.options.onConnected();
		}

	}



	public terminate = async () => {

		this.context = await this.options.updateContext(this.rooms);

		const instances : JanusInstance[] = Object.values(this.instances);

		if (this.sync) {
			clearInterval(this.sync);
			this.sync = undefined;
		}

		for(let i = 0; i < instances.length; i++) {
			const next = instances[i];
			await next.disconnect();
		}
		
		this.instances = {};

		this.wss.close((...args) => {

			for(const id in this.connections) {
				const { t } = this.connections[id];
				clearTimeout(t);
			}

			this.connections = {};

			if (this.options.onDisconnected) {
				this.options.onDisconnected();
			}

		});

	}



	public synchronize = async (instance_id?:string) : Promise<void> => {
		
		const instances = Object.values(this.instances);
		
		for(let i = 0; i < instances.length; i++) {
			const instance = instances[i];
			
			if (
				!instance || (instance_id && instance.id!=instance_id)
			) {
				continue;
			}

			const result : any = await instance.listRooms();
			const rooms : JanusRoom[] = result.plugindata.data.list;
			const handles = await instance.listHandles();
			
			this.stats[instance.id] = instance.stats;
			
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
				const { participants } = await instance.listParticipants(room);
				const instance_id = instance.id;
				const context : RoomContext = {
					room_id: room,
					instance_id,
					pin: undefined,
					secret: undefined,
					participants
				};
				
				const target = this.context[room];
				
				if (target) {
					if (target.pin) {
						context.pin = target.pin;
					}
					if (target.secret) {
						context.secret = target.secret;
					}
				}

				this.rooms[room] = context;
			}
		}
		
		//TODO should i update context here ???
		//this.context = await this.options.updateContext(this.rooms);
		
	}



	private transport = () => {

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

		//logger.info('initializing transport...');

		//logger.json(options);
		
		this.wss = new WebSocket.Server(options);
		
		this.wss.on('connection', this.onConnection);
		
		this.wss.on('listening', () => {

			this.listening = true;

			if (this.notifyConnected) {
				this.notifyConnected();
				delete this.notifyConnected;
			}
			
		});
		
		this.wss.on('close', (error) => {

			this.listening = false;

		});
		
		return new Promise((resolve) => {

			this.notifyConnected = () => resolve();

		});

	}



	private onError = (error) => {

		if (this.options.onError) {
			this.options.onError(error);
		}

	}



	private onTimeout = (user_id:string) => {

		//logger.info(`timeout called for user ${user_id}`);

		const { ws } = this.connections[user_id];

		ws.removeListener('message', this.onMessage);

		ws.close();

		delete this.connections[user_id];

		this.detachUserHandles(user_id);

	}



	private onConnection = (ws, req) => {

		let user_id = this.getUserId(req);
		
		if (!user_id) {

			//logger.info(`onConnection - user_id is missing`);

			ws.close();

			return;

		}

		//logger.info(`new socket connection from ${user_id}`);

		if (this.connections[user_id]) {

			this.connections[user_id].ws.removeListener('message', this.onMessage);

			//TODO review ???
			//this.connections[user_id].ws.close();

			clearTimeout(this.connections[user_id].t);

		}
		
		const t = setTimeout(() => {
			
			this.onTimeout(user_id);

		}, this.keepAliveTimeout);

		this.connections[user_id] = { ws, t };

		ws.on('message', this.onMessage(user_id));
		
	}



	private onMessage = (user_id) => (data) => {

		let message;

		try {

			message = JSON.parse(data);

		} catch(error) {

			this.onError(error);
			
		}

		if (message) {
			this.onUserMessage(user_id, message);
		}

	}



	private notify = (user_id:string) => (response) => {

		try {

			if (!this.connections[user_id]) {
				throw new Error(`connection ${user_id} already termianted`);
			}

			const { ws } = this.connections[user_id];

			const message = JSON.stringify(response);

			ws.send(message);

		} catch(error) {

			this.onError(error);

		}

	}



	private detachUserHandles = async (user_id:string) => {

		const instances = Object.values(this.instances);

		for(let i = 0;  i < instances.length; i++) {
			const instance = instances[i];
			for(const handle_id in instance.handles) {
				if (instance.handles[handle_id]===user_id) {
					await instance.detach(handle_id);
				}
			}
		}

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

			this.onTimeout(user_id);
			
		}, this.keepAliveTimeout);

		this.connections[user_id].t = t;

		return {
			type: 'keepalive',
			load: user_id
		};
	}



	private onJanusEvent = async (instance_id:string, json) : Promise<void> => {
		
		if (!json.sender) { 
			return;
		}

		const handle_id = json.sender;

		const user_id = this.getHandleUser(instance_id, handle_id);

		if (!user_id) {
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
		message: {
			transaction: string,
			type: string,
			load?: any
		}
	) : Promise<void> => {
		
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
				const rooms = Object.values(this.rooms);
				await this.synchronize();
				response = {
					type: 'rooms',
					load: rooms.map(({
						room_id,
						instance_id,
						participants
					}) => ({
						room_id,
						instance_id,
						participants
					}))
				};
				break;
			case 'join':
				response = await this.joinRoom(message);
				break;
			case 'configure':
				response = await this.onConfigure(message);
				break;
			case 'joinandconfigure':
				response = await this.onJoinAndConfigure(message);
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
				response.type = "unknown";
				break;
		}

		response.transaction = message.transaction;

		this.notify(user_id)(response);
		
	}



	public createRoom = async (message:any) : Promise<Response> => {
		
		try {

			const { description } = message.load;
			
			const instance : JanusInstance = this.selectInstance();

			if (!instance) {
				throw new Error(`No instance available`);
			}
			
			const room_id = this.getRoomId();

			const secret = this.getSecret();

			const pin = this.getPin();
			
			const result : any = await instance.createRoom({
				description,
				secret,
				pin,
				room: room_id
			});

			const { room } = result.plugindata.data;

			const context : RoomContext = {
				room_id: room,
				instance_id: instance.id,
				pin,
				secret,
				participants : []
			};
			
			this.rooms[room] = context;
			
			this.context = await this.options.updateContext(this.rooms);

			const response = {
				type:'create_room',
				load: {
					context,
					result
				}
			};

			return response;

		} catch(error) {

			this.onError(error);

			const response = {
				type:'error',
				load: error.message
			};
			
			return response;

		}

	}


	
	public destroyRoom = async (message:any) : Promise<Response> => {
		
		try {

			const { room_id } = message.load;

			const context = this.rooms[room_id];

			const instance = this.instances[context.instance_id];

			const result = await instance.destroyRoom({
				handle_id: instance.localHandleId,
				room: room_id,
				secret: context.secret
			});

			delete this.rooms[room_id];
			
			const response = {
				type: 'destroy_room',
				load: result
			};

			return response;
			
		} catch(error) {

			this.onError(error);

			const response = {
				type: 'error',
				load: error.message
			};
			
			return response;

		}
		
	}
	


	public getIceHandle = async (user_id:string, room_id:string) : Promise<Response> => {
	
		try {

			const room = this.rooms[room_id];

			const instance = this.instances[room.instance_id];

			const handleId = await instance.attach(user_id);
			
			const response = {
				type: 'attach',
				load: handleId
			};
			
			return response;

		} catch(error) {

			this.onError(error);

			const response = {
				type: 'error',
				load: error.message
			};
			
			return response;

		}
		
	}



	public joinRoom = async (message) : Promise<Response> => {
		
		try {

			const { 
				room_id, 
				display, 
				handle_id, 
				feed, 
				ptype 
			} = message.load;

			const room = this.rooms[room_id];

			const instance = this.instances[room.instance_id];

			const result = await instance.join({
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

		} catch(error) {

			this.onError(error);

			const response = {
				type: 'error',
				load: error.message
			};
			
			return response;
			
		}

	}



	public onConfigure = async (message) : Promise<Response> => {

		try {

			const {
				jsep,
				room_id,
				handle_id,
				video,
				audio,
				ptype
			} = message.load;

			const room = this.rooms[room_id];

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
			
		} catch(error) {

			this.onError(error);

			const response = {
				type: 'error',
				load: error.message
			};
			
			return response;
			
		}
			
	} 



	public onJoinAndConfigure = async (message) : Promise<Response> => {

		try {

			const {
				jsep,
				room_id,
				handle_id,
				ptype,
				feed
			} = message.load;

			const room = this.rooms[room_id];

			const instance = this.instances[room.instance_id];
			
			const result : any = await instance.joinandconfigure({
				jsep, 
				room: room.room_id, 
				handle_id, 
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

		} catch(error) {

			this.onError(error);

			const response = {
				type: 'error',
				load: error.message
			};
			
			return response;

		}
		
	} 



	public onPublish = async (message:any) : Promise<Response> => {

		try {

			const {
				jsep,
				room_id,
				handle_id
			} = message.load;

			const room = this.rooms[room_id];

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

		} catch(error) {

			this.onError(error);

			const response = {
				type: 'error',
				load: error.message
			};
			
			return response;

		}
		
	} 



	public onUnpublish = async (message:any) : Promise<Response> => {
		
		try {

			const { room_id, handle_id } = message.load;

			const room = this.rooms[room_id];

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

		} catch(error) {

			this.onError(error);

			const response = {
				type: 'error',
				load: error.message
			};
			
			return response;

		}
		
	} 



	public onHangup = async (message:any) : Promise<Response> => {
		
		try {

			const { room_id, handle_id } = message.load;

			const room = this.rooms[room_id];

			const instance = this.instances[room.instance_id];

			const result = await instance.hangup(handle_id);

			const response = {
				type: 'hangup',
				load: result
			};
			
			return response;

		} catch(error) {

			this.onError(error);

			const response = {
				type: 'error',
				load: error.message
			};
			
			return response;

		}
		
	} 



	public onDetach = async (message:any) : Promise<Response> => {
		
		try {

			const { room_id, handle_id } = message.load;

			const room = this.rooms[room_id];

			const instance = this.instances[room.instance_id];

			const result = await instance.detach(handle_id);

			const response = {
				type: 'detach',
				load: result
			};
			
			return response;

		} catch(error) {

			this.onError(error);

			const response = {
				type: 'error',
				load: error.message
			};
			
			return response;

		}
		
	} 



	public onLeave = async (message:any) : Promise<Response> => {
		
		try {

			const { room_id, handle_id } = message.load;

			const room = this.rooms[room_id];

			const instance = this.instances[room.instance_id];

			const result = await instance.leave(handle_id);

			const response = {
				type: 'leave',
				load: result
			};
			
			return response;

		} catch(error) {

			this.onError(error);

			const response = {
				type: 'error',
				load: error.message
			};
			
			return response;

		}
		
	} 



	public onTrickle = async (message:any) : Promise<Response> => {

		try {

			const { room_id, candidate, handle_id } = message.load;

			const room = this.rooms[room_id];

			const instance = this.instances[room.instance_id];

			const result = await instance.trickle(candidate, handle_id);

			const response = {
				type: 'trickle',
				load: result
			};

			return response;

		} catch(error) {

			this.onError(error);

			const response = {
				type: 'error',
				load: error.message
			};
			
			return response;

		}

	}



	public onStart = async (message:any) : Promise<Response> => {
		
		try {

			const { room_id, handle_id, answer } = message.load;

			const room = this.rooms[room_id];

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

		} catch(error) {
			
			this.onError(error);

			const response = {
				type: 'error',
				load: error.message
			};
			
			return response;

		}
		
	}



	private _selectInstance = (instances : JanusInstance[]) => {
		
		let instance = instances[this.count];
						
		if (!instance) {
			this.count = 0;
			instance = instances[this.count];
		}

		this.count += 1;

		return instance;

	}



	private selectInstance = () => {
		
		const instances : JanusInstance[] = Object.values(this.instances);

		if (instances.length===0) {
			return null;
		}

		if (this.options.selectInstance) {
			return this.options.selectInstance(instances);
		}

		return this._selectInstance(instances);
		
	}



	private getHandleUser = (instance_id:string, handle_id:number) : string => {

		const instance = this.instances[instance_id];

		if (instance) {

			const user_id = instance.handles[handle_id];

			return user_id;

		}
		
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

export default Janus;
