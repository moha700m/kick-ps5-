#!/usr/bin/env node
/* Static integrity checks that run before tests and deployment. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const checks = [];

function ok(name, condition, detail = '') {
  checks.push(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!condition) errors.push(name);
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const required = [
  'index.html',
  '404.html',
  'manifest.webmanifest',
  '.nojekyll',
  'assets/css/styles.css',
  'assets/js/config.js',
  'assets/js/store.js',
  'assets/js/api.js',
  'assets/js/app.js',
  'assets/img/icon.svg',
  '.github/workflows/deploy.yml'
];

for (const file of required) {
  ok(`exists: ${file}`, fs.existsSync(path.join(root, file)));
}

/* JavaScript syntax ------------------------------------------------------- */
const jsFiles = ['assets/js/config.js', 'assets/js/store.js', 'assets/js/api.js', 'assets/js/app.js'];
for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
  ok(`syntax: ${file}`, result.status === 0, (result.stderr || '').trim().split('\n')[0] || '');
}

/* HTML contract ----------------------------------------------------------- */
const html = read('index.html');
ok('html lang=ar', /<html[^>]+lang="ar"/.test(html));
ok('html dir=rtl', /<html[^>]+dir="rtl"/.test(html));
ok('viewport meta', /name="viewport"/.test(html));
ok('view root', /id="viewRoot"/.test(html));
ok('header search', /id="headerSearchForm"/.test(html));
ok('help button', /id="helpBtn"/.test(html));
ok('no inline event handlers', !/\son(click|load|error|submit)=/i.test(html));
ok('scripts loaded in order', /src="\.\/assets\/js\/config\.js"[\s\S]+store\.js[\s\S]+api\.js[\s\S]+app\.js/.test(html));

const localRefs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1])
  .filter((ref) => !/^(https?:|#|mailto:|data:)/.test(ref));
ok('local references are relative', localRefs.every((ref) => ref.startsWith('./')), localRefs.join(', '));
for (const ref of localRefs) {
  const clean = ref.split('?')[0].replace(/^\.\//, '');
  ok(`asset exists: ${clean}`, fs.existsSync(path.join(root, clean)));
}

/* Configuration contract -------------------------------------------------- */
const config = read('assets/js/config.js');
ok('uses player.kick.com', config.includes('https://player.kick.com/{slug}'));
ok('uses public channel endpoint', config.includes('/api/v2/channels/{slug}'));
ok('uses public search endpoint', config.includes('/api/search?searched_word='));
ok('uses public categories endpoint', config.includes('/api/v1/categories/top'));
ok('no m3u8 / stream scraping', !/m3u8|playback_url|playback\.live-video/i.test(config + read('assets/js/api.js')));

/* CSS contract ------------------------------------------------------------ */
const css = read('assets/css/styles.css');
ok('focus-visible styles', css.includes(':focus-visible'));
ok('reduced motion support', css.includes('prefers-reduced-motion'));
ok('16:9 player padding fallback', css.includes('padding-top: 56.25%'));
ok('RTL aware layout', /inset-inline-(start|end)/.test(css));

/* Forbidden platforms ----------------------------------------------------- */
const forbidden = [
  { name: 'Cloudflare', re: /cloudflare|wrangler|pages\.dev/i },
  { name: 'Vercel', re: /vercel/i },
  { name: 'Render', re: /render\.com/i }
];
const scanExtensions = new Set(['.html', '.css', '.js', '.mjs', '.json', '.md', '.yml', '.yaml', '.webmanifest']);
function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '_site', 'test-results', 'playwright-report'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const relative = path.relative(root, full);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (scanExtensions.has(path.extname(entry.name)) && relative !== 'scripts/check.mjs') out.push(full);
  }
  return out;
}
for (const { name, re } of forbidden) {
  const hits = walk(root).filter((file) => re.test(fs.readFileSync(file, 'utf8')));
  ok(`no ${name} references`, hits.length === 0, hits.map((f) => path.relative(root, f)).join(', '));
}

/* Workflow contract ------------------------------------------------------- */
const workflow = read('.github/workflows/deploy.yml');
ok('workflow deploys on main', /branches:\s*\[\s*main\s*\]/.test(workflow));
ok('workflow uses deploy-pages', workflow.includes('actions/deploy-pages'));
ok('workflow uploads artifact', workflow.includes('actions/upload-pages-artifact'));
ok('workflow has pages write', /pages:\s*write/.test(workflow));
ok('workflow has id-token write', /id-token:\s*write/.test(workflow));
ok('workflow runs tests', /npm test/.test(workflow));
ok('workflow builds site', /npm run build/.test(workflow));

/* Output ---------------------------------------------------------------- */
console.log(checks.join('\n'));
if (errors.length) {
  console.error(`\n${errors.length} check(s) failed.`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} checks passed.`);
