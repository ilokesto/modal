import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import {
  RELEASE_COMMIT, adaptInstallations, buildSnapshot, collectExamples, currentManifestHash,
  generatePublication, hash, importSpecifiers, inventory, promotePublication,
  releaseEntry, rewriteExampleImports, tarFiles, validateManifest, verifyDocsRevision,
  verifyPublication, verifySnapshot, writeImmutableSnapshot,
} from '../../scripts/docs-publication.mjs';
import { diskFiles, git, gitText, json } from '../../scripts/docs-publication/io.mjs';
import { receiptLayout, sourceLayout } from '../../scripts/docs-publication/layout.mjs';

const rootDir = path.resolve(import.meta.dirname, '../..');
const candidate = JSON.parse(await readFile(path.join(rootDir, 'docs-publication/candidate.json'), 'utf8'));
const selected = candidate.packages.modal;

async function fixture(t, { active = true } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'modal-publication-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'docs-publication'));
  await cp(path.join(rootDir, 'docs-publication/releases'), path.join(root, 'docs-publication/releases'), { recursive: true });
  await cp(path.join(rootDir, 'docs-publication/archive-index.json'), path.join(root, 'docs-publication/archive-index.json'));
  await writeFile(path.join(root, 'docs-publication/candidate.json'), json(candidate));
  if (active) await writeFile(path.join(root, 'docs-publication/active.json'), json(candidate));
  return root;
}

test('Modal selected snapshot: original Git and npm identities -> exact byte equality', async () => {
  const verified = await verifyPublication({ rootDir });
  assert.deepEqual([...verified.snapshots.keys()], ['modal']);
  const snapshot = verified.snapshots.get('modal');
  assert.equal(snapshot.receipt.schemaVersion, 2);
  assert.equal(snapshot.receipt.exampleSource.commit, selected.docsCommit);
  assert.equal(snapshot.receipt.runtimeSource.commit, selected.releaseCommit);
  assert.equal(snapshot.receipt.registry.gitHead, null);
  assert.equal(snapshot.receipt.registry.attestations, null);
  assert.deepEqual(inventory(tarFiles(snapshot.files.get('npm/package.tgz'))), snapshot.receipt.registry.files);
  let documents = 0;
  for (const [file, bytes] of snapshot.files) {
    if (file.startsWith('revision/docs/') && file.endsWith('.mdx')) documents++;
    if (!file.startsWith('release/') && !file.startsWith('revision/')) continue;
    const [label, ...suffix] = file.split('/');
    const sha = label === 'release' ? selected.releaseCommit : selected.docsCommit;
    assert.deepEqual(bytes, git(rootDir, ['show', `${sha}:packages/modal/${suffix.join('/')}`]));
  }
  assert.ok(documents > 0);
  const rebuilt = buildSnapshot({
    rootDir, entry: snapshot.receipt.package, tarball: snapshot.files.get('npm/package.tgz'),
    report: snapshot.files.get('provenance/release-provenance.md'),
  });
  assert.deepEqual(rebuilt.files.get('receipt.json'), snapshot.files.get('receipt.json'));
});

test('schema 1 archive: original example commit -> retained without reinterpretation', async () => {
  const bytes = await readFile(path.join(rootDir, 'docs-publication/releases/modal/2.0.0/r1/receipt.json'));
  const receipt = JSON.parse(bytes);
  const result = await verifySnapshot({ rootDir, entry: { ...receipt.package, receiptSha256: hash(bytes) } });
  assert.equal(result.receipt.schemaVersion, 1);
  assert.equal(result.receipt.exampleSource.commit, RELEASE_COMMIT);
  assert.equal(receiptLayout(receipt, 'modal').kind, 'monorepo-v1');
});

test('publication identity: foreign, partial, unsafe, or forged fields -> rejected', () => {
  for (const change of [
    manifest => { delete manifest.packages.modal; },
    manifest => { manifest.packages.toast = manifest.packages.modal; },
    manifest => { delete manifest.packages.modal.docsCommit; },
    manifest => { manifest.packages.modal.name = '@ilokesto/state'; },
    manifest => { manifest.packages.modal.channel = 'beta'; },
    manifest => { manifest.packages.modal.version = '0.0.0'; },
    manifest => { manifest.packages.modal.snapshot = '../escape'; },
    manifest => { manifest.packages.modal.revision = 0; },
    manifest => { manifest.packages.modal.extra = true; },
  ]) {
    const invalid = structuredClone(candidate);
    change(invalid);
    assert.throws(() => validateManifest(invalid), /Docs publication:/);
  }
  assert.throws(() => verifyDocsRevision({ rootDir, releaseCommit: RELEASE_COMMIT, docsCommit: 'HEAD' }), /explicit full commit/);
  verifyDocsRevision({ rootDir, releaseCommit: RELEASE_COMMIT, docsCommit: selected.docsCommit });
});

