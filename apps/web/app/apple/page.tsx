import type { Metadata } from "next";

import type { AppleStatus, MetricReadiness, MetricSeries, Readiness } from "../lib/api";
import { safeAppleStatus, safePrivacy, safeReadiness, safeSeries } from "../lib/load";

export const metadata: Metadata = { title: "健康分析 · HealthSave" };
export const dynamic = "force-dynamic";

type TrendMetric = {
  id: string;
  label: string;
  unit: string;
  digits?: number;
  higherIsBetter?: boolean;
};

const TREND_METRICS: TrendMetric[] = [
  { id: "activity.steps", label: "步数", unit: "步", higherIsBetter: true },
  { id: "activity.active_energy", label: "活动能量", unit: "kcal", higherIsBetter: true },
  { id: "vital.hrv_sdnn", label: "HRV", unit: "ms", digits: 1, higherIsBetter: true },
  { id: "vital.resting_heart_rate", label: "静息心率", unit: "bpm", digits: 0, higherIsBetter: false },
  { id: "vital.blood_oxygen", label: "血氧", unit: "%", digits: 1, higherIsBetter: true },
  { id: "vital.respiratory_rate", label: "呼吸频率", unit: "次/分", digits: 1 },
  { id: "body.wrist_temperature", label: "腕温", unit: "°C", digits: 2 },
  { id: "cardio.vo2_max", label: "VO2 max", unit: "ml/kg/min", digits: 1, higherIsBetter: true },
];

const CORE_METRICS = [
  { id: "vital.heart_rate", label: "心率" },
  { id: "vital.hrv_sdnn", label: "HRV" },
  { id: "vital.blood_oxygen", label: "血氧" },
  { id: "vital.respiratory_rate", label: "呼吸频率" },
  { id: "sleep.stage", label: "睡眠阶段" },
  { id: "workout.session", label: "体能训练" },
  { id: "activity.steps", label: "步数" },
  { id: "activity.active_energy", label: "活动能量" },
  { id: "body.wrist_temperature", label: "腕温" },
  { id: "cardio.vo2_max", label: "VO2 max" },
];

const RAW_LABELS: Record<string, string> = {
  heart_rate: "心率",
  hrv: "HRV",
  blood_oxygen: "血氧",
  daily_activity: "每日活动",
  quantity_samples: "其他连续指标",
  sleep_sessions: "睡眠记录",
  workouts: "体能训练",
};

function byMetric(readiness: Readiness | null): Map<string, MetricReadiness> {
  return new Map((readiness?.metrics ?? []).map((metric) => [metric.metric_id, metric]));
}

function zhTime(iso: string | null | undefined): string {
  if (!iso) return "暂无";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(new Date(iso));
}

function zhDate(iso: string | null | undefined): string {
  if (!iso) return "暂无";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(new Date(iso));
}

