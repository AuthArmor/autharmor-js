const { nodeResolve } = require("@rollup/plugin-node-resolve");
const commonjs = require("@rollup/plugin-commonjs");
const { babel } = require("@rollup/plugin-babel");
const { terser } = require("rollup-plugin-terser");
const json = require("@rollup/plugin-json");

const pkg = require("./package.json");

const makeConfigForOutput = output => ({
  input: "./src/index.js",
  output,
  plugins: [
    json(),
    babel(),
    nodeResolve({ jsnext: true, preferBuiltins: true, browser: true }),
    commonjs({ extensions: [".ts", ".js"] }),
    terser({
      format: {
        comments: false,
        ecma: 5
      }
    })
  ]
});

module.exports = [
  makeConfigForOutput({
    file: pkg.main,
    format: "umd",
    name: "AuthArmorSDK"
  })
];
