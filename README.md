# janus-gateway-node
This package can serve as an intermediate link between janus-gateway-client and collection of dockerized janus-gateway instances.
It can be used as a part of existing setup or being wrapped in top layer api in order to create bridge
between existing application and janus functionality. The simplest approach is taken in regard of how to bind
particular janus-instance to particular client. This is done by means of binding specific room to particular instance.
Instance selector and instances generator can be passed as a callbacks in constructor options. Internal instance selector
rely on simple round robin approach. Instances generator will spawn local instances by default if no callback was supplied.
Top level outside layer can exist which is going to launch instances on external machines and reduce responses in array of configurations
which is going to be returned from generate instances callback. Package based upon [video](https://www.youtube.com/watch?v=zxRwELmyWU0&t=1s) i saw earlier about scaling [janus-gateway](https://github.com/meetecho/janus-gateway).
## Getting Started  
```
yarn add janus-gateway-node 
```  
Summary - janus instances manager, receives messages from clients and dispatches them to correct janus instances (based on location of created room), sending back responses.  

![alt text](https://github.com/IG-88-2/janus-gateway-node/blob/master/xxx.png?raw=true)

Docker image herbert1947/janus-gateway-videoroom
```
docker pull herbert1947/janus-gateway-videoroom:latest 
```
## Usage

Follow this [link](https://github.com/IG-88-2/react-videoroom-janus) to find information on how to use frontend part.  

```
import { Janus } from 'janus-gateway-node';

...

const janus = new Janus();

await janus.initialize();

```
## Options 

### generateInstances

> `() => Promise<JanusInstanceOptions[]>` | optional

return necessary information for every available janus instance required
to establish connection. Example of launch instances script - https://github.com/IG-88-2/janus-gateway-videoroom-tests/blob/master/launchInstances.js

```
janus = new Janus({
    generateInstances : async () : Promise<JanusInstanceOptions[]> => {
        const instances = [];
        const start_ws_port = 8188;
        const start_admin_ws_port = 7188;

        for(let i = 0; i < this.instancesAmount; i++) {
            instances.push({
                id : uuidv1(),
                admin_key : uuidv1(),
                server_name : `instance_${i}`,
                log_prefix : `instance_${i}:`,
                docker_ip :  `127.0.0.${1 + i}`,
                ws_port : start_ws_port + i,
                admin_ws_port : start_admin_ws_port + i,
                stun_server : "stun.voip.eutelia.it",
                nat_1_1_mapping : this.options.publicIp || `127.0.0.${1 + i}`,
                stun_port : 3478,
                debug_level : 5
            });
        }

        await this.launchContainers(instances);
        
        return instances.map(({
            admin_key,
            server_name,
            ws_port,
            docker_ip,
            admin_ws_port,
            log_prefix,
            stun_server, 
            stun_port,
            id,
            debug_level
        }) => {
            return {
                protocol: `ws`,
                address: docker_ip,
                port: ws_port,
                adminPort: admin_ws_port,
                adminKey: admin_key,
                server_name
            };
        });
    }
});
```

### selectInstance

> `(instances:JanusInstance[]) => JanusInstance` | optional

this function is called when room needs to be created, user can make a choice based on current 
instance properties.  

```
janus = new Janus({
    selectInstance:(instances : JanusInstance[]) => {
		
		let instance = instances[this.count];
						
		if (!instance) {
			this.count = 0;
			instance = instances[this.count];
		}

		this.count += 1;

		return instance;

    }
});
```

### updateContext

> `(context:Context) => Promise<Context>` | optional

update rooms data on change.

### retrieveContext

> `() => Promise<Context>` | optional

retrieve rooms data on launch.

### onError

> `(error:any) => void` | optional

in case error occurred this. function will be invoked to notify user about error.  

### logger

> `any` | optional

customize logging.

### keepAliveTimeout

> `number` | optional

keepalive timeout for user.

### syncInterval

> `number` | optional

synchronization interval for janus instances.

### instancesAmount

> `number` | optional

amount of instances to spawn by default.

### publicIp

> `string` | optional

this option will be passed as nat 1 1 mapping to janus.

### webSocketOptions

> `any` | optional

options for websocket server constructor.

```
const keys = { 
    key: fs.readFileSync("/keys/key.pem"),
    cert: fs.readFileSync("/keys/cert.pem")
};

const serverOptions = { 
    key: keys.key, 
    cert: keys.cert 
};

const server = https.createServer(serverOptions, app).listen(443); 

janus = new Janus({
    webSocketOptions:{
        server
    }
});
```

## Instance methods  

### createRoom

> `(message:{ type?:string, load:Data}) => Promise<Response>`

```
const result = await janus.createRoom({
    load: {
        description: `vp8 room`,
        bitrate: 512000,
        bitrate_cap: false,
        videocodec: "vp8"
    }
});
```

## DEMO

[link](https://kreiadesign.com/)

## Contributing
Please consider to help by providing feedback on how this project can be 
improved or what is missing to make it useful for community. Thank you!
## Authors

* **Anatoly Strashkevich**

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
