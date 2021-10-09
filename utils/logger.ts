const util = require('util');

let enable = true;

export const logger = {
	enable : () => {

        enable = true;
    
    },
    disable : () => {
    
        enable = false;
    
    },
	info : (message) => {

		if (enable) {
            if (typeof message==="string") {
			    console.log("\x1b[32m", `[test info] ${message}`);
            } else {
                try {
					const string = util.inspect(message, {showHidden: false, depth: null});
					console.log("\x1b[32m", `[test info] ${string}`);
				} catch(error) {}
            }
		}

	},
	error : (message) => {
		
		if (enable) {
			if (typeof message==="string") {
				console.log("\x1b[31m", `[test error] ${message}`);
			} else {
				try {
					const string = util.inspect(message, {showHidden: false, depth: null});
					console.log("\x1b[31m", `[test error] ${string}`);
				} catch(error) {}
			}
		}

	},
	json : (object) => {

		if (enable) {
			const string = JSON.stringify(object, null, 2);
			console.log("\x1b[37m", `[test json] ${string}`);
		}

	}
};