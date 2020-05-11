const path = require(`path`);

const webpack = require(`webpack`);

const CopyWebpackPlugin = require('copy-webpack-plugin');   



module.exports = (env) => {
  
	return {

		mode : env,
    
		devtool : env === `development` ? `eval` : `none`,

		entry : {
			"janus-gateway-client" : `./lib/janus-gateway-client.ts`
		},

		output : {
			filename : `[name].js`,
			path : path.resolve(__dirname, env)
		},
      
		resolve : {
			extensions : [ `.ts`, `.tsx`, `.js`, `.json`, `.css` ]
		},
    
		module : {
			rules : [
				{
					test : /\.(ts|tsx)?$/,
					exclude : path.resolve(__dirname, `node_modules`),
					loader : `ts-loader`
				},
				{
					test : /\.(js|jsx)$/,
					use : {
						loader : `babel-loader`,
						options : {
							presets : [
								`@babel/preset-env`,
								`@babel/preset-react`
							],
							plugins : [
								`@babel/plugin-proposal-class-properties`
							]
						}
					},
					exclude : /node_modules/
				}
			]
		},
      
		target : `web`,

		plugins : [
			new webpack.DefinePlugin({
				'process.env.NODE_ENV' : JSON.stringify(env)
			}),
			new CopyWebpackPlugin([ 
				{ from : "./development", to : "" }
			])
		]

	};

};
