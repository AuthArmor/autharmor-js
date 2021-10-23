const path = require("path");
const commonConfig = require("./webpack.config");

module.exports = {
  ...commonConfig,
  devtool: undefined,
  output: {
    filename: "index.umd.js",
    hashDigestLength: 8,
    path: path.resolve(__dirname, "build")
  }
};
