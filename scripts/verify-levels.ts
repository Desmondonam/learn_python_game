/**
 * Curriculum QA: `npm run verify:levels`
 *
 * 1. Validates src/content/curriculum.json against schema/curriculum.schema.json.
 * 2. Checks cross-references (unique ids, scenarios exist, blanks match template).
 * 3. Runs every reference solution through the REAL validator, using native
 *    CPython + the same harness.py the app runs inside Pyodide. Every test must pass.
 * 4. Runs live_console starter code and asserts it does NOT already pass.
 * 5. Executes every predict_output snippet and checks the marked answer is correct.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import type { Curriculum, Level } from '../src/content/types';
import type { PythonRunner, RunResult } from '../src/engine/types';
import { assembleTemplate, normalizeOutput, scenariosOf, validateSubmission } from '../src/validator/validator';

const root = join(__dirname, '..');
const curriculum: Curriculum = JSON.parse(readFileSync(join(root, 'src/content/curriculum.json'), 'utf8'));
const schema = JSON.parse(readFileSync(join(root, 'schema/curriculum.schema.json'), 'utf8'));
const harnessPath = join(root, 'src/engine/harness.py');
const python = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');

const cpython: PythonRunner = async (req) => {
  const p = spawnSync(python, ['-I', harnessPath], {
    input: JSON.stringify({ softTimeoutSec: 2.5, ...req }),
    encoding: 'utf8',
    timeout: 10_000,
  });
  if (p.status !== 0) throw new Error(`harness failed: ${p.stderr || p.error}`);
  return JSON.parse(p.stdout) as RunResult;
};

const problems: string[] = [];
const fail = (level: Level | string, msg: string) => problems.push(`[${typeof level === 'string' ? level : level.id}] ${msg}`);

function checkSchema() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  if (!validate(curriculum)) {
    for (const e of validate.errors ?? []) fail('schema', `${e.instancePath} ${e.message}`);
  }
}

function checkStructure() {
  const ids = new Set<string>();
  const worldIds = new Set(curriculum.worlds.map((w) => w.id));
  for (const level of curriculum.levels) {
    if (ids.has(level.id)) fail(level, 'duplicate id');
    ids.add(level.id);
    if (!worldIds.has(level.world)) fail(level, `unknown world ${level.world}`);
    if (level.mechanic === 'predict_output') {
      if (level.answerIndex >= level.choices.length) fail(level, 'answerIndex out of range');
      continue;
    }
    const scenarioIds = new Set(scenariosOf(level).map((s) => s.id));
    for (const t of level.tests) {
      if (t.scenario && !scenarioIds.has(t.scenario)) fail(level, `test ${t.id} references missing scenario ${t.scenario}`);
      if (t.kind === 'code_matches' || t.kind === 'code_not_matches') {
        try {
          new RegExp(t.pattern, t.flags);
        } catch (e) {
          fail(level, `test ${t.id} has an invalid regex: ${e}`);
        }
      }
    }
    if (level.mechanic === 'code_repair') {
      const placeholders = [...level.template.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
      const blankIds = level.blanks.map((b) => b.id);
      if (placeholders.sort().join() !== [...blankIds].sort().join()) fail(level, `template placeholders ${placeholders} != blanks ${blankIds}`);
      for (const b of level.blanks) {
        for (const a of b.answers) if (!level.tokenBank.includes(a)) fail(level, `answer "${a}" for blank ${b.id} is not in tokenBank`);
      }
    }
  }
}

async function checkSolutions() {
  for (const level of curriculum.levels) {
    if (level.mechanic === 'predict_output') {
      const run = await cpython({ code: level.snippet });
      const answer = level.choices[level.answerIndex];
      const correct = run.ok ? normalizeOutput(run.stdout) === normalizeOutput(answer) : answer.startsWith(run.error!.type);
      if (!correct) fail(level, `snippet output ${JSON.stringify(run.ok ? run.stdout : run.error?.type)} != marked answer ${JSON.stringify(answer)}`);
      const dupes = level.choices.filter((c) => normalizeOutput(c) === normalizeOutput(answer));
      if (dupes.length > 1) fail(level, 'more than one choice matches the answer');
      continue;
    }

    const solution =
      level.mechanic === 'live_console'
        ? level.solution
        : assembleTemplate(level.template, Object.fromEntries(level.blanks.map((b) => [b.id, b.answers[0]])));
    if (!solution) {
      fail(level, 'could not assemble reference solution');
      continue;
    }
    const report = await validateSubmission(solution, level, cpython);
    for (const o of report.outcomes) if (!o.passed) fail(level, `solution fails "${o.label}": ${o.detail}`);

    if (level.mechanic === 'live_console') {
      const starter = await validateSubmission(level.starterCode, level, cpython);
      if (starter.passed) fail(level, 'starter code already passes every test');
    }
  }
}

(async () => {
  checkSchema();
  checkStructure();
  await checkSolutions();
  const n = curriculum.levels.length;
  if (problems.length) {
    console.error(`✗ ${problems.length} problem(s) across ${n} levels:\n  ` + problems.join('\n  '));
    process.exit(1);
  }
  const byMechanic = curriculum.levels.reduce<Record<string, number>>((acc, l) => ({ ...acc, [l.mechanic]: (acc[l.mechanic] ?? 0) + 1 }), {});
  console.log(`✓ ${n} levels in ${curriculum.worlds.length} worlds verified against CPython`, byMechanic);
})();
