import type { InsightsLatest, Narrative } from "../lib/api";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

export function WeeklyBriefCard({ latest }: { latest: InsightsLatest | null }) {
  if (!latest) {
    return (
      <article className="card brief">
        <h2>每周简报</h2>
        <p className="empty">暂时无法连接健康记录，恢复后会显示简报。</p>
      </article>
    );
  }

  // Prefer the weekly rollup; fall back to today's briefing until a week lands.
  const brief: Narrative | null = latest.weekly_summary ?? latest.daily_briefing;
  if (!brief) {
    return (
      <article className="card brief">
        <h2>每周简报</h2>
        <p className="empty">
          还没有生成简报。同步几天健康记录后会自动整理。
        </p>
      </article>
    );
  }

  const scope = brief.insight_type === "weekly_summary" ? "本周" : "今天";
  const when = brief.created_at ? ` · ${formatDate(brief.created_at)}` : "";

  return (
    <article className="card brief">
      <h2>每周简报</h2>
      <div className="brief-meta">
        {scope}
        {when} · 私密整理
      </div>
      <p className="brief-body">{brief.narrative}</p>
    </article>
  );
}
