import Link from "next/link";
import type { Metadata } from "next";

import type { AppleStatus } from "../../lib/api";
import { safeAppleStatus, safeSeries } from "../../lib/load";
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
  orderedSeriesPoints,
  recentTrend,
  relativeZh,
  trendTone,
  zhDate,
  zhTime,
} from "../appleHealth";

export const metadata: Metadata = { title: "浏览 · HealthSave" };
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ q?: string | string[] }>;
};

type SearchResult = {
  icon: AppleIconName;
  kind: string;
  title: string;
  body: string;
  href: string;
  meta: string;
};

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

const SEARCH_ALIASES: Record<string, string[]> = {
  "activity.stand_minutes": ["站立", "站立时间", "站立小时", "久坐", "stand"],
  "vital.respiratory_rate": ["呼吸", "呼吸频率", "呼吸次数", "睡眠呼吸", "respiratory"],
  "activity.steps": ["步数", "走路", "步行", "steps"],
  "activity.active_energy": ["能量", "卡路里", "消耗", "kcal"],
  "vital.heart_rate": ["心率", "心跳", "bpm"],
  "vital.resting_heart_rate": ["静息心率", "休息心率"],
  "vital.hrv_sdnn": ["hrv", "心率变异", "恢复"],
  "vital.blood_oxygen": ["血氧", "氧饱和"],
  "body.wrist_temperature": ["腕温", "体温", "温度"],
  "cardio.vo2_max": ["vo2", "心肺", "有氧"],
  sleep_sessions: ["睡眠", "睡觉", "深睡", "rem", "呼吸"],
  daily_activity: ["活动", "步数", "站立", "能量"],
  workouts: ["训练", "运动", "体能"],
  quantity_samples: ["呼吸", "腕温", "vo2", "静息心率", "其他"],
};

function trendLabel(pct: number | null): string {
  if (pct === null) return "暂无趋势";
  return `${pct > 0 ? "+" : ""}${formatValue(pct, 1)}%`;
}

function metricHint(metricId: string): string {
  if (metricId === "activity.stand_minutes") return "按天汇总 Apple Watch 站立与活动时间。";
  if (metricId === "vital.respiratory_rate") return "睡眠期间记录，白天通常不会持续产生读数。";
  return "点进去查看本周、本月和最近记录。";
}

function searchText(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? "").trim().slice(0, 32);
}

function haystack(parts: Array<string | number | null | undefined>): string {
  return parts.filter((part) => part !== null && part !== undefined).join(" ").toLowerCase();
}

function matchesSearch(query: string, parts: Array<string | number | null | undefined>): boolean {
  if (!query) return false;
  const normalized = query.toLowerCase();
  return haystack(parts).includes(normalized);
}

function categoryHref(slug: string): string {
  return slug === "data" ? "/apple/sources" : `/apple/categories/${slug}`;
}

function iconForMetric(metricId: string): AppleIconName {
  if (metricId.startsWith("activity.")) return "activity";
  if (metricId === "vital.respiratory_rate") return "sleep";
  if (metricId === "vital.hrv_sdnn" || metricId === "vital.resting_heart_rate") return "recovery";
  if (metricId.startsWith("body.")) return "body";
  if (metricId.startsWith("cardio.")) return "cardio";
  return "heart";
}

function metricGroup(metricId: string): string {
  return BROWSE_CATEGORIES.find((category) => category.metricIds.includes(metricId))?.title ?? "健康指标";
}

function buildSearchResults(query: string, status: AppleStatus | null): SearchResult[] {
  if (!query) return [];
  const results: SearchResult[] = [];

  APPLE_METRICS.forEach((metric) => {
    if (
      matchesSearch(query, [
        metric.id,
        metric.slug,
        metric.label,
        metric.note,
        metric.description,
        metric.unit,
        ...(SEARCH_ALIASES[metric.id] ?? []),
      ])
    ) {
      results.push({
        icon: iconForMetric(metric.id),
        kind: "指标",
        title: metric.label,
        body: metric.description,
        href: `/apple/metrics/${metric.slug}`,
        meta: `${metricGroup(metric.id)} · ${metric.note}`,
      });
    }
  });

  BROWSE_CATEGORIES.forEach((category) => {
    const labels = metricLabels(category.metricIds).join(" ");
    const metricAliases = category.metricIds.flatMap((metricId) => SEARCH_ALIASES[metricId] ?? []);
    if (
      matchesSearch(query, [
        category.slug,
        category.title,
        category.subtitle,
        category.description,
        labels,
        ...metricAliases,
      ])
    ) {
      results.push({
        icon: category.icon,
        kind: "分类",
        title: category.title,
        body: category.description,
        href: categoryHref(category.slug),
        meta: `${category.metricIds.length || category.rawTables.length} 个入口`,
      });
    }
  });

  Object.entries(RAW_TABLES).forEach(([table, spec]) => {
    const row = status?.[table] ?? null;
    if (matchesSearch(query, [table, spec.label, spec.description, ...(SEARCH_ALIASES[table] ?? [])])) {
      results.push({
        icon: table === "sleep_sessions" ? "sleep" : table === "daily_activity" || table === "workouts" ? "activity" : "data",
        kind: "同步类别",
        title: spec.label,
        body: spec.description,
        href: `/apple/raw/${encodeURIComponent(table)}`,
        meta: `${(row?.count ?? 0).toLocaleString("zh-CN")} 条 · ${row?.newest ? relativeZh(row.newest) : "暂无同步"}`,
      });
    }
  });

  return results.slice(0, 12);
}

export default async function AppleBrowsePage({ searchParams }: PageProps) {
  const query = searchText((await searchParams)?.q);
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
  const searchResults = buildSearchResults(query, status);

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

      <section className="apple-search-panel" aria-label="搜索健康数据">
        <form className="apple-search-form" action="/apple/browse">
          <label className="apple-search-field">
            <span aria-hidden>
              <svg viewBox="0 0 24 24" focusable="false">
                <circle cx="11" cy="11" r="6" />
                <path d="M16 16l4 4" />
              </svg>
            </span>
            <input name="q" defaultValue={query} placeholder="搜索步数、站立时间、呼吸次数" />
          </label>
          <button type="submit">搜索</button>
          {query && (
            <Link href="/apple/browse" className="apple-search-clear">
              清除
            </Link>
          )}
        </form>
        {query && (
          <div className="apple-search-results">
            <div className="apple-panel-head">
              <div>
                <h3>搜索结果</h3>
                <p>
                  “{query}” 找到 {searchResults.length} 个结果
                </p>
              </div>
            </div>
            {searchResults.length ? (
              <div className="apple-search-result-list">
                {searchResults.map((result) => (
                  <Link className="apple-search-result-row" href={result.href} key={`${result.kind}-${result.href}`}>
                    <AppleCategoryIcon name={result.icon} />
                    <div>
                      <span>{result.kind}</span>
                      <strong>{result.title}</strong>
                      <p>{result.body}</p>
                    </div>
                    <small>{result.meta}</small>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="apple-empty-chart compact">没有找到相关健康数据</div>
            )}
          </div>
        )}
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
            <p>站立时间和呼吸次数在这里可以直接进入详情；呼吸次数按“呼吸频率”记录，来自睡眠期间的 Apple Watch 数据。</p>
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
          <Link href="/apple/sources" className="apple-text-link">
            查看设备与同步
          </Link>
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
