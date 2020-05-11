import typescript from '@rollup/plugin-typescript';
import babel from 'rollup-plugin-babel';
import nodeResolve from 'rollup-plugin-node-resolve';
console.log('configure...');

export default {
  input: 'lib/janus-gateway-client.ts',
  plugins: [typescript()]
};
