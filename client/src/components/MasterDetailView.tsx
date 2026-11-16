import { ReactNode } from "react";

export interface KpiCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: string;
  trend?: {
    value: string;
    direction: "up" | "down" | "neutral";
  };
  onClick?: () => void;
  accent?: "default" | "amber" | "green" | "red" | "blue";
}

export function KpiCard({
  label,
  value,
  subtext,
  icon,
  trend,
  onClick,
  accent = "default",
}: KpiCardProps) {
  return (
    <div
      className={`kpi-card accent-${accent} ${onClick ? "interactive" : ""}`}
      onClick={onClick}
    >
      <div className="kpi-head">
        <span className="kpi-label">{label}</span>
        {icon && <span className="kpi-icon">{icon}</span>}
      </div>
      <div className="kpi-value">{value}</div>
      {(subtext || trend) && (
        <div className="kpi-foot">
          {trend && (
            <span className={`kpi-trend trend-${trend.direction}`}>
              {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"} {trend.value}
            </span>
          )}
          {subtext && <span className="kpi-subtext">{subtext}</span>}
        </div>
      )}
    </div>
  );
}

export interface MasterDetailViewProps {
  listTitle: string;
  listSubtitle?: string;
  listHeaderActions?: ReactNode;
  listContent: ReactNode;
  detailContent: ReactNode;
  hasSelection: boolean;
  emptyDetailMessage?: string;
}

export function MasterDetailView({
  listTitle,
  listSubtitle,
  listHeaderActions,
  listContent,
  detailContent,
  hasSelection,
  emptyDetailMessage = "Select an item to view full details and actions",
}: MasterDetailViewProps) {
  return (
    <div className="master-detail-shell">
      <section className="master-pane">
        <div className="pane-head">
          <div>
            <h3>{listTitle}</h3>
            {listSubtitle && <p className="pane-sub">{listSubtitle}</p>}
          </div>
          {listHeaderActions && <div className="pane-actions">{listHeaderActions}</div>}
        </div>
        <div className="pane-body">{listContent}</div>
      </section>

      <section className="detail-pane">
        {hasSelection ? (
          detailContent
        ) : (
          <div className="detail-empty">
            <div className="detail-empty-icon">▤</div>
            <p>{emptyDetailMessage}</p>
          </div>
        )}
      </section>
    </div>
  );
}
