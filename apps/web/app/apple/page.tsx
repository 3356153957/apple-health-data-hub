import Link from "next/link";
import type { Metadata } from "next";
import type { CSSProperties } from "react";

import type { AppleDailySummary, AppleStatus, MetricSeries, Readiness } from "../lib/api";
import {
  safeAppleDailySummary,
  safeAppleStatus,
  safePrivacy,
  safeReadiness,
  safeSeries,
} from "../lib/load";
import {
  APPLE_METRICS,
  AppleCategoryIcon,
  BROWSE_CATEGORIES,
  CORE_METRICS,
  RAW_TABLES,
  Sparkline,
  formatHours,
  formatValue,
  latestValue,
  metricSeriesValues,
  recentTrend,
  relativeZh,
  trendTone,
  workoutLabel,
  zhDate,
  zhTime,
} from "./appleHealth";

export const metadata: Metadata = { title: "健康概览 · HealthSave" };
export const dynamic = "force-dynamic";

function totalRows(status: AppleStatus | null): number {
  return Object.values(status ?? {}).reduce((sum, row) => sum + (row.count ?? 0), 0);
}

function readyCount(readiness: Readiness | null): number {
  if (!readiness) return 0;
  return CORE_METRICS.filter((item) => {
    const metric = readiness.metrics.find((entry) => entry.metric_id === item.id);
    return metric && Object.values(metric.analyzable ?? {}).some((gate) => gate.is_sufficient);
  }).length;
}

function latestSync(readiness: Readiness | null, status: AppleStatus | null): string | null {
  return readiness?.last_ingested_at ?? readiness?.last_observation_at ?? Object.values(status ?? {})[0]?.newest ?? null;
}

function todayReadiness(summary: AppleDailySummary | null): string {
  if (!summary) return "等待数据";
  const activity = summary.activity?.level ?? "暂无";
  const sleep = summary.sleep?.level ?? "暂无";
  if (activity === "充足" && sleep === "恢复较好") return "适合正常训练";
  if (sleep === "偏少") return "建议降低强度";
  if (activity === "偏少") return "建议补足活动量";
  return "保持稳定节奏";
}

function pct(value: number | null | undefined, goal: number): number {
  if (value === null || value === undefined || !Number.isFinite(value) || goal <= 0) return 0;
  return Math.max(0, Math.min(1, value / goal));
}

function ringStyle(value: number | null | undefined, goal: number, color: string): CSSProperties {
  return {
    "--ring-pct": `${pct(value, goal) * 100}%`,
    "--ring-color": color,
  } as CSSProperties;
}

function ActivityRing({
  label,
  value,
  goal,
  unit,
  color,
}: {
  label: string;
  value: number | null | undefined;
  goal: number;
  unit: string;
  color: string;
}) {
  return (
    <div className="apple-ring-item">
      <i className="apple-ring" style={ringStyle(value, goal, color)} />
      <div>
        <span>{label}</span>
        <strong>
          {formatValue(value)}
          <small>{unit}</small>
        </strong>
        <p>目标 {formatValue(goal)} {unit}</p>
      </div>
    </div>
  );
}

function trendHighlights(seriesList: Array<MetricSeries | null>) {
  return APPLE_METRICS.map((metric, index) => {
    const nums = metricSeriesValues(metric, seriesList[index]);
    const trend = recentTrend(nums);
    const latest = nums.length ? nums[nums.length - 1] : latestValue(seriesList[index]);
    return {
      metric,
      latest,
      trend,
      tone: trendTone(metric, trend.delta),
      absPct: Math.abs(trend.pct ?? 0),
    };
  })
    .filter((item) => item.trend.pct !== null)
    .sort((a, b) => b.absPct - a.absPct)
    .slice(0, 3);
}

