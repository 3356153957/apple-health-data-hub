import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { safeAppleStatus, safeSeries } from "../../../lib/load";
import {
  APPLE_METRICS,
  type AppleIconName,
  AppleCategoryIcon,
  BROWSE_CATEGORIES,
  RAW_TABLES,
  Sparkline,
  formatValue,
  latestValue,
  metricSeriesValues,
  recentTrend,
  relativeZh,
  trendTone,
  zhDate,
  zhTime,
} from "../../appleHealth";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ category: string }>;
};

function findCategory(slug: string) {
  return BROWSE_CATEGORIES.find((category) => category.slug === slug);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category } = await params;
  const spec = findCategory(decodeURIComponent(category));
  return { title: `${spec?.title ?? "健康分类"} · 健康` };
}

function rawNewest(status: Awaited<ReturnType<typeof safeAppleStatus>>): string | null {
  const dates = Object.values(status ?? {})
    .map((row) => row.newest)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  return dates[0] ?? null;
}

function trendLabel(pct: number | null): string {
  if (pct === null) return "暂无趋势";
  return `${pct > 0 ? "+" : ""}${formatValue(pct, 1)}%`;
}

function trendPhrase(pct: number | null): string {
  if (pct === null) return "趋势等待更多记录";
  return `最近 30 天${pct >= 0 ? "上升" : "下降"} ${formatValue(Math.abs(pct), 1)}%`;
}

function iconForMetric(metricId: string): AppleIconName {
  if (metricId.startsWith("activity.")) return "activity";
  if (metricId === "vital.respiratory_rate") return "sleep";
  if (metricId === "vital.hrv_sdnn" || metricId === "vital.resting_heart_rate") return "recovery";
  if (metricId.startsWith("body.")) return "body";
  if (metricId.startsWith("cardio.")) return "cardio";
  return "heart";
}

