import Link from "next/link";
import type { Metadata } from "next";

import type { AppleStatus } from "../../lib/api";
import { safeAppleStatus, safeSeries } from "../../lib/load";
import {
  APPLE_METRICS,
  AppleCategoryIcon,
  BROWSE_CATEGORIES,
  RAW_TABLES,
  Sparkline,
  formatValue,
  latestValue,
  metricSeriesValues,
  orderedSeriesPoints,
  recentTrend,
  relativeZh,
  trendTone,
  zhDate,
  zhTime,
} from "../appleHealth";

export const metadata: Metadata = { title: "浏览 · HealthSave" };
export const dynamic = "force-dynamic";

function rawNewest(status: AppleStatus | null, tables?: string[]): string | null {
  const rows = tables?.length
    ? tables.map((table) => status?.[table]).filter(Boolean)
    : Object.values(status ?? {});
  const newest = rows
    .map((row) => row?.newest)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  return newest[0] ?? null;
}

function rawTotal(status: AppleStatus | null, tables?: string[]): number {
  const rows = tables?.length
    ? tables.map((table) => status?.[table]).filter(Boolean)
    : Object.values(status ?? {});
  return rows.reduce((sum, row) => sum + (row?.count ?? 0), 0);
}

function metricLabels(metricIds: string[]): string[] {
  return metricIds
    .map((id) => APPLE_METRICS.find((metric) => metric.id === id)?.label)
    .filter((label): label is string => Boolean(label))
    .slice(0, 4);
}

const QUICK_METRIC_IDS = ["activity.stand_minutes", "vital.respiratory_rate", "activity.steps", "vital.heart_rate"];

function trendLabel(pct: number | null): string {
  if (pct === null) return "暂无趋势";
  return `${pct > 0 ? "+" : ""}${formatValue(pct, 1)}%`;
}

function metricHint(metricId: string): string {
  if (metricId === "activity.stand_minutes") return "按天汇总 Apple Watch 站立与活动时间。";
  if (metricId === "vital.respiratory_rate") return "睡眠期间记录，白天通常不会持续产生读数。";
  return "点进去查看本周、本月和最近记录。";
}

