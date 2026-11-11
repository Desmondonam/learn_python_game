import type { PyError } from './types';

export interface FriendlyError {
  /** Short, game-flavoured headline. */
  title: string;
  /** What actually went wrong, in plain English. */
  explanation: string;
  /** A concrete next step. */
  tip: string;
  line: number | null;
  lineText: string | null;
  /** The original `Type: message`, for players who want the real thing. */
  raw: string;
}

const CAPS: Record<string, string> = {
  str: 'text (str)',
  int: 'a whole number (int)',
  float: 'a decimal number (float)',
  list: 'a list',
  dict: 'a dictionary',
  NoneType: 'None (nothing)',
  tuple: 'a tuple',
  bool: 'a boolean',
};

function plainType(t: string) {
  return CAPS[t] ?? t;
}

function typeErrorDetail(msg: string): Pick<FriendlyError, 'explanation' | 'tip'> {
  let m = msg.match(/can only concatenate (\w+) \(not "(\w+)"\) to \w+/);
  if (m) {
    return {
      explanation: `You tried to glue ${plainType(m[2])} onto ${plainType(m[1])} with +. Python won't mix them automatically.`,
      tip: m[1] === 'str' ? `Convert the number first: str(value) — or use an f-string like f"Total: {value}".` : `Convert one side so both are the same type, e.g. int("42") or str(42).`,
    };
  }
  m = msg.match(/unsupported operand type\(s\) for (.+): '(\w+)' and '(\w+)'/);
  if (m) {
    return {
      explanation: `The ${m[1]} operator can't combine ${plainType(m[2])} with ${plainType(m[3])}.`,
      tip: m[2] === 'NoneType' || m[3] === 'NoneType' ? 'Something is None. A function may be missing a `return` statement.' : 'Cast the values to matching types (int(), float(), str()) before combining them.',
    };
  }
  m = msg.match(/'(\w+)' object is not subscriptable/);
  if (m) {
    return {
      explanation: `You used square brackets [ ] on ${plainType(m[1])}, which can't be indexed.`,
      tip: m[1] === 'NoneType' ? 'The value is None. Check that the function you called actually returns something.' : 'Only sequences (str, list, tuple) and dicts support [ ] lookups.',
    };
  }
  m = msg.match(/'(\w+)' object is not callable/);
  if (m) {
    return {
      explanation: `You put ( ) after ${plainType(m[1])}, as if it were a function.`,
      tip: 'Did you reuse a function name (like `list` or `str`) as a variable? Rename the variable.',
    };
  }
  m = msg.match(/(\w+)\(\) missing (\d+) required positional argument/);
  if (m) {
    return {
      explanation: `${m[1]}() needs more arguments than you gave it (${m[2]} missing).`,
      tip: 'Compare the call with the `def` line: every parameter without a default needs a value.',
    };
  }
  m = msg.match(/(\w+)\(\) takes (\d+) positional arguments? but (\d+) (?:was|were) given/);
  if (m) {
    return {
      explanation: `${m[1]}() accepts ${m[2]} argument(s), but the call passed ${m[3]}.`,
      tip: 'Remove the extra argument, or add a matching parameter to the def line.',
    };
  }
  m = msg.match(/'(\w+)' object does not support item assignment/);
  if (m) {
    return {
      explanation: `${plainType(m[1])} is immutable — its items can't be changed in place.`,
      tip: m[1] === 'tuple' ? 'Build a new tuple, or use a list if you need to modify it.' : 'Create a new value instead of modifying this one.',
    };
  }
  return {
    explanation: `An operation received a value of the wrong type: ${msg}.`,
    tip: 'Check the types involved. type(x) tells you what a value really is.',
  };
}

