import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { auditBuild, auditBundle, P10_INITIAL_RAW_BYTES } from './bundle-audit.mjs';

function fixture() {
  const stats = { inputs: {}, outputs: {} };
  const artifacts = new Map();
  const add = (name, text, entryPoint, imports = []) => {
    const content = Buffer.from(text);
    artifacts.set(name, content);
    stats.outputs[name] = { bytes: content.length, inputs: {}, imports };
    if (entryPoint !== undefined) {
      stats.inputs[entryPoint] = { bytes: content.length, imports: [] };
      stats.outputs[name].entryPoint = entryPoint;
      stats.outputs[name].inputs[entryPoint] = { bytesInOutput: content.length };
    }
  };
  add('main-A.js', 'console.log("main");', 'src/main.ts', [
    { path: 'shared-A.js', kind: 'import-statement' },
    { path: 'lazy-A.js', kind: 'dynamic-import' }
  ]);
  add('polyfills-A.js', 'console.log("polyfills");', 'angular:polyfills:angular:polyfills');
  add('styles-A.css', 'body { color: black; }', 'angular:styles/global:styles');
  add('shared-A.js', 'export const shared = 1;');
  add('lazy-A.js', 'export const routes = [];', 'src/app/features/cart/cart.routes.ts', [
    { path: 'lazy-shared-A.js', kind: 'import-statement' },
    { path: 'shared-A.js', kind: 'import-statement' },
    { path: 'main-A.js', kind: 'import-statement' }
  ]);
  add('lazy-shared-A.js', 'export const extra = 2;');
  return { stats, artifacts, add };
}

test('initial static graph excludes lazy dependencies and reports per-file gzip and P10 delta', () => {
  const { stats, artifacts } = fixture();
  const before = structuredClone(stats);
  const report = auditBundle(stats, artifacts);
  const initialPaths = ['main-A.js', 'polyfills-A.js', 'shared-A.js', 'styles-A.css'];
  const raw = initialPaths.reduce((total, name) => total + artifacts.get(name).length, 0);
  assert.deepEqual(report.initial.files.map(file => file.path), initialPaths);
  assert.equal(report.initial.rawBytes, raw);
  assert.equal(report.initial.gzipEstimateBytes,
    initialPaths.reduce((total, name) => total + gzipSync(artifacts.get(name), { level: 9 }).length, 0));
  assert.equal(report.p10Comparison.baselineRawBytes, 667223);
  assert.equal(report.p10Comparison.deltaRawBytes, raw - P10_INITIAL_RAW_BYTES);
  assert.equal(report.emittedJavaScriptFiles, 5);
  assert.deepEqual(report.lazyEntries, [{ path: 'lazy-A.js',
    entryPoint: 'src/app/features/cart/cart.routes.ts', entryRawBytes: artifacts.get('lazy-A.js').length }]);
  assert.match(report.lazyEntryMeaning, /NOT total/);
  assert.match(report.initial.gzipMethod, /not network transfer/);
  assert.deepEqual(stats, before);
  assert.deepEqual(auditBundle(stats, artifacts), report);
});

test('duplicate edges, static cycles and dynamic back-edges terminate and count once', () => {
  const { stats, artifacts } = fixture();
  stats.outputs['main-A.js'].imports.push({ path: 'shared-A.js', kind: 'import-statement' });
  stats.outputs['shared-A.js'].imports.push(
    { path: 'main-A.js', kind: 'import-statement' },
    { path: 'shared-A.js', kind: 'import-statement' },
    { path: 'lazy-A.js', kind: 'dynamic-import' }
  );
  const report = auditBundle(stats, artifacts);
  assert.equal(report.initial.files.length, 4);
  assert.equal(report.lazyEntries.length, 1);
});

test('a dynamic target also imported statically is initial, not a lazy-only entry', () => {
  const { stats, artifacts } = fixture();
  stats.outputs['main-A.js'].imports.push({ path: 'lazy-A.js', kind: 'import-statement' });
  const report = auditBundle(stats, artifacts);
  assert.equal(report.initial.files.length, 6);
  assert.deepEqual(report.lazyEntries, []);
});

