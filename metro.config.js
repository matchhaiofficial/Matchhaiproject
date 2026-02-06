const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push("ttf");

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  "react-native-svg/css": path.resolve(
    __dirname,
    "src/shims/react-native-svg-css"
  ),
};

module.exports = config;
