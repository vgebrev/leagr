#!/usr/bin/env node
/**
 * Type-check ratchet.
 *
 * Runs svelte-check and compares the result against `.check-baseline`, which holds the
 * allowed error/warning totals plus a per-file breakdown. Counts may only ever go down:
 * the run fails if any file gets worse, and also fails (with the exact command to bank
 * it) if things improved, so a fix is never left unrecorded and the baseline can never
 * silently drift back up.
 *
 * Temporary scaffolding. When the baseline reaches 0/0 this script and `.check-baseline`
 * are deleted and `check:ci` becomes a plain `svelte-check --fail-on-warnings`.
 *
 *   npm run check:ci                          # verify (CI + deploy)
 *   node check-ratchet.mjs --update   # bank an improvement locally
 */
import { spawnSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const BASELINE_FILE = '.check-baseline';
const update = process.argv.includes('--update');

const run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8', shell: false });
/** @param {string} msg */
const log = (msg) => process.stdout.write(msg + '\n');

const sync = run('npx', ['svelte-kit', 'sync']);
if (sync.status !== 0) {
    console.error('svelte-kit sync failed:\n' + (sync.stderr || sync.stdout));
    process.exit(1);
}

const res = run('npx', [
    'svelte-check',
    '--tsconfig',
    './jsconfig.json',
    '--output',
    'machine',
    '--threshold',
    'warning'
]);
const out = `${res.stdout || ''}${res.stderr || ''}`;

const totals = out.match(/COMPLETED \d+ FILES (\d+) ERRORS (\d+) WARNINGS/);
if (!totals) {
    console.error('Could not parse svelte-check output. Raw output follows:\n' + out);
    process.exit(1);
}

/** Per-file counts, so a regression can name the file instead of dumping 40 unrelated lines. */
/** @type {Record<string, number>} */
const files = {};
for (const line of out.split('\n')) {
    const m = line.match(/^\d+ (?:ERROR|WARNING) "([^"]+)"/);
    if (m) files[m[1]] = (files[m[1]] ?? 0) + 1;
}

const actual = {
    errors: Number(totals[1]),
    warnings: Number(totals[2]),
    files: Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)))
};

const serialise = (r) => JSON.stringify(r, null, 4) + '\n';

if (!existsSync(BASELINE_FILE)) {
    writeFileSync(BASELINE_FILE, serialise(actual));
    log(`${BASELINE_FILE} did not exist - seeded at ${actual.errors} errors.`);
    process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'));
const summary = `errors ${actual.errors}/${baseline.errors}, warnings ${actual.warnings}/${baseline.warnings} (actual/allowed)`;

const worse = Object.entries(actual.files)
    .filter(([f, n]) => n > (baseline.files?.[f] ?? 0))
    .sort((a, b) => b[1] - a[1]);

if (worse.length > 0 || actual.errors > baseline.errors || actual.warnings > baseline.warnings) {
    console.error(`Type-check regressed: ${summary}\n`);
    console.error('Files that got worse:');
    for (const [f, n] of worse) {
        console.error(`    ${f}: ${baseline.files?.[f] ?? 0} -> ${n}`);
    }
    console.error(
        `\nRun \`npm run check\` to see the diagnostics.\n` +
            `Do not raise ${BASELINE_FILE} - it only ever goes down.`
    );
    process.exit(1);
}

const improved =
    actual.errors < baseline.errors ||
    actual.warnings < baseline.warnings ||
    JSON.stringify(actual.files) !== JSON.stringify(baseline.files);

if (improved) {
    if (update) {
        writeFileSync(BASELINE_FILE, serialise(actual));
        const dropped = baseline.errors - actual.errors;
        log(`Type-check improved by ${dropped} errors: ${summary}\n${BASELINE_FILE} lowered.`);
        process.exit(0);
    }
    console.error(
        `Type-check improved but ${BASELINE_FILE} was not lowered: ${summary}\n\n` +
            `Bank it by running:\n    node check-ratchet.mjs --update`
    );
    process.exit(1);
}

log(`Type-check at baseline: ${summary}`);
