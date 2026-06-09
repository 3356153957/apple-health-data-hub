import Link from "next/link";
import type { Metadata } from "next";
import type { CSSProperties } from "react";

import type { AppleDailySummary, AppleStatus, MetricSeries, Readiness } from "../lib/api";
import type { AppleIconName, AppleMetric } from "./appleHealth";
import {
  safeAppleDailySummary,
  safeAppleRawDetail,
  safeAppleStatus,
  safePrivacy,
  safeReadiness,
  safeSeries,
} from "../lib/load";
import {
  APPLE_METRICS,
  AppleCategoryIcon,
  BROWSE_CATEGORIES,
  CORE_METRICS,
  FAVORITE_METRIC_IDS,
  RAW_TABLES,
  Sparkline,
  formatHours,
  formatRespiratoryRate,
  formatValue,
  latestValue,
  metricSeriesValues,
  recentTrend,
  relativeZh,
  trendTone,
  workoutLabel,
  zhDate,
  zhTime,
} from "./appleHealth";

export const metadata: Metadata = { title: "健康概览 · 健康" };
export const dynamic = "force-dynamic";

function totalRows(status: AppleStatus | null): number {
  return Object.values(status ?? {}).reduce((sum, row) => sum + (row.count ?? 0), 0);
}

function readyCount(readiness: Readiness | null): number {
  if (!readiness) return 0;
  return CORE_METRICS.filter((item) => {
    const metric = readiness.metrics.find((entry) => entry.metric_id === item.id);
    return metric && Object.values(metric.analyzable ?? {}).some((gate) => gate.is_sufficient);
  }).length;
}

function latestSync(readiness: Readiness | null, status: AppleStatus | null): string | null {
  return readiness?.last_ingested_at ?? readiness?.last_observation_at ?? Object.values(status ?? {})[0]?.newest ?? null;
}

function todayReadiness(summary: AppleDailySummary | null): string {
  if (!summary) return "等待数据";
  const activity = summary.activity?.level ?? "暂无";
  const sleep = summary.sleep?.level ?? "暂无";
  if (activity === "充足" && sleep === "恢复较好") return "适合正常训练";
  if (sleep === "偏少") return "建议降低强度";
  if (activity === "偏少") return "建议补足活动量";
  return "保持稳定节奏";
}

function iconForMetric(metricId: string): AppleIconName {
  if (metricId.startsWith("activity.")) return "activity";
  if (metricId.startsWith("cardio.")) return "cardio";
  if (metricId.startsWith("body.")) return "body";
  if (metricId === "vital.respiratory_rate") return "sleep";
  if (metricId === "vital.hrv_sdnn" || metricId === "vital.resting_heart_rate") return "recovery";
  return "heart";
}

function pct(value: number | null | undefined, goal: number): number {
  if (value === null || value === undefined || !Number.isFinite(value) || goal <= 0) return 0;
  return Math.max(0, Math.min(1, value / goal));
}

function ringStyle(value: number | null | undefined, goal: number, color: string): CSSProperties {
  return {
    "--ring-pct": `${pct(value, goal) * 100}%`,
    "--ring-color": color,
  } as CSSProperties;
}

function ActivityRing({
  label,
  value,
  goal,
  unit,
  color,
}: {
  label: string;
  value: number | null | undefined;
  goal: number;
  unit: string;
  color: string;
}) {
  return (
    <div className="apple-ring-item">
      <i className="apple-ring" style={ringStyle(value, goal, color)} />
      <div>
        <span>{label}</span>
        <strong>
          {formatValue(value)}
          <small>{unit}</small>
        </strong>
        <p>目标 {formatValue(goal)} {unit}</p>
      </div>
    </div>
  );
}

function HeroRing({
  label,
  value,
  goal,
  unit,
  color,
}: {
  label: string;
  value: number | null | undefined;
  goal: number;
  unit: string;
  color: string;
}) {
  return (
    <div className="apple-hero-ring-item" style={ringStyle(value, goal, color)}>
      <i className="apple-hero-ring" aria-hidden />
      <div>
        <span>{label}</span>
        <strong>
          {formatValue(value)}
          <small>{unit}</small>
        </strong>
      </div>
    </div>
  );
}

