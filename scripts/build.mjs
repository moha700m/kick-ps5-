#!/usr/bin/env node
/* Build the deployable static folder. No bundler, no server runtime. */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '_site');

const files = ['index.html', '404.html', 'manifest.webmanifest', '.nojekyll'];
const dirs = ['assets'];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const file of files) {
  const source = path.join(root, file);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing required file: ${file}`);
  }
  fs.copyFileSync(source, path.join(out, file));
}

for (const dir of dirs) {
  const source = path.join(root, dir);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing required folder: ${dir}`);
  }
  fs.cpSync(source, path.join(out, dir), { recursive: true });
}

let commit = process.env.GITHUB_SHA || '';
if (!commit) {
  try {
    commit = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    commit = 'local';
  }
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const info = {
  name: pkg.name,
  version: pkg.version,
  commit,
  ref: process.env.GITHUB_REF_NAME || '',
  builtAt: new Date().toISOString(),
  source: 'https://github.com/moha700m/kick-ps5-'
};
fs.writeFileSync(path.join(out, 'build.json'), JSON.stringify(info, null, 2) + '\n');

const bytes = fs.readdirSync(out).reduce((total, entry) => {
  const target = path.join(out, entry);
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    const walk = (dir) => fs.readdirSync(dir).reduce((sum, name) => {
      const item = path.join(dir, name);
      const s = fs.statSync(item);
      return sum + (s.isDirectory() ? walk(item) : s.size);
    }, 0);
    return total + walk(target);
  }
  return total + stat.size;
}, 0);

console.log(`Built _site (${(bytes / 1024).toFixed(1)} KiB) at ${info.builtAt}`);