test('embedded component styles and source maps are not counted; emitted CSS bundles are', () => {
  const { stats, artifacts, add } = fixture();
  add('main-A.js.map', '{"version":3}');
  add('associated.css', 'h1{color:blue}');
  stats.outputs['main-A.js'].cssBundle = 'associated.css';
  stats.outputs['embedded.css'] = { bytes: 1000, inputs: {}, imports: [], 'ng-component': true };
  const report = auditBundle(stats, artifacts);
  assert.equal(report.ignoredComponentStyleRecords, 1);
  assert.equal(report.initial.files.length, 5);
  assert.ok(report.initial.files.some(file => file.path === 'associated.css'));
  assert.ok(report.initial.files.every(file => !file.path.endsWith('.map')));
});

test('external imports are reported without being mistaken for missing local files', () => {
  const { stats, artifacts } = fixture();
  stats.outputs['main-A.js'].imports.push({ path: 'external-package', kind: 'import-statement', external: true });
  assert.deepEqual(auditBundle(stats, artifacts).externalImports, ['external-package']);
});

for (const kind of ['import-statement', 'dynamic-import']) {
  test(`rejects missing ${kind} output, including on a lazy chunk`, () => {
    const { stats, artifacts } = fixture();
    stats.outputs['lazy-A.js'].imports.push({ path: 'missing.js', kind });
    assert.throws(() => auditBundle(stats, artifacts), /lazy-A.js: missing imported output missing.js/);
  });
}

test('rejects missing associated CSS and missing or ambiguous initial entries', () => {
  const { stats, artifacts, add } = fixture();
  stats.outputs['main-A.js'].cssBundle = 'missing.css';
  assert.throws(() => auditBundle(stats, artifacts), /missing CSS output/);
  delete stats.outputs['main-A.js'].cssBundle;
  delete stats.outputs['styles-A.css'].entryPoint;
  assert.throws(() => auditBundle(stats, artifacts), /initial styles/);
  stats.outputs['styles-A.css'].entryPoint = 'angular:styles/global:styles';
  add('second-main.js', '1;', 'src/main.ts');
  assert.throws(() => auditBundle(stats, artifacts), /initial main.*found 2/);
});

test('zoneless builds may omit polyfills without omitting any remaining initial files', () => {
  const { stats, artifacts } = fixture();
  delete stats.outputs['polyfills-A.js'];
  delete stats.inputs['angular:polyfills:angular:polyfills'];
  artifacts.delete('polyfills-A.js');
  const report = auditBundle(stats, artifacts);
  assert.deepEqual(report.initial.roots, ['main-A.js', 'styles-A.css']);
  assert.deepEqual(report.initial.files.map(file => file.path), ['main-A.js', 'shared-A.js', 'styles-A.css']);
  assert.equal(report.initial.rawBytes, report.initial.files.reduce((sum, file) => sum + artifacts.get(file.path).length, 0));
});

test('duplicate optional polyfills entries are still rejected', () => {
  const { stats, artifacts, add } = fixture();
  add('second-polyfills.js', '1;', 'angular:polyfills:angular:polyfills');
  assert.throws(() => auditBundle(stats, artifacts), /initial polyfills.*found 2/);
});

for (const input of [
  'src/app/core/mock/backend.ts', 'src\\app\\core\\mock\\backend.ts',
  'src/app/core/other/../mock/backend.ts', 'src/app/core/./mock/backend.ts',
  'src/app/testing/fixtures.ts', 'src/app/example.spec.ts', 'src/app/example.test.ts',
  'src/app/core/config/app-data.providers.mock.ts', 'src/app/mock-providers.ts',
  'node_modules/@angular/core/fesm2022/testing.mjs', 'node_modules/zone.js/testing/index.js',
  'node_modules/zone.js/fesm2015/zone.js', 'node_modules\\zone.js\\bundles\\zone.umd.js',
  'node_modules/@testing-library/angular/index.js',
  'src/app/features/labs/cdk/cdk-lab.spec-helpers.ts', 'src/app/testhelpers.ts',
  'src/app/test-helper.ts', 'src/app/features/labs/lab.test-helpers.ts'
]) {
  test(`rejects forbidden input ${input}, even with zero emitted contribution`, () => {
    const { stats, artifacts } = fixture();
    stats.inputs[input] = { bytes: 1, imports: [] };
    assert.throws(() => auditBundle(stats, artifacts), /forbidden production input/);
    delete stats.inputs[input];
    stats.outputs['lazy-A.js'].inputs[input] = { bytesInOutput: 0 };
    assert.throws(() => auditBundle(stats, artifacts), /forbidden production input/);
  });
}