function trendHighlights(seriesList: Array<MetricSeries | null>) {
  return APPLE_METRICS.map((metric, index) => {
    const nums = metricSeriesValues(metric, seriesList[index]);
    const trend = recentTrend(nums);
    const latest = nums.length ? nums[nums.length - 1] : latestValue(seriesList[index]);
    return {
      metric,
      latest,
      trend,
      tone: trendTone(metric, trend.delta),
      absPct: Math.abs(trend.pct ?? 0),
    };
  })
    .filter((item) => item.trend.pct !== null)
    .sort((a, b) => b.absPct - a.absPct)
    .slice(0, 3);
}

type FocusInsight = {
  title: string;
  body: string;
  meta: string;
  href: string;
  icon: AppleIconName;
  tone: "good" | "warn" | "neutral";
};

type AppleRawRow = Record<string, string | number | null>;

type DayReview = {
  date: string;
  label: string;
  steps: number | null;
  activeMinutes: number | null;
  standMinutes: number | null;
  sleepMinutes: number | null;
  activityText: string;
  sleepText: string;
  tone: "good" | "warn" | "neutral";
};

type SummaryStat = {
  label: string;
  value: string;
};

type SummaryFeedItem = {
  title: string;
  body: string;
  meta: string;
  href?: string;
  icon: AppleIconName;
  tone: "good" | "warn" | "neutral";
  stats: SummaryStat[];
};

type HomeFavoriteItem = {
  title: string;
  value: string;
  helper: string;
  href?: string;
  icon: AppleIconName;
  tone?: "good" | "warn" | "neutral";
};

function summaryDateHref(summary: AppleDailySummary | null): string {
  return summary?.date ? `/apple/days/${encodeURIComponent(summary.date)}` : "/apple";
}

function deltaText(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "暂无 7 日对比";
  return `较近 7 日${value >= 0 ? "高" : "低"} ${formatValue(Math.abs(value), 1)}%`;
}

function activitySummaryTitle(activity: AppleDailySummary["activity"]): string {
  if (!activity) return "等待活动同步";
  if (activity.level === "充足") return "昨日活动达标";
  if (activity.level === "偏少") return "昨日活动偏少";
  return "昨日活动平稳";
}

function sleepSummaryTitle(sleep: AppleDailySummary["sleep"]): string {
  if (!sleep) return "等待睡眠同步";
  if (sleep.level === "偏少") return "昨夜睡眠偏少";
  if (sleep.level === "恢复较好") return "昨夜恢复不错";
  return "昨夜睡眠基本够用";
}

