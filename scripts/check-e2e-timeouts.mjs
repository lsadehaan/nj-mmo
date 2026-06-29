/**
 * AD-019 e2e timeout gate — rejects wall-clock sleeps and oversized timeouts.
 *
 * Usage:  node scripts/check-e2e-timeouts.mjs
 * Exit 0 = pass, 1 = violations found.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const E2E_SRC = join(root, 'client-e2e/src');

const DEFAULT_TEST_MAX = 15_000;
const DEFAULT_POLL_MAX = 8_000;

/** Only file allowed higher caps (real locomotion around buildings). */
const WHITELIST = {
  'terrain-pathing.spec.ts': { testMax: 25_000, pollMax: 20_000 },
};

const TEST_VECTORS = [
  {
    name: 'forbidden waitForTimeout',
    pattern: /waitForTimeout\s*\(/,
    max: 0,
    kind: 'ban',
  },
  {
    name: 'test.setTimeout',
    pattern: /test\.setTimeout\s*\(\s*(\d[\d_]*)/g,
    kind: 'test',
  },
  {
    name: 'poll timeout',
    pattern: /timeout:\s*(\d[\d_]*)/g,
    kind: 'poll',
  },
];

function walkTs(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walkTs(p));
    else if (entry.endsWith('.ts')) out.push(p);
  }
  return out;
}

function parseNum(raw) {
  return Number(String(raw).replace(/_/g, ''));
}

function capsForFile(relPath) {
  const base = relPath.split('/').pop();
  const wl = WHITELIST[base];
  return {
    testMax: wl?.testMax ?? DEFAULT_TEST_MAX,
    pollMax: wl?.pollMax ?? DEFAULT_POLL_MAX,
  };
}

function scanFile(absPath) {
  const rel = relative(root, absPath);
  const text = readFileSync(absPath, 'utf8');
  const caps = capsForFile(rel);
  const violations = [];

  if (text.includes('waitForTimeout(')) {
    violations.push({ rel, rule: 'waitForTimeout forbidden', value: null, max: 0 });
  }

  for (const match of text.matchAll(/test\.setTimeout\s*\(\s*(\d[\d_]*)/g)) {
    const value = parseNum(match[1]);
    if (value > caps.testMax) {
      violations.push({ rel, rule: 'test.setTimeout', value, max: caps.testMax });
    }
  }

  for (const match of text.matchAll(/timeout:\s*(\d[\d_]*)/g)) {
    const value = parseNum(match[1]);
    if (value > caps.pollMax) {
      violations.push({ rel, rule: 'poll/waitForFunction timeout', value, max: caps.pollMax });
    }
  }

  return violations;
}

function selfTest() {
  const fixtures = [
    { text: 'test.setTimeout(120_000);', file: 'bad.spec.ts', expectFail: true },
    { text: 'await page.waitForTimeout(1000);', file: 'bad.spec.ts', expectFail: true },
    { text: '{ timeout: 90_000 }', file: 'bad.spec.ts', expectFail: true },
    { text: 'test.setTimeout(15_000);', file: 'ok.spec.ts', expectFail: false },
    { text: '{ timeout: 20_000 }', file: 'terrain-pathing.spec.ts', expectFail: false },
    { text: 'test.setTimeout(25_000);', file: 'terrain-pathing.spec.ts', expectFail: false },
    { text: '{ timeout: 25_000 }', file: 'terrain-pathing.spec.ts', expectFail: true },
  ];

  for (const fx of fixtures) {
    const tmpPath = join(E2E_SRC, fx.file);
    const caps = capsForFile(`client-e2e/src/${fx.file}`);
    const hadWait = fx.text.includes('waitForTimeout');
    const testMatch = fx.text.match(/test\.setTimeout\s*\(\s*(\d[\d_]*)/);
    const pollMatch = fx.text.match(/timeout:\s*(\d[\d_]*)/);
    let fail =
      hadWait ||
      (testMatch && parseNum(testMatch[1]) > caps.testMax) ||
      (pollMatch && parseNum(pollMatch[1]) > caps.pollMax);
    if (Boolean(fail) !== fx.expectFail) {
      throw new Error(`self-test mismatch for ${fx.file}: ${fx.text}`);
    }
  }
}

function main() {
  selfTest();

  const files = walkTs(E2E_SRC);
  const violations = files.flatMap(scanFile);

  if (violations.length === 0) {
    console.log(`check-e2e-timeouts: PASS (${files.length} files)`);
    return;
  }

  console.error('check-e2e-timeouts: FAIL');
  for (const v of violations) {
    if (v.value === null) {
      console.error(`  ${v.rel}: ${v.rule}`);
    } else {
      console.error(`  ${v.rel}: ${v.rule} ${v.value} > max ${v.max}`);
    }
  }
  process.exit(1);
}

main();
