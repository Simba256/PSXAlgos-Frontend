// SB1 expression parser — TypeScript port of
// `psxDataPortal/backend/app/services/strategy/expression_parser.py` and the
// semantic walks in `expression_validator.py`. Lives client-side so the editor
// can give instant parse errors; backend re-runs the same checks on save.
//
// Grammar (SB2 — arithmetic + postfix subscript; AND/OR reserved for SB9):
//
//     expr           := additive
//     additive       := multiplicative (("+"|"-") multiplicative)*
//     multiplicative := unary (("*"|"/"|"%") unary)*
//     unary          := ("-"|"+") unary | postfix
//     postfix        := primary ("[" expr "]")*               -- SB2
//     primary        := number | indicator_ref | "(" expr ")" | function_call
//     function_call  := IDENT "(" expr ("," expr)* ")"
//     number         := /\d+(\.\d+)?([eE][+-]?\d+)?/
//     indicator_ref  := IDENT ( "(" IDENT ("," NUMBER)? ")" )?
//     IDENT          := /[a-z][a-z0-9_]*/
//
// The parser accepts comparison operators so SB9 can flip a single switch,
// but `validateExpression` rejects them at the top of a condition value.
// SB2 relaxes the cmp ban inside the first arg of `barssince(...)` and
// `valuewhen(...)` via the `cmp_allowed` flag on the walk.

import type {
  ArithOp,
  CmpOp,
  ConstantNode,
  ExprNode,
  FunctionCallNode,
  IndicatorRefNode,
  BinaryOpNode,
  MathFnName,
  SubscriptNode,
  UnaryOpNode,
  ParenNode,
} from "../api/strategies";

// Mirrors `MAX_EXPR_DEPTH` in `backend/app/schemas/strategy.py:22`.
export const MAX_EXPR_DEPTH = 16;

// Mirror of the backend `Indicator` enum (schemas/strategy.py:207-257). The FE
// keeps `Indicator` as a string in the API types (see the comment there) but
// the parser needs the closed set so unknown identifiers fail with a precise
// column pointer instead of bubbling up as a vague backend 422.
// SB8 — math helper whitelist. Mirror of backend `_MATH_FN_NAMES` in
// `expression_parser.py` / `expression_validator.py`. The parser takes the
// function-call branch when an identifier in this set is immediately
// followed by `(`; otherwise the identifier falls through to the
// indicator-ref branch.
export const MATH_FN_NAMES: ReadonlySet<MathFnName> = new Set([
  "abs",
  "max",
  "min",
  "round",
  "log",
  // SB2 — indexed-history helpers. Same parse path (function call), but
  // backed by a per-symbol rolling window in the evaluator. See
  // `docs/design_call_dossiers/SB2_indexed_history_2026-05-16.md` §1.3.
  "highest",
  "lowest",
  "barssince",
  "valuewhen",
]);

// Arity bounds keyed by math-fn name. `maxArgs: null` means variadic
// (>= `minArgs`). Mirror of `_MATH_FN_ARITY` in
// `backend/app/services/strategy/expression_validator.py`.
export const MATH_FN_ARITY: Readonly<Record<MathFnName, { minArgs: number; maxArgs: number | null }>> = {
  abs: { minArgs: 1, maxArgs: 1 },
  round: { minArgs: 1, maxArgs: 2 },
  log: { minArgs: 1, maxArgs: 2 },
  max: { minArgs: 2, maxArgs: null },
  min: { minArgs: 2, maxArgs: null },
  // SB2 — fixed arity per dossier §2.3.2.
  highest: { minArgs: 2, maxArgs: 2 },
  lowest: { minArgs: 2, maxArgs: 2 },
  barssince: { minArgs: 1, maxArgs: 1 },
  valuewhen: { minArgs: 2, maxArgs: 2 },
};

// SB2 — hint copy for the autocomplete dropdown. The five SB8 helpers
// read as plain "math fn"; the four SB2 helpers walk per-symbol history
// and read as "history" so users can tell them apart at a glance.
// Consumed by `expression-input.tsx` (PRESET_CHIPS autocomplete loop).
export const MATH_FN_HINTS: Readonly<Record<MathFnName, string>> = {
  abs: "math fn",
  max: "math fn",
  min: "math fn",
  round: "math fn",
  log: "math fn",
  highest: "history",
  lowest: "history",
  barssince: "history",
  valuewhen: "history",
};

