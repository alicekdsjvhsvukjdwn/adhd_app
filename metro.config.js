const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// expo-sqlite sur le web : le moteur est un fichier .wasm.
config.resolver.assetExts.push("wasm");

// SharedArrayBuffer (sqlite wasm) exige ces en-têtes, aussi en développement.
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  return middleware(req, res, next);
};

module.exports = config;
