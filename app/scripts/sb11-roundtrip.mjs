// SB11 round-trip harness. Run via tsx (zero on-disk artifacts beyond this script).
// 1. Parses each SB11 preset chip expression -> AST -> serialize -> reparse, asserts
//    structural + textual idempotency.
// 2. Builds AST for `correlation(close_price, sma_50, 30) > 0.5`, serializes to JSON,
//    POSTs to the BE evaluator. (We assert serialization shape here; the actual BE
//    eval is handled by the pytest path so this script only proves AST<->JSON parity.)

import { parseExpression, expressionToSource, MATH_FN_ARITY, MATH_FN_NAMES } from "../lib/strategy/expression.ts";

const SB11_PRESETS = [
  "percentrank(rsi, 252)",
  "zscore(close_price, 20)",
  "linreg_slope(close_price, 20)",
  "stdev(close_price, 20)",
  "correlation(close_price, volume, 20)",
];

let failed = 0;

function eq(a, b, label) {
  const aj = JSON.stringify(a);
  const bj = JSON.stringify(b);
  if (aj !== bj) {
    console.error(`FAIL [${label}]:\n  got: ${aj}\n  exp: ${bj}`);
    failed += 1;
  } else {
    console.log(`OK   [${label}]`);
  }
}

// (1) Per-preset round-trip.
for (const src of SB11_PRESETS) {
  const ast1 = parseExpression(src);
  const back = expressionToSource(ast1);
  const ast2 = parseExpression(back);
  eq(ast1, ast2, `preset-roundtrip: ${src}`);
  // Textual idempotency: re-render after re-parse must equal the first render.
  eq(back, expressionToSource(ast2), `preset-textual-idempotent: ${src}`);
  // Whitelist + arity assertions.
  if (ast1.type !== "function_call") {
    console.error(`FAIL [${src}]: expected function_call root, got ${ast1.type}`);
    failed += 1;
    continue;
  }
  if (!MATH_FN_NAMES.has(ast1.name)) {
    console.error(`FAIL [${src}]: fn ${ast1.name} not in whitelist`);
    failed += 1;
  }
  const arity = MATH_FN_ARITY[ast1.name];
  if (ast1.args.length < arity.minArgs || (arity.maxArgs !== null && ast1.args.length > arity.maxArgs)) {
    console.error(`FAIL [${src}]: arity mismatch ${ast1.args.length} vs ${JSON.stringify(arity)}`);
    failed += 1;
  }
}

// (2) Cross-system AST for `correlation(close_price, sma_50, 30) > 0.5`.
//     We assert the AST shape so the BE can be hit independently with this JSON.
const xsysSrc = "correlation(close_price, sma_50, 30)";
const xsysAst = parseExpression(xsysSrc);
const xsysJson = JSON.stringify(xsysAst);
console.log(`\nxsys AST (compact JSON):\n${xsysJson}\n`);

// Expected canonical shape (matches lib/api/strategies.ts interfaces).
const expected = {
  type: "function_call",
  name: "correlation",
  args: [
    { type: "indicator", indicator: "close_price", params: null },
    { type: "indicator", indicator: "sma_50", params: null },
    { type: "constant", value: 30 },
  ],
};
eq(xsysAst, expected, "xsys correlation AST shape");

// Re-parse the JSON -> string -> AST round-trip (proves the wire shape is stable).
const xsysBack = expressionToSource(xsysAst);
const xsysAst2 = parseExpression(xsysBack);
eq(xsysAst, xsysAst2, "xsys correlation re-parse");
console.log(`xsys correlation source rendered: ${xsysBack}`);

if (failed > 0) {
  console.error(`\n${failed} CHECK(S) FAILED`);
  process.exit(1);
}
console.log("\nALL ROUND-TRIP CHECKS PASS");
