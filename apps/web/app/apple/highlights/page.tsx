import Link from "next/link";
import type { Metadata } from "next";

import type { AppleDailySummary, AppleStatus, MetricSeries } from "../../lib/api";
import { safeAppleDailySummary, safeAppleStatus, safeSeries } from "../../lib/load";
import {
  APPLE_METRICS,
  type AppleIconName,
  AppleCategoryIcon,
  formatHours,
  formatRespiratoryRate,
  formatValue,
  latestValue,
  metricSeriesValues,
  recentTrend,
  relativeZh,
  trendTone,
} from "../appleHealth";

export const metadata: Metadata = { title: "健康亮点 · 健康" };
export const dynamic = "force-dynamic";

type HighlightItem = {
  title: string;
  body: string;
  meta: string;
  href: string;
  icon: AppleIconName;
  tone: "good" | "warn" | "neutral";
  stats: Array<{ label: string; value: string }>;
};

type TrendItem = {
  metric: (typeof APPLE_METRICS)[number];
  latest: number | null;
  pct: number | null;
  tone: string;
};

function summaryDateHref(summary: AppleDailySummary | null): string {
  return summary?.date ? `/apple/days/${encodeURIComponent(summary.date)}` : "/apple";
}

function readyTitle(summary: AppleDailySummary | null): string {
  if (!summary) return "等待同步";
  const activity = summary.activity?.level ?? "暂无活动";
  const sleep = summary.sleep?.level ?? "暂无睡眠";
  if (activity === "充足" && sleep !== "偏少") return "昨日状态不错";
  if (sleep === "偏少") return "恢复需要优先照顾";
  if (activity === "偏少") return "今天可以多活动一点";
  return `${activity} · ${sleep}`;
}

function rawNewest(status: AppleStatus | null): string | null {
  return Object.values(status ?? {})
    .map((row) => row.newest)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
}

function trendItems(seriesList: Array<MetricSeries | null>): TrendItem[] {
  return APPLE_METRICS.map((metric, index) => {
    const series = seriesList[index];
    const nums = metricSeriesValues(metric, series);
    const trend = recentTrend(nums);
    return {
      metric,
      latest: nums.length ? nums[nums.length - 1] : latestValue(series),
      pct: trend.pct,
      tone: trendTone(metric, trend.delta),
    };
  }).filter((item) => item.pct !== null);
}

function trendLabel(pct: number | null): string {
  if (pct === null) return "暂无趋势";
  return `${pct > 0 ? "上升" : "下降"} ${formatValue(Math.abs(pct), 1)}%`;
}

function buildHighlights({
  summary,
  seriesList,
  status,
}: {
  summary: AppleDailySummary | null;
  seriesList: Array<MetricSeries | null>;
  status: AppleStatus | null;
}): HighlightItem[] {
  const activity = summary?.activity ?? null;
  const sleep = summary?.sleep ?? null;
  const trends = trendItems(seriesList);
  const strongest = [...trends].sort((a, b) => Math.abs(b.pct ?? 0) - Math.abs(a.pct ?? 0))[0] ?? null;
  const hrv = trends.find((item) => item.metric.id === "vital.hrv_sdnn") ?? null;
  const respiration = trends.find((item) => item.metric.id === "vital.respiratory_rate") ?? null;
  const syncNewest = rawNewest(status);

  return [
    {
      title: readyTitle(summary),
      body: summary?.headline ?? "同步完成后，这里会显示每日运动、睡眠和恢复重点。",
      meta: summary ? `${summary.date} · 每日重点` : "每日重点",
      href: summaryDateHref(summary),
      icon: sleep?.level === "偏少" ? "sleep" : "activity",
      tone: sleep?.level === "偏少" ? "warn" : activity?.level === "充足" ? "good" : "neutral",
      stats: [
        { label: "步数", value: formatValue(activity?.steps) },
        { label: "睡眠", value: formatHours(sleep?.total_sleep_min) },
        { label: "建议", value: `${summary?.advice.length ?? 0} 条` },
      ],
    },
    {
      title: activity?.level === "充足" ? "活动完成度较好" : "活动还有补充空间",
      body: activity
        ? `昨日 ${formatValue(activity.steps)} 步，活动 ${formatValue(activity.active_minutes)} 分钟，站立 ${formatHours(activity.stand_minutes)}。`
        : "还没有同步到昨日活动记录。",
      meta: "活动",
      href: "/apple/categories/activity",
      icon: "activity",
      tone: activity?.level === "充足" ? "good" : activity ? "warn" : "neutral",
      stats: [
        { label: "能量", value: `${formatValue(activity?.active_calories)} kcal` },
        { label: "距离", value: `${formatValue(activity?.distance_km, 2)} km` },
        { label: "站立", value: formatHours(activity?.stand_minutes) },
      ],
    },
    {
      title: sleep?.level === "偏少" ? "睡眠恢复偏少" : "睡眠恢复记录",
      body: sleep
        ? `昨夜睡眠 ${formatHours(sleep.total_sleep_min)}，效率 ${formatValue(sleep.efficiency_pct, 1)}%，呼吸次数 ${formatRespiratoryRate(sleep.respiratory_rate)}。`
        : "还没有同步到睡眠阶段和呼吸记录。",
      meta: "睡眠",
      href: "/apple/categories/sleep",
      icon: "sleep",
      tone: sleep?.level === "偏少" ? "warn" : sleep ? "good" : "neutral",
      stats: [
        { label: "深睡", value: `${formatValue(sleep?.deep_min)} 分钟` },
        { label: "REM", value: `${formatValue(sleep?.rem_min)} 分钟` },
        { label: "清醒", value: `${formatValue(sleep?.awake_min)} 分钟` },
      ],
    },
    {
      title: hrv ? "恢复趋势" : "恢复指标",
      body: hrv
        ? `HRV 最近 30 天${trendLabel(hrv.pct)}，最新 ${formatValue(hrv.latest, hrv.metric.digits ?? 0)} ${hrv.metric.unit}。`
        : respiration
          ? `呼吸次数最近 30 天${trendLabel(respiration.pct)}，适合和睡眠质量一起看。`
          : "继续同步后，这里会显示 HRV、呼吸和静息状态。",
      meta: "恢复",
      href: "/apple/categories/recovery",
      icon: "recovery",
      tone: hrv?.tone === "warn" ? "warn" : hrv?.tone === "good" ? "good" : "neutral",
      stats: [
        { label: "HRV", value: hrv ? `${formatValue(hrv.latest, hrv.metric.digits ?? 0)} ${hrv.metric.unit}` : "暂无" },
        { label: "呼吸", value: respiration ? `${formatValue(respiration.latest, respiration.metric.digits ?? 0)} ${respiration.metric.unit}` : "暂无" },
        { label: "趋势", value: hrv ? trendLabel(hrv.pct) : respiration ? trendLabel(respiration.pct) : "暂无" },
      ],
    },
    {
      title: strongest ? `${strongest.metric.label}变化最大` : "趋势等待更多记录",
      body: strongest
        ? `最近 30 天${trendLabel(strongest.pct)}，最新 ${formatValue(strongest.latest, strongest.metric.digits ?? 0)} ${strongest.metric.unit}。`
        : "有更多连续记录后，这里会显示变化更明显的健康指标。",
      meta: "趋势",
      href: "/apple/trends",
      icon: "cardio",
      tone: strongest?.tone === "warn" ? "warn" : strongest?.tone === "good" ? "good" : "neutral",
      stats: [
        { label: "指标", value: strongest?.metric.label ?? "暂无" },
        { label: "变化", value: strongest ? trendLabel(strongest.pct) : "暂无" },
        { label: "最新", value: strongest ? `${formatValue(strongest.latest, strongest.metric.digits ?? 0)} ${strongest.metric.unit}` : "暂无" },
      ],
    },
    {
      title: "同步状态",
      body: syncNewest ? `最近同步 ${relativeZh(syncNewest)}，健康明细仍只保留在你的私密记录里。` : "还没有看到 Apple 健康同步记录。",
      meta: "设备与同步",
      href: "/apple/sources",
      icon: "data",
      tone: syncNewest ? "good" : "neutral",
      stats: [
        { label: "记录类别", value: `${Object.keys(status ?? {}).length} 类` },
        { label: "最近", value: relativeZh(syncNewest) },
        { label: "位置", value: "本机" },
      ],
    },
  ];
}

