import Link from "next/link";
import type { Metadata } from "next";

import type { MetricSeries } from "../../lib/api";
import { safeSeries } from "../../lib/load";
import {
  APPLE_METRICS,
  AppleCategoryIcon,
  BROWSE_CATEGORIES,
  Sparkline,
  formatValue,
  latestValue,
  metricSeriesValues,
  recentTrend,
  trendTone,
  zhDate,
} from "../appleHealth";

export const metadata: Metadata = { title: "趋势 · 健康" };
export const dynamic = "force-dynamic";

type TrendItem = {
  metric: (typeof APPLE_METRICS)[number];
  series: MetricSeries | null;
  nums: number[];
  latest: number | null;
  trend: { delta: number | null; pct: number | null };
  tone: string;
  absPct: number;
};

const RECOVERY_TREND_IDS = new Set([
  "vital.hrv_sdnn",
  "vital.resting_heart_rate",
  "vital.respiratory_rate",
  "vital.blood_oxygen",
]);

const ACTIVITY_TREND_IDS = new Set([
  "activity.steps",
  "activity.active_energy",
  "activity.stand_minutes",
  "cardio.vo2_max",
]);

function iconForMetric(metricId: string) {
  if (metricId.startsWith("activity.")) return "activity";
  if (metricId === "vital.respiratory_rate") return "sleep";
  if (metricId === "vital.hrv_sdnn" || metricId === "vital.resting_heart_rate") return "recovery";
  if (metricId.startsWith("body.")) return "body";
  if (metricId.startsWith("cardio.")) return "cardio";
  return "heart";
}

function groupForMetric(metricId: string): string {
  return BROWSE_CATEGORIES.find((category) => category.metricIds.includes(metricId))?.title ?? "健康指标";
}

function trendLabel(pct: number | null): string {
  if (pct === null) return "暂无对比";
  return `${pct > 0 ? "+" : ""}${formatValue(pct, 1)}%`;
}

function directionText(pct: number | null): string {
  if (pct === null || Math.abs(pct) < 0.05) return "保持平稳";
  return pct > 0 ? "上升" : "下降";
}

function changeSentence(item: TrendItem): string {
  const pct = item.trend.pct;
  const latest = item.latest === null ? "暂无最新值" : `${formatValue(item.latest, item.metric.digits ?? 0)} ${item.metric.unit}`;
  if (pct === null) return `${latest}，继续同步后会显示更清晰的变化。`;
  return `${latest}，最近 30 天${directionText(pct)} ${formatValue(Math.abs(pct), 1)}%。`;
}

function buildTrendItems(seriesList: Array<MetricSeries | null>): TrendItem[] {
  return APPLE_METRICS.map((metric, index) => {
    const series = seriesList[index];
    const nums = metricSeriesValues(metric, series);
    const trend = recentTrend(nums);
    const latest = nums.length ? nums[nums.length - 1] : latestValue(series);
    return {
      metric,
      series,
      nums,
      latest,
      trend,
      tone: trendTone(metric, trend.delta),
      absPct: Math.abs(trend.pct ?? 0),
    };
  });
}

