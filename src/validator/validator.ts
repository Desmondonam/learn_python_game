/**
 * Test validator engine.
 *
 * Pure TypeScript with no React Native imports, so the exact same logic runs
 * in the app (backed by Pyodide) and in `scripts/verify-levels.ts` (backed by
 * native CPython).
 *
 * Flow:
 *   1. Group the level's tests by scenario (each scenario = one set of sensor inputs).
 *   2. Run the program once per scenario, with every expression test as a probe.
 *   3. Score each test against that scenario's RunResult.
 */
import type { CodeRepairLevel, LiveConsoleLevel, Scenario, TestCase } from '../content/types';
import type { PythonRunner, PyValue, RunResult } from '../engine/types';

export interface TestOutcome {
  id: string;
  label: string;
  passed: boolean;
  hidden: boolean;
  scenario: string;
  /** Plain-English reason for a failure (or a short confirmation on pass). */
  detail: string;
  failHint?: string;
}

export interface ScenarioRun {
  scenario: Scenario;
  result: RunResult;
}

export interface ValidationReport {
  passed: boolean;
  passedCount: number;
  total: number;
  outcomes: TestOutcome[];
  runs: ScenarioRun[];
  /** First run that crashed, if any — drives the error card. */
  crash: ScenarioRun | null;
}

const DEFAULT_SCENARIO: Scenario = { id: 'default', label: 'Default inputs', inputs: {} };

export function scenariosOf(level: Pick<LiveConsoleLevel, 'scenarios'>): Scenario[] {
  return level.scenarios?.length ? level.scenarios : [DEFAULT_SCENARIO];
}

/** Normalise program output: unify newlines, strip trailing spaces per line and trailing blank lines. */
export function normalizeOutput(s: string): string {
  return s
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n+$/, '');
}

function numbersClose(a: number, b: number, tol: number) {
  if (a === b) return true;
  return Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
}

/** Deep JSON equality with float tolerance. */
export function jsonEqual(actual: unknown, expected: unknown, tol = 1e-9): boolean {
  if (typeof actual === 'number' && typeof expected === 'number') return numbersClose(actual, expected, tol);
  if (Array.isArray(actual) && Array.isArray(expected)) {
    return actual.length === expected.length && actual.every((v, i) => jsonEqual(v, expected[i], tol));
  }
  if (actual && expected && typeof actual === 'object' && typeof expected === 'object') {
    if (Array.isArray(actual) !== Array.isArray(expected)) return false;
    const a = actual as Record<string, unknown>;
    const e = expected as Record<string, unknown>;
    const ak = Object.keys(a);
    const ek = Object.keys(e);
    return ak.length === ek.length && ek.every((k) => k in a && jsonEqual(a[k], e[k], tol));
  }
  return actual === expected;
}

/** Compare a described Python value to an expected JSON value. Sets compare order-insensitively. */
export function pyValueEquals(actual: PyValue, expected: unknown, tol?: number): boolean {
  if ((actual.type === 'set' || actual.type === 'frozenset') && Array.isArray(actual.value) && Array.isArray(expected)) {
    if (actual.value.length !== expected.length) return false;
    const remaining = [...expected];
    return actual.value.every((v) => {
      const i = remaining.findIndex((e) => jsonEqual(v, e, tol));
      if (i < 0) return false;
      remaining.splice(i, 1);
      return true;
    });
  }
  // A Python bool must not satisfy an expected number (True == 1 in Python, but not for grading).
  if (actual.type === 'bool' && typeof expected !== 'boolean') return false;
  if ((actual.type === 'int' || actual.type === 'float') && typeof expected === 'boolean') return false;
  return jsonEqual(actual.value, expected, tol);
}

function show(v: unknown): string {
  if (typeof v === 'string') return JSON.stringify(v);
  if (v === null) return 'None';
  if (v === true) return 'True';
  if (v === false) return 'False';
  return JSON.stringify(v);
}

function firstLine(s: string, max = 80) {
  const line = s.split('\n')[0];
  return line.length > max ? line.slice(0, max - 1) + '…' : line;
}

