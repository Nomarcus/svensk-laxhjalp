#!/usr/bin/env node
/**
 * Translation key checker
 *
 * Compares en.json and ar.json against sv.json (source of truth)
 * and reports missing keys. Run after updating sv.json to see
 * what needs translating.
 *
 * Usage: node scripts/check-translations.js
 */

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'src', 'i18n', 'locales');

function getKeys(obj, prefix = '') {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      keys.push(...getKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function getValue(obj, keyPath) {
  return keyPath.split('.').reduce((o, k) => o?.[k], obj);
}

const sv = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'sv.json'), 'utf8'));
const svKeys = getKeys(sv);

const targetFiles = ['en.json', 'ar.json'];

let hasIssues = false;

for (const file of targetFiles) {
  const filePath = path.join(LOCALES_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.log(`\n❌ ${file} does not exist!`);
    hasIssues = true;
    continue;
  }

  const target = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const targetKeys = getKeys(target);

  const missing = svKeys.filter(k => !targetKeys.includes(k));
  const extra = targetKeys.filter(k => !svKeys.includes(k));

  if (missing.length === 0 && extra.length === 0) {
    console.log(`\n✅ ${file} — all ${svKeys.length} keys present`);
  } else {
    hasIssues = true;
    if (missing.length > 0) {
      console.log(`\n⚠️  ${file} — ${missing.length} missing key(s):`);
      for (const key of missing) {
        console.log(`   + ${key}: "${getValue(sv, key)}"`);
      }
    }
    if (extra.length > 0) {
      console.log(`\n🔸 ${file} — ${extra.length} extra key(s) (not in sv.json):`);
      for (const key of extra) {
        console.log(`   - ${key}`);
      }
    }
  }
}

if (!hasIssues) {
  console.log('\n🎉 All translations are in sync!');
}
process.exit(hasIssues ? 1 : 0);
