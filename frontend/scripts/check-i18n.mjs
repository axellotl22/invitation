// Fails when a translation key exists in one language but not the other.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const en = JSON.parse(readFileSync(path.join(dir, '../src/i18n/en.json'), 'utf8'));
const de = JSON.parse(readFileSync(path.join(dir, '../src/i18n/de.json'), 'utf8'));

function keys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

const enKeys = new Set(keys(en));
const deKeys = new Set(keys(de));
const missingDe = [...enKeys].filter((k) => !deKeys.has(k));
const missingEn = [...deKeys].filter((k) => !enKeys.has(k));

if (missingDe.length || missingEn.length) {
  if (missingDe.length) console.error('Missing in de.json:', missingDe);
  if (missingEn.length) console.error('Missing in en.json:', missingEn);
  process.exit(1);
}
console.log(`i18n ok: ${enKeys.size} keys in both languages`);