function scoreTest(test: TestCase, code: string, run: RunResult): Pick<TestOutcome, 'passed' | 'detail'> {
  const crashed = !run.ok && run.error;

  switch (test.kind) {
    case 'code_matches': {
      const ok = new RegExp(test.pattern, test.flags ?? 'm').test(code);
      return { passed: ok, detail: ok ? 'Required construct found' : 'Required construct not found in your code' };
    }
    case 'code_not_matches': {
      const ok = !new RegExp(test.pattern, test.flags ?? 'm').test(code);
      return { passed: ok, detail: ok ? 'No forbidden shortcuts' : 'Your code uses a construct this mission forbids' };
    }
    case 'no_error':
      return crashed
        ? { passed: false, detail: `Program crashed with ${run.error!.type}` }
        : { passed: true, detail: 'Ran without errors' };
  }

  if (crashed) {
    return { passed: false, detail: `Program crashed with ${run.error!.type} before this check` };
  }

  switch (test.kind) {
    case 'stdout_equals': {
      const got = normalizeOutput(run.stdout);
      const want = normalizeOutput(test.expected);
      if (got === want) return { passed: true, detail: 'Output matches' };
      if (!got) return { passed: false, detail: `Nothing was printed. Expected ${show(want)}` };
      if (got.toLowerCase() === want.toLowerCase()) return { passed: false, detail: `Almost — check upper/lower case. Got ${show(firstLine(got))}` };
      if (got.replace(/\s+/g, '') === want.replace(/\s+/g, '')) return { passed: false, detail: `Almost — check the spacing. Got ${show(firstLine(got))}` };
      return { passed: false, detail: `Printed ${show(firstLine(got))}, expected ${show(firstLine(want))}` };
    }
    case 'stdout_contains': {
      const ok = normalizeOutput(run.stdout).includes(test.expected);
      return { passed: ok, detail: ok ? 'Found in output' : `Output never contains ${show(test.expected)}` };
    }
    case 'variable_equals':
    case 'variable_type': {
      const v = run.variables[test.name];
      if (!v) return { passed: false, detail: `No variable named "${test.name}" was created` };
      if (test.kind === 'variable_type') {
        const ok = v.type === test.expected;
        return { passed: ok, detail: ok ? `${test.name} is a ${v.type}` : `${test.name} is a ${v.type}, expected ${test.expected}` };
      }
      const ok = pyValueEquals(v, test.expected, test.tolerance);
      return { passed: ok, detail: ok ? `${test.name} = ${v.repr}` : `${test.name} is ${v.repr}, expected ${show(test.expected)}` };
    }
    case 'expression_equals': {
      const p = run.probes.find((x) => x.expr === test.expr);
      if (!p) return { passed: false, detail: 'Check did not run' };
      if (!p.ok || !p.value) return { passed: false, detail: `${test.expr} raised ${p.error?.type ?? 'an error'}: ${p.error?.message ?? ''}` };
      const ok = pyValueEquals(p.value, test.expected, test.tolerance);
      return { passed: ok, detail: ok ? `${test.expr} → ${p.value.repr}` : `${test.expr} returned ${p.value.repr}, expected ${show(test.expected)}` };
    }
  }
}

export async function validateSubmission(
  code: string,
  level: Pick<LiveConsoleLevel | CodeRepairLevel, 'tests' | 'scenarios'>,
  runner: PythonRunner,
): Promise<ValidationReport> {
  const scenarios = scenariosOf(level);
  const byId = new Map(scenarios.map((s) => [s.id, s]));
  const scenarioOf = (t: TestCase) => byId.get(t.scenario ?? scenarios[0].id) ?? scenarios[0];

  // Only scenarios that some runtime test actually needs get executed — but always run the first,
  // because its output is what the console shows.
  const needed = new Set<string>([scenarios[0].id]);
  for (const t of level.tests) needed.add(scenarioOf(t).id);

  const runs: ScenarioRun[] = [];
  for (const scenario of scenarios) {
    if (!needed.has(scenario.id)) continue;
    const probes = level.tests
      .filter((t) => t.kind === 'expression_equals' && scenarioOf(t).id === scenario.id)
      .map((t) => (t as Extract<TestCase, { kind: 'expression_equals' }>).expr);
    const result = await runner({ code, inputs: scenario.inputs, probes: [...new Set(probes)] });
    runs.push({ scenario, result });
    // A timeout means the engine was just rebooted; don't hammer it with more runs.
    if (result.timedOut) break;
  }
  const runFor = new Map(runs.map((r) => [r.scenario.id, r.result]));

  const outcomes: TestOutcome[] = level.tests.map((t) => {
    const scenario = scenarioOf(t);
    const run = runFor.get(scenario.id) ?? runs[runs.length - 1]?.result;
    const scored = run ? scoreTest(t, code, run) : { passed: false, detail: 'Not run' };
    return {
      id: t.id,
      label: t.label,
      hidden: !!t.hidden,
      scenario: scenario.label,
      failHint: t.failHint,
      ...scored,
    };
  });

  const passedCount = outcomes.filter((o) => o.passed).length;
  return {
    passed: passedCount === outcomes.length,
    passedCount,
    total: outcomes.length,
    outcomes,
    runs,
    crash: runs.find((r) => !r.result.ok) ?? null,
  };
}

/** Fill a code_repair template with the player's answers. Returns null while any blank is empty. */
export function assembleTemplate(template: string, fills: Record<string, string>): string | null {
  let missing = false;
  const code = template.replace(/\{\{(\w+)\}\}/g, (_m, id: string) => {
    const v = (fills[id] ?? '').trim();
    if (!v) missing = true;
    return v;
  });
  return missing ? null : code;
}
