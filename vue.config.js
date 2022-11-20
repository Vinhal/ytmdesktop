const path = require("path");
const webpackNodeExternals = require("webpack-node-externals");

/**
 * @type {import("electron-builder").Configuration} builderOptions
 */
const builderOptions = {
  publish: ["github"],
  appId: "net.venipa.ytmdesktop",
  productName: "ytmusic",
  extraMetadata: {
    name: "ytmusic",
  },
  mac: {
    category: "public.app-category.music",
  },
  dmg: {
    title: "Install/Update ${productName} ${version}",
  },
  linux: {
    target: ["deb"],
    category: "Music",
    description: "Youtube Music desktop app",
  },
  squirrelWindows: null,
  nsis: {
    deleteAppDataOnUninstall: true,
  },
  win: {
    target: {
      target: "nsis",
      arch: "x64",
    },
  },
};
/**
 * @type {import('electron-builder').AfterPackContext} electronBuilder
 */
const electronBuilder = {
  mainProcessTypeChecking: false,
  preload: {
    "preload-yt": "src/preload/youtube.ts",
    "preload-api": "src/preload/api.ts",
    api: "src/api/main.ts",
  },
  nodeIntegration: false,
  builderOptions,
  externals: [
    "chokidar",
    "xosms",
    "express",
    "express-ws",
    ...Array.from(webpackNodeExternals()),
  ],
  nodeModulesPath: ["./node_modules"],
};
// const TsConfigPaths = require("tsconfig-paths-webpack-plugin").default;
// const tsConfigAliasMapping = Object.entries(tsconfig.compilerOptions.paths).map(([alias, paths]) => {
//   return [alias.split("/*", 2)[0], path.resolve(__dirname, paths[0].split("/*", 2)[0])];
// });
module.exports = {
  pluginOptions: {
    electronBuilder,
  },
  chainWebpack: (config) => {
    // tsConfigAliasMapping.forEach(([alias, path]) => config.resolve.alias.set(alias, path));
    // config.resolve.plugin("tsconfig-paths").use(new TsConfigPaths());
    config.module
      .rule("raw")
      .test(() => false)
      .use("raw-loader")
      .loader("raw-loader")
      .end();

    config.module.rules.delete("svg");

    config.module
      .rule("svg")
      .test(/\.(svg)(\?.*)?$/)
      .use("vue-loader")
      .loader("vue-loader")
      .end()
      .use("vue-svg-loader")
      .loader("vue-svg-loader");
  },
  configureWebpack: {
    devtool: "source-map",
  },
};