test('allows intentional fictional lab fixtures, CDK runtime helpers and public practice credentials', () => {
  const { stats, artifacts, add } = fixture();
  add('lab.js', 'const fictional = "fixture emilys emilyspass practice-only";',
    'src/app/features/labs/components/fixture-sum.pipe.ts');
  add('cdk-runtime.js', 'const isTest = typeof __karma__ !== "undefined" || typeof jasmine !== "undefined";',
    'node_modules/@angular/cdk/fesm2022/_test-environment-chunk.mjs');
  assert.doesNotThrow(() => auditBundle(stats, artifacts));
});

for (const marker of ['P02 Mock Product', 'MockProductBackend', 'mockApiInterceptor', 'jasmine.createSpy',
  'HttpTestingController', 'Mock scenarios require a supported outcome', 'Simulated API failure.']) {
  test(`rejects known emitted marker ${marker}, even in an orphan JS chunk`, () => {
    const { stats, artifacts, add } = fixture();
    add('orphan.js', `console.log(${JSON.stringify(marker)});`);
    assert.throws(() => auditBundle(stats, artifacts), /forbidden mock\/test marker/);
  });
}

test('verifies exact JS paths, not just counts, and checks bytes including UTF-8 and CSS', () => {
  const { stats, artifacts, add } = fixture();
  const original = artifacts.get('shared-A.js');
  artifacts.delete('shared-A.js');
  artifacts.set('same-count-wrong-name.js', original);
  assert.throws(() => auditBundle(stats, artifacts), /unexpected emitted JS\/CSS artifact/);
  artifacts.delete('same-count-wrong-name.js');
  assert.throws(() => auditBundle(stats, artifacts), /missing emitted artifact shared-A.js/);
  artifacts.set('shared-A.js', Buffer.from('incorrect size'));
  assert.throws(() => auditBundle(stats, artifacts), /shared-A.js: byte mismatch/);
  artifacts.set('shared-A.js', original);
  artifacts.set('styles-A.css', Buffer.from(''));
  assert.throws(() => auditBundle(stats, artifacts), /styles-A.css: byte mismatch/);
  add('styles-A.css', '/* élève 日本語 */', 'angular:styles/global:styles');
  assert.doesNotThrow(() => auditBundle(stats, artifacts));
});

for (const path of ['../escape.js', 'folder/../../escape.js', '/escape.js', 'C:/escape.js',
  'C:\\escape.js', '\\\\server\\escape.js', 'file.js:stream', 'folder\\escape.js', './main.js',
  'folder//escape.js', 'folder/../escape.js', 'folder./escape.js', 'bad\u0000.js']) {
  test(`rejects unsafe output path ${JSON.stringify(path)}`, () => {
    const { stats, artifacts } = fixture();
    stats.outputs[path] = { bytes: 0, inputs: {}, imports: [] };
    assert.throws(() => auditBundle(stats, artifacts), /unsafe output path/);
    delete stats.outputs[path];
    stats.outputs['main-A.js'].imports.push({ path, kind: 'dynamic-import' });
    assert.throws(() => auditBundle(stats, artifacts), /unsafe output path/);
  });
}

for (const [label, mutate, error] of [
  ['missing inputs', stats => { delete stats.inputs; }, /stats.inputs/],
  ['empty outputs', stats => { stats.outputs = {}; }, /stats.outputs/],
  ['null output', stats => { stats.outputs['main-A.js'] = null; }, /expected an object/],
  ['negative bytes', stats => { stats.outputs['main-A.js'].bytes = -1; }, /safe integer bytes/],
  ['string bytes', stats => { stats.outputs['main-A.js'].bytes = '12'; }, /safe integer bytes/],
  ['fractional bytes', stats => { stats.outputs['main-A.js'].bytes = 1.5; }, /safe integer bytes/],
  ['unsafe bytes', stats => { stats.outputs['main-A.js'].bytes = Number.MAX_SAFE_INTEGER + 1; }, /safe integer bytes/],
  ['null imports', stats => { stats.outputs['main-A.js'].imports = null; }, /imports.*array/],
  ['unknown import kind', stats => { stats.outputs['main-A.js'].imports[0].kind = 'surprise'; }, /supported kind/],
  ['invalid external', stats => { stats.outputs['main-A.js'].imports[0].external = 'false'; }, /boolean external/],
  ['null contribution', stats => { stats.outputs['main-A.js'].inputs['src/main.ts'] = null; }, /expected an object/],
  ['missing input', stats => { delete stats.inputs['src/main.ts']; }, /missing stats input/],
  ['JS disguised as embedded CSS', stats => { stats.outputs['main-A.js']['ng-component'] = true; }, /ng-component/]
]) {
  test(`schema error is useful: ${label}`, () => {
    const { stats, artifacts } = fixture();
    mutate(stats);
    assert.throws(() => auditBundle(stats, artifacts), error);
  });
}