export default async function AppleBrowsePage() {
  const userCategories = BROWSE_CATEGORIES.filter((category) => category.slug !== "data");
  const metricCount = new Set(userCategories.flatMap((category) => category.metricIds)).size;
  const sourceTables = Object.keys(RAW_TABLES);
  const quickMetrics = QUICK_METRIC_IDS.map((id) => APPLE_METRICS.find((metric) => metric.id === id)).filter(
    (metric): metric is (typeof APPLE_METRICS)[number] => Boolean(metric),
  );
  const [status, quickSeriesList] = await Promise.all([
    safeAppleStatus(),
    Promise.all(quickMetrics.map((metric) => safeSeries(metric.id, "30d"))),
  ]);

  return (
    <>
      <section className="apple-detail-hero">
        <div>
          <Link href="/apple" className="apple-back-link">
            返回健康概览
          </Link>
          <div className="hero-eyebrow">浏览</div>
          <h2>按健康分类查看</h2>
          <p>把活动、心脏、睡眠、恢复、身体和心肺数据分开看，先进入分类，再查看具体指标和同步记录。</p>
        </div>
        <div className="apple-hero-badges">
          <span className="apple-badge">{userCategories.length} 个分类</span>
          <span className="apple-badge good">{relativeZh(rawNewest(status))}</span>
        </div>
      </section>

      <section className="apple-kpis">
        <div className="apple-kpi">
          <span>健康分类</span>
          <strong>{userCategories.length}</strong>
          <small>活动、睡眠、恢复等入口</small>
        </div>
        <div className="apple-kpi">
          <span>可查看指标</span>
          <strong>{metricCount}</strong>
          <small>来自 Apple Watch 和 iPhone</small>
        </div>
        <div className="apple-kpi">
          <span>同步记录</span>
          <strong>{rawTotal(status).toLocaleString("zh-CN")}</strong>
          <small>本机 Health Data Hub</small>
        </div>
        <div className="apple-kpi">
          <span>最近同步</span>
          <strong className="compact">{relativeZh(rawNewest(status)).replace("同步", "")}</strong>
          <small>只读取本地数据</small>
        </div>
      </section>

      <section className="apple-panel apple-category-section">
        <div className="apple-panel-head">
          <div>
            <h3>常用指标</h3>
            <p>站立时间和呼吸频率在这里可以直接进入详情；呼吸频率来自睡眠期间的 Apple Watch 记录。</p>
          </div>
        </div>
        <div className="apple-category-metric-grid apple-quick-metric-grid">
          {quickMetrics.map((metric, index) => {
            const series = quickSeriesList[index];
            const nums = metricSeriesValues(metric, series);
            const points = orderedSeriesPoints(series);
            const firstPoint = points[0];
            const latestPoint = points[points.length - 1];
            const latest = nums.length ? nums[nums.length - 1] : latestValue(series);
            const trend = recentTrend(nums);
            const tone = trendTone(metric, trend.delta);
            return (
              <Link className="apple-category-metric-card apple-quick-metric-card" href={`/apple/metrics/${metric.slug}`} key={metric.id}>
                <div className="apple-card-title">
                  <span>{metric.label}</span>
                  <em className={tone}>{trendLabel(trend.pct)}</em>
                </div>
                <div className="apple-value">
                  {formatValue(latest, metric.digits ?? 0)}
                  <span>{metric.unit}</span>
                </div>
                <Sparkline nums={nums} />
                <div className="apple-card-meta">
                  {nums.length.toLocaleString("zh-CN")} 个点 · {zhDate(firstPoint?.t)} 到 {zhDate(latestPoint?.t)}
                </div>
                <p className="apple-metric-note">{metricHint(metric.id)}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="apple-panel apple-category-section">
        <div className="apple-panel-head">
          <div>
            <h3>健康分类</h3>
            <p>按 Apple 健康的浏览方式，把相关指标和记录放在同一个入口下。</p>
          </div>
        </div>
        <div className="apple-browse-list">
          {userCategories.map((category) => {
            const newest = rawNewest(status, category.rawTables);
            const labels = metricLabels(category.metricIds);
            return (
              <Link className="apple-browse-row" href={`/apple/categories/${category.slug}`} key={category.slug}>
                <AppleCategoryIcon name={category.icon} />
                <div>
                  <span>{category.title}</span>
                  <strong>{category.subtitle}</strong>
                  <p>{category.description}</p>
                  {!!labels.length && (
                    <div className="apple-browse-tags">
                      {labels.map((label) => (
                        <em key={label}>{label}</em>
                      ))}
                    </div>
                  )}
                </div>
                <small>
                  {rawTotal(status, category.rawTables).toLocaleString("zh-CN")} 条
                  <br />
                  {relativeZh(newest)}
                </small>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="apple-panel apple-category-section">
        <div className="apple-panel-head">
          <div>
            <h3>数据来源</h3>
            <p>需要核对同步是否完整时，再进入原始记录。日常查看优先使用上面的分类和指标详情。</p>
          </div>
        </div>
        <div className="apple-source-grid">
          {sourceTables.map((table) => {
            const row = status?.[table] ?? null;
            return (
              <Link className="apple-source-card" href={`/apple/raw/${encodeURIComponent(table)}`} key={table}>
                <span>{RAW_TABLES[table]?.label ?? table}</span>
                <strong>{(row?.count ?? 0).toLocaleString("zh-CN")}</strong>
                <small>{row?.newest ? `最近：${zhTime(row.newest)}` : "暂无同步记录"}</small>
                <p>{RAW_TABLES[table]?.description ?? "同步数据明细。"}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
