import type { MetricSeries } from "../lib/api";
import type { SeriesPoint } from "../lib/api";

export type AppleMetric = {
  id: string;
  slug: string;
  label: string;
  unit: string;
  digits?: number;
  higherIsBetter?: boolean;
  normalizer?: "percentFraction";
  note: string;
  description: string;
};

export type AppleIconName = "activity" | "heart" | "sleep" | "recovery" | "body" | "cardio" | "data";

export type AppleBrowseCategory = {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  icon: AppleIconName;
  metricIds: string[];
  rawTables: string[];
};

export const APPLE_ICON_PATHS: Record<AppleIconName, string[]> = {
  activity: ["M13 5l3 6h5", "M11 19l-3-6H3", "M16 11l-4 8", "M8 13l4-8"],
  heart: ["M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8"],
  sleep: ["M21 12.8A8 8 0 1 1 11.2 3a6 6 0 1 0 9.8 9.8"],
  recovery: ["M12 3v6l4 2", "M21 12a9 9 0 1 1-3.3-7", "M21 4v6h-6"],
  body: ["M12 5a3 3 0 1 0 0.01 0", "M5 21v-2a7 7 0 0 1 14 0v2", "M8 14h8"],
  cardio: ["M4 17l4-4 3 3 7-8", "M14 8h4v4"],
  data: ["M5 5h14", "M5 12h14", "M5 19h14", "M8 5v14", "M16 5v14"],
};

export const APPLE_METRICS: AppleMetric[] = [
  {
    id: "vital.heart_rate",
    slug: "heart-rate",
    label: "心率",
    unit: "bpm",
    digits: 0,
    note: "连续心率",
    description: "Apple Watch 记录的连续心率读数，可以用来看活动、睡眠和恢复时的心率变化。",
  },
  {
    id: "activity.steps",
    slug: "steps",
    label: "步数",
    unit: "步",
    higherIsBetter: true,
    note: "每日活动量",
    description: "反映一天中的基础活动量，适合和睡眠、训练安排一起看。",
  },
  {
    id: "activity.active_energy",
    slug: "active-energy",
    label: "活动能量",
    unit: "kcal",
    higherIsBetter: true,
    note: "运动消耗",
    description: "Apple Watch 估算的主动消耗，可以帮助判断昨日运动负荷。",
  },
  {
    id: "activity.stand_minutes",
    slug: "stand-time",
    label: "站立时间",
    unit: "分钟",
    digits: 0,
    higherIsBetter: true,
    note: "日常活动",
    description: "Apple Watch 记录的站立分钟数，和健身圆环里的站立小时口径不同，适合和久坐、运动分钟一起看。",
  },
  {
    id: "vital.hrv_sdnn",
    slug: "hrv",
    label: "HRV",
    unit: "ms",
    digits: 1,
    higherIsBetter: true,
    note: "恢复参考",
    description: "心率变异性常用于观察恢复压力，短期波动很正常，更适合看趋势。",
  },
  {
    id: "vital.resting_heart_rate",
    slug: "resting-heart-rate",
    label: "静息心率",
    unit: "bpm",
    digits: 0,
    higherIsBetter: false,
    note: "疲劳参考",
    description: "静息心率升高时，可能和疲劳、睡眠不足、压力或身体状态有关。",
  },
  {
    id: "vital.blood_oxygen",
    slug: "blood-oxygen",
    label: "血氧",
    unit: "%",
    digits: 1,
    higherIsBetter: true,
    normalizer: "percentFraction",
    note: "夜间与静息",
    description: "血氧读数适合观察长期稳定性；单次异常需要结合身体感受判断。",
  },
  {
    id: "vital.respiratory_rate",
    slug: "respiratory-rate",
    label: "呼吸次数",
    unit: "次/分",
    digits: 1,
    note: "睡眠呼吸频率",
    description: "Apple Watch 通常在睡眠期间记录每分钟呼吸次数，适合和睡眠质量、疲劳状态一起看。",
  },
  {
    id: "body.wrist_temperature",
    slug: "wrist-temperature",
    label: "腕温",
    unit: "°C",
    digits: 2,
    note: "夜间体温",
    description: "腕温适合看连续趋势，单日变化不代表诊断结论。",
  },
  {
    id: "cardio.vo2_max",
    slug: "vo2-max",
    label: "VO2 max",
    unit: "ml/kg/min",
    digits: 1,
    higherIsBetter: true,
    note: "心肺能力",
    description: "心肺适能估算值，通常需要更多户外步行或跑步记录才会稳定。",
  },
];