test('rejects unknown stats and artifact shapes', () => {
  for (const stats of [null, undefined, [], 'text']) {
    assert.throws(() => auditBundle(stats, new Map()), /stats: expected an object/);
  }
  const { stats, artifacts } = fixture();
  assert.throws(() => auditBundle(stats, {}), /expected a Map/);
  artifacts.set('main-A.js', 'not a Buffer');
  assert.throws(() => auditBundle(stats, artifacts), /expected a Buffer/);
});

test('P10 comparison does not impose an additional budget', () => {
  const { stats, artifacts, add } = fixture();
  add('main-A.js', 'x'.repeat(P10_INITIAL_RAW_BYTES + 1), 'src/main.ts');
  assert.ok(auditBundle(stats, artifacts).p10Comparison.deltaRawBytes > 0);
});

function diskFixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'bundle-audit-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const browser = join(directory, 'browser');
  mkdirSync(browser);
  const sample = fixture();
  sample.add('nested/extra.js', 'export const nested = 1;');
  for (const [name, content] of sample.artifacts) {
    mkdirSync(dirname(join(browser, name)), { recursive: true });
    writeFileSync(join(browser, name), content);
  }
  const statsPath = join(directory, 'stats.json');
  writeFileSync(statsPath, JSON.stringify(sample.stats));
  return { ...sample, directory, browser, statsPath };
}

test('disk adapter matches pure audit, uses sibling browser root and ignores copied non-code assets', t => {
  const sample = diskFixture(t);
  writeFileSync(join(sample.browser, 'mock-product.svg'), '<svg/>');
  assert.deepEqual(auditBuild(sample.statsPath), auditBundle(sample.stats, sample.artifacts));
});

test('disk adapter supports explicit emitted root and rejects stale nested JavaScript', t => {
  const sample = diskFixture(t);
  const elsewhere = join(sample.directory, 'elsewhere.json');
  writeFileSync(elsewhere, JSON.stringify(sample.stats));
  assert.doesNotThrow(() => auditBuild(elsewhere, sample.browser));
  writeFileSync(join(sample.browser, 'nested', 'stale.mjs'), 'stale');
  assert.throws(() => auditBuild(sample.statsPath), /unexpected emitted.*nested\/stale.mjs/);
});

test('disk adapter rejects missing and changed emitted files', t => {
  const sample = diskFixture(t);
  writeFileSync(join(sample.browser, 'main-A.js'), 'changed');
  assert.throws(() => auditBuild(sample.statsPath), /byte mismatch/);
  rmSync(join(sample.browser, 'main-A.js'));
  assert.throws(() => auditBuild(sample.statsPath), /missing emitted artifact main-A.js/);
});

test('disk adapter rejects invalid JSON and traversal before opening output-derived paths', t => {
  const sample = diskFixture(t);
  writeFileSync(sample.statsPath, '{invalid');
  assert.throws(() => auditBuild(sample.statsPath), /Cannot read JSON/);
  sample.stats.outputs['../escape.js'] = { bytes: 0, inputs: {}, imports: [] };
  writeFileSync(sample.statsPath, JSON.stringify(sample.stats));
  assert.throws(() => auditBuild(sample.statsPath), /unsafe output path/);
});

test('disk adapter rejects directory symlinks/junctions outside browser root', t => {
  const sample = diskFixture(t);
  const outside = join(sample.directory, 'outside');
  mkdirSync(outside);
  symlinkSync(outside, join(sample.browser, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => auditBuild(sample.statsPath), /symbolic links are not supported/);
});