export const KNOWN_INDICATORS: ReadonlySet<string> = new Set([
  "close_price",
  "open_price",
  "high_price",
  "low_price",
  "volume",
  "volume_sma_20",
  "sma_20",
  "sma_50",
  "sma_200",
  "ema_12",
  "ema_26",
  "macd",
  "macd_signal",
  "macd_histogram",
  "rsi",
  "stochastic_k",
  "stochastic_d",
  "roc",
  "williams_r",
  "bb_upper",
  "bb_middle",
  "bb_lower",
  "bb_percent_b",
  "atr",
  "atr_percent",
  "adx",
  "parabolic_sar",
  "obv",
  "cmf",
  "vwap",
  "pivot",
  "support_1",
  "support_2",
  "resistance_1",
  "resistance_2",
  // SB7 — calendar & cooldown tokens. Resolved at evaluator time against
  // the current bar's date / per-strategy entry ledger. Bare-identifier
  // shape; users compose against the existing SingleCondition.operator
  // (e.g. `dayofweek == 1`, `entries_today < 2`, `bars_since_entry > 5`).
  "dayofweek",
  "entries_today",
  "bars_since_entry",
]);

// ── Errors ──────────────────────────────────────────────────────────────

export class ParseError extends Error {
  source: string;
  column: number;
  constructor(message: string, source: string, column: number) {
    const pointer = " ".repeat(column) + "^";
    super(`${message} at column ${column}\n  ${source}\n  ${pointer}`);
    this.name = "ParseError";
    this.source = source;
    this.column = column;
  }
}

export class ValidationError extends Error {
  reason: string;
  path: string;
  constructor(message: string, reason: string, path = "") {
    const rendered = path ? `${message} (path: ${path})` : message;
    super(rendered);
    this.name = "ValidationError";
    this.reason = reason;
    this.path = path;
  }
}

// ── Lexer ───────────────────────────────────────────────────────────────

type TokKind =
  | "NUMBER"
  | "IDENT"
  | "LPAREN"
  | "RPAREN"
  | "LBRACK"
  | "RBRACK"
  | "COMMA"
  | "EOF"
  | ArithOp
  | CmpOp;

interface Token {
  kind: TokKind;
  text: string;
  column: number;
}

const OPERATOR_LITERALS: ReadonlyArray<TokKind> = [
  // Longest first so `<=` doesn't tokenize as `<` then `=`.
  "<=",
  ">=",
  "==",
  "!=",
  "+",
  "-",
  "*",
  "/",
  "%",
  "<",
  ">",
];

const NUMBER_RE = /\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const IDENT_RE = /[a-z][a-z0-9_]*/y;

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = source.length;
  while (i < n) {
    const ch = source[i];
    if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
      i += 1;
      continue;
    }
    if (ch === "(") {
      tokens.push({ kind: "LPAREN", text: "(", column: i });
      i += 1;
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "RPAREN", text: ")", column: i });
      i += 1;
      continue;
    }
    if (ch === "[") {
      tokens.push({ kind: "LBRACK", text: "[", column: i });
      i += 1;
      continue;
    }
    if (ch === "]") {
      tokens.push({ kind: "RBRACK", text: "]", column: i });
      i += 1;
      continue;
    }
    if (ch === ",") {
      tokens.push({ kind: "COMMA", text: ",", column: i });
      i += 1;
      continue;
    }
    if (ch >= "0" && ch <= "9") {
      NUMBER_RE.lastIndex = i;
      const m = NUMBER_RE.exec(source);
      if (m && m.index === i) {
        tokens.push({ kind: "NUMBER", text: m[0], column: i });
        i += m[0].length;
        continue;
      }
    }
    if (ch >= "a" && ch <= "z") {
      IDENT_RE.lastIndex = i;
      const m = IDENT_RE.exec(source);
      if (m && m.index === i) {
        tokens.push({ kind: "IDENT", text: m[0], column: i });
        i += m[0].length;
        continue;
      }
    }
    let matched = false;
    for (const lit of OPERATOR_LITERALS) {
      if (source.startsWith(lit, i)) {
        tokens.push({ kind: lit, text: lit, column: i });
        i += lit.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    throw new ParseError(`unexpected character '${ch}'`, source, i);
  }
  tokens.push({ kind: "EOF", text: "", column: n });
  return tokens;
}

// ── Pratt parser ────────────────────────────────────────────────────────