function buildSummaryFeed(summary: AppleDailySummary | null): SummaryFeedItem[] {
  const activity = summary?.activity ?? null;
  const sleep = summary?.sleep ?? null;
  const dayHref = summaryDateHref(summary);
  const advice = summary?.advice?.[0] ?? "同步完成后，这里会显示结合运动和睡眠的每日建议。";

  return [
    {
      title: todayReadiness(summary),
      body: summary?.headline ?? "同步完成后，这里会展示昨日运动、睡眠与恢复建议。",
      meta: summary ? `${summary.date} · 每日重点` : "每日重点",
      href: "/apple/daily",
      icon: sleep?.level === "偏少" ? "sleep" : "activity",
      tone: sleep?.level === "偏少" ? "warn" : activity?.level === "充足" ? "good" : "neutral",
      stats: [
        { label: "步数", value: formatValue(activity?.steps) },
        { label: "睡眠", value: formatHours(sleep?.total_sleep_min) },
        { label: "训练", value: `${summary?.workouts.length ?? 0} 次` },
      ],
    },
    {
      title: activitySummaryTitle(activity),
      body: activity
        ? `活动 ${formatValue(activity.active_minutes)} 分钟，消耗 ${formatValue(activity.active_calories)} kcal，站立 ${formatHours(activity.stand_minutes)}。`
        : "还没有同步到这一天的活动、站立和能量数据。",
      meta: deltaText(activity?.delta_pct?.steps),
      href: dayHref,
      icon: "activity",
      tone: activity?.level === "充足" ? "good" : activity?.level === "偏少" ? "warn" : "neutral",
      stats: [
        { label: "距离", value: `${formatValue(activity?.distance_km, 2)} km` },
        { label: "活动分钟", value: `${formatValue(activity?.active_minutes)} 分钟` },
        { label: "站立", value: formatHours(activity?.stand_minutes) },
      ],
    },
    {
      title: sleepSummaryTitle(sleep),
      body: sleep
        ? `睡眠效率 ${formatValue(sleep.efficiency_pct, 1)}%，呼吸次数 ${formatRespiratoryRate(sleep.respiratory_rate)}。`
        : "还没有同步到这一天的睡眠阶段和呼吸数据。",
      meta: sleep ? `${formatHours(sleep.total_sleep_min)} · ${sleep.level}` : "睡眠摘要",
      href: dayHref,
      icon: "sleep",
      tone: sleep?.level === "偏少" ? "warn" : sleep ? "good" : "neutral",
      stats: [
        { label: "深睡", value: `${formatValue(sleep?.deep_min)} 分钟` },
        { label: "REM", value: `${formatValue(sleep?.rem_min)} 分钟` },
        { label: "清醒", value: `${formatValue(sleep?.awake_min)} 分钟` },
      ],
    },
    {
      title: "接下来建议",
      body: advice,
      meta: "根据活动和睡眠生成",
      icon: "recovery",
      tone: sleep?.level === "偏少" ? "warn" : "neutral",
      stats: [
        { label: "活动", value: activity?.level ?? "暂无" },
        { label: "睡眠", value: sleep?.level ?? "暂无" },
        { label: "建议", value: `${summary?.advice?.length ?? 0} 条` },
      ],
    },
  ];
}

function buildHomeFavorites(
  summary: AppleDailySummary | null,
  coreReadyCount: number,
  observationRows: number,
): HomeFavoriteItem[] {
  const activity = summary?.activity ?? null;
  const sleep = summary?.sleep ?? null;
  return [
    {
      title: "步数",
      value: formatValue(activity?.steps),
      helper: activity?.level ?? "等待活动记录",
      href: "/apple/metrics/steps",
      icon: "activity",
      tone: activity?.level === "充足" ? "good" : activity?.level === "偏少" ? "warn" : "neutral",
    },
    {
      title: "睡眠",
      value: formatHours(sleep?.total_sleep_min),
      helper: sleep?.level ?? "等待睡眠记录",
      href: summaryDateHref(summary),
      icon: "sleep",
      tone: sleep?.level === "偏少" ? "warn" : sleep ? "good" : "neutral",
    },
    {
      title: "站立时间",
      value: formatHours(activity?.stand_minutes),
      helper: "昨日完整日站立记录",
      href: "/apple/metrics/stand-time",
      icon: "activity",
    },
    {
      title: "呼吸次数",
      value: formatRespiratoryRate(sleep?.respiratory_rate),
      helper: "昨夜睡眠平均",
      href: "/apple/metrics/respiratory-rate",
      icon: "sleep",
    },
    {
      title: "训练",
      value: `${summary?.workouts.length ?? 0} 次`,
      helper: summary?.workouts[0] ? workoutLabel(summary.workouts[0].sport_type) : "昨日未记录训练",
      href: "/apple/raw/workouts",
      icon: "cardio",
    },
    {
      title: "健康记录",
      value: `${coreReadyCount}/${CORE_METRICS.length}`,
      helper: `${observationRows.toLocaleString("zh-CN")} 条私密记录`,
      href: "/apple/sources",
      icon: "data",
    },
  ];
}

function favoriteMetricCards(seriesList: Array<MetricSeries | null>) {
  return FAVORITE_METRIC_IDS.map((metricId) => {
    const metricIndex = APPLE_METRICS.findIndex((item) => item.id === metricId);
    const metric = APPLE_METRICS[metricIndex];
    if (!metric) return null;
    const series = seriesList[metricIndex];
    const nums = metricSeriesValues(metric, series);
    const latest = nums.length ? nums[nums.length - 1] : latestValue(series);
    const trend = recentTrend(nums);
    return {
      metric,
      nums,
      latest,
      trend,
      tone: trendTone(metric, trend.delta),
    };
  }).filter((item): item is {
    metric: AppleMetric;
    nums: number[];
    latest: number | null;
    trend: { delta: number | null; pct: number | null };
    tone: string;
  } => Boolean(item));
}

