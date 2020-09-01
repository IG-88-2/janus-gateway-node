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

### option 1

> `(rooms:JanusRoom[]) => void` | _required_

called when connection established and response arrived for get available rooms request.  

### onError

> `(error:any) => void` | _required_

in case error occurred this. function will be invoked to notify user about error.  

### logger

> `any` | optional

customize logging

## DEMO

[link](https://kreiadesign.com/)

## Contributing
Please consider to help by providing feedback on how this project can be 
improved or what is missing to make it useful for community. Thank you!
## Authors

* **Anatoly Strashkevich**

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
