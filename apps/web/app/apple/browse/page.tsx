import Link from "next/link";
import type { Metadata } from "next";

import type { AppleDailySummary, AppleStatus } from "../../lib/api";
import { safeAppleDailySummary, safeAppleStatus, safeSeries } from "../../lib/load";
import {
  APPLE_METRICS,
  type AppleIconName,
  AppleCategoryIcon,
  BROWSE_CATEGORIES,
  RAW_TABLES,
  formatValue,
  latestValue,
  metricSeriesValues,
  orderedSeriesPoints,
  recentTrend,
  relativeZh,
  zhDate,
  zhTime,
} from "../appleHealth";

export const metadata: Metadata = { title: "浏览 · 健康" };
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

type RankedSearchResult = SearchResult & {
  order: number;
  score: number;
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

const SUGGESTED_SEARCHES: Array<{ query: string; label: string; icon: AppleIconName }> = [
  { query: "睡眠", label: "睡眠", icon: "sleep" },
  { query: "站立时间", label: "站立时间", icon: "activity" },
  { query: "呼吸次数", label: "呼吸次数", icon: "sleep" },
  { query: "心率", label: "心率", icon: "heart" },
  { query: "训练", label: "训练", icon: "cardio" },
  { query: "设备与同步", label: "设备与同步", icon: "data" },
];

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
  if (metricId === "activity.stand_minutes") return "站立时间有数据，按天累计查看更接近 Apple 健康的口径。";
  if (metricId === "vital.respiratory_rate") return "呼吸次数有数据，主要来自睡眠期间的 Apple Watch 记录。";
  return "点进去查看本周、本月和最近记录。";
}

function searchText(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? "").trim().slice(0, 32);
}