export function humanizeError(err: PyError): FriendlyError {
  const raw = `${err.type}: ${err.message}`;
  const base = { line: err.line ?? null, lineText: err.lineText ?? null, raw };
  const at = err.line ? ` on line ${err.line}` : '';

  switch (err.type) {
    case 'IndentationError':
    case 'TabError': {
      const expected = /expected an indented block/.test(err.message);
      const unexpected = /unexpected indent/.test(err.message);
      return {
        ...base,
        title: 'Alignment fault',
        explanation: expected
          ? `Python expected an indented block${at}. Lines that belong to an if/for/while/def must be pushed in.`
          : unexpected
            ? `Line ${err.line ?? '?'} is indented, but nothing above it opens a block.`
            : `The indentation${at} doesn't line up with the lines around it.`,
        tip: 'Use 4 spaces per level. Every line inside the same block must start at exactly the same column.',
      };
    }
    case 'SyntaxError': {
      const msg = err.message;
      let explanation = `Python couldn't read the code${at}: ${msg}.`;
      let tip = 'Look for a missing colon, bracket or quote on that line (or the one right before it).';
      if (/expected ':'/.test(msg)) {
        explanation = `A block header${at} is missing its colon.`;
        tip = 'Lines starting with if, elif, else, for, while and def must end with ":".';
      } else if (/unterminated string/.test(msg)) {
        explanation = `A text string${at} was opened with a quote but never closed.`;
        tip = 'Make sure each string starts and ends with the same kind of quote.';
      } else if (/was never closed|unmatched|does not match/.test(msg)) {
        explanation = `Brackets${at} don't balance: ${msg}.`;
        tip = 'Count your ( [ { and make sure each one has a partner.';
      } else if (/invalid syntax\. Maybe you meant '==' or ':='/.test(msg) || /cannot assign to/.test(msg)) {
        explanation = `There's an assignment (=) where Python expected a comparison${at}.`;
        tip = 'Use == to compare values and = only to store a value in a variable.';
      }
      return { ...base, title: 'Syntax glitch', explanation, tip };
    }
    case 'NameError':
      return {
        ...base,
        title: 'Unknown signal',
        explanation: `Python doesn't know anything called "${err.name ?? '?'}"${at}.`,
        tip: 'Check the spelling and capitalization, and make sure the variable is assigned before it is used. Text needs quotes: "like this".',
      };
    case 'UnboundLocalError':
      return {
        ...base,
        title: 'Scope collision',
        explanation: `Inside a function you read a variable before giving it a value. Because the function also assigns it, Python treats it as local.`,
        tip: 'Pass the value in as a parameter, or use a different local name.',
      };
    case 'TypeError':
      return { ...base, title: 'Type mismatch', ...typeErrorDetail(err.message) };
    case 'IndexError':
      return {
        ...base,
        title: 'Out of range',
        explanation: `You asked for a position that doesn't exist${at}. A list of length 3 only has indexes 0, 1 and 2.`,
        tip: 'Indexes start at 0. Use -1 for the last item, and len(x) to check the size.',
      };
    case 'KeyError':
      return {
        ...base,
        title: 'Missing key',
        explanation: `The dictionary has no key ${err.name ?? err.message}${at}.`,
        tip: 'Check spelling and case. Use d.get(key, default) when a key might be missing.',
      };
    case 'ValueError':
      return {
        ...base,
        title: 'Bad value',
        explanation: /invalid literal for int\(\)/.test(err.message)
          ? `int() can only convert text that looks like a whole number${at}. ${err.message}.`
          : `The type was fine but the value wasn't${at}: ${err.message}.`,
        tip: 'For text like "3.5", use float() instead of int().',
      };
    case 'ZeroDivisionError':
      return {
        ...base,
        title: 'Division by zero',
        explanation: `The code divided by zero${at}.`,
        tip: 'Guard it with an if: only divide when the denominator is not 0.',
      };
    case 'AttributeError':
      return {
        ...base,
        title: 'No such feature',
        explanation: `That value has no attribute "${err.name ?? '?'}"${at}. (${err.message})`,
        tip: "Check the method name and the value's type — e.g. lists use .append(), strings use .upper().",
      };
    case 'RecursionError':
      return {
        ...base,
        title: 'Infinite recursion',
        explanation: 'A function kept calling itself without ever stopping.',
        tip: 'Make sure there is a base case that returns without calling the function again.',
      };
    case 'TimeoutError':
      return {
        ...base,
        title: 'Core overheated',
        explanation: 'Your program ran for more than 3 seconds, so the engine shut it down. This is almost always an infinite loop.',
        tip: 'Check that every while loop changes something that eventually makes its condition False (or reaches a break).',
      };
    case 'EngineError':
      return {
        ...base,
        title: 'Engine offline',
        explanation: err.message,
        tip: 'Wait for the PY ENGINE light to turn green, then run again.',
      };
    default:
      return {
        ...base,
        title: 'Runtime fault',
        explanation: `${err.type}${at}: ${err.message}`,
        tip: 'Read the line it points to and check the values involved.',
      };
  }
}
