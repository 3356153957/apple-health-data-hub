import type { Privacy } from "../lib/api";

const CLASS_LABELS: Record<string, string> = {
  raw_observations: "原始健康记录",
  findings: "分析发现",
  aggregates: "汇总数据",
  evidence: "证据片段",
  prompt: "模型提示词",
};

function label(payloadClass: string): string {
  return CLASS_LABELS[payloadClass] ?? payloadClass;
}

export function PrivacyCard({ privacy }: { privacy: Privacy | null }) {
  if (privacy === null) {
    return (
      <article className="card privacy">
        <h2>隐私状态</h2>
        <p className="empty">暂时连接不上本机服务，恢复后会显示数据出口状态。</p>
      </article>
    );
  }

  const local = !privacy.cloud_active;
  const detail = privacy.is_local
    ? `分析在本机由 ${privacy.provider} 完成，健康数据不会发送到外部。`
    : privacy.cloud_active
      ? `部分分析摘要会发送给 ${privacy.provider}，原始健康记录不会离开本机。`
      : `${privacy.provider} 已配置，但云端出口关闭，当前没有数据离开本机。`;

  const leaving = privacy.egress.filter((e) => e.leaves_host).map((e) => label(e.payload_class));

  return (
    <article className="card privacy">
      <h2>隐私状态</h2>

      <div className="readiness-head">
        <span className="cand-hyp">{local ? "仅自己可见" : "云端摘要已开启"}</span>
        <span className={`badge ${local ? "ready" : "waiting"}`}>
          {local ? "无外发" : `→ ${privacy.provider}`}
        </span>
      </div>

      <p className="brief-body">{detail}</p>

      {privacy.cloud_active && leaving.length > 0 && (
        <div className="chips">
          {leaving.map((name) => (
            <span className="chip" key={name}>
              ↗ {name}
            </span>
          ))}
        </div>
      )}

      {/* The privacy invariant, always true regardless of opt-in. */}
      <div className="assurance">原始健康记录不会离开本机。</div>
    </article>
  );
}
