import Link from "next/link";
import type { Metadata } from "next";

import type { AppleRawDetail, AppleStatus, MetricSeries, Privacy, Readiness, SeriesPoint } from "../../lib/api";
import { safeAppleRawDetail, safeAppleStatus, safePrivacy, safeReadiness, safeSeries } from "../../lib/load";
import {
  APPLE_METRICS,
  AppleCategoryIcon,
  RAW_TABLES,
  formatHours,
  formatValue,
  normalizeMetricValue,
  relativeZh,
  zhTime,
} from "../appleHealth";

export const metadata: Metadata = { title: "数据来源 · HealthSave" };
export const dynamic = "force-dynamic";

type RawRow = Record<string, string | number | null>;

type SourceSummary = {
  id: string;
  count: number;
  latest: string | null;
  tables: string[];
};

type KeyMetricDefinition = {
  id: string;
  href: string;
  icon: "activity" | "sleep";
  source: string;
  helper: string;
};

const KEY_METRICS: KeyMetricDefinition[] = [
  {
    id: "activity.stand_minutes",
    href: "/apple/metrics/stand-time",
    icon: "activity",
    source: "活动记录",
    helper: "Apple Watch 已同步站立分钟数，和健身圆环里的站立小时不是同一个口径。",
  },
  {
    id: "vital.respiratory_rate",
    href: "/apple/metrics/respiratory-rate",
    icon: "sleep",
    source: "睡眠呼吸",
    helper: "呼吸次数通常在睡眠期间记录，白天不会像心率一样持续产生。",
  },
];

function newest(values: Array<string | null | undefined>): string | null {
  return (
    values
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null
  );
}

function totalRows(status: AppleStatus | null): number {
  return Object.values(status ?? {}).reduce((sum, row) => sum + (row.count ?? 0), 0);
}

function rawTime(row: RawRow): string | null {
  const value = row.end_time ?? row.start_time ?? row.time ?? row.date;
  return value === null || value === undefined ? null : String(value);
}

function validTime(value: string | null): string | null {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00+08:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : value;
}

function sourceTitle(sourceId: string): string {
  const normalized = sourceId.toLowerCase();
  if (normalized.includes("apple-health")) return "Apple 健康同步";
  if (normalized.includes("healthsave")) return "本机同步";
  if (sourceId === "本机同步") return "本机同步";
  return sourceId;
}

function sourceSubtitle(sourceId: string): string {
  if (sourceId === "本机同步") return "没有附带来源名称的本机记录";
  const normalized = sourceId.toLowerCase();
  if (normalized.includes("apple-health")) return "来自 Apple 健康导入与自动同步";
  if (normalized.includes("healthsave")) return "来自本机健康记录";
  return "本机同步来源";
}

function sourceSummaries(details: Array<AppleRawDetail | null>): SourceSummary[] {
  const map = new Map<string, { count: number; latest: string | null; tables: Set<string> }>();
  details.forEach((detail) => {
    detail?.rows.forEach((row) => {
      const sourceId = typeof row.source_id === "string" && row.source_id.trim() ? row.source_id.trim() : "本机同步";
      const current = map.get(sourceId) ?? { count: 0, latest: null, tables: new Set<string>() };
      current.count += 1;
      current.tables.add(detail.table);
      current.latest = newest([current.latest, validTime(rawTime(row))]);
      map.set(sourceId, current);
    });
  });
  return Array.from(map.entries())
    .map(([id, value]) => ({
      id,
      count: value.count,
      latest: value.latest,
      tables: Array.from(value.tables).sort(),
    }))
    .sort((a, b) => b.count - a.count);
}

function privacyLabel(privacy: Privacy | null): string {
  if (!privacy) return "本地优先";
  if (privacy.raw_observations_leave_host) return "有原始数据外发";
  return privacy.is_local ? "仅本机读取" : "云端模式";
}

function privacyHelper(privacy: Privacy | null): string {
  if (!privacy) return "暂时无法读取隐私状态，但页面不会主动上传健康明细。";
  if (privacy.raw_observations_leave_host) return "建议到隐私设置里核对外发范围。";
  return privacy.cloud_active ? "当前启用了云端能力，但原始健康记录不会直接离开本机。" : "当前分析和读取都在本机完成。";
}

