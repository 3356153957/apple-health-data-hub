import Link from "next/link";
import type { Metadata } from "next";

import type { AppleDailySummary, MetricSeries } from "../../lib/api";
import { safeAppleDailySummary, safeSeries } from "../../lib/load";
import {
  APPLE_METRICS,
  AppleCategoryIcon,
  FAVORITE_METRIC_IDS,
  Sparkline,
  formatHours,
  formatValue,
  latestValue,
  metricSeriesValues,
  recentTrend,
  trendTone,
  zhDate,
} from "../appleHealth";

export const metadata: Metadata = { title: "收藏 · 健康" };
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

function dailyFocus(summary: AppleDailySummary | null, changed: FavoriteItem | null): {
  href: string;
  icon: ReturnType<typeof iconForMetric>;
  title: string;
  body: string;
  tone: string;
} {
  if (summary?.sleep?.level === "偏少") {
    return {
      href: "/apple/categories/sleep",
      icon: "sleep",
      title: "先看睡眠恢复",
      body: `昨夜睡眠 ${formatHours(summary.sleep.total_sleep_min)}，适合先看睡眠、呼吸次数和 HRV。`,
      tone: "warn",
    };
  }
  if (summary?.activity?.level === "偏少") {
    return {
      href: "/apple/categories/activity",
      icon: "activity",
      title: "先看活动量",
      body: `昨日 ${formatValue(summary.activity.steps)} 步，活动 ${formatValue(summary.activity.active_minutes)} 分钟，可以先补基础活动。`,
      tone: "warn",
    };
  }
  if (changed) {
    return {
      href: `/apple/metrics/${changed.metric.slug}`,
      icon: iconForMetric(changed.metric.id),
      title: `先看${changed.metric.label}`,
      body: favoriteStatus(changed),
      tone: changed.tone,
    };
  }
  return {
    href: "/apple/daily",
    icon: "activity",
    title: "先看每日总结",
    body: "同步完成后，这里会根据昨日运动和睡眠挑出最值得先看的收藏项。",
    tone: "neutral",
  };
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
  const [seriesList, dailySummary] = await Promise.all([
    Promise.all(APPLE_METRICS.map((metric) => safeSeries(metric.id, "30d"))),
    safeAppleDailySummary(),
  ]);
  const favorites = buildFavoriteItems(seriesList);
  const comparable = favorites.filter((item) => item.trend.pct !== null);
  const changed = [...comparable].sort((a, b) => Math.abs(b.trend.pct ?? 0) - Math.abs(a.trend.pct ?? 0))[0] ?? null;
  const focus = dailyFocus(dailySummary, changed);
  const totalPoints = favorites.reduce((sum, item) => sum + item.nums.length, 0);
  const latestDates = favorites
    .map((item) => item.series?.end)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  const favoriteKpis = [
    {
      href: "/apple/browse",
      label: "收藏指标",
      value: String(favorites.length),
      detail: "摘要页优先展示",
      tone: "",
    },
    {
      href: "/apple/trends",
      label: "30 天记录",
      value: totalPoints.toLocaleString("zh-CN"),
      detail: "用于趋势图",
      tone: "",
    },
    {
      href: "/apple/trends",
      label: "可比较",
      value: String(comparable.length),
      detail: "已有趋势对比",
      tone: "",
    },
    {
      href: changed ? `/apple/metrics/${changed.metric.slug}` : "/apple/trends",
      label: "变化最大",
      value: changed ? favoriteTrendLabel(changed.trend.pct).replace("30 天", "") : "暂无",
      detail: changed?.metric.label ?? "等待更多同步记录",
      tone: changed?.tone ?? "neutral",
    },
  ];

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

      <section className="apple-category-guide">
        <Link className={`apple-category-guide-card ${focus.tone}`} href={focus.href}>
          <AppleCategoryIcon name={focus.icon} />
          <div>
            <span>今日关注</span>
            <strong>{focus.title}</strong>
            <p>{focus.body}</p>
          </div>
        </Link>

        <Link className={`apple-category-guide-card ${changed?.tone ?? "neutral"}`} href={changed ? `/apple/metrics/${changed.metric.slug}` : "/apple/trends"}>
          <AppleCategoryIcon name={changed ? iconForMetric(changed.metric.id) : "recovery"} />
          <div>
            <span>变化最大</span>
            <strong>{changed?.metric.label ?? "等待趋势"}</strong>
            <p>{changed ? favoriteStatus(changed) : "更多连续记录同步后，这里会显示变化最明显的收藏指标。"}</p>
          </div>
        </Link>

        <Link className="apple-category-guide-card good" href="/apple/daily">
          <AppleCategoryIcon name="data" />
          <div>
            <span>记录覆盖</span>
            <strong>{totalPoints.toLocaleString("zh-CN")} 条健康记录</strong>
            <p>{favorites.length} 个收藏指标已接入 30 天趋势，适合每天快速扫一眼。</p>
          </div>
        </Link>
      </section>

      <section className="apple-kpis">
        {favoriteKpis.map((item) => (
          <Link className="apple-kpi clickable" href={item.href} key={item.label}>
            <span>{item.label}</span>
            <strong className={item.tone}>{item.value}</strong>
            <small>{item.detail}</small>
          </Link>
        ))}
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
            <p>按最近同步时间和记录数量查看每个收藏项。</p>
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
                  {item.nums.length.toLocaleString("zh-CN")} 条记录 · {zhDate(item.series?.start)} 到 {zhDate(item.series?.end)}
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