function favoriteTrendLabel(metric: AppleMetric, pctValue: number | null): string {
  if (pctValue === null) return metric.note;
  const direction = pctValue > 0 ? "上升" : "下降";
  return `30 天${direction} ${formatValue(Math.abs(pctValue), 1)}%`;
}

function metricSnapshot(seriesList: Array<MetricSeries | null>, metricId: string) {
  const index = APPLE_METRICS.findIndex((item) => item.id === metricId);
  const metric = APPLE_METRICS[index];
  if (!metric) return null;
  const nums = metricSeriesValues(metric, seriesList[index]);
  const trend = recentTrend(nums);
  return {
    metric,
    latest: nums.length ? nums[nums.length - 1] : latestValue(seriesList[index]),
    trend,
    tone: trendTone(metric, trend.delta),
  };
}

function buildFocusInsights(
  summary: AppleDailySummary | null,
  seriesList: Array<MetricSeries | null>,
): FocusInsight[] {
  const insights: FocusInsight[] = [];
  const activity = summary?.activity;
  const sleep = summary?.sleep;
  const stepsDelta = activity?.delta_pct?.steps ?? null;
  const activeMinutes = activity?.active_minutes ?? null;
  const hrv = metricSnapshot(seriesList, "vital.hrv_sdnn");
  const respiration = metricSnapshot(seriesList, "vital.respiratory_rate");

  if (activity) {
    const isActiveDay = activity.level === "充足" || (stepsDelta !== null && stepsDelta >= 10) || (activeMinutes !== null && activeMinutes >= 30);
    insights.push({
      title: isActiveDay ? "活动量保持得不错" : "今天可以补一点活动量",
      body: isActiveDay
        ? `昨日 ${formatValue(activity.steps)} 步，活动 ${formatValue(activeMinutes)} 分钟，日常活动已经有基础。`
        : `昨日 ${formatValue(activity.steps)} 步，活动 ${formatValue(activeMinutes)} 分钟，今天安排几段轻活动会更稳。`,
      meta: stepsDelta === null ? "昨日活动" : `较近 7 日 ${stepsDelta > 0 ? "高" : "低"} ${formatValue(Math.abs(stepsDelta), 1)}%`,
      href: "/apple/categories/activity",
      icon: "activity",
      tone: isActiveDay ? "good" : "warn",
    });
  }

  if (sleep) {
    const sleepHours = sleep.total_sleep_min === null ? null : sleep.total_sleep_min / 60;
    const lowSleep = sleep.level === "偏少" || (sleep.total_sleep_min !== null && sleep.total_sleep_min < 360);
    insights.push({
      title: lowSleep ? "恢复优先级更高" : "睡眠恢复较稳定",
      body: lowSleep
        ? `昨夜睡眠 ${formatHours(sleep.total_sleep_min)}，今天训练和学习节奏建议留出缓冲。`
        : `昨夜睡眠 ${formatHours(sleep.total_sleep_min)}，睡眠效率 ${formatValue(sleep.efficiency_pct, 1)}%。`,
      meta: sleepHours === null ? "昨夜睡眠" : `${formatValue(sleepHours, 1)} 小时 · ${sleep.level}`,
      href: "/apple/raw/sleep_sessions",
      icon: "sleep",
      tone: lowSleep ? "warn" : "good",
    });
  }

  if (hrv) {
    const hrvPct = hrv.trend.pct;
    insights.push({
      title: hrvPct !== null && hrvPct < -5 ? "恢复指标有下降" : "恢复趋势可继续观察",
      body:
        hrvPct === null
          ? `最近 HRV 最新值 ${formatValue(hrv.latest, hrv.metric.digits ?? 0)} ${hrv.metric.unit}，继续积累记录。`
          : `HRV 最近 30 天${hrvPct >= 0 ? "上升" : "下降"} ${formatValue(Math.abs(hrvPct), 1)}%，适合结合睡眠和训练负荷一起看。`,
      meta: `最新 ${formatValue(hrv.latest, hrv.metric.digits ?? 0)} ${hrv.metric.unit}`,
      href: `/apple/metrics/${hrv.metric.slug}`,
      icon: "recovery",
      tone: hrvPct !== null && hrvPct < -5 ? "warn" : hrv.tone === "good" ? "good" : "neutral",
    });
  } else if (respiration) {
    insights.push({
      title: "夜间呼吸有记录",
      body: `最近呼吸次数 ${formatValue(respiration.latest, respiration.metric.digits ?? 0)} ${respiration.metric.unit}，适合和睡眠质量一起看。`,
      meta: "睡眠呼吸",
      href: `/apple/metrics/${respiration.metric.slug}`,
      icon: "sleep",
      tone: "neutral",
    });
  }

  if (respiration && hrv && insights.length < 3) {
    insights.push({
      title: "夜间呼吸次数",
      body: `昨夜平均 ${formatValue(sleep?.respiratory_rate ?? respiration.latest, respiration.metric.digits ?? 0)} ${respiration.metric.unit}，目前已同步到睡眠记录。`,
      meta: "睡眠期间采集",
      href: `/apple/metrics/${respiration.metric.slug}`,
      icon: "sleep",
      tone: "neutral",
    });
  }

  return insights.slice(0, 3);
}