export default async function AppleTrendsPage() {
  const seriesList = await Promise.all(APPLE_METRICS.map((metric) => safeSeries(metric.id, "30d")));
  const items = buildTrendItems(seriesList);
  const comparable = items.filter((item) => item.trend.pct !== null);
  const ranked = [...comparable].sort((a, b) => b.absPct - a.absPct);
  const focus = ranked.slice(0, 4);
  const upward = comparable.filter((item) => (item.trend.pct ?? 0) > 0.05).length;
  const downward = comparable.filter((item) => (item.trend.pct ?? 0) < -0.05).length;
  const strongest = ranked[0] ?? null;
  const recoveryFocus = ranked.find((item) => RECOVERY_TREND_IDS.has(item.metric.id)) ?? null;
  const activityFocus = ranked.find((item) => ACTIVITY_TREND_IDS.has(item.metric.id)) ?? null;
  const totalPoints = items.reduce((sum, item) => sum + item.nums.length, 0);

  return (
    <>
      <section className="apple-detail-hero apple-trends-hero">
        <div>
          <Link href="/apple" className="apple-back-link">
            返回健康概览
          </Link>
          <div className="hero-eyebrow">趋势</div>
          <h2>最近变化</h2>
          <p>把 30 天内变化更明显的指标放在前面，适合快速查看活动、睡眠和恢复有没有偏离平时状态。</p>
        </div>
        <div className="apple-hero-badges">
          <span className="apple-badge">{APPLE_METRICS.length} 个指标</span>
          <span className="apple-badge good">30 天窗口</span>
        </div>
      </section>

      <section className="apple-category-guide">
        <Link
          className={`apple-category-guide-card ${recoveryFocus?.tone ?? "neutral"}`}
          href={recoveryFocus ? `/apple/metrics/${recoveryFocus.metric.slug}` : "/apple/categories/recovery"}
        >
          <AppleCategoryIcon name={recoveryFocus ? iconForMetric(recoveryFocus.metric.id) : "recovery"} />
          <div>
            <span>恢复信号</span>
            <strong>{recoveryFocus?.metric.label ?? "恢复指标"}</strong>
            <p>{recoveryFocus ? changeSentence(recoveryFocus) : "HRV、静息心率和呼吸次数同步后会在这里形成恢复趋势。"}</p>
          </div>
        </Link>

        <Link
          className={`apple-category-guide-card ${activityFocus?.tone ?? "neutral"}`}
          href={activityFocus ? `/apple/metrics/${activityFocus.metric.slug}` : "/apple/categories/activity"}
        >
          <AppleCategoryIcon name={activityFocus ? iconForMetric(activityFocus.metric.id) : "activity"} />
          <div>
            <span>活动负荷</span>
            <strong>{activityFocus?.metric.label ?? "活动指标"}</strong>
            <p>{activityFocus ? changeSentence(activityFocus) : "步数、活动能量和站立时间同步后会在这里呈现活动变化。"}</p>
          </div>
        </Link>

        <Link className="apple-category-guide-card good" href="/apple/report">
          <AppleCategoryIcon name="data" />
          <div>
            <span>整体节奏</span>
            <strong>{upward} 上升 · {downward} 下降</strong>
            <p>{comparable.length} 个指标已有 30 天对比，当前趋势来自 {totalPoints.toLocaleString("zh-CN")} 条健康记录。</p>
          </div>
        </Link>
      </section>

      <section className="apple-kpis">
        <div className="apple-kpi">
          <span>可比较指标</span>
          <strong>{comparable.length}</strong>
          <small>已形成 30 天对比</small>
        </div>
        <div className="apple-kpi">
          <span>健康记录</span>
          <strong>{totalPoints.toLocaleString("zh-CN")}</strong>
          <small>来自 Apple Watch 与 iPhone</small>
        </div>
        <div className="apple-kpi">
          <span>上升 / 下降</span>
          <strong>
            {upward} / {downward}
          </strong>
          <small>近 30 天前后对比</small>
        </div>
        <div className="apple-kpi">
          <span>最大变化</span>
          <strong className={strongest?.tone ?? "neutral"}>{strongest ? trendLabel(strongest.trend.pct) : "暂无"}</strong>
          <small>{strongest?.metric.label ?? "等待更多同步记录"}</small>
        </div>
      </section>

      <section className="apple-panel apple-trend-focus-panel">
        <div className="apple-panel-head">
          <div>
            <h3>重点趋势</h3>
            <p>优先显示最近变化幅度更大的项目，点进去可以看本周、本月和最近记录。</p>
          </div>
        </div>
        <div className="apple-trend-focus-grid">
          {focus.map((item) => (
            <Link className="apple-trend-focus-card" href={`/apple/metrics/${item.metric.slug}`} key={item.metric.id}>
              <div className="apple-card-title">
                <span>{item.metric.label}</span>
                <em className={item.tone}>{trendLabel(item.trend.pct)}</em>
              </div>
              <div className="apple-trend-focus-body">
                <AppleCategoryIcon name={iconForMetric(item.metric.id)} />
                <div>
                  <strong>
                    {formatValue(item.latest, item.metric.digits ?? 0)}
                    <small>{item.metric.unit}</small>
                  </strong>
                  <p>{changeSentence(item)}</p>
                </div>
              </div>
              <Sparkline nums={item.nums} />
            </Link>
          ))}
          {!focus.length && <div className="apple-empty-chart compact">暂无可比较的趋势</div>}
        </div>
      </section>

      <section className="apple-panel apple-category-section">
        <div className="apple-panel-head">
          <div>
            <h3>全部趋势</h3>
            <p>所有指标按变化幅度排序，平稳项目也保留在列表里。</p>
          </div>
        </div>
        <div className="apple-trend-table">
          {[...items].sort((a, b) => b.absPct - a.absPct).map((item) => (
            <Link className="apple-trend-row" href={`/apple/metrics/${item.metric.slug}`} key={item.metric.id}>
              <AppleCategoryIcon name={iconForMetric(item.metric.id)} />
              <div>
                <span>{groupForMetric(item.metric.id)}</span>
                <strong>{item.metric.label}</strong>
                <p>
                  {item.nums.length.toLocaleString("zh-CN")} 条记录 · {zhDate(item.series?.start)} 到 {zhDate(item.series?.end)}
                </p>
              </div>
              <div className="apple-trend-row-value">
                <strong>
                  {formatValue(item.latest, item.metric.digits ?? 0)}
                  <small>{item.metric.unit}</small>
                </strong>
                <em className={item.tone}>{trendLabel(item.trend.pct)}</em>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
