import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import sourceMaps from 'rollup-plugin-sourcemaps';
import typescript from 'rollup-plugin-typescript2';
import copy from 'rollup-plugin-copy';
const pkg = {
  "main": "dist/index.js",
  "module": "dist/index.esm.js"
};

export default {
  input: `janus-gateway-node.ts`,
  output: [
    {
      name: 'janus-gateway-node', 
      file: pkg.main,
      format: 'cjs',
      sourcemap: false
    },
    {
      name: 'janus-gateway-node', 
      file: pkg.module,
      format: 'es',
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
    sourceMaps(),
    copy({
      targets: [
        { src: './package.json', dest: 'dist' },
        { src: './README.md', dest: 'dist' }
      ]
    })
  ]
}
