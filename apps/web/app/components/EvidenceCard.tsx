import type { Finding } from "../lib/api";

const TYPE_LABELS: Record<string, string> = {
  anomaly: "异常",
  trend: "趋势",
  correlation: "关联",
  summary: "摘要",
  recovery_score: "恢复",
};

// structured_data is untyped JSON — narrow before use so nothing unknown lands
// in a template literal (and so a malformed payload degrades gracefully).
function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function num(value: unknown, digits = 2): string | null {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : null;
}

function directionLabel(value: unknown): string {
  if (value === "down") return "下降";
  if (value === "up") return "上升";
  if (value === "below") return "低于";
  if (value === "above") return "高于";
  return typeof value === "string" ? value : "变化";
}

// One-line human summary derived purely from the structured finding — no LLM
// involved (Tier-1: the evidence reads even when narration is off).
function summarize(finding: Finding): string {
  const d = finding.structured_data ?? {};
  switch (finding.finding_type) {
    case "anomaly": {
      const z = num(d.magnitude);
      const dir = str(d.direction) === "down" ? "低于" : "高于";
      return `${dir}个人基线${z ? ` · z=${z}` : ""}`;
    }
    case "trend": {
      const p = num(d.p_value, 3);
      return `${directionLabel(str(d.direction))}趋势 · ${num(d.period_days, 0) ?? "?"} 天${p ? ` · p=${p}` : ""}`;
    }
    case "correlation": {
      const r = num(d.coefficient);
      return `${str(d.metric_a) ?? "?"} ~ ${str(d.metric_b) ?? "?"}${r ? ` · r=${r}` : ""}`;
    }
    case "summary": {
      const avg = num(d.avg, 1);
      const delta = num(d.delta_pct_vs_baseline, 1);
      const sign = delta && Number(delta) >= 0 ? "+" : "";
      return `平均 ${avg ?? "?"}${delta ? ` · 较基线 ${sign}${delta}%` : ""}`;
    }
    case "recovery_score": {
      const score = num(d.score, 0);
      return score ? `恢复分 ${score}/100` : "恢复评分";
    }
    default:
      return finding.metric ?? "finding";
  }
}

// Why this finding earned a spot in the feed — the gate that surfaced it,
// derived from the structured data (no LLM). Makes the cut transparent.
function why(finding: Finding): string {
  const d = finding.structured_data ?? {};
  switch (finding.finding_type) {
    case "anomaly":
      return `${finding.severity ?? "已标记"} · 偏离你的个人基线`;
    case "trend": {
      const p = num(d.p_value, 3);
      return p ? `统计上较明显的趋势（p=${p}）` : "多天持续朝同一方向变化";
    }
    case "correlation": {
      const p = num(d.p_value, 3);
      return p
        ? `关联强度达到可参考水平（p=${p}）`
        : "两个指标之间出现较强关联";
    }
    case "summary":
      return "周期汇总相对 30 天基线发生变化";
    default:
      return "由健康分析自动整理";
  }
}

function EvidenceRow({ finding }: { finding: Finding }) {
  const kind = finding.finding_type ?? "finding";
  const label = TYPE_LABELS[kind] ?? kind;
  const entries = Object.entries(finding.structured_data ?? {});
  return (
    <li className="evidence-item">
      <div className="evidence-head">
        <span className="type-badge">{label}</span>
        <span className="evidence-metric">{finding.metric ?? "—"}</span>
        <span className="evidence-sum">{summarize(finding)}</span>
      </div>
      <div className="why">纳入原因：{why(finding)}</div>
      {entries.length > 0 && (
        <details className="calc">
          <summary>查看计算</summary>
          <dl className="calc-grid">
            {entries.map(([key, value]) => (
              <div className="calc-row" key={key}>
                <dt>{key}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </li>
  );
}

export function EvidenceCard({ findings }: { findings: Finding[] | null }) {
  if (findings === null) {
    return (
      <article className="card evidence">
        <h2>健康发现</h2>
        <p className="empty">暂时无法连接健康记录，恢复后会显示发现。</p>
      </article>
    );
  }

  if (findings.length === 0) {
    return (
      <article className="card evidence">
        <h2>健康发现</h2>
        <p className="empty">
          还没有新的发现。同步更多记录后，这里会显示趋势和异常提醒。
        </p>
      </article>
    );
  }

  return (
    <article className="card evidence">
      <h2>健康发现</h2>
      <ul className="evidence-list">
        {findings.map((finding) => (
          <EvidenceRow key={finding.id} finding={finding} />
        ))}
      </ul>
      <div className="meta">
        {findings.length} 条发现 · 基于计算生成
      </div>
    </article>
  );
}
