export const logger = {
	info : (message, tag?) => {

		console.log("\x1b[32m", `[janus-gateway-node]${tag ? ` [${tag}]` : ``} ${message}`);
	},
	error : (message) => {

		if (typeof message==="string") {
			console.log("\x1b[31m", `[janus-gateway-node] ${message}`);
		} else {
			try {
				const string = JSON.stringify(message, null, 2);
				console.log("\x1b[31m", `[janus-gateway-node] ${string}`);
			} catch(error) {}
		}
	},
	json : (object) => {

		const string = JSON.stringify(object, null, 2); 

		console.log("\x1b[37m", `[janus-gateway-node] ${string}`);
	}
};