const PREC_CMP = 10;
const PREC_ADD = 20;
const PREC_MUL = 30;
const PREC_UNARY = 40;
// SB2 — postfix subscript binds tighter than unary minus and looser than the
// primary atom (so `-a[1]` is `-(a[1])`, not `(-a)[1]`). Mirrors backend
// `_PREC_SUBSCRIPT = 45` in `expression_parser.py`.
const PREC_SUBSCRIPT = 45;

const CMP_OPS: ReadonlySet<string> = new Set(["<", ">", "<=", ">=", "==", "!="]);
const ADD_OPS: ReadonlySet<string> = new Set(["+", "-"]);
const MUL_OPS: ReadonlySet<string> = new Set(["*", "/", "%"]);

class Parser {
  private tokens: Token[];
  private pos = 0;
  constructor(private source: string) {
    this.tokens = tokenize(source);
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    const t = this.tokens[this.pos];
    this.pos += 1;
    return t;
  }

  private expect(kind: TokKind, message: string): Token {
    const t = this.peek();
    if (t.kind !== kind) throw new ParseError(message, this.source, t.column);
    return this.advance();
  }

  parse(): ExprNode {
    if (this.peek().kind === "EOF") {
      throw new ParseError("expected expression", this.source, 0);
    }
    const node = this.parseExpr(0);
    if (this.peek().kind !== "EOF") {
      const t = this.peek();
      throw new ParseError(`unexpected token '${t.text}'`, this.source, t.column);
    }
    return node;
  }

  private parseExpr(minBp: number): ExprNode {
    let left = this.parseNud();
    while (true) {
      const t = this.peek();
      const bp = this.ledBp(t.kind);
      if (bp <= minBp) break;
      // SB2 — postfix subscript. `series[offset]` binds left as the series
      // and re-enters the parser at min_bp=0 inside the brackets (matching
      // the `[` ... `]` reset of precedence, same as `(` ... `)`).
      if (t.kind === "LBRACK") {
        this.advance();
        const offset = this.parseExpr(0);
        this.expect("RBRACK", "expected ']'");
        const sub: SubscriptNode = { type: "subscript", series: left, offset };
        left = sub;
        continue;
      }
      this.advance();
      const right = this.parseExpr(bp);
      const op = t.text as ArithOp | CmpOp;
      const next: BinaryOpNode = { type: "binary_op", op, left, right };
      left = next;
    }
    return left;
  }

  private ledBp(kind: TokKind): number {
    if (CMP_OPS.has(kind)) return PREC_CMP;
    if (ADD_OPS.has(kind)) return PREC_ADD;
    if (MUL_OPS.has(kind)) return PREC_MUL;
    if (kind === "LBRACK") return PREC_SUBSCRIPT;
    return 0;
  }

  private parseNud(): ExprNode {
    const t = this.peek();
    if (t.kind === "NUMBER") {
      this.advance();
      const v = Number(t.text);
      const node: ConstantNode = { type: "constant", value: v };
      return node;
    }
    if (t.kind === "IDENT") {
      return this.parseIdentPrimary();
    }
    if (t.kind === "LPAREN") {
      this.advance();
      const inner = this.parseExpr(0);
      this.expect("RPAREN", "expected ')'");
      const node: ParenNode = { type: "paren", operand: inner };
      return node;
    }
    if (t.kind === "-") {
      this.advance();
      const operand = this.parseExpr(PREC_UNARY);
      const node: UnaryOpNode = { type: "unary_op", op: "-", operand };
      return node;
    }
    if (t.kind === "+") {
      this.advance();
      return this.parseExpr(PREC_UNARY);
    }
    if (t.kind === "EOF") {
      throw new ParseError("unexpected end of input", this.source, t.column);
    }
    throw new ParseError(`unexpected token '${t.text}'`, this.source, t.column);
  }

  private parseIdentPrimary(): ExprNode {
    const tok = this.advance();
    const name = tok.text;
    // SB8 — function call branch. Math fns take precedence over indicator
    // names; an identifier in MATH_FN_NAMES followed by `(` is a call.
    if (
      MATH_FN_NAMES.has(name as MathFnName) &&
      this.peek().kind === "LPAREN"
    ) {
      return this.parseFunctionCallTail(name as MathFnName, tok.column);
    }
    if (!KNOWN_INDICATORS.has(name)) {
      throw new ParseError(`unknown indicator '${name}'`, this.source, tok.column);
    }
    let params: Record<string, number> | null = null;
    if (this.peek().kind === "LPAREN") {
      this.advance();
      this.expect("IDENT", "expected indicator source identifier");
      let period: number | null = null;
      if (this.peek().kind === "COMMA") {
        this.advance();
        const nTok = this.expect("NUMBER", "expected period number");
        if (nTok.text.includes(".") || nTok.text.includes("e") || nTok.text.includes("E")) {
          throw new ParseError(
            "indicator period must be an integer",
            this.source,
            nTok.column,
          );
        }
        period = Number(nTok.text);
      }
      this.expect("RPAREN", "expected ')'");
      params = period !== null ? { period } : {};
    }
    const node: IndicatorRefNode = { type: "indicator", indicator: name, params };
    return node;
  }