export default async function AppleHealthPage() {
  const [readiness, status, privacy, dailySummary, seriesList] = await Promise.all([
    safeReadiness(),
    safeAppleStatus(),
    safePrivacy(),
    safeAppleDailySummary(),
    Promise.all(APPLE_METRICS.map((metric) => safeSeries(metric.id, "30d"))),
  ]);
  const observationRows = readiness?.sources.reduce((sum, source) => sum + source.observation_count, 0) ?? totalRows(status);
  const coreReadyCount = readyCount(readiness);
  const isLocal = privacy ? !privacy.cloud_active : true;
  const highlights = trendHighlights(seriesList);

  return (
    <>
      <section className="apple-hero product">
        <div>
          <div className="hero-eyebrow">Apple Watch 健康概览</div>
          <h2>{todayReadiness(dailySummary)}</h2>
          <p>{dailySummary?.headline ?? "同步完成后，这里会展示昨日运动、睡眠与恢复建议。"}</p>
        </div>
        <div className="apple-hero-badges">
          <span className="apple-badge good">{isLocal ? "本地数据" : "云端模式"}</span>
          <span className="apple-badge">{relativeZh(latestSync(readiness, status))}</span>
        </div>
      </section>

      <section className="apple-kpis">
        <div className="apple-kpi">
          <span>昨日步数</span>
          <strong>{formatValue(dailySummary?.activity?.steps)}</strong>
          <small>{dailySummary?.activity?.level ?? "暂无活动记录"}</small>
        </div>
        <div className="apple-kpi">
          <span>昨夜睡眠</span>
          <strong>{formatHours(dailySummary?.sleep?.total_sleep_min)}</strong>
          <small>{dailySummary?.sleep?.level ?? "暂无睡眠记录"}</small>
        </div>
        <div className="apple-kpi">
          <span>运动记录</span>
          <strong>{dailySummary?.workouts.length ?? 0}</strong>
          <small>{dailySummary?.workouts[0] ? workoutLabel(dailySummary.workouts[0].sport_type) : "昨日未记录训练"}</small>
        </div>
        <div className="apple-kpi">
          <span>核心指标</span>
          <strong>
            {coreReadyCount}/{CORE_METRICS.length}
          </strong>
          <small>{observationRows.toLocaleString("zh-CN")} 条本机健康记录</small>
        </div>
      </section>

      <section className="apple-two-col apple-ios-summary">
        <article className="apple-panel apple-rings-panel">
          <div className="apple-panel-head">
            <div>
              <h3>活动状态</h3>
              <p>按常用运动目标快速看昨日完成度。</p>
            </div>
            <Link href="/apple/raw/daily_activity" className="apple-text-link">
              查看活动
            </Link>
          </div>
          <div className="apple-rings-grid">
            <ActivityRing
              label="活动能量"
              value={dailySummary?.activity?.active_calories}
              goal={600}
              unit="kcal"
              color="var(--down)"
            />
            <ActivityRing
              label="活动分钟"
              value={dailySummary?.activity?.active_minutes}
              goal={30}
              unit="分钟"
              color="var(--up)"
            />
            <ActivityRing
              label="站立时间"
              value={dailySummary?.activity?.stand_minutes}
              goal={180}
              unit="分钟"
              color="var(--accent)"
            />
          </div>
        </article>

        <article className="apple-panel apple-highlight-panel">
          <div className="apple-panel-head">
            <div>
              <h3>趋势亮点</h3>
              <p>自动挑出最近变化最明显的指标。</p>
            </div>
          </div>
          <div className="apple-highlight-list">
            {highlights.map(({ metric, latest, trend, tone }) => (
              <Link className="apple-highlight-row" href={`/apple/metrics/${metric.slug}`} key={metric.id}>
                <AppleCategoryIcon name={metric.id.startsWith("activity.") ? "activity" : metric.id.startsWith("cardio.") ? "cardio" : "heart"} />
                <div>
                  <span>{metric.label}</span>
                  <strong>
                    {formatValue(latest, metric.digits ?? 0)}
                    <small>{metric.unit}</small>
                  </strong>
                </div>
                <em className={tone}>
                  {trend.pct === null ? "暂无" : `${trend.pct > 0 ? "+" : ""}${formatValue(trend.pct, 1)}%`}
                </em>
              </Link>
            ))}
            {!highlights.length && <div className="apple-empty-line">暂无可比较的趋势亮点</div>}
          </div>
        </article>
      </section>

      <section className="apple-two-col apple-brief-grid">
        <article className="apple-panel apple-daily-card">
          <div className="apple-panel-head">
            <div>
              <h3>昨日健康简报</h3>
              <p>{dailySummary ? `${dailySummary.date} · ${dailySummary.timezone}` : "暂无昨日简报"}</p>
            </div>
            <Link href="/apple/raw/daily_activity" className="apple-text-link">
              查看活动明细
            </Link>
          </div>
          <div className="apple-brief-metrics">
            <div>
              <span>距离</span>
              <strong>{formatValue(dailySummary?.activity?.distance_km, 2)} km</strong>
            </div>
            <div>
              <span>活动分钟</span>
              <strong>{formatValue(dailySummary?.activity?.active_minutes)} 分钟</strong>
            </div>
            <div>
              <span>站立时间</span>
              <strong>{formatHours(dailySummary?.activity?.stand_minutes)}</strong>
            </div>
            <div>
              <span>活动能量</span>
              <strong>{formatValue(dailySummary?.activity?.active_calories)} kcal</strong>
            </div>
          </div>
          <ul className="apple-advice">
            {(dailySummary?.advice ?? ["暂无足够数据生成建议。"]).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="apple-panel apple-daily-card">
          <div className="apple-panel-head">
            <div>
              <h3>睡眠结构</h3>
              <p>按 Apple Watch 睡眠阶段汇总</p>
            </div>
            <Link href="/apple/raw/sleep_sessions" className="apple-text-link">
              查看睡眠明细
            </Link>
          </div>
          <div className="apple-sleep-bars">
            {[
              ["深睡", dailySummary?.sleep?.deep_min, "deep"],
              ["核心", dailySummary?.sleep?.core_min, "core"],
              ["REM", dailySummary?.sleep?.rem_min, "rem"],
              ["清醒", dailySummary?.sleep?.awake_min, "awake"],
            ].map(([label, raw, tone]) => {
              const value = typeof raw === "number" ? raw : 0;
              const total = dailySummary?.sleep?.in_bed_min || 1;
              return (
                <div className="apple-sleep-row" key={label}>
                  <span>{label}</span>
                  <div className="apple-sleep-track">
                    <i className={`apple-sleep-fill ${tone}`} style={{ width: `${Math.min(100, (value / total) * 100)}%` }} />
                  </div>
                  <strong>{formatValue(value)} 分钟</strong>
                </div>
              );
            })}
          </div>
          <div className="apple-sleep-extra">
            <div>
              <span>睡眠效率</span>
              <strong>{formatValue(dailySummary?.sleep?.efficiency_pct, 1)}%</strong>
            </div>
            <div>
              <span>呼吸频率</span>
              <strong>{formatValue(dailySummary?.sleep?.respiratory_rate, 1)} 次/分</strong>
            </div>
          </div>
        </article>
      </section>

      <div className="apple-section-head">
        <h3>浏览</h3>
        <p>按 Apple 健康式分类快速进入你关心的数据。</p>
      </div>
      <section className="apple-category-grid">
        {BROWSE_CATEGORIES.map((category) => (
          <Link className="apple-category-card" href={`/apple/categories/${category.slug}`} key={category.title}>
            <AppleCategoryIcon name={category.icon} />
            <div>
              <span>{category.title}</span>
              <small>{category.subtitle}</small>
            </div>
          </Link>
        ))}
      </section>

      <div className="apple-section-head">
        <h3>健康指标</h3>
        <p>点击任意指标查看最近数据点和详细趋势。</p>
      </div>
      <section className="apple-trend-grid">
        {APPLE_METRICS.map((metric, index) => {
          const series = seriesList[index];
          const nums = metricSeriesValues(metric, series);
          const latest = nums.length ? nums[nums.length - 1] : latestValue(series);
          const trend = recentTrend(nums);
          const tone = trendTone(metric, trend.delta);
          return (
            <Link className="apple-trend-card clickable" href={`/apple/metrics/${metric.slug}`} key={metric.id}>
              <div className="apple-card-title">
                <span>{metric.label}</span>
                <em className={tone}>
                  {trend.pct === null ? metric.note : `${trend.pct > 0 ? "+" : ""}${formatValue(trend.pct, 1)}%`}
                </em>
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
      </section>

      <div className="apple-section-head">
        <h3>同步数据</h3>
        <p>每一类都可以点进去看最近明细。</p>
      </div>
      <section className="apple-raw-grid">
        {Object.entries(status ?? {}).map(([key, row]) => (
          <Link className="apple-raw-tile" href={`/apple/raw/${encodeURIComponent(key)}`} key={key}>
            <span>{RAW_TABLES[key]?.label ?? key}</span>
            <strong>{row.count.toLocaleString("zh-CN")}</strong>
            <small>最近：{zhTime(row.newest)}</small>
          </Link>
        ))}
      </section>
    </>
  );
}
