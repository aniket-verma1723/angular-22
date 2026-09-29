import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

export const P10_INITIAL_RAW_BYTES = 667223;

const isJavaScript = name => /\.(?:[cm]?js)$/i.test(name);
const isBundle = name => isJavaScript(name) || /\.css$/i.test(name);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
// Do not ban test-runner globals: CDK's shipped _isTestEnvironment references them.
// Likewise, public session practice credentials and fictional lab data are intentional.
const markers = [
  'MockProductBackend', 'mockApiInterceptor', 'P02 Mock Product',
  'Mock scenarios require a supported outcome', 'Simulated API failure.',
  'HttpTestingController', 'jasmine.createSpy'
];

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function requireBytes(value, label) {
  requireValue(Number.isSafeInteger(value) && value >= 0, `${label}: expected nonnegative safe integer bytes`);
}

// Stats output keys are relative to browser/, not the workspace or stats file.
// Reject aliases, Windows drives/ADS, separators and traversal on every platform.
function outputPath(value, label) {
  requireValue(typeof value === 'string' && value.length > 0 &&
    !/[\\:\x00-\x1f<>"|?*]/.test(value) &&
    value.split('/').every(part => part !== '' && part !== '.' && part !== '..' && !/[. ]$/.test(part)),
  `${label}: unsafe output path ${JSON.stringify(value)}`);
  return value;
}

function checkInput(name, label) {
  requireValue(typeof name === 'string' && name.length > 0, `${label}: expected nonempty input path`);
  const path = posix.normalize(name.replaceAll('\\', '/')).toLowerCase();
  const forbidden = /(?:^|\/)core\/mock(?:\/|$)|(?:^|\/)app\/testing(?:\/|$)|(?:^|\/)@testing-library(?:\/|$)|(?:^|[/.])testing(?:[/.]|$)|\.(?:spec|test)\.[^/]+$|(?:^|[/._-])(?:spec|test)[._-]?helpers?(?:[./_-]|$)|(?:providers?\.mock|mock[._-]?providers?)(?:[./_-]|$)/;
  requireValue(!forbidden.test(path), `${label}: forbidden production input ${JSON.stringify(name)}`);
  requireValue(!/(?:^|\/)node_modules\/zone\.js(?:\/|$)/.test(path),
    `${label}: forbidden production input (Zone.js is test-only) ${JSON.stringify(name)}`);
}

function validateStats(stats) {
  requireValue(isRecord(stats), 'stats: expected an object');
  requireValue(isRecord(stats.inputs), 'stats.inputs: expected an object');
  requireValue(isRecord(stats.outputs) && Object.keys(stats.outputs).length > 0,
    'stats.outputs: expected a nonempty object');
  for (const [name, input] of Object.entries(stats.inputs)) {
    checkInput(name, 'stats.inputs');
    requireValue(isRecord(input), `input ${name}: expected an object`);
    requireBytes(input.bytes, `input ${name}.bytes`);
  }
  const outputs = new Map(Object.entries(stats.outputs));
  for (const [name, output] of outputs) {
    outputPath(name, 'stats.outputs');
    requireValue(isRecord(output), `output ${name}: expected an object`);
    requireBytes(output.bytes, `output ${name}.bytes`);
    requireValue(isRecord(output.inputs), `output ${name}.inputs: expected an object`);
    requireValue(Array.isArray(output.imports), `output ${name}.imports: expected an array`);
    if (output.entryPoint !== undefined) checkInput(output.entryPoint, `output ${name}.entryPoint`);
    if (output['ng-component'] !== undefined) {
      requireValue(typeof output['ng-component'] === 'boolean' && /\.css$/i.test(name),
        `output ${name}: ng-component must be a boolean on a CSS record`);
    }
    for (const [input, contribution] of Object.entries(output.inputs)) {
      checkInput(input, `output ${name}`);
      requireValue(isRecord(contribution), `output ${name} input ${input}: expected an object`);
      requireBytes(contribution.bytesInOutput, `output ${name} input ${input}.bytesInOutput`);
      requireValue(Object.hasOwn(stats.inputs, input), `output ${name}: missing stats input ${input}`);
    }
    for (const item of output.imports) {
      requireValue(isRecord(item) && typeof item.path === 'string' && item.path.length > 0 &&
        ['import-statement', 'dynamic-import', 'require-call', 'require-resolve', 'import-rule', 'url-token'].includes(item.kind) &&
        (item.external === undefined || typeof item.external === 'boolean'),
      `output ${name}.imports: expected path, supported kind and optional boolean external`);
      if (!item.external) {
        outputPath(item.path, `output ${name} import`);
        requireValue(outputs.has(item.path), `output ${name}: missing imported output ${item.path}`);
      }
    }
    if (output.cssBundle !== undefined) {
      outputPath(output.cssBundle, `output ${name}.cssBundle`);
      requireValue(outputs.has(output.cssBundle) && /\.css$/i.test(output.cssBundle),
        `output ${name}: missing CSS output ${output.cssBundle}`);
    }
  }
  return outputs;
}

/**
 * Pure audit: no filesystem, process, clock or network access; does not mutate arguments.
 * artifacts is a Map of exact browser-relative paths to Buffers (including all emitted JS).
 * Known-path/marker checks are regression guards, NOT a security certification.
 */
export function auditBundle(stats, artifacts) {
  const outputs = validateStats(stats);
  requireValue(artifacts instanceof Map, 'artifacts: expected a Map of relative paths to Buffers');
  for (const [name, content] of artifacts) {
    outputPath(name, 'artifacts');
    requireValue(Buffer.isBuffer(content), `artifact ${name}: expected a Buffer`);
    if (isBundle(name)) {
      requireValue(outputs.has(name) && !outputs.get(name)['ng-component'],
        `unexpected emitted JS/CSS artifact ${name}: no matching emitted stats output`);
    }
  }
  const emitted = [...outputs].filter(([, output]) => !output['ng-component']);
  for (const [name, output] of emitted) {
    const content = artifacts.get(name);
    requireValue(content !== undefined, `missing emitted artifact ${name}`);
    requireValue(content.length === output.bytes,
      `artifact ${name}: byte mismatch (stats ${output.bytes}, file ${content.length})`);
    if (isJavaScript(name)) {
      const text = content.toString('utf8');
      for (const marker of markers) {
        requireValue(!text.includes(marker), `artifact ${name}: forbidden mock/test marker ${JSON.stringify(marker)}`);
      }
    }
  }

  const entryKinds = [
    ['main', entry => entry === 'src/main.ts', isJavaScript, false],
    ['polyfills', entry => entry === 'angular:polyfills:angular:polyfills', isJavaScript, true],
    ['styles', entry => entry === 'angular:styles/global:styles', name => /\.css$/i.test(name), false]
  ];
  const roots = entryKinds.flatMap(([label, matches, extension, optional]) => {
    const candidates = emitted.filter(([name, output]) => matches(output.entryPoint) && extension(name));
    // Zoneless builds may have no polyfills entry; if present it must still be unambiguous.
    if (optional && candidates.length === 0) return [];
    requireValue(candidates.length === 1, `initial ${label}: expected exactly one entry output, found ${candidates.length}`);
    return [candidates[0][0]];
  });
  // An iterative visited set handles duplicates, shared dependencies and valid ESM cycles.
  const initial = new Set();
  const visited = new Set();
  const pending = [...roots];
  while (pending.length > 0) {
    const name = pending.pop();
    if (visited.has(name)) continue;
    visited.add(name);
    const output = outputs.get(name);
    if (output['ng-component']) continue;
    if (isBundle(name)) initial.add(name);
    for (const item of output.imports) {
      if (!item.external && item.kind !== 'dynamic-import') pending.push(item.path);
    }
    if (output.cssBundle) pending.push(output.cssBundle);
  }

  const initialFiles = [...initial].sort().map(path => ({
    path, rawBytes: outputs.get(path).bytes,
    gzipEstimateBytes: gzipSync(artifacts.get(path), { level: 9 }).length
  }));
  const initialRawBytes = initialFiles.reduce((total, file) => total + file.rawBytes, 0);
  requireBytes(initialRawBytes, 'initial total');
  const dynamicTargets = new Set([...outputs.values()].flatMap(output => output.imports
    .filter(item => !item.external && item.kind === 'dynamic-import').map(item => item.path)));
  const lazyEntries = [...dynamicTargets].sort()
    .filter(name => !initial.has(name) && isJavaScript(name))
    .map(path => ({ path, entryPoint: outputs.get(path).entryPoint ?? null, entryRawBytes: outputs.get(path).bytes }));
  return {
    scope: 'Production artifact regression audit, not a security certification or browser performance measurement.',
    emittedJavaScriptFiles: emitted.filter(([name]) => isJavaScript(name)).length,
    verifiedEmittedFiles: emitted.length,
    ignoredComponentStyleRecords: outputs.size - emitted.length,
    initial: {
      roots, files: initialFiles, rawBytes: initialRawBytes,
      gzipEstimateBytes: initialFiles.reduce((total, file) => total + file.gzipEstimateBytes, 0),
      gzipMethod: 'Sum of individually gzip-compressed files at level 9; not network transfer size. Compare using the same Node/zlib version.',
      excluded: 'Dynamic imports, source maps, non-JS/CSS assets and embedded ng-component CSS records.'
    },
    p10Comparison: {
      baselineRawBytes: P10_INITIAL_RAW_BYTES,
      deltaRawBytes: initialRawBytes - P10_INITIAL_RAW_BYTES,
      policy: 'Informational comparison, not a pass/fail threshold. Angular build budgets remain authoritative.'
    },
    lazyEntries,
    lazyEntryMeaning: 'Dynamic-import entry file bytes only (routes, components or defer entries); NOT total route/dependency cost.',
    externalImports: [...new Set([...outputs.values()].flatMap(output => output.imports
      .filter(item => item.external).map(item => item.path)))].sort()
  };
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read JSON ${path}: ${error.message}`, { cause: error });
  }
}

function containedPath(root, name) {
  const target = resolve(root, outputPath(name, 'artifact'));
  const actual = realpathSync(target);
  const inside = relative(root, actual);
  requireValue(inside !== '..' && !inside.startsWith(`..${sep}`) && !isAbsolute(inside),
    `artifact ${name}: resolved path escapes emitted root`);
  return actual;
}

/** Read-only disk adapter. Reject symlinks and extra JS/CSS left by stale builds. */
export function auditBuild(statsPath = 'dist/angular-22/stats.json', emittedRoot = join(dirname(statsPath), 'browser')) {
  const stats = readJson(statsPath);
  const outputs = validateStats(stats); // Validate paths BEFORE any output-derived filesystem access.
  const root = realpathSync(emittedRoot);
  const artifacts = new Map();
  const expected = new Set([...outputs].filter(([, output]) => !output['ng-component']).map(([name]) => name));
  const directories = [''];
  while (directories.length > 0) {
    const directory = directories.pop();
    const location = directory === '' ? root : containedPath(root, directory);
    for (const entry of readdirSync(location, { withFileTypes: true })) {
      const name = directory === '' ? entry.name : `${directory}/${entry.name}`;
      requireValue(!entry.isSymbolicLink(), `artifact ${name}: symbolic links are not supported`);
      if (entry.isDirectory()) directories.push(name);
      else if (isBundle(name) || expected.has(name)) {
        const path = containedPath(root, name);
        const metadata = statSync(path);
        requireValue(metadata.isFile(), `artifact ${name}: expected a regular file`);
        const content = readFileSync(path);
        requireValue(metadata.size === content.length, `artifact ${name}: size changed during audit; rebuild and retry`);
        artifacts.set(name, content);
      }
    }
  }
  return auditBundle(stats, artifacts);
}

// Importing this module in node:test has no CLI side effects.
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    requireValue(process.argv.length <= 4, 'Usage: node tools/quality/bundle-audit.mjs [stats.json] [browser-root]');
    const report = auditBuild(process.argv[2], process.argv[3]);
    const configPath = fileURLToPath(new URL('../../angular.json', import.meta.url));
    const config = readJson(configPath);
    const budgets = config?.projects?.['angular-22']?.architect?.build?.configurations?.production?.budgets;
    requireValue(Array.isArray(budgets), `${configPath}: missing production budgets`);
    console.log(JSON.stringify({ ...report, initialBudgetConfiguration: budgets.filter(budget => budget.type === 'initial') }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ error: error.message }));
    process.exitCode = 1;
  }
}