  // SB8 — parse the `(args)` tail of a math-fn call. `nameCol` is kept for
  // future arity-mismatch diagnostics that want to point at the function
  // name rather than the closing paren. Arity itself is a validator concern.
  private parseFunctionCallTail(name: MathFnName, _nameCol: number): ExprNode {
    this.expect("LPAREN", "expected '('");
    const args: ExprNode[] = [];
    if (this.peek().kind === "RPAREN") {
      // Empty arg list is a syntax error — none of the SB8 helpers are
      // zero-arg. Caret lands on the closing paren.
      throw new ParseError(
        `function '${name}' requires at least one argument`,
        this.source,
        this.peek().column,
      );
    }
    args.push(this.parseExpr(0));
    while (this.peek().kind === "COMMA") {
      this.advance();
      args.push(this.parseExpr(0));
    }
    this.expect("RPAREN", "expected ')'");
    const node: FunctionCallNode = { type: "function_call", name, args };
    return node;
  }
}

// ── Public surface ──────────────────────────────────────────────────────

export function parseExpression(source: string): ExprNode {
  if (source == null) throw new ParseError("source is null", "", 0);
  return new Parser(source).parse();
}

export type TryParseOk = { ok: true; ast: ExprNode; canonical: string };
export type TryParseErr = { ok: false; message: string; column: number; reason: string; path: string };
export type TryParseResult = TryParseOk | TryParseErr;

// Non-throwing wrapper. Runs the parser, then the semantic walk; surfaces the
// first failure encountered. The editor uses this for live feedback; the
// backend re-runs both checks at save so this never has to be 100% complete —
// it just has to mirror the common paths to keep the inline feedback honest.
export function tryParseExpression(source: string): TryParseResult {
  try {
    const ast = parseExpression(source);
    try {
      validateExpression(ast);
    } catch (err) {
      if (err instanceof ValidationError) {
        return { ok: false, message: err.message, column: 0, reason: err.reason, path: err.path };
      }
      throw err;
    }
    return { ok: true, ast, canonical: expressionToSource(ast) };
  } catch (err) {
    if (err instanceof ParseError) {
      return { ok: false, message: err.message, column: err.column, reason: "parse_error", path: "" };
    }
    throw err;
  }
}

// ── Renderer ────────────────────────────────────────────────────────────

function nodePrec(node: ExprNode): number {
  if (node.type === "binary_op") {
    if (CMP_OPS.has(node.op)) return PREC_CMP;
    if (ADD_OPS.has(node.op)) return PREC_ADD;
    if (MUL_OPS.has(node.op)) return PREC_MUL;
  }
  if (node.type === "unary_op") return PREC_UNARY;
  // SB2 — subscript ranks above unary but below the primary atom ceiling,
  // so a subscripted series renders without extra parens when nested in a
  // binary op (e.g. `close_price[1] + 5`).
  if (node.type === "subscript") return PREC_SUBSCRIPT;
  return PREC_UNARY + 1;
}

function renderNumber(v: number): string {
  if (Number.isFinite(v) && v === Math.trunc(v)) {
    return v >= 0 ? String(v) : `-${-v}`;
  }
  return String(v);
}