function rawNumber(row: AppleRawRow | undefined, key: string): number | null {
  const value = row?.[key];
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function localDateKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : null;
}

function dayLabel(dateKey: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    timeZone: "Asia/Shanghai",
  }).format(new Date(`${dateKey}T12:00:00+08:00`));
}

function activityText(steps: number | null, activeMinutes: number | null): { text: string; tone: "good" | "warn" | "neutral" } {
  if (steps === null && activeMinutes === null) return { text: "暂无活动", tone: "neutral" };
  if ((steps ?? 0) >= 8000 || (activeMinutes ?? 0) >= 30) return { text: "活动充足", tone: "good" };
  if ((steps ?? 0) >= 5000 || (activeMinutes ?? 0) >= 15) return { text: "保持中", tone: "neutral" };
  return { text: "活动偏少", tone: "warn" };
}

function sleepText(sleepMinutes: number | null): { text: string; tone: "good" | "warn" | "neutral" } {
  if (sleepMinutes === null) return { text: "暂无睡眠", tone: "neutral" };
  if (sleepMinutes >= 420) return { text: "睡眠充足", tone: "good" };
  if (sleepMinutes >= 355) return { text: "睡眠尚可", tone: "neutral" };
  return { text: "睡眠偏少", tone: "warn" };
}

function combinedTone(a: "good" | "warn" | "neutral", b: "good" | "warn" | "neutral"): "good" | "warn" | "neutral" {
  if (a === "warn" || b === "warn") return "warn";
  if (a === "good" && b === "good") return "good";
  return "neutral";
}

function buildSevenDayReview(activityRows: AppleRawRow[], sleepRows: AppleRawRow[]): DayReview[] {
  const sleepByDate = new Map<string, AppleRawRow>();
  sleepRows.forEach((row) => {
    const dateKey = localDateKey(String(row.end_time ?? row.start_time ?? ""));
    if (!dateKey) return;
    const current = sleepByDate.get(dateKey);
    const currentSleep = rawNumber(current, "total_sleep_min") ?? 0;
    const nextSleep = rawNumber(row, "total_sleep_min") ?? 0;
    if (!current || nextSleep > currentSleep) sleepByDate.set(dateKey, row);
  });

  const activityByDate = new Map(
    activityRows
      .map((row) => [String(row.date ?? ""), row] as const)
      .filter(([date]) => /^\d{4}-\d{2}-\d{2}$/.test(date)),
  );
  const dates = Array.from(new Set([...activityByDate.keys(), ...sleepByDate.keys()]))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 7);

  return dates.map((date) => {
    const activity = activityByDate.get(date);
    const sleep = sleepByDate.get(date);
    const steps = rawNumber(activity, "steps");
    const activeMinutes = rawNumber(activity, "active_minutes");
    const standMinutes = rawNumber(activity, "stand_minutes");
    const sleepMinutes = rawNumber(sleep, "total_sleep_min");
    const activityState = activityText(steps, activeMinutes);
    const sleepState = sleepText(sleepMinutes);
    return {
      date,
      label: dayLabel(date),
      steps,
      activeMinutes,
      standMinutes,
      sleepMinutes,
      activityText: activityState.text,
      sleepText: sleepState.text,
      tone: combinedTone(activityState.tone, sleepState.tone),
    };
  });
}

