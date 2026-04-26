const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [...(config.watchFolders || []), workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// config.resolver.disableHierarchicalLookup = true;

// Resolve .js imports → .ts source files for workspace packages (ESM compat)
const origResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // For imports within the shared package that use .js extensions
  if (moduleName.endsWith('.js') && !moduleName.includes('node_modules')) {
    const tsName = moduleName.replace(/\.js$/, '.ts');
    try {
      return (origResolveRequest || context.resolveRequest)(
        context,
        tsName,
        platform,
      );
    } catch {
      // Fall through to default resolution
    }
  }
  return (origResolveRequest || context.resolveRequest)(
    context,
    moduleName,
    platform,
  );
};

module.exports = withNativeWind(config, { input: "./src/global.css" });