test('immutable snapshots: payload, receipt, tarball, extra file, and symlink mutation -> rejected', async t => {
  const root = await fixture(t);
  const base = path.join(root, selected.snapshot);
  for (const file of ['revision/docs/index.mdx', 'release/README.md', 'examples/apps/docs/components/demos/modal-demo.tsx', 'npm/package.tgz', 'receipt.json']) {
    const target = path.join(base, file);
    const original = await readFile(target);
    const changed = Buffer.from(original);
    changed[changed.length - 1] ^= 1;
    await writeFile(target, changed);
    await assert.rejects(verifyPublication({ rootDir: root }), /snapshot receipt SHA-256|snapshot file inventory|tarball SRI/);
    await writeFile(target, original);
  }
  await writeFile(path.join(base, 'extra.txt'), 'extra');
  await assert.rejects(verifySnapshot({ rootDir: root, entry: selected }), /snapshot file inventory/);
  await rm(path.join(base, 'extra.txt'));
  await symlink('release/README.md', path.join(base, 'link'));
  await assert.rejects(verifySnapshot({ rootDir: root, entry: selected }), /not a regular file/);
});

test('inactive archive: one receipt byte changed -> publication command rejects it', async t => {
  const root = await fixture(t);
  const file = path.join(root, 'docs-publication/releases/modal/2.0.0/r1/receipt.json');
  await writeFile(file, Buffer.concat([await readFile(file), Buffer.from('\n')]));
  await assert.rejects(verifyPublication({ rootDir: root }), /snapshot receipt SHA-256/);
});

test('generation: changed current source and stale outputs -> frozen bytes and unrelated outputs preserved', async t => {
  const root = await fixture(t);
  await mkdir(path.join(root, 'docs-publication/.generated/historical'), { recursive: true });
  await writeFile(path.join(root, 'docs-publication/.generated/historical/sentinel'), 'historical');
  await generatePublication({ rootDir: root });
  const before = inventory(await diskFiles(path.join(root, 'docs-publication/.generated')));
  const examples = inventory(await diskFiles(path.join(root, 'docs-publication/runtime/.generated')));
  await mkdir(path.join(root, 'docs'));
  await writeFile(path.join(root, 'docs/index.mdx'), 'uncommitted current content');
  await writeFile(path.join(root, 'docs-publication/.generated/modal/docs/stale.mdx'), 'stale');
  await writeFile(path.join(root, 'docs-publication/runtime/.generated/modal/stale.ts'), 'stale');

  await generatePublication({ rootDir: root });

  assert.deepEqual(inventory(await diskFiles(path.join(root, 'docs-publication/.generated'))), before);
  assert.deepEqual(inventory(await diskFiles(path.join(root, 'docs-publication/runtime/.generated'))), examples);
  const generated = await readFile(path.join(root, 'docs-publication/runtime/.generated/modal/modal-demo.tsx'), 'utf8');
  assert.ok(importSpecifiers(generated).some(item => item.value === '@ilokesto/released-modal'));
  assert.ok(importSpecifiers(generated).some(item => item.value === '@ilokesto/released-overlay'));
});

