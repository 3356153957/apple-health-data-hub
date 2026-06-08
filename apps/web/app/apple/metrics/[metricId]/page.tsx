import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import type { AppleMetric } from "../../appleHealth";
import { safeAppleRawDetail, safeSeries } from "../../../lib/load";
import {
  APPLE_METRICS,
  average,
  formatValue,
  latestValue,
  metricSeriesValues,
  normalizeMetricValue,
  orderedSeriesPoints,
  recentTrend,
  trendTone,
  zhTime,
} from "../../appleHealth";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ metricId: string }>;
  searchParams?: Promise<{ range?: string | string[] }>;
};

type DetailPoint = {
  t: string;
  value: number | null;
  unit: string;
  source_id: string | null;
};

type ChartPoint = DetailPoint & {
  value: number;
};

const RAW_METRIC_MAP: Record<string, { table: string; time: string; value: string; unit?: string; metricName?: string }> = {
  "vital.heart_rate": { table: "heart_rate", time: "time", value: "bpm", unit: "bpm" },
  "vital.hrv_sdnn": { table: "hrv", time: "time", value: "value_ms", unit: "ms" },
  "vital.blood_oxygen": { table: "blood_oxygen", time: "time", value: "spo2_pct", unit: "%" },
  "activity.steps": { table: "daily_activity", time: "date", value: "steps", unit: "步" },
  "activity.active_energy": { table: "daily_activity", time: "date", value: "active_calories", unit: "kcal" },
  "activity.stand_minutes": {
    table: "daily_activity",
    time: "date",
    value: "stand_minutes",
    unit: "分钟",
  },
  "vital.resting_heart_rate": {
    table: "quantity_samples",
    time: "time",
    value: "value",
    unit: "bpm",
    metricName: "resting_heart_rate",
  },
  "vital.respiratory_rate": {
    table: "quantity_samples",
    time: "time",
    value: "value",
    unit: "次/分",
    metricName: "respiratory_rate",
  },
  "cardio.vo2_max": {
    table: "quantity_samples",
    time: "time",
    value: "value",
    unit: "ml/kg/min",
    metricName: "vo2_max",
  },
};

function rawDetailPoints(
  metric: AppleMetric,
  rows: Array<Record<string, string | number | null>>,
): DetailPoint[] {
  const config = RAW_METRIC_MAP[metric.id];
  if (!config) return [];
  return rows
    .filter((row) => !config.metricName || row.metric_name === config.metricName)
    .map((row) => {
      const rawValue = row[config.value];
      const numeric = typeof rawValue === "number" ? rawValue : Number(rawValue);
      return {
        t: String(row[config.time] ?? ""),
        value: Number.isFinite(numeric) ? normalizeMetricValue(metric, numeric) : null,
        unit: config.unit ?? String(row.unit ?? metric.unit),
        source_id: typeof row.source_id === "string" ? row.source_id : null,
      };
    })
    .filter((point) => point.t)
    .sort((a, b) => new Date(b.t).getTime() - new Date(a.t).getTime());
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { metricId } = await params;
  const key = decodeURIComponent(metricId);
  const metric = APPLE_METRICS.find((item) => item.slug === key || item.id === key);
  return { title: `${metric?.label ?? "健康指标"} · 健康` };
}