function render(node: ExprNode, parentPrec: number): string {
  if (node.type === "constant") {
    return renderNumber(node.value);
  }
  if (node.type === "indicator") {
    return node.indicator;
  }
  if (node.type === "function_call") {
    // Args render with parentPrec=0 so each gets its own paren context —
    // `max(a + b, c * d)` round-trips without spurious parens around args.
    const renderedArgs = node.args.map((a) => render(a, 0)).join(", ");
    return `${node.name}(${renderedArgs})`;
  }
  if (node.type === "subscript") {
    // SB2 — `series` renders at our own precedence so `(a + b)[1]` keeps its
    // parens; `offset` renders at parentPrec=0 (bracketed context resets
    // precedence, same as a function-call arg).
    const seriesSrc = render(node.series, PREC_SUBSCRIPT);
    const offsetSrc = render(node.offset, 0);
    return `${seriesSrc}[${offsetSrc}]`;
  }
  if (node.type === "paren") {
    return `(${render(node.operand, 0)})`;
  }
  if (node.type === "unary_op") {
    return `-${render(node.operand, PREC_UNARY)}`;
  }
  // binary_op
  const myPrec = nodePrec(node);
  const left = render(node.left, myPrec);
  // Right side bumps by 1 so left-assoc renders without ambiguity.
  const right = render(node.right, myPrec + 1);
  const rendered = `${left} ${node.op} ${right}`;
  if (myPrec < parentPrec) return `(${rendered})`;
  return rendered;
}

export function expressionToSource(node: ExprNode): string {
  return render(node, 0);
}

// ── Semantic walks ──────────────────────────────────────────────────────

function walkDepth(node: ExprNode, depth = 1): number {
  if (node.type === "constant" || node.type === "indicator") return depth;
  if (node.type === "paren" || node.type === "unary_op") {
    return walkDepth(node.operand, depth + 1);
  }
  if (node.type === "function_call") {
    if (node.args.length === 0) return depth;
    return Math.max(...node.args.map((a) => walkDepth(a, depth + 1)));
  }
  if (node.type === "subscript") {
    return Math.max(
      walkDepth(node.series, depth + 1),
      walkDepth(node.offset, depth + 1),
    );
  }
  // binary_op
  return Math.max(walkDepth(node.left, depth + 1), walkDepth(node.right, depth + 1));
}

function isLiteralZero(node: ExprNode): boolean {
  if (node.type === "constant") return node.value === 0;
  if (node.type === "paren") return isLiteralZero(node.operand);
  if (node.type === "unary_op" && node.op === "-") return isLiteralZero(node.operand);
  return false;
}

// SB2 — returns the static non-negative integer value of `node`, or null.
// Accepts `ConstantNode(value=k)` where k is a non-negative whole number,
// or a `ParenNode` wrapping the same. Mirrors backend
// `_resolve_static_int_offset` in `expression_validator.py`. The
// SubscriptNode offset and the second arg of `highest`/`lowest` are both
// SB2.0-restricted to this shape — dynamic offsets defer to SB2.b.
function resolveStaticIntOffset(node: ExprNode): number | null {
  if (node.type === "paren") return resolveStaticIntOffset(node.operand);
  if (node.type === "constant") {
    if (node.value < 0) return null;
    if (node.value !== Math.trunc(node.value)) return null;
    return node.value;
  }
  return null;
}

