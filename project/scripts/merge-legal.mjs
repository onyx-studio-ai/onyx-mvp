#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const msgDir = join(__dirname, '..', 'messages');

async function main() {
  const privacy = await import('./data/privacy.mjs');
  const aup = await import('./data/aup.mjs');
  const terms1 = await import('./data/terms-1.mjs');
  const terms2 = await import('./data/terms-2.mjs');

  const legal = {
    en: {
      terms: { ...terms1.en, ...terms2.en },
      privacy: privacy.en,
      aup: aup.en,
    },
    'zh-TW': {
      terms: { ...terms1.zhTW, ...terms2.zhTW },
      privacy: privacy.zhTW,
      aup: aup.zhTW,
    },
    'zh-CN': {
      terms: { ...terms1.zhCN, ...terms2.zhCN },
      privacy: privacy.zhCN,
      aup: aup.zhCN,
    },
  };

  for (const [locale, data] of Object.entries(legal)) {
    const file = join(msgDir, `${locale}.json`);
    const json = JSON.parse(readFileSync(file, 'utf8'));
    json.legal = data;
    writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
    console.log(`✓ ${locale}.json updated with legal namespace`);
  }

  console.log('\nDone. Verify with:');
  console.log('  node -e "JSON.parse(require(\'fs\').readFileSync(\'messages/en.json\',\'utf8\'))"');
}

main().catch(e => { console.error(e); process.exit(1); });