function minMax(nums: number[]): { min: number | null; max: number | null } {
  if (!nums.length) return { min: null, max: null };
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

const TOTAL_METRICS = new Set(["activity.steps", "activity.active_energy", "activity.stand_minutes"]);

type PeriodStats = {
  count: number;
  avg: number | null;
  min: number | null;
  max: number | null;
  total: number | null;
  latest: DetailPoint | null;
};

type IconName = "week" | "month" | "trend" | "records";

type MetricInsight = {
  icon: IconName;
  title: string;
  body: string;
  meta: string;
  tone: "good" | "warn" | "neutral";
};

const RANGE_OPTIONS = [
  { key: "24h", label: "日", title: "24 小时" },
  { key: "7d", label: "周", title: "7 天" },
  { key: "30d", label: "月", title: "30 天" },
  { key: "90d", label: "三月", title: "90 天" },
  { key: "1y", label: "年", title: "1 年" },
] as const;

type RangeKey = (typeof RANGE_OPTIONS)[number]["key"];

const RELATED_METRICS: Array<{
  id: string;
  href: string;
  icon: IconName;
  kicker: string;
  description: string;
}> = [
  {
    id: "activity.stand_minutes",
    href: "/apple/metrics/stand-time",
    icon: "records",
    kicker: "活动",
    description: "按天汇总 Apple Watch 站立分钟数，不会混在心率曲线里。",
  },
  {
    id: "vital.respiratory_rate",
    href: "/apple/metrics/respiratory-rate",
    icon: "trend",
    kicker: "睡眠",
    description: "通常在睡眠期间产生读数，适合和睡眠质量、疲劳状态一起看。",
  },
];

const ICON_PATHS: Record<IconName, string[]> = {
  week: ["M7 2v4", "M17 2v4", "M3 9h18", "M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2"],
  month: ["M4 19V5", "M4 19h16", "M8 16v-5", "M12 16V8", "M16 16v-8"],
  trend: ["M4 16l5-5 4 4 7-8", "M14 7h6v6"],
  records: ["M8 6h13", "M8 12h13", "M8 18h13", "M3.5 6h.01", "M3.5 12h.01", "M3.5 18h.01"],
};

function MetricIcon({ name }: { name: IconName }) {
  return (
    <span className={`apple-mini-icon ${name}`} aria-hidden>
      <svg viewBox="0 0 24 24" focusable="false">
        {ICON_PATHS[name].map((path) => (
          <path d={path} key={path} />
        ))}
      </svg>
    </span>
  );
}

function sourceLabel(sourceId: string | null | undefined): string {
  if (!sourceId) return "本机同步";
  if (sourceId === "apple-health-healthsave") return "Apple 健康同步";
  return sourceId;
}

function pointDate(point: DetailPoint): Date | null {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(point.t) ? new Date(`${point.t}T12:00:00+08:00`) : new Date(point.t);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfWeek(now: Date): Date {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date;
}

function startOfMonth(now: Date): Date {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(1);
  return date;
}

function shiftDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function shiftMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function pointsBetween(points: DetailPoint[], start: Date, end: Date): DetailPoint[] {
  return points.filter((point) => {
    const date = pointDate(point);
    return date !== null && date >= start && date < end;
  });
}

function startForRange(key: RangeKey, now: Date): Date {
  if (key === "24h") return shiftDays(now, -1);
  if (key === "7d") return shiftDays(now, -7);
  if (key === "30d") return shiftDays(now, -30);
  if (key === "90d") return shiftDays(now, -90);
  return shiftDays(now, -365);
}

function pointKey(point: DetailPoint): string {
  return [point.t, point.value ?? "null", point.unit ?? "", point.source_id ?? ""].join("|");
}

function mergePoints(...groups: DetailPoint[][]): DetailPoint[] {
  const byKey = new Map<string, DetailPoint>();
  groups.flat().forEach((point) => {
    const key = pointKey(point);
    if (!byKey.has(key)) byKey.set(key, point);
  });
  return Array.from(byKey.values()).sort((a, b) => {
    const aDate = pointDate(a)?.getTime() ?? 0;
    const bDate = pointDate(b)?.getTime() ?? 0;
    return aDate - bDate;
  });
}

function statsFor(points: DetailPoint[]): PeriodStats {
  const values = points.map((point) => point.value).filter((value): value is number => value !== null);
  const range = minMax(values);
  return {
    count: points.length,
    avg: average(values),
    min: range.min,
    max: range.max,
    total: values.length ? values.reduce((sum, value) => sum + value, 0) : null,
    latest: points[points.length - 1] ?? null,
  };
}

function primaryValue(metric: AppleMetric, stats: PeriodStats): number | null {
  return TOTAL_METRICS.has(metric.id) ? stats.total : stats.avg;
}

function primaryLabel(metric: AppleMetric): string {
  return TOTAL_METRICS.has(metric.id) ? "累计" : "平均";
}

function changePct(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function changeLabel(value: number | null, label: string): string {
  if (value === null) return "暂无同期对比";
  return `${value > 0 ? "+" : ""}${formatValue(value, 1)}% ${label}`;
}

function rangeLabel(metric: AppleMetric, stats: { min: number | null; max: number | null }): string {
  if (stats.min === null || stats.max === null) return "暂无范围";
  return `${formatValue(stats.min, metric.digits ?? 0)}-${formatValue(stats.max, metric.digits ?? 0)} ${metric.unit}`;
}

function metricSummary(metric: AppleMetric, week: PeriodStats, month: PeriodStats): string {
  const weekValue = primaryValue(metric, week);
  const monthValue = primaryValue(metric, month);
  if (weekValue === null && monthValue === null) return "本周和本月还没有可用于汇总的记录。";
  const weekText = weekValue === null ? "本周暂无记录" : `本周${primaryLabel(metric)} ${formatValue(weekValue, metric.digits ?? 0)} ${metric.unit}`;
  const monthText =
    monthValue === null ? "本月暂无记录" : `本月${primaryLabel(metric)} ${formatValue(monthValue, metric.digits ?? 0)} ${metric.unit}`;
  return `${weekText}，${monthText}。`;
}

function metricAmount(metric: AppleMetric, value: number | null): string {
  if (value === null) return "暂无";
  return `${formatValue(value, metric.digits ?? 0)} ${metric.unit}`;
}

function positionTone(metric: AppleMetric, position: number | null): "good" | "warn" | "neutral" {
  if (position === null || metric.higherIsBetter === undefined) return "neutral";
  if (position >= 0.8) return metric.higherIsBetter ? "good" : "warn";
  if (position <= 0.2) return metric.higherIsBetter ? "warn" : "good";
  return "neutral";
}

function positionTitle(position: number | null): string {
  if (position === null) return "等待更多记录";
  if (position >= 0.8) return "接近近期高位";
  if (position <= 0.2) return "接近近期低位";
  return "处在近期中段";
}

function rangePosition(latest: number | null, range: { min: number | null; max: number | null }): number | null {
  if (latest === null || range.min === null || range.max === null || range.max === range.min) return null;
  return Math.max(0, Math.min(1, (latest - range.min) / (range.max - range.min)));
}

function insightTone(metric: AppleMetric, pct: number | null): "good" | "warn" | "neutral" {
  if (pct === null || metric.higherIsBetter === undefined || Math.abs(pct) < 0.01) return "neutral";
  const good = metric.higherIsBetter ? pct > 0 : pct < 0;
  return good ? "good" : "warn";
}

function buildMetricInsights({
  metric,
  latest,
  range,
  trendPct,
  weekChange,
  monthChange,
  windowLabel,
}: {
  metric: AppleMetric;
  latest: number | null;
  range: { min: number | null; max: number | null };
  trendPct: number | null;
  weekChange: number | null;
  monthChange: number | null;
  windowLabel: string;
}): MetricInsight[] {
  const position = rangePosition(latest, range);
  const trendDirection = trendPct === null ? null : trendPct >= 0 ? "上升" : "下降";
  const monthDirection = monthChange === null ? null : monthChange >= 0 ? "高于" : "低于";

  return [
    {
      icon: "records",
      title: positionTitle(position),
      body:
        position === null
          ? `${windowLabel}记录还不足以判断区间位置，后续同步后会更稳定。`
          : `最新 ${metricAmount(metric, latest)}，${windowLabel}范围是 ${rangeLabel(metric, range)}。`,
      meta: "当前位置",
      tone: positionTone(metric, position),
    },
    {
      icon: "trend",
      title: trendDirection === null ? "趋势还不明显" : `${windowLabel}${trendDirection} ${formatValue(Math.abs(trendPct ?? 0), 1)}%`,
      body:
        trendDirection === null
          ? "最近数据点还不足以形成稳定趋势，先继续观察。"
          : `最近半段相对前半段${trendDirection}，适合和睡眠、活动量、训练安排一起看。`,
      meta: "阶段对比",
      tone: insightTone(metric, trendPct),
    },
    {
      icon: "month",
      title: monthDirection === null ? "暂无月度对比" : `本月${monthDirection}上月 ${formatValue(Math.abs(monthChange ?? 0), 1)}%`,
      body:
        monthDirection === null
          ? `本周变化${weekChange === null ? "暂时无法比较" : `${weekChange >= 0 ? "上升" : "下降"} ${formatValue(Math.abs(weekChange), 1)}%`}，月度对比还需要更多记录。`
          : `本周${weekChange === null ? "暂无同期对比" : `${weekChange >= 0 ? "高于" : "低于"}上周 ${formatValue(Math.abs(weekChange), 1)}%`}，本月趋势已经可以和上月做初步比较。`,
      meta: "周期回顾",
      tone: insightTone(metric, monthChange ?? weekChange),
    },
  ];
}

function selectedRange(raw: string | string[] | undefined): RangeKey {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return RANGE_OPTIONS.some((option) => option.key === value) ? (value as RangeKey) : "30d";
}

function rangeTitle(key: RangeKey): string {
  return RANGE_OPTIONS.find((option) => option.key === key)?.title ?? "30 天";
}

function compactDate(iso: string | null | undefined): string {
  if (!iso) return "暂无";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00+08:00`) : new Date(iso);
  if (Number.isNaN(date.getTime())) return "暂无";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(date);
}

function sampleChartPoints(points: ChartPoint[], target = 180): ChartPoint[] {
  if (points.length <= target) return points;
  const step = points.length / target;
  const sampled: ChartPoint[] = [];
  for (let index = 0; index < target; index += 1) {
    sampled.push(points[Math.min(points.length - 1, Math.floor(index * step))]);
  }
  return sampled;
}

function MetricDetailChart({
  metric,
  points,
  avg,
}: {
  metric: AppleMetric;
  points: DetailPoint[];
  avg: number | null;
}) {
  const values = points.filter((point): point is ChartPoint => point.value !== null && Number.isFinite(point.value));
  const sampled = sampleChartPoints(values);
  if (sampled.length < 2) return <div className="apple-empty-chart">暂无趋势</div>;

  const nums = sampled.map((point) => point.value);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const highIndex = nums.indexOf(max);
  const lowIndex = nums.indexOf(min);
  const xFor = (index: number) => (index / Math.max(1, sampled.length - 1)) * 100;
  const yFor = (value: number) => 64 - ((value - min) / span) * 50;
  const linePoints = sampled.map((point, index) => `${xFor(index).toFixed(2)},${yFor(point.value).toFixed(2)}`).join(" ");
  const areaPoints = `0,68 ${linePoints} 100,68`;
  const avgY = avg === null ? null : yFor(avg);
  const start = values[0];
  const end = values[values.length - 1];

  return (
    <div className="apple-detail-chart">
      <div className="apple-detail-chart-top">
        <div>
          <span>图表范围</span>
          <strong>
            {formatValue(min, metric.digits ?? 0)}-{formatValue(max, metric.digits ?? 0)}
            <small>{metric.unit}</small>
          </strong>
        </div>
        <div>
          <span>平均值</span>
          <strong>
            {formatValue(avg, metric.digits ?? 0)}
            <small>{metric.unit}</small>
          </strong>
        </div>
      </div>
      <svg className="apple-detail-chart-svg" viewBox="0 0 100 72" preserveAspectRatio="none" aria-hidden>
        <line x1="0" x2="100" y1="14" y2="14" className="grid" />
        <line x1="0" x2="100" y1="39" y2="39" className="grid" />
        <line x1="0" x2="100" y1="64" y2="64" className="grid" />
        {avgY !== null && <line x1="0" x2="100" y1={avgY} y2={avgY} className="avg" />}
        <polygon points={areaPoints} className="area" />
        <polyline points={linePoints} className="line" />
        <circle cx={xFor(highIndex)} cy={yFor(max)} r="1.35" className="marker high" />
        <circle cx={xFor(lowIndex)} cy={yFor(min)} r="1.35" className="marker low" />
      </svg>
      <div className="apple-chart-axis">
        <span>{compactDate(start.t)}</span>
        <span>{values.length.toLocaleString("zh-CN")} 个点</span>
        <span>{compactDate(end.t)}</span>
      </div>
      <div className="apple-chart-extremes">
        <span>
          最高 {formatValue(max, metric.digits ?? 0)} {metric.unit} · {compactDate(sampled[highIndex]?.t)}
        </span>
        <span>
          最低 {formatValue(min, metric.digits ?? 0)} {metric.unit} · {compactDate(sampled[lowIndex]?.t)}
        </span>
      </div>
    </div>
  );
}

export default async function AppleMetricDetailPage({ params, searchParams }: PageProps) {
  const { metricId } = await params;
  const query = searchParams ? await searchParams : {};
  const decodedId = decodeURIComponent(metricId);
  const metric = APPLE_METRICS.find((item) => item.slug === decodedId || item.id === decodedId);
  if (!metric) notFound();

  const activeRange = selectedRange(query.range);
  const rawConfig = RAW_METRIC_MAP[metric.id];
  const [selectedSeries, series90, rawDetail] = await Promise.all([
    safeSeries(metric.id, activeRange),
    safeSeries(metric.id, "90d"),
    rawConfig ? safeAppleRawDetail(rawConfig.table, 500) : Promise.resolve(null),
  ]);
  const rawPoints = rawDetailPoints(metric, rawDetail?.rows ?? []);
  const seriesPoints = orderedSeriesPoints(series90).map((point) => ({
    t: point.t,
    value: normalizeMetricValue(metric, point.value),
    unit: point.unit ?? metric.unit,
    source_id: point.source_id,
  }));
  const selectedPointsAsc = orderedSeriesPoints(selectedSeries).map((point) => ({
    t: point.t,
    value: normalizeMetricValue(metric, point.value),
    unit: point.unit ?? metric.unit,
    source_id: point.source_id,
  }));
  const selectedPointsDesc = [...selectedPointsAsc].reverse();
  const now = new Date();
  const rawPointsAsc = [...rawPoints].reverse();
  const selectedRawPoints = pointsBetween(rawPointsAsc, startForRange(activeRange, now), now);
  const selectedDetailPointsAsc = mergePoints(selectedPointsAsc, selectedRawPoints);
  const detailPointsAsc = mergePoints(seriesPoints, rawPointsAsc);
  const chartPoints = selectedDetailPointsAsc.length ? selectedDetailPointsAsc : detailPointsAsc;
  const nums = selectedDetailPointsAsc.map((point) => point.value).filter((value): value is number => value !== null);
  const longNums = detailPointsAsc.map((point) => point.value).filter((value): value is number => value !== null);
  const latest = rawPoints[0]?.value ?? (nums.length ? nums[nums.length - 1] : latestValue(selectedSeries));
  const avg = average(nums);
  const range = minMax(nums);
  const trend = recentTrend(nums);
  const tone = trendTone(metric, trend.delta);
  const windowLabel = rangeTitle(activeRange);
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);
  const weekStats = statsFor(pointsBetween(detailPointsAsc, weekStart, now));
  const previousWeekStats = statsFor(pointsBetween(detailPointsAsc, shiftDays(weekStart, -7), weekStart));
  const monthStats = statsFor(pointsBetween(detailPointsAsc, monthStart, now));
  const previousMonthStats = statsFor(pointsBetween(detailPointsAsc, shiftMonths(monthStart, -1), monthStart));
  const weekChange = changePct(primaryValue(metric, weekStats), primaryValue(metric, previousWeekStats));
  const monthChange = changePct(primaryValue(metric, monthStats), primaryValue(metric, previousMonthStats));
  const metricInsights = buildMetricInsights({
    metric,
    latest,
    range,
    trendPct: trend.pct,
    weekChange,
    monthChange,
    windowLabel,
  });

  const recentRows = rawPoints.length
    ? rawPoints.slice(0, 120)
    : selectedPointsDesc.slice(0, 80);
  const relatedSeries = await Promise.all(RELATED_METRICS.map((item) => safeSeries(item.id, "30d")));
  const relatedCards = RELATED_METRICS.map((item, index) => {
    const relatedMetric = APPLE_METRICS.find((candidate) => candidate.id === item.id);
    if (!relatedMetric) return null;
    const relatedLatest = normalizeMetricValue(relatedMetric, latestValue(relatedSeries[index]));
    return {
      ...item,
      active: item.id === metric.id,
      metric: relatedMetric,
      latest: relatedLatest,
    };
  }).filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <>
      <section className="apple-detail-hero">
        <div>
          <Link href="/apple" className="apple-back-link">
            返回健康概览
          </Link>
          <div className="hero-eyebrow">健康指标</div>
          <h2>{metric.label}</h2>
          <p>{metric.description}</p>
        </div>
        <div className="apple-hero-badges">
          <span className="apple-badge">{metric.note}</span>
          <span className="apple-badge good">本地读取</span>
        </div>
      </section>

      <section className="apple-related-metrics" aria-label="相关指标">
        <div className="apple-related-copy">
          <span>相关指标</span>
          <strong>不同指标分开展示</strong>
          <p>
            当前页只展示{metric.label}。站立时间在活动里，呼吸次数在睡眠和恢复里，点下面卡片可以直接查看。
          </p>
        </div>
        {relatedCards.map((item) => (
          <Link className={`apple-related-card ${item.active ? "active" : ""}`} href={item.href} key={item.id}>
            <MetricIcon name={item.icon} />
            <div>
              <span>{item.active ? "当前指标" : item.kicker}</span>
              <strong>{item.metric.label}</strong>
              <p>{item.description}</p>
              <em>
                {item.latest === null ? "暂无近期记录" : `已同步 ${formatValue(item.latest, item.metric.digits ?? 0)}`}
                {item.latest === null ? "" : ` ${item.metric.unit}`}
              </em>
            </div>
          </Link>
        ))}
      </section>

      <nav className="apple-range-tabs" aria-label="时间范围">
        {RANGE_OPTIONS.map((option) => (
          <Link
            className={option.key === activeRange ? "active" : undefined}
            href={`/apple/metrics/${encodeURIComponent(metric.slug)}?range=${option.key}`}
            key={option.key}
          >
            {option.label}
          </Link>
        ))}
      </nav>

      <section className="apple-kpis">
        <div className="apple-kpi icon">
          <MetricIcon name="records" />
          <span>最新值</span>
          <strong>{formatValue(latest, metric.digits ?? 0)}</strong>
          <small>{metric.unit}</small>
        </div>
        <div className="apple-kpi icon">
          <MetricIcon name="week" />
          <span>{windowLabel}平均</span>
          <strong>{formatValue(avg, metric.digits ?? 0)}</strong>
          <small>{metric.unit}</small>
        </div>
        <div className="apple-kpi icon">
          <MetricIcon name="month" />
          <span>{windowLabel}范围</span>
          <strong>
            {formatValue(range.min, metric.digits ?? 0)}-{formatValue(range.max, metric.digits ?? 0)}
          </strong>
          <small>{metric.unit}</small>
        </div>
        <div className="apple-kpi icon">
          <MetricIcon name="trend" />
          <span>趋势变化</span>
          <strong className={tone}>{trend.pct === null ? "暂无" : `${trend.pct > 0 ? "+" : ""}${formatValue(trend.pct, 1)}%`}</strong>
          <small>最近半段对比前半段</small>
        </div>
      </section>

      <section className="apple-metric-insights">
        {metricInsights.map((insight) => (
          <article className={`apple-metric-insight ${insight.tone}`} key={insight.title}>
            <MetricIcon name={insight.icon} />
            <div>
              <span>{insight.meta}</span>
              <strong>{insight.title}</strong>
              <p>{insight.body}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="apple-panel apple-period-overview">
        <div className="apple-panel-head">
          <div>
            <h3>周期总览</h3>
            <p>{metricSummary(metric, weekStats, monthStats)}</p>
          </div>
          <span className="apple-badge">按本周与本月汇总</span>
        </div>
        <div className="apple-period-grid">
          <article className="apple-period-card">
            <MetricIcon name="week" />
            <div>
              <span>本周总体</span>
              <strong>
                {formatValue(primaryValue(metric, weekStats), metric.digits ?? 0)}
                <small>{metric.unit}</small>
              </strong>
              <p>
                {primaryLabel(metric)} · {weekStats.count.toLocaleString("zh-CN")} 条 · {rangeLabel(metric, weekStats)}
              </p>
            </div>
            <em className={trendTone(metric, weekChange)}>{changeLabel(weekChange, "较上周")}</em>
          </article>

          <article className="apple-period-card">
            <MetricIcon name="month" />
            <div>
              <span>本月总体</span>
              <strong>
                {formatValue(primaryValue(metric, monthStats), metric.digits ?? 0)}
                <small>{metric.unit}</small>
              </strong>
              <p>
                {primaryLabel(metric)} · {monthStats.count.toLocaleString("zh-CN")} 条 · {rangeLabel(metric, monthStats)}
              </p>
            </div>
            <em className={trendTone(metric, monthChange)}>{changeLabel(monthChange, "较上月")}</em>
          </article>
        </div>
      </section>

      <section className="apple-panel apple-chart-panel">
        <div className="apple-panel-head">
          <div>
            <h3>{windowLabel}趋势</h3>
            <p>{nums.length.toLocaleString("zh-CN")} 个数据点</p>
          </div>
          <span className="apple-badge">
            {`90 天总计 ${longNums.length.toLocaleString("zh-CN")} 点`}
          </span>
        </div>
        <MetricDetailChart metric={metric} points={chartPoints} avg={avg} />
      </section>

      <section className="apple-panel">
        <div className="apple-panel-head">
          <div>
            <h3>最近记录</h3>
            <p>先展示最近 12 条，完整同步记录可以展开查看。</p>
          </div>
        </div>
        <div className="apple-record-grid">
          {recentRows.slice(0, 12).map((point, index) => (
            <article className="apple-record-card" key={`${point.t}-${index}`}>
              <MetricIcon name="records" />
              <div>
                <span>{zhTime(point.t)}</span>
                <strong>
                  {point.value === null ? "暂无" : formatValue(point.value, metric.digits ?? 0)}
                  <small>{point.unit ?? metric.unit}</small>
                </strong>
                <p>{sourceLabel(point.source_id)}</p>
              </div>
            </article>
          ))}
          {!recentRows.length && <div className="apple-empty-chart compact">暂无最近记录</div>}
        </div>
        <details className="apple-disclosure">
          <summary>查看表格明细</summary>
        <div className="apple-table-wrap">
          <table className="apple-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>数值</th>
                <th>单位</th>
                <th>来源</th>
              </tr>
            </thead>
            <tbody>
              {recentRows.map((point, index) => (
                <tr key={`${point.t}-${index}`}>
                  <td>{zhTime(point.t)}</td>
                  <td>{point.value === null ? "暂无" : formatValue(point.value, metric.digits ?? 0)}</td>
                  <td>{point.unit ?? metric.unit}</td>
                  <td>{sourceLabel(point.source_id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </details>
      </section>
    </>
  );
}
