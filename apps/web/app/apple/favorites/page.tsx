import Link from "next/link";
import type { Metadata } from "next";

import type { MetricSeries } from "../../lib/api";
import { safeSeries } from "../../lib/load";
import {
  APPLE_METRICS,
  AppleCategoryIcon,
  FAVORITE_METRIC_IDS,
  Sparkline,
  formatValue,
  latestValue,
  metricSeriesValues,
  recentTrend,
  trendTone,
  zhDate,
} from "../appleHealth";

export const metadata: Metadata = { title: "收藏 · HealthSave" };
export const dynamic = "force-dynamic";

type FavoriteItem = {
  metric: (typeof APPLE_METRICS)[number];
  series: MetricSeries | null;
  nums: number[];
  latest: number | null;
  trend: { delta: number | null; pct: number | null };
  tone: string;
};

function iconForMetric(metricId: string) {
  if (metricId.startsWith("activity.")) return "activity";
  if (metricId === "vital.respiratory_rate") return "sleep";
  if (metricId === "vital.hrv_sdnn" || metricId === "vital.resting_heart_rate") return "recovery";
  if (metricId.startsWith("body.")) return "body";
  if (metricId.startsWith("cardio.")) return "cardio";
  return "heart";
}

function favoriteTrendLabel(pctValue: number | null): string {
  if (pctValue === null) return "等待更多记录";
  const direction = pctValue > 0 ? "上升" : "下降";
  return `30 天${direction} ${formatValue(Math.abs(pctValue), 1)}%`;
}

function favoriteStatus(item: FavoriteItem): string {
  if (item.latest === null) return "暂无最新值";
  if (item.trend.pct === null) return `${formatValue(item.latest, item.metric.digits ?? 0)} ${item.metric.unit}，已加入收藏。`;
  return `${formatValue(item.latest, item.metric.digits ?? 0)} ${item.metric.unit}，最近 30 天${item.trend.pct > 0 ? "上升" : "下降"} ${formatValue(Math.abs(item.trend.pct), 1)}%。`;
}

function buildFavoriteItems(seriesList: Array<MetricSeries | null>): FavoriteItem[] {
  return FAVORITE_METRIC_IDS.map((metricId) => {
    const metricIndex = APPLE_METRICS.findIndex((metric) => metric.id === metricId);
    const metric = APPLE_METRICS[metricIndex];
    if (!metric) return null;
    const series = seriesList[metricIndex];
    const nums = metricSeriesValues(metric, series);
    const trend = recentTrend(nums);
    return {
      metric,
      series,
      nums,
      latest: nums.length ? nums[nums.length - 1] : latestValue(series),
      trend,
      tone: trendTone(metric, trend.delta),
    };
  }).filter((item): item is FavoriteItem => Boolean(item));
}

export default async function AppleFavoritesPage() {
  const seriesList = await Promise.all(APPLE_METRICS.map((metric) => safeSeries(metric.id, "30d")));
  const favorites = buildFavoriteItems(seriesList);
  const comparable = favorites.filter((item) => item.trend.pct !== null);
  const changed = [...comparable].sort((a, b) => Math.abs(b.trend.pct ?? 0) - Math.abs(a.trend.pct ?? 0))[0] ?? null;
  const totalPoints = favorites.reduce((sum, item) => sum + item.nums.length, 0);
  const latestDates = favorites
    .map((item) => item.series?.end)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return (
    <>
      <section className="apple-detail-hero">
        <div>
          <Link href="/apple" className="apple-back-link">
            返回健康概览
          </Link>
          <div className="hero-eyebrow">收藏</div>
          <h2>常看指标</h2>
          <p>把最常查看的活动、心率、恢复和睡眠指标放在一起，打开后先看这些项目，再进入单个指标看详细记录。</p>
        </div>
        <div className="apple-hero-badges">
          <span className="apple-badge">{favorites.length} 个收藏</span>
          <span className="apple-badge good">最近 {zhDate(latestDates[0])}</span>
        </div>
      </section>

      <section className="apple-kpis">
        <div className="apple-kpi">
          <span>收藏指标</span>
          <strong>{favorites.length}</strong>
          <small>摘要页优先展示</small>
        </div>
        <div className="apple-kpi">
          <span>30 天数据点</span>
          <strong>{totalPoints.toLocaleString("zh-CN")}</strong>
          <small>用于小图和趋势</small>
        </div>
        <div className="apple-kpi">
          <span>可比较</span>
          <strong>{comparable.length}</strong>
          <small>已有趋势对比</small>
        </div>
        <div className="apple-kpi">
          <span>变化最大</span>
          <strong className={changed?.tone ?? "neutral"}>{changed ? favoriteTrendLabel(changed.trend.pct).replace("30 天", "") : "暂无"}</strong>
          <small>{changed?.metric.label ?? "等待更多同步记录"}</small>
        </div>
      </section>

      <section className="apple-panel apple-favorites-panel">
        <div className="apple-panel-head">
          <div>
            <h3>收藏项目</h3>
            <p>这些项目会优先放在健康概览里，适合每天快速扫一眼。</p>
          </div>
          <Link href="/apple/trends" className="apple-text-link">
            查看趋势
          </Link>
        </div>
        <div className="apple-favorite-grid apple-favorite-grid-full">
          {favorites.map((item) => (
            <Link className="apple-favorite-card" href={`/apple/metrics/${item.metric.slug}`} key={item.metric.id}>
              <div className="apple-favorite-top">
                <AppleCategoryIcon name={iconForMetric(item.metric.id)} />
                <em className={item.tone}>{favoriteTrendLabel(item.trend.pct)}</em>
              </div>
              <span>{item.metric.label}</span>
              <strong>
                {formatValue(item.latest, item.metric.digits ?? 0)}
                <small>{item.metric.unit}</small>
              </strong>
              <Sparkline nums={item.nums} />
              <p>{favoriteStatus(item)}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="apple-panel apple-category-section">
        <div className="apple-panel-head">
          <div>
            <h3>收藏明细</h3>
            <p>按最近同步时间和数据点数量核对每个收藏项。</p>
          </div>
        </div>
        <div className="apple-favorite-list">
          {favorites.map((item) => (
            <Link className="apple-favorite-row" href={`/apple/metrics/${item.metric.slug}`} key={item.metric.id}>
              <AppleCategoryIcon name={iconForMetric(item.metric.id)} />
              <div>
                <span>{item.metric.note}</span>
                <strong>{item.metric.label}</strong>
                <p>
                  {item.nums.length.toLocaleString("zh-CN")} 个点 · {zhDate(item.series?.start)} 到 {zhDate(item.series?.end)}
                </p>
              </div>
              <em className={item.tone}>{favoriteTrendLabel(item.trend.pct)}</em>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
