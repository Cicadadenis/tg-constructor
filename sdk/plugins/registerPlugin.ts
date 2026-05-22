import type { CompilerPlugin } from "./plugin";

const plugins: CompilerPlugin[] = [];

export function registerPlugin(plugin: CompilerPlugin) {
  plugins.push(plugin);
}

export function getPlugins() {
  return plugins;
}