function normalizeSearch(value: string | number | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function bestSearchScore(query: string, groups: Array<{ parts: Array<string | number | null | undefined>; score: number }>): number {
  const normalized = normalizeSearch(query);
  if (!normalized) return 0;
  let best = 0;
  groups.forEach((group) => {
    group.parts.forEach((part) => {
      const text = normalizeSearch(part);
      if (!text) return;
      if (text === normalized) best = Math.max(best, group.score + 20);
      else if (text.startsWith(normalized)) best = Math.max(best, group.score + 10);
      else if (text.includes(normalized)) best = Math.max(best, group.score);
    });
  });
  return best;
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

function quickMetricValue(metricId: string, latest: number | null, summary: AppleDailySummary | null): { value: number | null; label: string } {
  if (metricId === "activity.stand_minutes") {
    return {
      value: summary?.activity?.stand_minutes ?? latest,
      label: summary?.activity?.stand_minutes !== null && summary?.activity?.stand_minutes !== undefined ? "上一完整日" : "最近记录",
    };
  }
  if (metricId === "vital.respiratory_rate") {
    return {
      value: summary?.sleep?.respiratory_rate ?? latest,
      label: summary?.sleep?.respiratory_rate !== null && summary?.sleep?.respiratory_rate !== undefined ? "昨夜睡眠平均" : "最近睡眠读数",
    };
  }
  if (metricId === "activity.steps") {
    return {
      value: summary?.activity?.steps ?? latest,
      label: summary?.activity?.steps !== null && summary?.activity?.steps !== undefined ? "上一完整日" : "最近记录",
    };
  }
  return { value: latest, label: "最新读数" };
}

function quickMetricTone(metricId: string, value: number | null, trendPct: number | null): "good" | "warn" | "neutral" {
  if (value === null) return "neutral";
  if (metricId === "activity.stand_minutes") return value >= 180 ? "good" : "warn";
  if (metricId === "activity.steps") return value >= 8000 ? "good" : value < 5000 ? "warn" : "neutral";
  if (metricId === "vital.respiratory_rate") return value >= 12 && value <= 20 ? "good" : "neutral";
  if (metricId === "vital.heart_rate") return trendPct !== null && Math.abs(trendPct) > 12 ? "warn" : "neutral";
  return "neutral";
}

function buildSearchResults(query: string, status: AppleStatus | null): SearchResult[] {
  if (!query) return [];
  const results: RankedSearchResult[] = [];
  let order = 0;

  APPLE_METRICS.forEach((metric) => {
    const score = bestSearchScore(query, [
      { parts: [metric.label], score: 90 },
      { parts: [metric.note, ...(SEARCH_ALIASES[metric.id] ?? [])], score: 70 },
      { parts: [metric.id, metric.slug, metric.unit], score: 55 },
      { parts: [metric.description], score: 35 },
    ]);
    if (score > 0) {
      results.push({
        icon: iconForMetric(metric.id),
        kind: "指标",
        title: metric.label,
        body: metric.description,
        href: `/apple/metrics/${metric.slug}`,
        meta: `${metricGroup(metric.id)} · ${metric.note}`,
        order: order++,
        score,
      });
    }
  });

  BROWSE_CATEGORIES.forEach((category) => {
    const labels = metricLabels(category.metricIds).join(" ");
    const metricAliases = category.metricIds.flatMap((metricId) => SEARCH_ALIASES[metricId] ?? []);
    const score = bestSearchScore(query, [
      { parts: [category.title], score: 95 },
      { parts: [category.subtitle, labels, ...metricAliases], score: 72 },
      { parts: [category.slug, category.description], score: 42 },
    ]);
    if (score > 0) {
      results.push({
        icon: category.icon,
        kind: "分类",
        title: category.title,
        body: category.description,
        href: categoryHref(category.slug),
        meta: `${category.metricIds.length || category.rawTables.length} 个入口`,
        order: order++,
        score,
      });
    }
  });

  Object.entries(RAW_TABLES).forEach(([table, spec]) => {
    const row = status?.[table] ?? null;
    const score = bestSearchScore(query, [
      { parts: [spec.label], score: 88 },
      { parts: [table, ...(SEARCH_ALIASES[table] ?? [])], score: 66 },
      { parts: [spec.description], score: 40 },
    ]);
    if (score > 0) {
      results.push({
        icon: table === "sleep_sessions" ? "sleep" : table === "daily_activity" || table === "workouts" ? "activity" : "data",
        kind: "记录类别",
        title: spec.label,
        body: spec.description,
        href: `/apple/raw/${encodeURIComponent(table)}`,
        meta: `${(row?.count ?? 0).toLocaleString("zh-CN")} 条 · ${row?.newest ? relativeZh(row.newest) : "暂无同步"}`,
        order: order++,
        score,
      });
    }
  });

  return results
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, 12)
    .map(({ order: _order, score: _score, ...result }) => result);
}

export default async function AppleBrowsePage({ searchParams }: PageProps) {
  const query = searchText((await searchParams)?.q);
  const userCategories = BROWSE_CATEGORIES.filter((category) => category.slug !== "data");
  const quickMetrics = QUICK_METRIC_IDS.map((id) => APPLE_METRICS.find((metric) => metric.id === id)).filter(
    (metric): metric is (typeof APPLE_METRICS)[number] => Boolean(metric),
  );
  const [status, dailySummary, quickSeriesList] = await Promise.all([
    safeAppleStatus(),
    safeAppleDailySummary(),
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
          <h2>健康明细</h2>
          <p>像 Apple 健康一样按分类进入；常看的项目放在前面，更多记录留在分类详情里。</p>
        </div>
        <div className="apple-hero-badges">
          <span className="apple-badge">{userCategories.length} 个健康分类</span>
          <span className="apple-badge good">常看项目优先</span>
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
        <div className="apple-search-suggestions" aria-label="推荐搜索">
          <span>推荐搜索</span>
          <div>
            {SUGGESTED_SEARCHES.map((item) => (
              <Link
                className={query === item.query ? "active" : undefined}
                href={`/apple/browse?q=${encodeURIComponent(item.query)}`}
                key={item.query}
              >
                <AppleCategoryIcon name={item.icon} />
                {item.label}
              </Link>
            ))}
          </div>
        </div>
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

      <section className="apple-panel apple-category-section">
        <div className="apple-panel-head">
          <div>
            <h3>常看项目</h3>
            <p>只保留最常需要回看的几项。想看完整记录，从下方分类进入。</p>
          </div>
          <Link href="/apple/favorites" className="apple-text-link">
            管理常看
          </Link>
        </div>
        <div className="apple-browse-focus-grid">
          {quickMetrics.map((metric, index) => {
            const series = quickSeriesList[index];
            const nums = metricSeriesValues(metric, series);
            const points = orderedSeriesPoints(series);
            const firstPoint = points[0];
            const latestPoint = points[points.length - 1];
            const latest = nums.length ? nums[nums.length - 1] : latestValue(series);
            const reading = quickMetricValue(metric.id, latest, dailySummary);
            const trend = recentTrend(nums);
            const tone = quickMetricTone(metric.id, reading.value, trend.pct);
            return (
              <Link className={`apple-browse-focus-card ${tone}`} href={`/apple/metrics/${metric.slug}`} key={metric.id}>
                <AppleCategoryIcon name={iconForMetric(metric.id)} />
                <span>{metric.label}</span>
                <strong>
                  {formatValue(reading.value, metric.digits ?? 0)}
                  <small>{metric.unit}</small>
                </strong>
                <p>{metricHint(metric.id)}</p>
                <em>
                  {reading.label} · {trendLabel(trend.pct)} · {zhDate(firstPoint?.t)} 到 {zhDate(latestPoint?.t)}
                </em>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="apple-panel apple-category-section">
        <div className="apple-panel-head">
          <div>
            <h3>健康分类</h3>
            <p>每个分类里都有本周、本月、最近记录和相关健康明细。</p>
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
                  {category.metricIds.length} 项
                  <br />
                  {relativeZh(newest).replace("同步", "")}
                </small>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="apple-browse-sync-note">
        <AppleCategoryIcon name="data" />
        <div>
          <strong>设备、同步和隐私状态放在一个地方</strong>
          <p>需要核对 Apple Watch、iPhone 或同步记录是否完整时，进入设备与同步查看。</p>
        </div>
        <Link href="/apple/sources">设备与同步</Link>
      </section>

      <section className="apple-panel apple-category-section apple-browse-records">
        <div className="apple-panel-head">
          <div>
            <h3>记录类别</h3>
            <p>面向排查和核对，平时优先从上面的健康分类进入。</p>
          </div>
          <Link href="/apple/sources" className="apple-text-link">
            查看设备与同步
          </Link>
        </div>
        <div className="apple-source-grid">
          {Object.keys(RAW_TABLES).map((table) => {
            const row = status?.[table] ?? null;
            return (
              <Link className="apple-source-card" href={`/apple/raw/${encodeURIComponent(table)}`} key={table}>
                <span>{RAW_TABLES[table]?.label ?? table}</span>
                <strong>{(row?.count ?? 0).toLocaleString("zh-CN")}</strong>
                <small>{row?.newest ? `最近：${zhTime(row.newest)}` : "暂无同步记录"}</small>
                <p>{RAW_TABLES[table]?.description ?? "健康记录详情。"}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
