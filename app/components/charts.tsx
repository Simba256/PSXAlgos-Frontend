"use client";

import { useT } from "./theme";

export function Sparkline({
  data,
  width = 80,
  height = 22,
  color,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  const T = useT();
  const c = color || T.gain;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const r = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / r) * height}`)
    .join(" ");
  return (
    <svg width={width} height={height}>
      <polyline
        points={pts}
        fill="none"
        stroke={c}
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EquityCurve({
  data,
  width = 540,
  height = 180,
  color,
  grid = true,
  benchmark,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  grid?: boolean;
  benchmark?: number[];
}) {
  const T = useT();
  const c = color || T.gain;
  const all = benchmark ? [...data, ...benchmark] : data;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const r = max - min || 1;
  const toPts = (d: number[]) =>
    d
      .map(
        (v, i) =>
          `${(i / (d.length - 1)) * width},${height - ((v - min) / r) * (height - 8) - 4}`
      )
      .join(" ");
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      width="100%"
      height={height}
      style={{ display: "block", maxWidth: "100%" }}
    >
      {grid &&
        Array.from({ length: 4 }).map((_, i) => (
          <line
            key={i}
            x1={0}
            x2={width}
            y1={((i + 1) * height) / 5}
            y2={((i + 1) * height) / 5}
            stroke={T.outlineFaint}
            strokeDasharray="2 4"
          />
        ))}
      <polyline points={toPts(data)} fill="none" stroke={c} strokeWidth="1.5" />
      <polyline
        points={`0,${height} ${toPts(data)} ${width},${height}`}
        fill={c + "20"}
        stroke="none"
      />
      {benchmark && (
        <polyline
          points={toPts(benchmark)}
          fill="none"
          stroke={T.text3}
          strokeWidth="1.2"
          strokeDasharray="3 3"
        />
      )}
    </svg>
  );
}