export default async function AppleHealthPage() {
  const [readiness, status, privacy, dailySummary, seriesList, activityDetail, sleepDetail] = await Promise.all([
    safeReadiness(),
    safeAppleStatus(),
    safePrivacy(),
    safeAppleDailySummary(),
    Promise.all(APPLE_METRICS.map((metric) => safeSeries(metric.id, "30d"))),
    safeAppleRawDetail("daily_activity", 14),
    safeAppleRawDetail("sleep_sessions", 20),
  ]);
  const observationRows = readiness?.sources.reduce((sum, source) => sum + source.observation_count, 0) ?? totalRows(status);
  const coreReadyCount = readyCount(readiness);
  const isLocal = privacy ? !privacy.cloud_active : true;
  const highlights = trendHighlights(seriesList);
  const favorites = favoriteMetricCards(seriesList);
  const focusInsights = buildFocusInsights(dailySummary, seriesList);
  const sevenDayReview = buildSevenDayReview(activityDetail?.rows ?? [], sleepDetail?.rows ?? []);
  const summaryFeed = buildSummaryFeed(dailySummary);
  const homeFavorites = buildHomeFavorites(dailySummary, coreReadyCount, observationRows);
  const activity = dailySummary?.activity ?? null;

  return (
    <>
      <section className="apple-hero product">
        <div>
          <div className="hero-eyebrow">Apple Watch 健康概览</div>
          <h2>{todayReadiness(dailySummary)}</h2>
          <p>{dailySummary?.headline ?? "同步完成后，这里会展示昨日运动、睡眠与恢复建议。"}</p>
        </div>
        <div className="apple-hero-side">
          <div className="apple-hero-badges">
            <span className="apple-badge good">{isLocal ? "仅自己可见" : "云端摘要"}</span>
            <span className="apple-badge">{relativeZh(latestSync(readiness, status))}</span>
          </div>
          <div className="apple-hero-rings" aria-label="活动圆环">
            <HeroRing label="能量" value={activity?.active_calories} goal={600} unit="kcal" color="var(--down)" />
            <HeroRing label="分钟" value={activity?.active_minutes} goal={30} unit="分" color="var(--up)" />
            <HeroRing label="站立" value={activity?.stand_minutes} goal={180} unit="分" color="var(--accent)" />
          </div>
        </div>
      </section>

      <section className="apple-summary-feed" aria-label="每日摘要">
        <div className="apple-section-head apple-summary-head">
          <div>
            <h3>每日摘要</h3>
            <p>{dailySummary ? `${dailySummary.date} · 运动、睡眠和建议` : "同步完成后显示每日摘要"}</p>
          </div>
          <div className="apple-link-group">
            <Link href="/apple/coach" className="apple-text-link">
              健康教练
            </Link>
            <Link href="/apple/daily" className="apple-text-link">
              每日总结
            </Link>
            <Link href="/apple/highlights" className="apple-text-link">
              全部亮点
            </Link>
            <Link href="/apple/report" className="apple-text-link">
              健康报告
            </Link>
            {dailySummary?.date && (
              <Link href={summaryDateHref(dailySummary)} className="apple-text-link">
                当天详情
              </Link>
            )}
          </div>
        </div>
        <div className="apple-summary-feed-grid">
          {summaryFeed.map((item, index) => {
            const content = (
              <>
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
              </>
            );

            return item.href ? (
              <Link
                className={`apple-summary-card ${item.tone} ${index === 0 ? "primary" : ""}`}
                href={item.href}
                key={item.title}
              >
                {content}
              </Link>
            ) : (
              <article className={`apple-summary-card ${item.tone}`} key={item.title}>
                {content}
              </article>
            );
          })}
        </div>
      </section>

      <section className="apple-home-favorites" aria-label="收藏指标">
        <div className="apple-section-head">
          <div>
            <h3>收藏</h3>
            <p>把每天最常看的健康指标放在这里。</p>
          </div>
          <Link href="/apple/favorites" className="apple-text-link">
            管理
          </Link>
        </div>
        <div className="apple-home-favorites-grid">
          {homeFavorites.map((item) => {
            const content = (
              <>
                <AppleCategoryIcon name={item.icon} />
                <div>
                  <span>{item.title}</span>
                  <strong>{item.value}</strong>
                  <small>{item.helper}</small>
                </div>
              </>
            );
            return item.href ? (
              <Link className={`apple-home-favorite ${item.tone ?? ""}`} href={item.href} key={item.title}>
                {content}
              </Link>
            ) : (
              <article className={`apple-home-favorite ${item.tone ?? ""}`} key={item.title}>
                {content}
              </article>
            );
          })}
        </div>
      </section>

      {!!focusInsights.length && (
        <section className="apple-focus-grid">
          {focusInsights.map((insight) => (
            <Link className={`apple-focus-card ${insight.tone}`} href={insight.href} key={insight.title}>
              <AppleCategoryIcon name={insight.icon} />
              <div>
                <span>{insight.meta}</span>
                <strong>{insight.title}</strong>
                <p>{insight.body}</p>
              </div>
            </Link>
          ))}
        </section>
      )}

      {!!sevenDayReview.length && (
        <section className="apple-panel apple-week-review">
          <div className="apple-panel-head">
            <div>
              <h3>最近 7 天</h3>
              <p>把每天的活动、站立和睡眠放在一起看。</p>
            </div>
            <Link href="/apple/calendar" className="apple-text-link">
              打开日历
            </Link>
          </div>
          <div className="apple-week-strip">
            {sevenDayReview.map((day) => (
              <Link className={`apple-day-card ${day.tone}`} href={`/apple/days/${encodeURIComponent(day.date)}`} key={day.date}>
                <span>{day.label}</span>
                <strong>{formatValue(day.steps)}</strong>
                <small>步</small>
                <div className="apple-day-bars" aria-hidden>
                  <i style={{ height: `${Math.max(8, Math.min(100, ((day.steps ?? 0) / 10000) * 100))}%` }} />
                  <i style={{ height: `${Math.max(8, Math.min(100, ((day.activeMinutes ?? 0) / 60) * 100))}%` }} />
                  <i style={{ height: `${Math.max(8, Math.min(100, ((day.sleepMinutes ?? 0) / 480) * 100))}%` }} />
                </div>
                <p>
                  {day.activityText} · {day.sleepText}
                </p>
                <em>
                  {formatHours(day.sleepMinutes)} 睡眠 · {formatHours(day.standMinutes)} 站立
                </em>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="apple-panel apple-favorites-panel">
        <div className="apple-panel-head">
          <div>
            <h3>常看指标</h3>
            <p>活动、心率、恢复和睡眠的关键状态。</p>
          </div>
          <Link href="/apple/favorites" className="apple-text-link">
            查看全部
          </Link>
        </div>
        <div className="apple-favorite-grid">
          {favorites.map(({ metric, nums, latest, trend, tone }) => (
            <Link className="apple-favorite-card" href={`/apple/metrics/${metric.slug}`} key={metric.id}>
              <div className="apple-favorite-top">
                <AppleCategoryIcon name={iconForMetric(metric.id)} />
                <em className={tone}>{favoriteTrendLabel(metric, trend.pct)}</em>
              </div>
              <span>{metric.label}</span>
              <strong>
                {formatValue(latest, metric.digits ?? 0)}
                <small>{metric.unit}</small>
              </strong>
              <Sparkline nums={nums} />
              <p>{metric.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="apple-two-col apple-ios-summary">
        <article className="apple-panel apple-rings-panel">
          <div className="apple-panel-head">
            <div>
              <h3>活动状态</h3>
              <p>按常用运动目标快速看昨日完成度。</p>
            </div>
            <Link href="/apple/raw/daily_activity" className="apple-text-link">
              查看活动
            </Link>
          </div>
          <div className="apple-rings-grid">
            <ActivityRing
              label="活动能量"
              value={dailySummary?.activity?.active_calories}
              goal={600}
              unit="kcal"
              color="var(--down)"
            />
            <ActivityRing
              label="活动分钟"
              value={dailySummary?.activity?.active_minutes}
              goal={30}
              unit="分钟"
              color="var(--up)"
            />
            <ActivityRing
              label="站立时间"
              value={dailySummary?.activity?.stand_minutes}
              goal={180}
              unit="分钟"
              color="var(--accent)"
            />
          </div>
        </article>

        <article className="apple-panel apple-highlight-panel">
          <div className="apple-panel-head">
            <div>
              <h3>趋势亮点</h3>
              <p>自动挑出最近变化最明显的指标。</p>
            </div>
            <Link href="/apple/trends" className="apple-text-link">
              查看全部
            </Link>
          </div>
          <div className="apple-highlight-list">
            {highlights.map(({ metric, latest, trend, tone }) => (
              <Link className="apple-highlight-row" href={`/apple/metrics/${metric.slug}`} key={metric.id}>
                <AppleCategoryIcon name={iconForMetric(metric.id)} />
                <div>
                  <span>{metric.label}</span>
                  <strong>
                    {formatValue(latest, metric.digits ?? 0)}
                    <small>{metric.unit}</small>
                  </strong>
                </div>
                <em className={tone}>
                  {trend.pct === null ? "暂无" : `${trend.pct > 0 ? "+" : ""}${formatValue(trend.pct, 1)}%`}
                </em>
              </Link>
            ))}
            {!highlights.length && <div className="apple-empty-line">暂无可比较的趋势亮点</div>}
          </div>
        </article>
      </section>

      <div className="apple-section-head">
        <h3>浏览</h3>
        <p>按 Apple 健康式分类快速进入你关心的数据。</p>
      </div>
      <section className="apple-category-grid">
        {BROWSE_CATEGORIES.map((category) => (
          <Link className="apple-category-card" href={category.slug === "data" ? "/apple/sources" : `/apple/categories/${category.slug}`} key={category.title}>
            <AppleCategoryIcon name={category.icon} />
            <div>
              <span>{category.title}</span>
              <small>{category.subtitle}</small>
            </div>
          </Link>
        ))}
      </section>

      <div className="apple-section-head">
        <h3>健康指标</h3>
        <p>点击任意指标查看最近记录、本周和本月趋势。</p>
      </div>
      <section className="apple-trend-grid">
        {APPLE_METRICS.map((metric, index) => {
          const series = seriesList[index];
          const nums = metricSeriesValues(metric, series);
          const latest = nums.length ? nums[nums.length - 1] : latestValue(series);
          const trend = recentTrend(nums);
          const tone = trendTone(metric, trend.delta);
          return (
            <Link className="apple-trend-card clickable" href={`/apple/metrics/${metric.slug}`} key={metric.id}>
              <div className="apple-card-title">
                <span>{metric.label}</span>
                <em className={tone}>
                  {trend.pct === null ? metric.note : `${trend.pct > 0 ? "+" : ""}${formatValue(trend.pct, 1)}%`}
                </em>
              </div>
              <div className="apple-value">
                {formatValue(latest, metric.digits ?? 0)}
                <span>{metric.unit}</span>
              </div>
              <Sparkline nums={nums} />
              <div className="apple-card-meta">
                {nums.length.toLocaleString("zh-CN")} 条记录 · {zhDate(series?.start)} 到 {zhDate(series?.end)}
              </div>
            </Link>
          );
        })}
      </section>

      <div className="apple-section-head">
        <h3>同步数据</h3>
        <p>每一类都可以点进去看最近明细。</p>
      </div>
      <section className="apple-raw-grid">
        {Object.entries(status ?? {}).map(([key, row]) => (
          <Link className="apple-raw-tile" href={`/apple/raw/${encodeURIComponent(key)}`} key={key}>
            <span>{RAW_TABLES[key]?.label ?? key}</span>
            <strong>{row.count.toLocaleString("zh-CN")}</strong>
            <small>最近：{zhTime(row.newest)}</small>
          </Link>
        ))}
      </section>
    </>
  );
}