export const CORE_METRICS = [
  { id: "vital.heart_rate", label: "心率", group: "生命体征" },
  { id: "vital.hrv_sdnn", label: "HRV", group: "恢复" },
  { id: "vital.blood_oxygen", label: "血氧", group: "生命体征" },
  { id: "vital.respiratory_rate", label: "呼吸次数", group: "睡眠" },
  { id: "sleep.stage", label: "睡眠阶段", group: "睡眠" },
  { id: "workout.session", label: "体能训练", group: "训练" },
  { id: "activity.steps", label: "步数", group: "活动" },
  { id: "activity.active_energy", label: "活动能量", group: "活动" },
  { id: "activity.stand_minutes", label: "站立时间", group: "活动" },
  { id: "body.wrist_temperature", label: "腕温", group: "身体" },
  { id: "cardio.vo2_max", label: "VO2 max", group: "心肺" },
];

export const FAVORITE_METRIC_IDS = [
  "activity.steps",
  "vital.heart_rate",
  "activity.stand_minutes",
  "vital.hrv_sdnn",
  "vital.respiratory_rate",
  "vital.blood_oxygen",
];

export const RAW_TABLES: Record<string, { label: string; description: string }> = {
  heart_rate: { label: "心率", description: "Apple Watch 记录的连续心率读数。" },
  hrv: { label: "HRV", description: "心率变异性读数，单位为毫秒。" },
  blood_oxygen: { label: "血氧", description: "血氧饱和度读数。" },
  daily_activity: { label: "每日活动", description: "按天汇总的步数、距离、能量、活动分钟和站立时间。" },
  quantity_samples: { label: "其他连续指标", description: "呼吸次数、静息心率、腕温、VO2 max 等其他样本。" },
  sleep_sessions: { label: "睡眠记录", description: "睡眠时段和各睡眠阶段时长。" },
  workouts: { label: "体能训练", description: "Apple Watch 体能训练记录。" },
};

export const BROWSE_CATEGORIES: AppleBrowseCategory[] = [
  {
    slug: "activity",
    title: "活动",
    subtitle: "步数、能量、站立时间",
    description: "把每日活动量、训练和站立时间放在一起看，适合判断今天是否需要补活动或降低强度。",
    icon: "activity",
    metricIds: ["activity.steps", "activity.active_energy", "activity.stand_minutes"],
    rawTables: ["daily_activity", "workouts"],
  },
  {
    slug: "heart",
    title: "心脏",
    subtitle: "心率、HRV、静息心率",
    description: "集中查看心率、HRV、静息心率和血氧，适合观察训练压力、恢复和日常状态。",
    icon: "heart",
    metricIds: ["vital.heart_rate", "vital.resting_heart_rate", "vital.hrv_sdnn", "vital.blood_oxygen"],
    rawTables: ["heart_rate", "hrv", "blood_oxygen", "quantity_samples"],
  },
  {
    slug: "sleep",
    title: "睡眠",
    subtitle: "睡眠阶段、效率、呼吸次数",
    description: "把睡眠时长、睡眠阶段和夜间呼吸放在一起看，优先判断恢复是否够用。",
    icon: "sleep",
    metricIds: ["vital.respiratory_rate", "body.wrist_temperature", "vital.hrv_sdnn"],
    rawTables: ["sleep_sessions", "quantity_samples"],
  },
  {
    slug: "recovery",
    title: "恢复",
    subtitle: "HRV、静息心率、呼吸",
    description: "用 HRV、静息心率、呼吸次数和血氧组合观察身体压力，帮助决定训练强度。",
    icon: "recovery",
    metricIds: ["vital.hrv_sdnn", "vital.resting_heart_rate", "vital.respiratory_rate", "vital.blood_oxygen"],
    rawTables: ["hrv", "heart_rate", "blood_oxygen", "quantity_samples"],
  },
  {
    slug: "body",
    title: "身体",
    subtitle: "腕温和其他身体指标",
    description: "查看腕温等身体指标的长期变化，适合和睡眠、恢复状态一起判断。",
    icon: "body",
    metricIds: ["body.wrist_temperature"],
    rawTables: ["quantity_samples"],
  },
  {
    slug: "cardio",
    title: "心肺",
    subtitle: "VO2 max 与训练能力",
    description: "查看心肺适能和训练相关记录，适合观察长期体能变化。",
    icon: "cardio",
    metricIds: ["cardio.vo2_max", "vital.heart_rate"],
    rawTables: ["workouts", "quantity_samples", "heart_rate"],
  },
  {
    slug: "data",
    title: "数据来源",
    subtitle: "设备、同步、隐私状态",
    description: "查看 Apple Watch、iPhone 和本机服务的同步状态，需要核对时再进入记录明细。",
    icon: "data",
    metricIds: [],
    rawTables: ["daily_activity", "sleep_sessions", "workouts", "heart_rate", "hrv", "blood_oxygen", "quantity_samples"],
  },
];