function walkAndCheck(
  node: ExprNode,
  pathParts: string[],
  cmpAllowed = false,
): void {
  const path = pathParts.length ? "/" + pathParts.join("/") : "";
  if (node.type === "constant") return;
  if (node.type === "indicator") {
    if (node.params != null) {
      throw new ValidationError(
        "parameterized indicator refs (e.g. sma(close, 50)) are coming in SB1.b — use the bare form (e.g. sma_50) for now",
        "parameterized_ref_deferred",
        path,
      );
    }
    return;
  }
  if (node.type === "paren") {
    walkAndCheck(node.operand, [...pathParts, "operand"], cmpAllowed);
    return;
  }
  if (node.type === "unary_op") {
    walkAndCheck(node.operand, [...pathParts, "operand"], cmpAllowed);
    return;
  }
  if (node.type === "subscript") {
    // SB2 — offset must reduce statically to a non-negative integer literal.
    // Dynamic offsets defer to SB2.b. Mirrors backend rule
    // `subscript_offset_not_static` in `expression_validator.py`.
    const staticOffset = resolveStaticIntOffset(node.offset);
    if (staticOffset === null) {
      throw new ValidationError(
        "subscript offset must be a non-negative integer literal in SB2.0 (e.g. close_price[1]). Dynamic offsets are coming in SB2.b.",
        "subscript_offset_not_static",
        path + "/offset",
      );
    }
    if (node.series.type === "constant") {
      throw new ValidationError(
        "cannot subscript a constant value",
        "subscript_on_constant",
        path + "/series",
      );
    }
    if (node.series.type === "subscript") {
      throw new ValidationError(
        "double-subscript (a[i][j]) is not supported — combine the offsets manually (close_price[1][1] == close_price[2])",
        "subscript_double",
        path + "/series",
      );
    }
    walkAndCheck(node.series, [...pathParts, "series"], cmpAllowed);
    // Inside the offset subtree no special rules apply; cmp ops stay rejected.
    walkAndCheck(node.offset, [...pathParts, "offset"], false);
    return;
  }
  if (node.type === "function_call") {
    // Whitelist — defensive, the type union narrows `node.name` already.
    if (!MATH_FN_NAMES.has(node.name)) {
      throw new ValidationError(
        `unknown math function '${node.name}'`,
        "unknown_math_fn",
        path,
      );
    }
    const { minArgs, maxArgs } = MATH_FN_ARITY[node.name];
    const n = node.args.length;
    if (n < minArgs || (maxArgs !== null && n > maxArgs)) {
      let arityDesc: string;
      if (maxArgs === null) arityDesc = `>= ${minArgs}`;
      else if (minArgs === maxArgs) arityDesc = `exactly ${minArgs}`;
      else arityDesc = `${minArgs}-${maxArgs}`;
      throw new ValidationError(
        `${node.name}() takes ${arityDesc} arguments, got ${n}`,
        "math_fn_arity",
        path,
      );
    }
    // round(x, n) — when `n` is a literal it must be a non-negative integer.
    // Dynamic `n` is accepted; the backend evaluator rechecks at runtime.
    if (node.name === "round" && node.args.length === 2) {
      const second = node.args[1];
      if (second.type === "constant") {
        if (second.value < 0 || second.value !== Math.trunc(second.value)) {
          throw new ValidationError(
            `round() decimals argument must be a non-negative integer, got ${second.value}`,
            "round_decimals_invalid",
            path + "/args/1",
          );
        }
      }
    }
    // SB2 — highest/lowest length must be a positive integer literal.
    // Mirrors `rolling_length_not_static` in the backend validator.
    if (node.name === "highest" || node.name === "lowest") {
      const length = resolveStaticIntOffset(node.args[1]);
      if (length === null || length < 1) {
        throw new ValidationError(
          `${node.name}() length must be a positive integer literal in SB2.0; dynamic length is coming in SB2.b`,
          "rolling_length_not_static",
          path + "/args/1",
        );
      }
    }
    node.args.forEach((arg, i) => {
      // SB2 — relax the cmp-op-in-arith ban inside the FIRST arg of
      // `barssince(...)` and `valuewhen(...)`. The flag propagates to
      // children so a nested binary_op tree (future SB9 AND/OR) inherits.
      const allowChild =
        cmpAllowed ||
        ((node.name === "barssince" || node.name === "valuewhen") && i === 0);
      walkAndCheck(arg, [...pathParts, "args", String(i)], allowChild);
    });
    return;
  }
  // binary_op
  if (CMP_OPS.has(node.op) && !cmpAllowed) {
    throw new ValidationError(
      `comparison operator '${node.op}' is not yet supported inside a condition value — SB1 ships arithmetic-only (the outer SingleCondition.operator carries the comparison)`,
      "comparison_op_in_arith",
      path,
    );
  }
  if ((node.op === "/" || node.op === "%") && isLiteralZero(node.right)) {
    throw new ValidationError(
      "divide by literal zero in expression",
      "div_by_literal_zero",
      path + "/right",
    );
  }
  walkAndCheck(node.left, [...pathParts, "left"], cmpAllowed);
  walkAndCheck(node.right, [...pathParts, "right"], cmpAllowed);
}

export function validateExpression(node: ExprNode): void {
  const depth = walkDepth(node);
  if (depth > MAX_EXPR_DEPTH) {
    throw new ValidationError(
      `expression depth ${depth} exceeds maximum of ${MAX_EXPR_DEPTH}`,
      "depth_overflow",
    );
  }
  walkAndCheck(node, [], false);
}

// True if any IndicatorRefNode appears anywhere in the tree. Used by the
// canvas leaf rendering to decide between "ref" vs "constant" visual cues.
export function hasIndicatorRef(node: ExprNode): boolean {
  if (node.type === "indicator") return true;
  if (node.type === "constant") return false;
  if (node.type === "paren" || node.type === "unary_op") return hasIndicatorRef(node.operand);
  if (node.type === "function_call") return node.args.some((a) => hasIndicatorRef(a));
  if (node.type === "subscript") return hasIndicatorRef(node.series) || hasIndicatorRef(node.offset);
  return hasIndicatorRef(node.left) || hasIndicatorRef(node.right);
}
