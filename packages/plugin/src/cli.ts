#!/usr/bin/env node
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { styleText } from 'node:util';
import { normalizePath, resolveConfig, type Plugin } from 'vite';
import {
  generateStaticAssetsTypes,
  type GenerateStaticAssetsTypesOptions,
  type StaticAssetsPluginOptions,
} from './index.js';

const help = `Usage:
  vsap generate [options]

Options:
  -c, --config <path>         Vite config to load for plugin options
  --no-config                 Do not load vite.config.* before generating
  -r, --root <path>           Root directory for relative paths (default: cwd)
  --mode <mode>               Vite mode for config loading (default: production)
  -d, --directory <path>      Static assets directory (default: public)
  -o, --types-output-file <path>
                              Generated .d.ts path (default: src/static-assets.d.ts)
  -i, --ignore <glob>         Ignore glob; may be passed more than once
  --no-directory-types        Disable StaticAssetDirectory and FilesInFolder
  --max-directory-depth <n>   Maximum directory nesting level for type generation
  -h, --help                  Show this help
`;

interface CliOptions extends GenerateStaticAssetsTypesOptions {
  config?: string;
  loadConfig: boolean;
  mode?: string;
}

interface StaticAssetsPluginWithOptions extends Plugin {
  __staticAssetsPluginOptions: StaticAssetsPluginOptions;
}

function readValue(args: string[], index: number, flag: string) {
  const value = args[index + 1];
  if (!value || value.startsWith('-')) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function parseArgs(args: string[]): { command: string; options: CliOptions } {
  const [command, ...rest] = args;
  const options: CliOptions = { loadConfig: true };

  if (!command || command === '-h' || command === '--help') {
    return { command: 'help', options };
  }

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    switch (arg) {
      case '--root':
      case '-r':
        options.root = readValue(rest, i, arg);
        i++;
        break;
      case '--config':
      case '-c':
        options.config = readValue(rest, i, arg);
        i++;
        break;
      case '--mode':
        options.mode = readValue(rest, i, arg);
        i++;
        break;
      case '--no-config':
        options.loadConfig = false;
        break;
      case '--directory':
      case '-d':
        options.directory = readValue(rest, i, arg);
        i++;
        break;
      case '--types-output-file':
      case '-o':
        options.typesOutputFile = readValue(rest, i, arg);
        i++;
        break;
      case '--ignore':
      case '-i':
        options.ignore = [...(options.ignore || []), readValue(rest, i, arg)];
        i++;
        break;
      case '--no-directory-types':
        options.enableDirectoryTypes = false;
        break;
      case '--max-directory-depth': {
        const value = Number(readValue(rest, i, arg));
        if (!Number.isInteger(value) || value < 1) {
          throw new Error(`${arg} must be an integer >= 1`);
        }
        options.maxDirectoryDepth = value;
        i++;
        break;
      }
      case '-h':
      case '--help':
        return { command: 'help', options };
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return { command, options };
}

function hasStaticAssetsPluginOptions(plugin: Plugin): plugin is StaticAssetsPluginWithOptions {
  return '__staticAssetsPluginOptions' in plugin;
}

function findStaticAssetsOptions(plugins: readonly Plugin[]): StaticAssetsPluginOptions | undefined {
  for (const plugin of plugins) {
    if (hasStaticAssetsPluginOptions(plugin)) {
      return plugin.__staticAssetsPluginOptions;
    }
  }
  return undefined;
}

async function loadViteConfigOptions(options: CliOptions): Promise<GenerateStaticAssetsTypesOptions> {
  if (!options.loadConfig) return {};
  const configLookupRoot = path.resolve(options.root || process.cwd());
  const configFile = options.config ? path.resolve(configLookupRoot, options.config) : undefined;

  const config = await resolveConfig(
    {
      ...(configFile ? { configFile } : {}),
      ...(options.root ? { root: path.resolve(options.root) } : {}),
    },
    'build',
    options.mode || process.env.NODE_ENV || 'production',
  );

  if (!config) return {};

  const pluginOptions = findStaticAssetsOptions(config.plugins);

  return {
    root: config.root,
    ...(pluginOptions || {}),
  };
}

function toGenerateOptions(options: CliOptions): GenerateStaticAssetsTypesOptions {
  const { config: _config, loadConfig: _loadConfig, mode: _mode, ...generateOptions } = options;
  return generateOptions;
}

async function resolveGenerateOptions(options: CliOptions): Promise<GenerateStaticAssetsTypesOptions> {
  const configOptions = await loadViteConfigOptions(options);
  return {
    ...configOptions,
    ...toGenerateOptions(options),
  };
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));

  if (command === 'help') {
    console.log(help);
    return;
  }

  if (command !== 'generate') {
    throw new Error(`Unknown command: ${command}`);
  }

  const generateOptions = await resolveGenerateOptions(options);
  const result = await generateStaticAssetsTypes(generateOptions);
  const root = path.resolve(generateOptions.root || process.cwd());
  const output = normalizePath(result.outputFile).startsWith(`${normalizePath(root)}/`)
    ? normalizePath(result.outputFile).slice(normalizePath(root).length + 1)
    : normalizePath(result.outputFile);
  const state = result.changed ? 'Generated' : 'Already up to date';
  console.log(`${styleText('green', '✓')} ${state} static assets types at ${styleText('blue', output)} (${result.files.length} assets)`);
}

const isDirectRun = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isDirectRun) {
  main().catch((error) => {
    console.error(`${styleText('red', '✗')} ${error instanceof Error ? error.message : String(error)}`);
    console.error(help);
    process.exitCode = 1;
  });
}

export { parseArgs, resolveGenerateOptions };