export default async function AppleCategoryPage({ params }: PageProps) {
  const { category } = await params;
  const decodedCategory = decodeURIComponent(category);
  const spec = findCategory(decodedCategory);
  if (!spec) notFound();
  if (decodedCategory === "data") redirect("/apple/sources");

  const categoryMetrics = spec.metricIds
    .map((id) => APPLE_METRICS.find((metric) => metric.id === id))
    .filter((metric): metric is (typeof APPLE_METRICS)[number] => Boolean(metric));

  const [status, seriesList] = await Promise.all([
    safeAppleStatus(),
    Promise.all(categoryMetrics.map((metric) => safeSeries(metric.id, "30d"))),
  ]);

  const rawRows = spec.rawTables.map((table) => ({ table, row: status?.[table] ?? null }));
  const rawTotal = rawRows.reduce((sum, item) => sum + (item.row?.count ?? 0), 0);
  const seriesTotal = seriesList.reduce((sum, series) => sum + (series?.points.length ?? 0), 0);
  const trendItems = categoryMetrics.map((metric, index) => {
    const series = seriesList[index];
    const nums = metricSeriesValues(metric, series);
    const trend = recentTrend(nums);
    const latest = nums.length ? nums[nums.length - 1] : latestValue(series);
    return {
      metric,
      latest,
      trend,
      tone: trendTone(metric, trend.delta),
      absPct: Math.abs(trend.pct ?? 0),
    };
  });
  const strongestTrend =
    [...trendItems].filter((item) => item.trend.pct !== null).sort((a, b) => b.absPct - a.absPct)[0] ?? null;
  const freshestSource =
    [...rawRows]
      .filter((item) => item.row?.newest)
      .sort((a, b) => new Date(b.row?.newest ?? 0).getTime() - new Date(a.row?.newest ?? 0).getTime())[0] ?? null;
  const largestSource = [...rawRows].sort((a, b) => (b.row?.count ?? 0) - (a.row?.count ?? 0))[0] ?? null;

  return (
    <>
      <section className="apple-detail-hero apple-category-hero">
        <div className="apple-category-title">
          <AppleCategoryIcon name={spec.icon} />
          <div>
            <Link href="/apple" className="apple-back-link">
              返回健康概览
            </Link>
            <div className="hero-eyebrow">健康分类</div>
            <h2>{spec.title}</h2>
            <p>{spec.description}</p>
          </div>
        </div>
        <div className="apple-hero-badges">
          <span className="apple-badge">{categoryMetrics.length} 个指标</span>
          <span className="apple-badge good">{relativeZh(rawNewest(status))}</span>
        </div>
      </section>

      <section className="apple-category-guide">
        <Link
          className={`apple-category-guide-card ${strongestTrend?.tone ?? "neutral"}`}
          href={strongestTrend ? `/apple/metrics/${strongestTrend.metric.slug}` : `/apple/categories/${spec.slug}`}
        >
          <AppleCategoryIcon name={strongestTrend ? iconForMetric(strongestTrend.metric.id) : spec.icon} />
          <div>
            <span>先看这个</span>
            <strong>{strongestTrend ? strongestTrend.metric.label : spec.title}</strong>
            <p>
              {strongestTrend
                ? `${trendPhrase(strongestTrend.trend.pct)}，最新 ${formatValue(
                    strongestTrend.latest,
                    strongestTrend.metric.digits ?? 0,
                  )} ${strongestTrend.metric.unit}。`
                : "继续同步后，这里会自动挑出最值得先看的指标。"}
            </p>
          </div>
        </Link>

        <Link className="apple-category-guide-card good" href="/apple/sources">
          <AppleCategoryIcon name="data" />
          <div>
            <span>数据状态</span>
            <strong>{rawTotal.toLocaleString("zh-CN")} 条记录</strong>
            <p>
              {freshestSource?.row?.newest
                ? `${RAW_TABLES[freshestSource.table]?.label ?? freshestSource.table} 最近 ${zhTime(freshestSource.row.newest)} 同步。`
                : "这类数据还没有看到同步记录。"}
            </p>
          </div>
        </Link>

        <Link className="apple-category-guide-card" href={`/apple/raw/${encodeURIComponent(largestSource?.table ?? spec.rawTables[0])}`}>
          <AppleCategoryIcon name={spec.icon} />
          <div>
            <span>记录详情</span>
            <strong>{RAW_TABLES[largestSource?.table ?? ""]?.label ?? "详细记录"}</strong>
            <p>
              {(largestSource?.row?.count ?? 0).toLocaleString("zh-CN")} 条同步记录，适合确认 Apple Watch 和 iPhone 是否同步完整。
            </p>
          </div>
        </Link>
      </section>

      <section className="apple-kpis">
        <div className="apple-kpi">
          <span>相关指标</span>
          <strong>{categoryMetrics.length}</strong>
          <small>{spec.subtitle}</small>
        </div>
        <div className="apple-kpi">
          <span>30 天数据点</span>
          <strong>{seriesTotal.toLocaleString("zh-CN")}</strong>
          <small>用于趋势判断</small>
        </div>
        <div className="apple-kpi">
          <span>记录数量</span>
          <strong>{rawTotal.toLocaleString("zh-CN")}</strong>
          <small>{spec.rawTables.length} 类来源</small>
        </div>
        <div className="apple-kpi">
          <span>最近同步</span>
          <strong className="compact">{relativeZh(rawNewest(status)).replace("同步", "")}</strong>
          <small>本机健康记录</small>
        </div>
      </section>

      {!!categoryMetrics.length && (
        <section className="apple-panel apple-category-section">
          <div className="apple-panel-head">
            <div>
              <h3>相关指标</h3>
              <p>先看趋势，再进入单个指标查看本周、本月和最近记录。</p>
            </div>
          </div>
          <div className="apple-category-metric-grid">
            {categoryMetrics.map((metric, index) => {
              const series = seriesList[index];
              const nums = metricSeriesValues(metric, series);
              const latest = nums.length ? nums[nums.length - 1] : latestValue(series);
              const trend = recentTrend(nums);
              const tone = trendTone(metric, trend.delta);
              return (
                <Link className="apple-category-metric-card" href={`/apple/metrics/${metric.slug}`} key={metric.id}>
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
                    {nums.length.toLocaleString("zh-CN")} 个点 · {zhDate(series?.start)} 到 {zhDate(series?.end)}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="apple-panel apple-category-section">
        <div className="apple-panel-head">
          <div>
            <h3>设备与记录</h3>
            <p>按健康类别整理最近记录，需要核对时可以继续查看详情。</p>
          </div>
        </div>
        <div className="apple-source-grid">
          {rawRows.map(({ table, row }) => (
            <Link className="apple-source-card" href={`/apple/raw/${encodeURIComponent(table)}`} key={table}>
              <span>{RAW_TABLES[table]?.label ?? table}</span>
              <strong>{(row?.count ?? 0).toLocaleString("zh-CN")}</strong>
              <small>{row?.newest ? `最近：${zhTime(row.newest)}` : "暂无同步记录"}</small>
              <p>{RAW_TABLES[table]?.description ?? "健康记录详情。"}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
