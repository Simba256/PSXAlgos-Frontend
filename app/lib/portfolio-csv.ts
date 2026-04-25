// CSV import/export + helpers for the portfolio ledger. Extracted from
// app/portfolio/page.tsx so the page stays a rendering layer and the parser
// stays testable in isolation.

export type TradeSource = "signal" | "manual";
export type CloseReason = "Stop loss" | "Target hit" | "Manual close";

export interface OpenPosition {
  id: string;
  sym: string;
  qty: number;
  entry: number;
  now: number;
  source: TradeSource;
  strat: string | null;
  date: string;
  stop: number;
  target: number;
}

export interface ClosedTrade {
  id: string;
  sym: string;
  qty: number;
  entry: number;
  exit: number;
  pnl: number;
  ret: number;
  date: string;
  reason: CloseReason;
  source: TradeSource;
  strat: string | null;
}

export const todayLabel = (): string => {
  const d = new Date();
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
};

export const newId = (prefix: string): string =>
  `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const CSV_HEADER =
  "type,symbol,qty,entry,now_or_exit,source,strategy,date,stop,target,pnl,return,reason";

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCSV(open: OpenPosition[], closed: ClosedTrade[]): string {
  const lines: string[] = [CSV_HEADER];
  for (const p of open) {
    lines.push(
      [
        "open",
        p.sym,
        p.qty,
        p.entry,
        p.now,
        p.source,
        p.strat ?? "",
        p.date,
        p.stop,
        p.target,
        "",
        "",
        "",
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  for (const c of closed) {
    lines.push(
      [
        "closed",
        c.sym,
        c.qty,
        c.entry,
        c.exit,
        c.source,
        c.strat ?? "",
        c.date,
        "",
        "",
        c.pnl,
        c.ret,
        c.reason,
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return lines.join("\n");
}

function parseCSVRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function fromCSV(text: string): { open: OpenPosition[]; closed: ClosedTrade[] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return { open: [], closed: [] };
  const header = parseCSVRow(lines[0]).map((h) => h.toLowerCase().trim());
  const idx = (key: string) => header.indexOf(key);
  const iType = idx("type");
  const iSym = idx("symbol");
  const iQty = idx("qty");
  const iEntry = idx("entry");
  const iNowExit = idx("now_or_exit");
  const iSource = idx("source");
  const iStrat = idx("strategy");
  const iDate = idx("date");
  const iStop = idx("stop");
  const iTarget = idx("target");
  const iPnl = idx("pnl");
  const iRet = idx("return");
  const iReason = idx("reason");

  if (iType < 0 || iSym < 0 || iQty < 0 || iEntry < 0) {
    throw new Error("header must include type, symbol, qty, entry");
  }

  const open: OpenPosition[] = [];
  const closed: ClosedTrade[] = [];
  const num = (cols: string[], i: number, d = 0) =>
    i >= 0 && cols[i] ? Number(cols[i]) || d : d;
  const str = (cols: string[], i: number, d = ""): string =>
    i >= 0 && cols[i] !== undefined ? cols[i] : d;
  const src = (cols: string[]): TradeSource =>
    str(cols, iSource).toLowerCase() === "signal" ? "signal" : "manual";

  for (let li = 1; li < lines.length; li++) {
    const cols = parseCSVRow(lines[li]);
    const type = str(cols, iType).toLowerCase();
    const sym = str(cols, iSym).toUpperCase();
    if (!sym) continue;
    if (type === "open") {
      const entry = num(cols, iEntry);
      open.push({
        id: newId("p"),
        sym,
        qty: Math.max(1, Math.round(num(cols, iQty))),
        entry,
        now: num(cols, iNowExit, entry) || entry,
        source: src(cols),
        strat: str(cols, iStrat) || null,
        date: str(cols, iDate) || todayLabel(),
        stop: num(cols, iStop),
        target: num(cols, iTarget),
      });
    } else if (type === "closed") {
      const entry = num(cols, iEntry);
      const exit = num(cols, iNowExit, entry);
      const qty = Math.max(1, Math.round(num(cols, iQty)));
      const pnl = iPnl >= 0 && cols[iPnl] ? Number(cols[iPnl]) : Math.round((exit - entry) * qty);
      const ret =
        iRet >= 0 && cols[iRet]
          ? Number(cols[iRet])
          : Number((((exit - entry) / entry) * 100).toFixed(2));
      const rawReason = str(cols, iReason);
      const reason: CloseReason =
        rawReason === "Stop loss" || rawReason === "Target hit" || rawReason === "Manual close"
          ? rawReason
          : "Manual close";
      closed.push({
        id: newId("c"),
        sym,
        qty,
        entry,
        exit,
        pnl,
        ret,
        date: str(cols, iDate) || todayLabel(),
        reason,
        source: src(cols),
        strat: str(cols, iStrat) || null,
      });
    }
  }
  return { open, closed };
}
