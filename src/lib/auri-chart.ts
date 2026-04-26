/**
 * Auri — Recharts color palette
 *
 * Use these instead of Recharts' default saturated blue/purple.
 * Import and pass directly to stroke/fill props.
 *
 * @example
 * import { auriChart } from '@/lib/auri-chart';
 * <Line stroke={auriChart.primary} strokeWidth={2.4} />
 * <Bar fill={auriChart.accent} />
 */
export const auriChart = {
  /** Deep teal — primary brand, main data series */
  primary:     "#0F4C5C",
  /** Coral — accent / second data series */
  accent:      "#E8825B",
  /** Soft sage — positive states, third data series */
  sage:        "#A9C2A1",
  /** Warm sand — fourth data series or highlight */
  sand:        "#D9C09B",
  /** Mid ink — annotations, reference lines */
  ink2:        "#4A6268",
  /** Light border — grid lines */
  border:      "#E2EBEC",

  // ── Growth curve envelope ─────────────────────────────────────────────
  /** P50 — median line (solid, primary teal) */
  curveMain:   "#0F4C5C",
  /** P15/P85 — inner envelope (sage dashed) */
  curveMid:    "#A9C2A1",
  /** P3/P97 — outer envelope (sand dashed) */
  curveOuter:  "#D9C09B",
  /** Patient data points */
  curvePatient: "#E8825B",

  // ── Semantic ──────────────────────────────────────────────────────────
  success:     "#3D7A5A",
  warning:     "#B87A2A",
  danger:      "#9A3A2A",
  info:        "#3A7A8A",
} as const;
