import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('The account store keeps favorites and drops anything else', () => {
  const php = spawnSync('php', [resolve(root, 'tests/compte-store.php')], {encoding: 'utf8'});
  assert.equal(php.status, 0, php.stderr || php.stdout);
  assert.match(php.stdout, /ok/);
});

test('The account endpoint does not embed secrets', async () => {
  const source = await readFile(resolve(root, 'public/compte.php'), 'utf8');
  assert.match(source, /'secret'/);
  assert.match(source, /'markets'/);
  assert.doesNotMatch(source, /SMTP_PASS|password_hash|GOOGLE_OAUTH_CLIENT_SECRET/);
});