test('import adaptation: executable imports versus displayed strings -> only executable edges rewritten', () => {
  const source = "import { createOverlayStore } from '@ilokesto/overlay';\nimport { ModalProvider } from '@ilokesto/modal';\nimport { DemoFrame } from './demo-frame';\nimport styles from '../landings/store-landing.module.css';\n"
    + "const dynamic = import('@ilokesto/state/react');\nconst displayed = `import { Store } from '@ilokesto/store';`;\n// import x from '@ilokesto/store';";
  const sourcePath = 'apps/docs/components/demos/modal-demo.tsx';
  const frozen = new Set([sourcePath, 'apps/docs/components/demos/helper.ts']);
  const output = rewriteExampleImports(source, sourcePath, frozen);
  assert.deepEqual(importSpecifiers(output).map(item => item.value), [
    '@ilokesto/released-overlay', '@ilokesto/released-modal', '@/components/demos/demo-frame',
    '@/components/landings/store-landing.module.css', '@ilokesto/released-state/react',
  ]);
  assert.equal(output.split('\n').slice(-2).join('\n'), source.split('\n').slice(-2).join('\n'));
  assert.throws(() => rewriteExampleImports('const x = import(variable);', sourcePath, frozen), /nonliteral executable import/);
  assert.throws(() => rewriteExampleImports("import x from './missing';", sourcePath, frozen), /unresolved frozen helper/);
  assert.throws(() => rewriteExampleImports("import x from '@ilokesto/unknown';", sourcePath, frozen), /unrecognized example package/);
  assert.equal(collectExamples(rootDir, RELEASE_COMMIT, 'modal').files.size, 1);
});

test('installation adaptation: shell fences versus TypeScript -> pinned install commands only', () => {
  const source = '```package-install\n@ilokesto/modal ky\n```\n```bash\npnpm add @ilokesto/modal\n'
    + 'echo @ilokesto/modal\n```\n```ts\nconst command = "pnpm add @ilokesto/modal";\n```\n';
  const adapted = adaptInstallations(source, candidate.packages);
  assert.ok(adapted.includes('@ilokesto/modal@2.0.0 ky'));
  assert.ok(adapted.includes('pnpm add @ilokesto/modal@2.0.0\n'));
  assert.ok(adapted.includes('echo @ilokesto/modal\n'));
  assert.ok(adapted.endsWith('```ts\nconst command = "pnpm add @ilokesto/modal";\n```\n'));
  assert.equal(adaptInstallations(adapted, candidate.packages), adapted);
});

test('immutable writes: differing payload -> refuse overwrite', async t => {
  const root = await fixture(t);
  const target = path.join(root, 'new-snapshot');
  const files = new Map([['docs/index.mdx', Buffer.from('original')]]);
  await writeImmutableSnapshot(target, files);
  await writeImmutableSnapshot(target, files);
  await assert.rejects(writeImmutableSnapshot(target, new Map([['docs/index.mdx', Buffer.from('changed')]])), /refusing overwrite/);
  assert.equal(await readFile(path.join(target, 'docs/index.mdx'), 'utf8'), 'original');
});

test('promotion: stale or invalid candidate -> active bytes remain unchanged', async t => {
  const root = await fixture(t, { active: false });
  assert.equal(await currentManifestHash(root), 'none');
  await assert.rejects(promotePublication({ rootDir: root }), /requires --expected-current/);
  const target = path.join(root, 'docs-publication/candidate.json');
  await writeFile(target, json({ schemaVersion: 1, packages: {} }));
  await assert.rejects(promotePublication({ rootDir: root, expectedCurrent: 'none' }), /empty publication/);
  assert.equal(await currentManifestHash(root), 'none');
  await writeFile(target, json(candidate));
  const result = await promotePublication({ rootDir: root, expectedCurrent: 'none' });
  await assert.rejects(promotePublication({ rootDir: root, expectedCurrent: 'none' }), /stale promotion/);
  await writeFile(path.join(root, selected.snapshot, 'revision/docs/index.mdx'), 'corrupt');
  await assert.rejects(promotePublication({ rootDir: root, expectedCurrent: result.hash }), /snapshot file inventory/);
  assert.equal(await currentManifestHash(root), result.hash);
});

test('source layout: explicit schema discriminant -> no missing-file fallback', () => {
  assert.deepEqual(sourceLayout('standalone-v1', 'modal'), { kind: 'standalone-v1', packageBase: '', app: 'website' });
  for (const schemaVersion of [1, 2]) {
    assert.equal(receiptLayout({ schemaVersion }, 'modal').packageBase, 'packages/modal/');
    assert.throws(() => receiptLayout({ schemaVersion, sourceLayout: 'standalone-v1' }, 'modal'), /legacy receipt/);
  }
  assert.equal(receiptLayout({ schemaVersion: 3, sourceLayout: 'standalone-v1' }, 'modal').app, 'website');
  assert.throws(() => receiptLayout({ schemaVersion: 3 }, 'modal'), /explicit standalone/);
  assert.throws(() => sourceLayout('auto', 'modal'), /unsupported source layout/);
  assert.throws(() => collectExamples(rootDir, RELEASE_COMMIT, 'modal', 'standalone-v1'), /missing example source/);
});