function providerLabel(provider: string | null | undefined): string {
  if (!provider) return "本地分析";
  if (provider.toLowerCase() === "ollama") return "本地分析";
  return provider;
}

function readinessSources(readiness: Readiness | null): number {
  return readiness?.sources.length ?? 0;
}

function tableHealth(row: AppleStatus[string] | null | undefined): "good" | "warn" | "neutral" {
  if (!row?.newest) return "warn";
  const hours = (Date.now() - new Date(row.newest).getTime()) / 36e5;
  if (hours <= 24) return "good";
  if (hours <= 96) return "neutral";
  return "warn";
}

function tableHelper(table: string, row: AppleStatus[string] | null | undefined): string {
  if (!row?.newest) return "还没有看到这类同步记录";
  if (table === "quantity_samples") return "包含呼吸次数、腕温、VO2 max 等睡眠和身体指标";
  if (table === "daily_activity") return "包含步数、活动分钟、能量和站立时间";
  if (table === "sleep_sessions") return "包含睡眠时段、阶段和睡眠呼吸";
  return RAW_TABLES[table]?.description ?? "同步记录明细";
}

function latestPoint(series: MetricSeries | null): SeriesPoint | null {
  return (
    [...(series?.points ?? [])]
      .filter((point) => point.value !== null && Number.isFinite(point.value))
      .sort((a, b) => new Date(b.t).getTime() - new Date(a.t).getTime())[0] ?? null
  );
}

function metricValue(metricId: string, series: MetricSeries | null): number | null {
  const metric = APPLE_METRICS.find((item) => item.id === metricId);
  const point = latestPoint(series);
  if (!metric || !point || point.value === null) return null;
  return normalizeMetricValue(metric, point.value);
}

function metricValueText(metricId: string, value: number | null): string {
  if (metricId === "activity.stand_minutes") return formatHours(value);
  const metric = APPLE_METRICS.find((item) => item.id === metricId);
  return `${formatValue(value, metric?.digits ?? 0)} ${metric?.unit ?? ""}`.trim();
}

