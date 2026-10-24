import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { verifyCheckpoint, verifyHistory, verifyStandalone } from '../../scripts/verify-migration.mjs';

const repository = path.resolve(import.meta.dirname, '../..');
const manifest = JSON.parse(await readFile(path.join(repository, '.migration/source-manifest.json'), 'utf8'));
const git = (root, args) => execFileSync('git', ['--no-pager', '-C', root, ...args], {
  env: { ...process.env, GIT_MASTER: '1', GIT_PAGER: 'cat', PAGER: 'cat',
    GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.test',
    GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.test' },
  stdio: 'pipe',
});
const put = async (root, file, value) => {
  await mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await writeFile(path.join(root, file), JSON.stringify(value));
};

test('standalone workspace: untracked private workspaces -> checked without sibling links', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'modal-workspace-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  git(root, ['init', '--quiet']);
  await put(root, 'package.json', { name: '@ilokesto/modal', version: '9.0.0' });
  await put(root, 'website/package.json', { name: '@ilokesto/modal-website', private: true, dependencies: {
    '@ilokesto/modal': 'workspace:*', '@ilokesto/modal-docs-runtime': 'workspace:*',
  } });
  await put(root, 'docs-publication/runtime/package.json', { name: '@ilokesto/modal-docs-runtime', private: true,
    dependencies: { '@ilokesto/released-modal': 'npm:@ilokesto/modal@2.0.0' } });
  assert.equal((await verifyStandalone(root, manifest)).manifests, 3);

  await put(root, 'website/package.json', { name: '@ilokesto/modal-website', private: true,
    dependencies: { '@ilokesto/store': 'workspace:*' } });
  await assert.rejects(verifyStandalone(root, manifest), /SIBLING_DEPENDENCY/);
  await put(root, 'website/package.json', { name: '@ilokesto/modal-website', private: true,
    dependencies: { '@ilokesto/store': 'file:../../store' } });
  await assert.rejects(verifyStandalone(root, manifest), /EXTERNAL_DEPENDENCY_PATH/);
  await put(root, 'website/package.json', { name: '@ilokesto/modal-website', private: false,
    dependencies: { '@ilokesto/modal': 'workspace:*' } });
  await assert.rejects(verifyStandalone(root, manifest), /SIBLING_DEPENDENCY/);
  await put(root, 'website/package.json', { name: '@ilokesto/modal-website', private: true,
    dependencies: { '@ilokesto/queryable': '0.0.1' } });
  await assert.rejects(verifyStandalone(root, manifest), /PRIVATE_PACKAGE_DEPENDENCY/);
});

test('checkpoint: future development commit and new version -> immutable history remains valid', async t => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'modal-future-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const root = path.join(parent, 'clone');
  git(repository, ['clone', '--no-local', '--quiet', repository, root]);
  // The standalone tree is delivered as an uncommitted working copy; a bare clone
  // only sees the pre-migration baseline. Overlay the current files (disposable
  // fixture) so the future-development commit builds on the standalone state.
  const files = new Set(git(repository, ['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
    .toString().split('\0').filter(Boolean));
  for (const file of files) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await cp(path.join(repository, file), path.join(root, file), { verbatimSymlinks: true });
  }
  const current = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  current.version = '9.0.0';
  await put(root, 'package.json', current);
  await writeFile(path.join(root, 'future-development.txt'), 'future development\n');
  git(root, ['add', '.']);
  git(root, ['commit', '--quiet', '-m', 'Future development fixture']);

  const result = await verifyCheckpoint(root, manifest);

  assert.equal(result.checkpoint, manifest.checkpoint.commit);
  assert.notEqual(git(root, ['rev-parse', 'HEAD']).toString().trim(), manifest.checkpoint.commit);
  await verifyStandalone(root, manifest);
});

test('history: missing original Grunfeld master in disposable clone -> rejected', async t => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'modal-archive-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const root = path.join(parent, 'clone');
  git(repository, ['clone', '--no-local', '--quiet', repository, root]);
  git(root, ['fetch', '--quiet', repository,
    'refs/remotes/origin/legacy/*:refs/remotes/origin/legacy/*']);
  await verifyHistory(root, manifest);
  const archive = 'refs/remotes/origin/legacy/grunfeld/heads/master';
  assert.match(git(root, ['rev-parse', '--verify', archive]).toString(), /^[0-9a-f]{40}\n$/);

  git(root, ['update-ref', '-d', archive]);

  await assert.rejects(verifyHistory(root, manifest), /MISSING_ARCHIVE_REF.*grunfeld\/heads\/master/);
});

