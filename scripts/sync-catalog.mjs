import { readFile, writeFile } from 'node:fs/promises';
import createMoncolleCharacters from '../assets/js/characters.js';

const source = new URL('../assets/data/characters.json', import.meta.url);
const localCopy = new URL('../assets/data/characters.local.js', import.meta.url);
const data = JSON.parse(await readFile(source, 'utf8'));
const { CATALOG } = createMoncolleCharacters(data);
const generated = '// Generated from characters.json by scripts/sync-catalog.mjs\n' +
  'window.moncolleLocalCatalog = ' + JSON.stringify(data) + ';\n';

if (process.argv.includes('--check')) {
  if ((await readFile(localCopy, 'utf8')).replaceAll('\r\n', '\n') !== generated)
    throw new Error('ローカル版の図鑑を更新してください。node scripts/sync-catalog.mjs');
} else {
  await writeFile(localCopy, generated, 'utf8');
}
console.log('図鑑 ' + CATALOG.length + '体を確認しました。');