export default async function AppleSourcesPage() {
  const sourceTables = Object.keys(RAW_TABLES);
  const [status, privacy, readiness, rawDetails, keyMetricSeries] = await Promise.all([
    safeAppleStatus(),
    safePrivacy(),
    safeReadiness(),
    Promise.all(sourceTables.map((table) => safeAppleRawDetail(table, 400))),
    Promise.all(KEY_METRICS.map((metric) => safeSeries(metric.id, "30d"))),
  ]);
  const latest = newest(Object.values(status ?? {}).map((row) => row.newest));
  const sources = sourceSummaries(rawDetails);
  const sampledRows = rawDetails.reduce((sum, detail) => sum + (detail?.rows.length ?? 0), 0);

  return (
    <>
      <section className="apple-detail-hero">
        <div>
          <Link href="/apple" className="apple-back-link">
            返回健康概览
          </Link>
          <div className="hero-eyebrow">数据来源</div>
          <h2>设备与同步</h2>
          <p>查看 Apple Watch、iPhone 和本机服务最近同步了哪些健康记录；需要核对明细时，再进入单个类别。</p>
        </div>
        <div className="apple-hero-badges">
          <span className="apple-badge good">{privacyLabel(privacy)}</span>
          <span className="apple-badge">{relativeZh(latest)}</span>
        </div>
      </section>

      <section className="apple-kpis">
        <div className="apple-kpi">
          <span>同步记录</span>
          <strong>{totalRows(status).toLocaleString("zh-CN")}</strong>
          <small>来自 Apple 健康导入与自动同步</small>
        </div>
        <div className="apple-kpi">
          <span>最近同步</span>
          <strong className="compact">{relativeZh(latest).replace("同步", "")}</strong>
          <small>{latest ? zhTime(latest) : "暂无同步时间"}</small>
        </div>
        <div className="apple-kpi">
          <span>可见来源</span>
          <strong>{sources.length || readinessSources(readiness)}</strong>
          <small>{sampledRows.toLocaleString("zh-CN")} 条最近记录用于核对</small>
        </div>
        <div className="apple-kpi">
          <span>隐私状态</span>
          <strong className="compact">{privacyLabel(privacy)}</strong>
          <small>{privacyHelper(privacy)}</small>
        </div>
      </section>

      <section className="apple-source-device-grid">
        <article className="apple-source-device-card">
          <AppleCategoryIcon name="heart" />
          <div>
            <span>Apple Watch 与 iPhone</span>
            <strong>健康数据来源</strong>
            <p>心率、活动、睡眠、训练和身体指标会按类别汇总到本机健康记录。</p>
          </div>
        </article>
        <article className="apple-source-device-card">
          <AppleCategoryIcon name="data" />
          <div>
            <span>本机健康记录</span>
            <strong>{providerLabel(privacy?.provider)}</strong>
            <p>{privacyHelper(privacy)}</p>
          </div>
        </article>
      </section>

      <section className="apple-panel apple-category-section">
        <div className="apple-panel-head">
          <div>
            <h3>关键指标已同步</h3>
            <p>站立时间和呼吸次数不是单独的设备来源，它们分别归在活动记录和睡眠呼吸里。</p>
          </div>
        </div>
        <div className="apple-source-metric-grid">
          {KEY_METRICS.map((definition, index) => {
            const metric = APPLE_METRICS.find((item) => item.id === definition.id);
            const series = keyMetricSeries[index];
            const point = latestPoint(series);
            const value = metricValue(definition.id, series);
            return (
              <Link className="apple-source-metric-card" href={definition.href} key={definition.id}>
                <AppleCategoryIcon name={definition.icon} />
                <div>
                  <span>{definition.source}</span>
                  <strong>{metric?.label ?? definition.source}</strong>
                  <p>{definition.helper}</p>
                </div>
                <div className="apple-source-metric-value">
                  <b>{metricValueText(definition.id, value)}</b>
                  <small>{point ? `最近 ${zhTime(point.t)}` : "暂无最近记录"}</small>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="apple-panel apple-category-section">
        <div className="apple-panel-head">
          <div>
            <h3>来源明细</h3>
            <p>按同步来源汇总最近记录，方便确认数据是不是来自你自己的本机服务。</p>
          </div>
        </div>
        <div className="apple-source-summary-list">
          {sources.map((source) => (
            <article className="apple-source-summary-row" key={source.id}>
              <AppleCategoryIcon name="data" />
              <div>
                <span>{sourceTitle(source.id)}</span>
                <strong>{source.count.toLocaleString("zh-CN")} 条最近记录</strong>
                <p>{sourceSubtitle(source.id)}</p>
                <div className="apple-source-chip-list">
                  {source.tables.map((table) => (
                    <em key={table}>{RAW_TABLES[table]?.label ?? table}</em>
                  ))}
                </div>
              </div>
              <small>{source.latest ? `最近 ${zhTime(source.latest)}` : "暂无时间"}</small>
            </article>
          ))}
          {!sources.length && <div className="apple-empty-chart compact">暂无可展示的数据来源</div>}
        </div>
      </section>

      <section className="apple-panel apple-category-section">
        <div className="apple-panel-head">
          <div>
            <h3>记录类别</h3>
            <p>这些类别对应 Apple 健康里的活动、睡眠、心脏和身体数据；点进去可以看最近记录。</p>
          </div>
          <Link href="/privacy" className="apple-text-link">
            隐私设置
          </Link>
        </div>
        <div className="apple-source-status-list">
          {sourceTables.map((table) => {
            const row = status?.[table] ?? null;
            const tone = tableHealth(row);
            return (
              <Link className="apple-source-status-row" href={`/apple/raw/${encodeURIComponent(table)}`} key={table}>
                <AppleCategoryIcon name={table === "sleep_sessions" ? "sleep" : table === "daily_activity" || table === "workouts" ? "activity" : "heart"} />
                <div>
                  <span>{RAW_TABLES[table]?.label ?? table}</span>
                  <strong>{(row?.count ?? 0).toLocaleString("zh-CN")} 条</strong>
                  <p>{tableHelper(table, row)}</p>
                </div>
                <em className={tone}>{row?.newest ? relativeZh(row.newest) : "暂无同步"}</em>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