export function AppleCategoryIcon({ name }: { name: AppleIconName }) {
  return (
    <span className={`apple-category-icon ${name}`} aria-hidden>
      <svg viewBox="0 0 24 24" focusable="false">
        {APPLE_ICON_PATHS[name].map((path) => (
          <path d={path} key={path} />
        ))}
      </svg>
    </span>
  );
}

export function zhTime(iso: string | null | undefined): string {
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

export function zhDate(iso: string | null | undefined): string {
  if (!iso) return "暂无";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(new Date(iso));
}

export function relativeZh(iso: string | null | undefined): string {
  if (!iso) return "暂无同步";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "刚刚同步";
  if (minutes < 60) return `${minutes} 分钟前同步`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前同步`;
  return `${Math.floor(hours / 24)} 天前同步`;
}

export function formatValue(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "暂无";
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function formatHours(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return "暂无";
  return `${formatValue(minutes / 60, 1)} 小时`;
}

export function workoutLabel(value: string | null | undefined): string {
  if (!value) return "暂无训练类型";
  const labels: Record<string, string> = {
    "strength training": "力量训练",
    "functional strength training": "功能力量训练",
    walking: "步行",
    running: "跑步",
    cycling: "骑行",
    swimming: "游泳",
    yoga: "瑜伽",
  };
  return labels[value.toLowerCase()] ?? value;
}

export function orderedSeriesPoints(series: MetricSeries | null, direction: "asc" | "desc" = "asc"): SeriesPoint[] {
  return [...(series?.points ?? [])].sort((a, b) => {
    const diff = new Date(a.t).getTime() - new Date(b.t).getTime();
    return direction === "asc" ? diff : -diff;
  });
}

export function seriesValues(series: MetricSeries | null): number[] {
  return orderedSeriesPoints(series)
    .map((point) => point.value)
    .filter((value): value is number => value !== null && Number.isFinite(value));
}

export function normalizeMetricValue(metric: AppleMetric, value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  if (metric.normalizer === "percentFraction" && Math.abs(value) <= 1.5) return value * 100;
  return value;
}

export function metricSeriesValues(metric: AppleMetric, series: MetricSeries | null): number[] {
  return orderedSeriesPoints(series)
    .map((point) => normalizeMetricValue(metric, point.value))
    .filter((value): value is number => value !== null && Number.isFinite(value));
}

export function latestValue(series: MetricSeries | null): number | null {
  const nums = seriesValues(series);
  return nums.length ? nums[nums.length - 1] : null;
}

export function average(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

export function recentTrend(nums: number[]): { delta: number | null; pct: number | null } {
  if (nums.length < 4) return { delta: null, pct: null };
  const half = Math.max(2, Math.floor(nums.length / 2));
  const previous = average(nums.slice(0, half));
  const current = average(nums.slice(-half));
  if (previous === null || current === null || previous === 0) return { delta: null, pct: null };
  return { delta: current - previous, pct: ((current - previous) / Math.abs(previous)) * 100 };
}

export function trendTone(metric: AppleMetric, delta: number | null): string {
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

export function Sparkline({ nums, tall = false }: { nums: number[]; tall?: boolean }) {
  const sampled = downsample(nums, tall ? 160 : 80);
  if (sampled.length < 2) return <div className={tall ? "apple-empty-chart" : "apple-empty-line"}>暂无趋势</div>;
  const min = Math.min(...sampled);
  const max = Math.max(...sampled);
  const span = max - min || 1;
  const height = tall ? 86 : 38;
  const yMax = tall ? 78 : 34;
  const yPad = tall ? 68 : 30;
  const points = sampled
    .map((value, index) => {
      const x = (index / (sampled.length - 1)) * 100;
      const y = yMax - ((value - min) / span) * yPad;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg className={tall ? "apple-chart" : "apple-spark"} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={tall ? "1.8" : "2.4"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