test('schema 3 capture: actual root Git tree and website helpers -> capture and verify explicit layout', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'modal-layout-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'repository');
  execFileSync('git', ['clone', '--no-local', '--quiet', rootDir, root], { env: { ...process.env, GIT_MASTER: '1', GIT_PAGER: 'cat' } });
  git(root, ['read-tree', `${RELEASE_COMMIT}:packages/modal`]);
  // A standalone capture cannot declare workspace: ranges; expand them exactly as
  // the published manifest does (workspace:^2.0.0 -> ^2.0.0).
  const baselineManifest = git(root, ['show', `${RELEASE_COMMIT}:packages/modal/package.json`]).toString('utf8');
  const standaloneManifest = baselineManifest.replace(/"workspace:([^"]+)"/g, '"$1"');
  const manifestPath = path.join(root, 'standalone-package.json');
  await writeFile(manifestPath, standaloneManifest);
  const manifestBlob = git(root, ['hash-object', '-w', manifestPath]).toString().trim();
  git(root, ['update-index', '--add', '--cacheinfo', `100644,${manifestBlob},package.json`]);
  await rm(manifestPath);
  const originals = collectExamples(rootDir, RELEASE_COMMIT, 'modal');
  for (const record of originals.entries) {
    git(root, ['update-index', '--add', '--cacheinfo', `${record.mode},${record.blob},${record.path.replace('apps/docs/', 'website/')}`]);
  }
  const tree = gitText(root, ['write-tree']);
  const commit = git(root, ['commit-tree', tree, '-m', 'Standalone layout fixture'], {
    env: { ...process.env, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.test',
      GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.test' },
  }).toString().trim();
  await cp(path.join(rootDir, 'scripts'), path.join(root, 'fixture-scripts'), { recursive: true });
  const catalogPath = path.join(root, 'fixture-scripts/docs-publication/catalog.mjs');
  const catalog = await readFile(catalogPath, 'utf8');
  await writeFile(catalogPath, catalog.replace('releaseCommit: RELEASE_COMMIT,', `releaseCommit: '${commit}', sourceLayout: 'standalone-v1',`));
  await symlink(path.join(rootDir, 'node_modules'), path.join(root, 'node_modules'));
  const module = await import(pathToFileURL(path.join(root, 'fixture-scripts/docs-publication/snapshot.mjs')).href);
  const original = await verifySnapshot({ rootDir, entry: selected });
  const entry = module.releaseEntry('modal', commit, commit, 3);

  const built = module.buildSnapshot({ rootDir: root, entry, layout: 'standalone-v1',
    tarball: original.files.get('npm/package.tgz'), report: original.files.get('provenance/release-provenance.md') });

  assert.equal(built.receipt.schemaVersion, 3);
  assert.equal(built.receipt.sourceLayout, 'standalone-v1');
  assert.ok(built.receipt.releaseSource.files.every(file => !file.path.startsWith('packages/')));
  assert.ok(built.receipt.exampleSource.files.every(file => file.path.startsWith('website/')));
  assert.deepEqual(built.files.get('npm/package.tgz'), original.files.get('npm/package.tgz'));
  await writeImmutableSnapshot(path.join(root, entry.snapshot), built.files);
  const withDigest = { ...entry, receiptSha256: hash(built.files.get('receipt.json')) };
  await module.verifySnapshot({ rootDir: root, entry: withDigest });
  const corrupt = { ...built.receipt };
  delete corrupt.sourceLayout;
  const bytes = Buffer.from(json(corrupt));
  await writeFile(path.join(root, entry.snapshot, 'receipt.json'), bytes);
  await assert.rejects(module.verifySnapshot({ rootDir: root, entry: { ...withDigest, receiptSha256: hash(bytes) } }), /explicit standalone/);
});

test('publication CLI: exact candidate -> verified without active mutation', async () => {
  const before = await currentManifestHash(rootDir);
  const stdout = execFileSync(process.execPath, ['scripts/docs-publication.mjs', 'verify', '--manifest', 'docs-publication/candidate.json'], { cwd: rootDir, encoding: 'utf8' });
  assert.deepEqual(JSON.parse(stdout), { packages: ['modal'], verified: true });
  assert.equal(await currentManifestHash(rootDir), before);
});
