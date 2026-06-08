import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import type { AppleMetric } from "../../appleHealth";
import { safeAppleRawDetail, safeSeries } from "../../../lib/load";
import {
  APPLE_METRICS,
  Sparkline,
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
};

type DetailPoint = {
  t: string;
  value: number | null;
  unit: string;
  source_id: string | null;
};

const RAW_METRIC_MAP: Record<string, { table: string; time: string; value: string; unit?: string; metricName?: string }> = {
  "vital.heart_rate": { table: "heart_rate", time: "time", value: "bpm", unit: "bpm" },
  "vital.hrv_sdnn": { table: "hrv", time: "time", value: "value_ms", unit: "ms" },
  "vital.blood_oxygen": { table: "blood_oxygen", time: "time", value: "spo2_pct", unit: "%" },
  "activity.steps": { table: "daily_activity", time: "date", value: "steps", unit: "步" },
  "activity.active_energy": { table: "daily_activity", time: "date", value: "active_calories", unit: "kcal" },
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
  return { title: `${metric?.label ?? "指标详情"} · HealthSave` };
}

function minMax(nums: number[]): { min: number | null; max: number | null } {
  if (!nums.length) return { min: null, max: null };
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

export default async function AppleMetricDetailPage({ params }: PageProps) {
  const { metricId } = await params;
  const decodedId = decodeURIComponent(metricId);
  const metric = APPLE_METRICS.find((item) => item.slug === decodedId || item.id === decodedId);
  if (!metric) notFound();

  const rawConfig = RAW_METRIC_MAP[metric.id];
  const [series30, series90, rawDetail] = await Promise.all([
    safeSeries(metric.id, "30d"),
    safeSeries(metric.id, "90d"),
    rawConfig ? safeAppleRawDetail(rawConfig.table, 500) : Promise.resolve(null),
  ]);
  const rawPoints = rawDetailPoints(metric, rawDetail?.rows ?? []);
  const rawNumsAsc = [...rawPoints].reverse().map((point) => point.value).filter((value): value is number => value !== null);
  const nums = rawNumsAsc.length ? rawNumsAsc : metricSeriesValues(metric, series30);
  const longNums = metricSeriesValues(metric, series90);
  const latest = rawPoints[0]?.value ?? (nums.length ? nums[nums.length - 1] : latestValue(series30));
  const avg = average(nums);
  const range = minMax(nums);
  const trend = recentTrend(nums);
  const tone = trendTone(metric, trend.delta);
  const windowLabel = rawPoints.length ? "最近" : "30 天";

  const recentRows = rawPoints.length
    ? rawPoints.slice(0, 120)
    : orderedSeriesPoints(series30, "desc").slice(0, 80).map((point) => ({
        t: point.t,
        value: normalizeMetricValue(metric, point.value),
        unit: point.unit ?? metric.unit,
        source_id: point.source_id,
      }));

  return (
    <>
      <section className="apple-detail-hero">
        <div>
          <Link href="/apple" className="apple-back-link">
            返回健康概览
          </Link>
          <div className="hero-eyebrow">指标详情</div>
          <h2>{metric.label}</h2>
          <p>{metric.description}</p>
        </div>
        <div className="apple-hero-badges">
          <span className="apple-badge">{metric.id}</span>
          <span className="apple-badge good">本地读取</span>
        </div>
      </section>

      <section className="apple-kpis">
        <div className="apple-kpi">
          <span>最新值</span>
          <strong>{formatValue(latest, metric.digits ?? 0)}</strong>
          <small>{metric.unit}</small>
        </div>
        <div className="apple-kpi">
          <span>{windowLabel}平均</span>
          <strong>{formatValue(avg, metric.digits ?? 0)}</strong>
          <small>{metric.unit}</small>
        </div>
        <div className="apple-kpi">
          <span>{windowLabel}范围</span>
          <strong>
            {formatValue(range.min, metric.digits ?? 0)}-{formatValue(range.max, metric.digits ?? 0)}
          </strong>
          <small>{metric.unit}</small>
        </div>
        <div className="apple-kpi">
          <span>趋势变化</span>
          <strong className={tone}>{trend.pct === null ? "暂无" : `${trend.pct > 0 ? "+" : ""}${formatValue(trend.pct, 1)}%`}</strong>
          <small>最近半段对比前半段</small>
        </div>
      </section>

      <section className="apple-panel apple-chart-panel">
        <div className="apple-panel-head">
          <div>
            <h3>{windowLabel}趋势</h3>
            <p>{nums.length.toLocaleString("zh-CN")} 个数据点</p>
          </div>
          <span className="apple-badge">
            {rawPoints.length ? "最近同步记录" : `90 天总计 ${longNums.length.toLocaleString("zh-CN")} 点`}
          </span>
        </div>
        <Sparkline nums={nums} tall />
      </section>

      <section className="apple-panel">
        <div className="apple-panel-head">
          <div>
            <h3>最近数据点</h3>
            <p>最多显示最近 {recentRows.length.toLocaleString("zh-CN")} 条，完整原始表可在同步数据里查看。</p>
          </div>
        </div>
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
                  <td>{point.source_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
