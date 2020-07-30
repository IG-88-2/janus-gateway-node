import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import sourceMaps from 'rollup-plugin-sourcemaps';
import typescript from 'rollup-plugin-typescript2';

export default {
  input: `./lib/janus-gateway-node.ts`,
  output: [
    { 
      file: './dist/index.js', 
      name: 'janus-gateway-node', 
      format: 'umd',
      sourcemap: false 
    }
  ],
  external: [
    "child_process"
  ],
  plugins: [
    typescript({ useTsconfigDeclarationDir: true }),
    commonjs(),
    resolve({
      browser: false,
      preferBuiltins: true
    }),
    sourceMaps()
  ]
}