function relativeZh(iso: string | null | undefined): string {
  if (!iso) return "从未同步";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

function formatValue(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "暂无";
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function values(series: MetricSeries | null): number[] {
  return (series?.points ?? [])
    .map((point) => point.value)
    .filter((value): value is number => value !== null && Number.isFinite(value));
}

function latestValue(series: MetricSeries | null): number | null {
  const nums = values(series);
  return nums.length ? nums[nums.length - 1] : null;
}

function average(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function recentTrend(nums: number[]): { delta: number | null; pct: number | null } {
  if (nums.length < 4) return { delta: null, pct: null };
  const half = Math.max(2, Math.floor(nums.length / 2));
  const previous = average(nums.slice(0, half));
  const current = average(nums.slice(-half));
  if (previous === null || current === null || previous === 0) return { delta: null, pct: null };
  return { delta: current - previous, pct: ((current - previous) / Math.abs(previous)) * 100 };
}

function trendClass(metric: TrendMetric, delta: number | null): string {
  if (delta === null || metric.higherIsBetter === undefined) return "neutral";
  if (Math.abs(delta) < 0.01) return "neutral";
  const good = metric.higherIsBetter ? delta > 0 : delta < 0;
  return good ? "good" : "warn";
}

function downsample(nums: number[], target = 80): number[] {
  if (nums.length <= target) return nums;
  const step = nums.length / target;
  const sampled: number[] = [];
  for (let i = 0; i < target; i += 1) {
    sampled.push(nums[Math.min(nums.length - 1, Math.floor(i * step))]);
  }
  return sampled;
}

function Sparkline({ nums }: { nums: number[] }) {
  const sampled = downsample(nums);
  if (sampled.length < 2) return <div className="apple-empty-line">数据还不够画趋势</div>;
  const min = Math.min(...sampled);
  const max = Math.max(...sampled);
  const span = max - min || 1;
  const points = sampled
    .map((value, index) => {
      const x = (index / (sampled.length - 1)) * 100;
      const y = 34 - ((value - min) / span) * 30;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg className="apple-spark" viewBox="0 0 100 38" preserveAspectRatio="none" aria-hidden>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function analysisLabel(metric: MetricReadiness | undefined): { text: string; tone: string } {
  if (!metric) return { text: "未同步", tone: "missing" };
  const gates = Object.values(metric.analyzable ?? {});
  if (gates.length && gates.every((gate) => gate.is_sufficient)) return { text: "可分析", tone: "ready" };
  if (metric.observation_count > 0) return { text: "继续积累", tone: "waiting" };
  return { text: "无数据", tone: "missing" };
}

function rawRows(status: AppleStatus | null): number {
  return Object.values(status ?? {}).reduce((sum, row) => sum + (row.count ?? 0), 0);
}

function insightSummary(readiness: Readiness | null): string {
  if (!readiness) return "暂时连不上后端，页面会在服务恢复后自动显示。";
  const ready = readiness.metrics.filter((metric) =>
    Object.values(metric.analyzable ?? {}).some((gate) => gate.is_sufficient),
  ).length;
  const waiting = readiness.metrics.length - ready;
  return `${ready} 个指标已经够做趋势或异常分析，${waiting} 个指标还在积累样本。`;
}

export default async function AppleHealthPage() {
  const [readiness, status, privacy, seriesList] = await Promise.all([
    safeReadiness(),
    safeAppleStatus(),
    safePrivacy(),
    Promise.all(TREND_METRICS.map((metric) => safeSeries(metric.id, "30d"))),
  ]);
  const metricMap = byMetric(readiness);
  const readyCore = CORE_METRICS.filter((metric) => analysisLabel(metricMap.get(metric.id)).tone === "ready").length;
  const waitingMetrics = (readiness?.metrics ?? []).filter((metric) =>
    Object.values(metric.analyzable ?? {}).some((gate) => !gate.is_sufficient),
  );
  const totalObservations = readiness?.sources.reduce((sum, source) => sum + source.observation_count, 0) ?? rawRows(status);
  const cloudBlocked = privacy ? !privacy.cloud_active : true;

  return (
    <>
      <section className="apple-hero">
        <div>
          <div className="hero-eyebrow">Apple Health 本地分析</div>
          <h2>你的数据已经可以做基础趋势判断了</h2>
          <p>{insightSummary(readiness)} 所有读取都来自本机 Health Data Hub，API Key 只在服务端请求里使用。</p>
        </div>
        <div className="apple-hero-badges">
          <span className="apple-badge good">{cloudBlocked ? "本地优先" : "云端已启用"}</span>
          <span className="apple-badge">同步 {relativeZh(readiness?.last_ingested_at)}</span>
        </div>
      </section>

      <section className="apple-kpis">
        <div className="apple-kpi">
          <span>总观测量</span>
          <strong>{totalObservations.toLocaleString("zh-CN")}</strong>
          <small>最近数据：{zhTime(readiness?.last_observation_at)}</small>
        </div>
        <div className="apple-kpi">
          <span>核心数据</span>
          <strong>
            {readyCore}/{CORE_METRICS.length}
          </strong>
          <small>心率、睡眠、训练、活动等</small>
        </div>
        <div className="apple-kpi">
          <span>覆盖天数</span>
          <strong>{Math.max(...(readiness?.metrics.map((metric) => metric.days_with_data) ?? [0]))}</strong>
          <small>多数指标已覆盖约一个月</small>
        </div>
        <div className="apple-kpi">
          <span>仍需积累</span>
          <strong>{waitingMetrics.length}</strong>
          <small>主要是 VO2 max、腕温、训练趋势</small>
        </div>
      </section>

      <div className="apple-section-head">
        <h3>近 30 天趋势</h3>
        <p>用于快速看方向，不替代医生判断。</p>
      </div>
      <section className="apple-trend-grid">
        {TREND_METRICS.map((metric, index) => {
          const series = seriesList[index];
          const nums = values(series);
          const latest = latestValue(series);
          const trend = recentTrend(nums);
          const tone = trendClass(metric, trend.delta);
          return (
            <article className="apple-trend-card" key={metric.id}>
              <div className="apple-card-title">
                <span>{metric.label}</span>
                <em className={tone}>
                  {trend.pct === null ? "样本少" : `${trend.pct > 0 ? "+" : ""}${formatValue(trend.pct, 1)}%`}
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
            </article>
          );
        })}
      </section>

      <div className="apple-section-head">
        <h3>数据完整度</h3>
        <p>这里判断“现在够不够分析”，不是单纯有没有数据。</p>
      </div>
      <section className="apple-readiness">
        {CORE_METRICS.map((item) => {
          const metric = metricMap.get(item.id);
          const state = analysisLabel(metric);
          return (
            <article className="apple-ready-row" key={item.id}>
              <div>
                <strong>{item.label}</strong>
                <span>
                  {metric ? `${metric.observation_count.toLocaleString("zh-CN")} 条 · ${metric.days_with_data} 天` : "未发现数据"}
                </span>
              </div>
              <span className={`apple-state ${state.tone}`}>{state.text}</span>
            </article>
          );
        })}
      </section>

      <section className="apple-two-col">
        <article className="apple-panel">
          <h3>原始同步表</h3>
          <div className="apple-raw-list">
            {Object.entries(status ?? {}).map(([key, row]) => (
              <div className="apple-raw-row" key={key}>
                <span>{RAW_LABELS[key] ?? key}</span>
                <strong>{row.count.toLocaleString("zh-CN")}</strong>
                <small>{zhTime(row.newest)}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="apple-panel">
          <h3>下一步建议</h3>
          <ul className="apple-advice">
            <li>继续佩戴 Apple Watch 睡觉，腕温和睡眠趋势会更稳。</li>
            <li>VO2 max 只有 2 条，通常需要更多户外步行/跑步记录。</li>
            <li>训练趋势还差一点样本，力量训练再同步几次就能做趋势分析。</li>
            <li>如果某个指标长期无数据，优先检查 iPhone 健康权限。</li>
          </ul>
        </article>
      </section>
    </>
  );
}
