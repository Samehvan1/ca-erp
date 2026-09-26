export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral" | "purple";

export interface StatusBadgeProps {
  status: string;
  tone?: StatusTone;
  icon?: string;
  size?: "sm" | "md";
  dot?: boolean;
}

export function StatusBadge({ status, tone, icon, size = "md", dot = true }: StatusBadgeProps) {
  const s = status.toLowerCase();
  let resolvedTone: StatusTone = tone || "neutral";

  if (!tone) {
    if (/approve|passed|received|closed|active|approved|complete|intact|ok|processed|paid|fully_received|healthy/i.test(s)) {
      resolvedTone = "success";
    } else if (/pending|open|partial|in_transit|dispatched|quarantin|aging|warn|review/i.test(s)) {
      resolvedTone = "warning";
    } else if (/reject|denied|cancel|expired|over|short|fail|error|negative|critical|discrepant/i.test(s)) {
      resolvedTone = "danger";
    } else if (/requested|created|draft|scheduled|info/i.test(s)) {
      resolvedTone = "info";
    }
  }

  return (
    <span className={`status-pill tone-${resolvedTone} size-${size}`}>
      {dot && <span className="status-dot" />}
      {icon && <span className="status-icon">{icon}</span>}
      <span className="status-text">{status.replace(/_/g, " ")}</span>
    </span>
  );
}

export interface VarianceBadgeProps {
  expected: number;
  actual: number;
  uom?: string;
  format?: "qty" | "currency" | "pct";
}

export function VarianceBadge({ expected, actual, uom = "", format = "qty" }: VarianceBadgeProps) {
  const diff = actual - expected;
  const isZero = Math.abs(diff) < 0.001;
  const isPositive = diff > 0;

  let label = "";
  if (format === "currency") {
    label = `${isPositive ? "+" : ""}${diff.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP`;
  } else if (format === "pct") {
    const pct = expected === 0 ? 0 : (diff / expected) * 100;
    label = `${isPositive ? "+" : ""}${pct.toFixed(1)}%`;
  } else {
    label = `${isPositive ? "+" : ""}${diff} ${uom}`.trim();
  }

  if (isZero) {
    return <span className="variance-pill variance-zero">✓ Matched</span>;
  }

  return (
    <span className={`variance-pill ${isPositive ? "variance-pos" : "variance-neg"}`}>
      {label}
    </span>
  );
}