export default async function AppleHighlightsPage() {
  const [summary, status, seriesList] = await Promise.all([
    safeAppleDailySummary(),
    safeAppleStatus(),
    Promise.all(APPLE_METRICS.map((metric) => safeSeries(metric.id, "30d"))),
  ]);
  const highlights = buildHighlights({ summary, status, seriesList });
  const warningCount = highlights.filter((item) => item.tone === "warn").length;
  const goodCount = highlights.filter((item) => item.tone === "good").length;

  return (
    <>
      <section className="apple-detail-hero">
        <div>
          <Link href="/apple" className="apple-back-link">
            返回健康概览
          </Link>
          <div className="hero-eyebrow">健康亮点</div>
          <h2>值得关注的内容</h2>
          <p>把每天最重要的运动、睡眠、恢复、趋势和同步状态整理成一组可点击卡片，适合快速浏览后再进入详情。</p>
        </div>
        <div className="apple-hero-badges">
          <span className="apple-badge">{highlights.length} 条亮点</span>
          <span className="apple-badge good">{summary?.date ?? "等待同步"}</span>
        </div>
      </section>

      <section className="apple-kpis">
        <div className="apple-kpi">
          <span>亮点</span>
          <strong>{highlights.length}</strong>
          <small>按日常查看顺序排列</small>
        </div>
        <div className="apple-kpi">
          <span>状态较好</span>
          <strong className="good">{goodCount}</strong>
          <small>活动、睡眠或同步正常</small>
        </div>
        <div className="apple-kpi">
          <span>需要关注</span>
          <strong className={warningCount ? "warn" : "neutral"}>{warningCount}</strong>
          <small>可能需要调整节奏</small>
        </div>
        <div className="apple-kpi">
          <span>最近同步</span>
          <strong className="compact">{relativeZh(rawNewest(status)).replace("同步", "")}</strong>
          <small>本机健康记录</small>
        </div>
      </section>

      <section className="apple-panel apple-highlights-panel">
        <div className="apple-panel-head">
          <div>
            <h3>全部亮点</h3>
            <p>点开任意卡片查看当天详情、分类、趋势或同步来源。</p>
          </div>
        </div>
        <div className="apple-highlights-grid">
          {highlights.map((item, index) => (
            <Link className={`apple-highlight-story ${item.tone} ${index === 0 ? "primary" : ""}`} href={item.href} key={item.title}>
              <div className="apple-summary-card-top">
                <AppleCategoryIcon name={item.icon} />
                <span>{item.meta}</span>
              </div>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
              <div className="apple-summary-stats">
                {item.stats.map((stat) => (
                  <span key={`${item.title}-${stat.label}`}>
                    <b>{stat.value}</b>
                    <small>{stat.label}</small>
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
