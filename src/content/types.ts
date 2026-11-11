/**
 * TypeScript mirror of schema/curriculum.schema.json.
 * Keep the two in sync; `npm run verify:levels` validates the JSON against the schema.
 */

export type Mechanic = 'code_repair' | 'live_console' | 'predict_output';
export type Career = 'dataScience' | 'softwareEngineering' | 'webDevelopment';

export interface World {
  id: number;
  codename: string;
  title: string;
  concepts: string[];
  theme: string;
  /** Accent colour key from the theme palette. */
  accent: 'cyan' | 'emerald' | 'amber' | 'magenta' | 'violet';
}

/** A set of "sensor inputs" injected into the program as global variables. */
export interface Scenario {
  id: string;
  label: string;
  inputs: Record<string, unknown>;
}

interface TestBase {
  id: string;
  /** Shown in the test panel. */
  label: string;
  /** Scenario to run against. Defaults to the level's first scenario. */
  scenario?: string;
  /** Hidden tests show only "Hidden check" until they pass. */
  hidden?: boolean;
  /** Shown when this specific test fails. */
  failHint?: string;
}

export type TestCase =
  | (TestBase & { kind: 'stdout_equals'; expected: string })
  | (TestBase & { kind: 'stdout_contains'; expected: string })
  | (TestBase & { kind: 'variable_equals'; name: string; expected: unknown; tolerance?: number })
  | (TestBase & { kind: 'variable_type'; name: string; expected: string })
  | (TestBase & { kind: 'expression_equals'; expr: string; expected: unknown; tolerance?: number })
  | (TestBase & { kind: 'no_error' })
  | (TestBase & { kind: 'code_matches'; pattern: string; flags?: string })
  | (TestBase & { kind: 'code_not_matches'; pattern: string; flags?: string });

export type TestKind = TestCase['kind'];

export type CareerLinks = Record<Career, string>;

interface LevelBase {
  id: string;
  world: number;
  order: number;
  title: string;
  concept: string;
  tags: string[];
  briefing: string;
  objective: string;
  xp: number;
  hints: string[];
  careers: CareerLinks;
}

export interface Blank {
  id: string;
  /** Accepted answers. The first is used as the reference solution. Validation
   * is behavioural (tests), so any fill that passes the tests is correct. */
  answers: string[];
}

export interface CodeRepairLevel extends LevelBase {
  mechanic: 'code_repair';
  /** Code with {{blankId}} placeholders. */
  template: string;
  blanks: Blank[];
  /** Tappable chips (answers + distractors). */
  tokenBank: string[];
  scenarios?: Scenario[];
  tests: TestCase[];
}

export interface LiveConsoleLevel extends LevelBase {
  mechanic: 'live_console';
  starterCode: string;
  /** Reference solution; checked by `npm run verify:levels`, never shown verbatim. */
  solution: string;
  scenarios?: Scenario[];
  tests: TestCase[];
}

export interface PredictOutputLevel extends LevelBase {
  mechanic: 'predict_output';
  snippet: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
}

export type Level = CodeRepairLevel | LiveConsoleLevel | PredictOutputLevel;

export interface Curriculum {
  version: number;
  worlds: World[];
  levels: Level[];
}