async function pathFixture(t) {
  const directory = path.join(repository, '.qa/tmp');
  await mkdir(directory, { recursive: true });
  const parent = await mkdtemp(path.join(directory, 'modal-path-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const root = path.join(parent, 'repo');
  const outside = path.join(parent, 'outside');
  await mkdir(root);
  await mkdir(outside);
  git(root, ['init', '--quiet']);
  for (const file of ['package.json', 'website/package.json', 'docs-publication/runtime/package.json']) {
    await put(root, file, JSON.parse(await readFile(path.join(repository, file), 'utf8')));
  }
  return { root, outside };
}

function pathResult(t, root) {
  const args = [path.join(repository, 'scripts/verify-migration.mjs'), 'standalone',
    '--repo', root, '--manifest-stdin', '-'];
  const result = spawnSync(process.execPath, args, {
    cwd: root, input: JSON.stringify(manifest), encoding: 'utf8', timeout: 10_000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  t.diagnostic(JSON.stringify({ command: [process.execPath, ...args], exitCode: result.status,
    stdout: result.stdout, stderr: result.stderr }));
  return { exitCode: result.status, ...JSON.parse(result.status === 0 ? result.stdout : result.stderr) };
}

for (const staged of [false, true]) {
  test(`standalone paths: ${staged ? 'staged' : 'untracked'} current private workspaces and internal file/link targets -> accepted`, async t => {
    const { root } = await pathFixture(t);
    if (staged) git(root, ['add', '.']);
    assert.equal(pathResult(t, root).results[0].manifests, 3);
    await put(root, 'local-helper/package.json', { name: 'modal-local-helper', private: true });
    await put(root, 'website/package.json', {
      name: '@ilokesto/modal-website', private: true, dependencies: {
        '@ilokesto/modal': 'workspace:*',
        '@ilokesto/modal-docs-runtime': 'link:../docs-publication/runtime',
        'modal-local-helper': 'file:../local-helper',
      },
    });
    if (staged) git(root, ['add', '.']);

    const result = pathResult(t, root);

    assert.equal(result.exitCode, 0);
    assert.equal(result.results[0].manifests, 4);
  });
}

for (const protocol of ['file', 'link']) {
  test(`standalone paths: normalized ${protocol} escapes with literal percent segments -> rejected`, async t => {
    const { root } = await pathFixture(t);
    git(root, ['add', '.']);
    for (const target of ['./../outside', './nested/../../outside', '%2e%2e/../../outside', '..\\outside']) {
      await put(root, 'package.json', { name: '@ilokesto/modal', dependencies: { probe: `${protocol}:${target}` } });

      const result = pathResult(t, root);

      assert.equal(result.exitCode, 1, target);
      assert.equal(result.code, 'EXTERNAL_DEPENDENCY_PATH', target);
    }
  });

  test(`standalone paths: ignored external symlink in ${protocol} target -> rejected`, async t => {
    const { root, outside } = await pathFixture(t);
    await writeFile(path.join(root, '.gitignore'), 'escape\n');
    await symlink(outside, path.join(root, 'escape'), 'dir');
    await put(root, 'package.json', { name: '@ilokesto/modal', dependencies: { probe: `${protocol}:./escape` } });

    const result = pathResult(t, root);

    assert.equal(result.exitCode, 1);
    assert.equal(result.code, 'EXTERNAL_DEPENDENCY_PATH');
  });
}

test('standalone paths: own workspace name redirected to path or foreign alias -> rejected', async t => {
  const { root } = await pathFixture(t);
  git(root, ['add', 'package.json']);
  for (const range of ['workspace:../../outside', 'workspace:%2e%2e/%2e%2e/outside', 'workspace:@ilokesto/overlay@*']) {
    await put(root, 'website/package.json', {
      name: '@ilokesto/modal-website', private: true, dependencies: { '@ilokesto/modal': range },
    });

    const result = pathResult(t, root);

    assert.equal(result.exitCode, 1);
    assert.equal(result.code, 'SIBLING_DEPENDENCY');
  }
});

test('standalone paths: untracked workspace directory symlink outside repository -> rejected', async t => {
  const { root, outside } = await pathFixture(t);
  git(root, ['add', '.']);
  await put(outside, 'package.json', { name: 'external-workspace', private: true });
  await symlink(outside, path.join(root, 'external-workspace'), 'dir');

  const result = pathResult(t, root);

  assert.equal(result.exitCode, 1);
  assert.equal(result.code, 'EXTERNAL_REPOSITORY_PATH');
});

test('standalone compatibility: pnpm workspace aliases, relative links and literal percent paths -> accepted', async t => {
  const { root } = await pathFixture(t);
  await put(root, 'package.json', { name: '@ilokesto/modal', version: '2.0.1', packageManager: 'pnpm@10.17.1' });
  await put(root, 'docs-publication/runtime/package.json', {
    name: '@ilokesto/modal-docs-runtime', version: '0.0.0', private: true,
  });
  await put(root, 'literal%package/package.json', { name: 'modal-percent-helper', version: '1.0.0', private: true });
  await put(root, '%2e%2e/package.json', { name: 'modal-literal-helper', version: '1.0.0', private: true });
  await put(root, 'website/package.json', {
    name: '@ilokesto/modal-website', version: '0.0.0', private: true, dependencies: {
      'modal-alias': 'workspace:@ilokesto/modal@*',
      'runtime-alias': 'workspace:@ilokesto/modal-docs-runtime@*',
      'runtime-relative': 'workspace:../docs-publication/runtime',
      'literal-file': 'file:../literal%package',
      'literal-link': 'link:../%2e%2e',
    },
  });
  await writeFile(path.join(root, 'pnpm-workspace.yaml'),
    'packages:\n  - .\n  - website\n  - docs-publication/runtime\n  - literal%package\n  - "%2e%2e"\nlinkWorkspacePackages: false\n');
  const args = ['install', '--lockfile-only', '--offline', '--ignore-scripts', '--store-dir', path.join(root, '.pnpm-store')];
  const installed = spawnSync('pnpm', args, { cwd: root, encoding: 'utf8', timeout: 20_000 });
  t.diagnostic(JSON.stringify({ command: ['pnpm', ...args], cwd: root, exitCode: installed.status,
    stdout: installed.stdout, stderr: installed.stderr }));
  assert.equal(installed.error, undefined);
  assert.equal(installed.status, 0, installed.stderr || installed.stdout);

  const result = pathResult(t, root);

  assert.equal(result.exitCode, 0);
  assert.equal(result.results[0].manifests, 5);
});
