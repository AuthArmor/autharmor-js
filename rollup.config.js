import json from "@rollup/plugin-json";
import { terser } from "rollup-plugin-terser";
import babel from "rollup-plugin-babel";

export default {
  input: "src/index.js",
  output: [
    {
      file: "dist/bundle.js",
      format: "cjs"
    },
    {
      file: "dist/bundle.min.js",
      format: "iife",
      name: "AuthArmorSDK",
      plugins: [terser()]
    }
  ],
  plugins: [
    json(),
    babel({
      plugins: ["@babel/plugin-proposal-optional-chaining"]
    })
  ]
};
