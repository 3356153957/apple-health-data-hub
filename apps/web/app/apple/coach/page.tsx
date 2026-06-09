import Link from "next/link";
import type { Metadata } from "next";

import type { AppleDailySummary, AppleStatus, MetricSeries } from "../../lib/api";
import { safeAppleDailySummary, safeAppleStatus, safeSeries } from "../../lib/load";
import {
  APPLE_METRICS,
  type AppleIconName,
  AppleCategoryIcon,
  formatHours,
  formatRespiratoryRate,
  formatValue,
  latestValue,
  metricSeriesValues,
  recentTrend,
  relativeZh,
  trendTone,
} from "../appleHealth";
import { CoachActionChecklist } from "./CoachActionChecklist";

export const metadata: Metadata = { title: "健康教练 · 健康" };
export const dynamic = "force-dynamic";

type Tone = "good" | "warn" | "neutral";

type CoachCard = {
  id: string;
  title: string;
  body: string;
  href: string;
  icon: AppleIconName;
  tone: Tone;
  meta: string;
};

type CoachTrend = {
  metric: (typeof APPLE_METRICS)[number];
  latest: number | null;
  pct: number | null;
  tone: string;
};

const COACH_METRIC_IDS = [
  "vital.hrv_sdnn",
  "vital.resting_heart_rate",
  "vital.respiratory_rate",
  "activity.steps",
  "activity.active_energy",
];

function rawNewest(status: AppleStatus | null): string | null {
  return Object.values(status ?? {})
    .map((row) => row.newest)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
}

function summaryHref(summary: AppleDailySummary | null): string {
  return summary?.date ? `/apple/days/${encodeURIComponent(summary.date)}` : "/apple/daily";
}

function trendLabel(pct: number | null): string {
  if (pct === null) return "趋势未形成";
  return `${pct > 0 ? "上升" : "下降"} ${formatValue(Math.abs(pct), 1)}%`;
}

function findMetric(metricId: string) {
  return APPLE_METRICS.find((metric) => metric.id === metricId) ?? null;
}

function buildTrends(seriesList: Array<MetricSeries | null>): CoachTrend[] {
  return COACH_METRIC_IDS.map((metricId, index) => {
    const metric = findMetric(metricId);
    if (!metric) return null;
    const nums = metricSeriesValues(metric, seriesList[index]);
    const trend = recentTrend(nums);
    return {
      metric,
      latest: nums.length ? nums[nums.length - 1] : latestValue(seriesList[index]),
      pct: trend.pct,
      tone: trendTone(metric, trend.delta),
    };
  }).filter((item): item is CoachTrend => item !== null);
}

function readinessTitle(summary: AppleDailySummary | null, alerts: CoachCard[]): string {
  if (!summary) return "等待同步后生成建议";
  if (alerts.some((alert) => alert.tone === "warn")) return "今天先处理需要关注的项目";
  if (summary.sleep?.level === "偏少") return "今天优先恢复";
  if (summary.activity?.level === "偏少") return "今天补足基础活动";
  return "今天保持稳定节奏";
}

function buildActions(summary: AppleDailySummary | null): CoachCard[] {
  const activity = summary?.activity ?? null;
  const sleep = summary?.sleep ?? null;
  const workouts = summary?.workouts ?? [];
  const actions: CoachCard[] = [];

  actions.push({
    title: sleep?.level === "偏少" ? "训练强度保守" : "按正常节奏安排",
    body:
      sleep?.level === "偏少"
        ? "昨夜睡眠偏少，今天训练以轻活动、拉伸或低强度力量为主。"
        : "睡眠没有明显拖后腿，可以按计划完成学习、训练和日常活动。",
    href: "/apple/daily",
    icon: sleep?.level === "偏少" ? "sleep" : "activity",
    tone: sleep?.level === "偏少" ? "warn" : "good",
    meta: "今日安排",
    id: "training-intensity",
  });

  actions.push({
    title: activity?.level === "偏少" ? "补 20-30 分钟轻活动" : "保持活动量",
    body:
      activity?.level === "偏少"
        ? `昨日 ${formatValue(activity?.steps)} 步，活动 ${formatValue(activity?.active_minutes)} 分钟；今天优先补一段快走或骑行。`
        : `昨日 ${formatValue(activity?.steps)} 步，活动 ${formatValue(activity?.active_minutes)} 分钟；继续保持基础活动量。`,
    href: "/apple/categories/activity",
    icon: "activity",
    tone: activity?.level === "偏少" ? "warn" : "good",
    meta: "活动目标",
    id: "activity-baseline",
  });

  actions.push({
    title: workouts.length ? "训练后注意恢复" : "记录下一次训练",
    body: workouts.length
      ? `昨日记录到 ${workouts.length} 次训练，今天结合腿部疲劳和睡眠状态决定是否加量。`
      : "如果今天实际训练，建议从 Apple Watch 开始体能训练，方便周报判断负荷。",
    href: "/apple/raw/workouts",
    icon: "cardio",
    tone: workouts.length ? "neutral" : "warn",
    meta: "训练闭环",
    id: "workout-recording",
  });

  const advice = summary?.advice ?? [];
  advice.slice(0, 2).forEach((item, index) => {
    actions.push({
      title: index === 0 ? "系统建议" : "补充建议",
      body: item,
      href: "/apple/daily",
      icon: "recovery",
      tone: "neutral",
      meta: "每日建议",
      id: `daily-advice-${index}`,
    });
  });

  return actions.slice(0, 5);
}

function buildAlerts(summary: AppleDailySummary | null, trends: CoachTrend[], status: AppleStatus | null): CoachCard[] {
  const alerts: CoachCard[] = [];
  const activity = summary?.activity ?? null;
  const sleep = summary?.sleep ?? null;
  const newest = rawNewest(status);
  const hrv = trends.find((item) => item.metric.id === "vital.hrv_sdnn") ?? null;
  const restingHr = trends.find((item) => item.metric.id === "vital.resting_heart_rate") ?? null;
  const respiration = trends.find((item) => item.metric.id === "vital.respiratory_rate") ?? null;
  const hrvPct = hrv?.pct;
  const restingHrPct = restingHr?.pct;
  const respirationPct = respiration?.pct;

  if (!summary) {
    alerts.push({
      title: "还没有每日摘要",
      body: "完成一次 Apple Watch 同步后，这里会生成每日建议和提醒。",
      href: "/apple/checklist",
      icon: "data",
      tone: "warn",
      meta: "同步",
      id: "summary-missing",
    });
  }

  if (sleep && sleep.total_sleep_min !== null && sleep.total_sleep_min < 360) {
    alerts.push({
      title: "睡眠少于 6 小时",
      body: `昨夜睡眠 ${formatHours(sleep.total_sleep_min)}，今天训练和熬夜都建议保守。`,
      href: summaryHref(summary),
      icon: "sleep",
      tone: "warn",
      meta: "恢复提醒",
      id: "sleep-under-six-hours",
    });
  }

  if (activity && (activity.steps ?? 0) < 5000 && (activity.active_minutes ?? 0) < 30) {
    alerts.push({
      title: "基础活动偏少",
      body: `昨日 ${formatValue(activity.steps)} 步，活动 ${formatValue(activity.active_minutes)} 分钟；今天需要补一段低门槛活动。`,
      href: "/apple/categories/activity",
      icon: "activity",
      tone: "warn",
      meta: "活动提醒",
      id: "low-foundation-activity",
    });
  }

  if (hrvPct != null && hrvPct < -8) {
    alerts.push({
      title: "HRV 下降较明显",
      body: `HRV 近 30 天${trendLabel(hrvPct)}，适合和睡眠、训练负荷一起看。`,
      href: "/apple/metrics/hrv",
      icon: "recovery",
      tone: "warn",
      meta: "恢复趋势",
      id: "hrv-down",
    });
  }

  if (restingHrPct != null && restingHrPct > 5) {
    alerts.push({
      title: "静息心率上升",
      body: `静息心率近 30 天${trendLabel(restingHrPct)}，如果同时睡眠偏少，今天降低强度。`,
      href: "/apple/metrics/resting-heart-rate",
      icon: "heart",
      tone: "warn",
      meta: "心脏趋势",
      id: "resting-heart-rate-up",
    });
  }

  if (respirationPct != null && Math.abs(respirationPct) > 8) {
    alerts.push({
      title: "夜间呼吸变化较大",
      body: `呼吸次数近 30 天${trendLabel(respirationPct)}，需要结合睡眠质量一起判断。`,
      href: "/apple/metrics/respiratory-rate",
      icon: "sleep",
      tone: "warn",
      meta: "睡眠呼吸",
      id: "respiration-shift",
    });
  }

  if (!newest) {
    alerts.push({
      title: "等待同步记录",
      body: "当前没有可用的 Apple 健康同步记录，先检查 iPhone 与电脑是否在同一网络，并确认同步已开启。",
      href: "/apple/sources",
      icon: "data",
      tone: "warn",
      meta: "设备与同步",
      id: "sync-missing",
    });
  }

  if (!alerts.length) {
    alerts.push({
      title: "暂无需要处理的提醒",
      body: "活动、睡眠和恢复没有出现需要优先处理的明显信号。继续保持佩戴和同步。",
      href: "/apple/highlights",
      icon: "recovery",
      tone: "good",
      meta: "异常提醒",
      id: "no-priority-alerts",
    });
  }

  return alerts.slice(0, 5);
}

function phaseCards(): CoachCard[] {
  return [
    {
      title: "每天先看教练",
      body: "打开后先确认今天该正常训练、补活动，还是优先恢复。",
      href: "/apple/coach",
      icon: "recovery",
      tone: "good",
      meta: "日常使用",
      id: "phase-one",
    },
    {
      title: "每周检查目标",
      body: "把步数、活动分钟、站立、睡眠和训练放进一周闭环。",
      href: "/apple/goals",
      icon: "activity",
      tone: "neutral",
      meta: "目标管理",
      id: "phase-two",
    },
    {
      title: "有疑问就问",
      body: "用当前记录回答今天怎么安排，再把问题变成可观察的习惯尝试。",
      href: "/apple/assistant",
      icon: "cardio",
      tone: "neutral",
      meta: "问答与实验",
      id: "phase-three",
    },
    {
      title: "需要时核对设备",
      body: "查看 Apple Watch、iPhone、同步时间和隐私状态是否正常。",
      href: "/apple/sources",
      icon: "data",
      tone: "neutral",
      meta: "设备与同步",
      id: "phase-four",
    },
  ];
}

export default async function AppleCoachPage() {
  const [summary, status, seriesList] = await Promise.all([
    safeAppleDailySummary(),
    safeAppleStatus(),
    Promise.all(COACH_METRIC_IDS.map((metricId) => safeSeries(metricId, "30d"))),
  ]);
  const trends = buildTrends(seriesList);
  const alerts = buildAlerts(summary, trends, status);
  const actions = buildActions(summary);
  const warningCount = alerts.filter((item) => item.tone === "warn").length;
  const newest = rawNewest(status);
  const sleep = summary?.sleep ?? null;
  const activity = summary?.activity ?? null;

  return (
    <>
      <section className={`apple-detail-hero ${warningCount ? "" : "good"}`}>
        <div>
          <Link href="/apple" className="apple-back-link">
            返回健康概览
          </Link>
          <div className="hero-eyebrow">健康教练</div>
          <h2>{readinessTitle(summary, alerts)}</h2>
          <p>
            这里不复制 Apple 健康的数据列表，而是把昨日运动、睡眠、恢复趋势转换成今天的执行建议和需要关注的提醒。
          </p>
        </div>
        <div className="apple-hero-badges">
          <span className="apple-badge">{warningCount ? `${warningCount} 条提醒` : "暂无优先提醒"}</span>
          <span className="apple-badge good">{newest ? relativeZh(newest) : "等待同步"}</span>
        </div>
      </section>

      <section className="apple-kpis apple-coach-kpis">
        <Link className="apple-kpi clickable" href="/apple/metrics/respiratory-rate">
          <span>夜间呼吸</span>
          <strong className="compact">{formatRespiratoryRate(sleep?.respiratory_rate)}</strong>
          <small>睡眠期间平均</small>
        </Link>
        <Link className="apple-kpi clickable" href="/apple/metrics/stand-time">
          <span>昨日站立</span>
          <strong className="compact">{formatHours(activity?.stand_minutes)}</strong>
          <small>按站立分钟汇总</small>
        </Link>
        <Link className="apple-kpi clickable" href="/apple/daily">
          <span>今日建议</span>
          <strong>{actions.length}</strong>
          <small>按执行优先级排列</small>
        </Link>
        <Link className="apple-kpi clickable" href="/apple/highlights">
          <span>需要关注</span>
          <strong className={warningCount ? "warn" : "good"}>{warningCount}</strong>
          <small>{warningCount ? "先处理这些信号" : "当前无明显异常"}</small>
        </Link>
        <Link className="apple-kpi clickable" href={summaryHref(summary)}>
          <span>昨夜睡眠</span>
          <strong>{formatHours(sleep?.total_sleep_min)}</strong>
          <small>{sleep ? `效率 ${formatValue(sleep.efficiency_pct, 1)}%` : "等待睡眠记录"}</small>
        </Link>
        <Link className="apple-kpi clickable" href="/apple/categories/activity">
          <span>昨日活动</span>
          <strong>{formatValue(activity?.steps)}</strong>
          <small>{formatValue(activity?.active_minutes)} 分钟活动</small>
        </Link>
      </section>

      <section className="apple-panel apple-category-section">
        <div className="apple-panel-head">
          <div>
            <h3>今天先做什么</h3>
            <p>按当前数据生成的执行建议。优先处理恢复、基础活动和训练记录。</p>
          </div>
          <Link href="/apple/daily" className="apple-text-link">
            每日总结
          </Link>
        </div>
        <div className="apple-category-guide">
          {actions.map((item) => (
            <Link className={`apple-category-guide-card ${item.tone}`} href={item.href} key={`${item.meta}-${item.title}`}>
              <AppleCategoryIcon name={item.icon} />
              <div>
                <span>{item.meta}</span>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <CoachActionChecklist actions={actions.slice(0, 4)} dateKey={summary?.date ?? "today"} />

      <section className="apple-panel apple-category-section">
        <div className="apple-panel-head">
          <div>
            <h3>需要关注的提醒</h3>
            <p>只做日常健康提醒，不替代医学判断。每条提醒都能点进对应数据依据。</p>
          </div>
          <Link href="/apple/trends" className="apple-text-link">
            查看趋势
          </Link>
        </div>
        <div className="apple-metric-insights">
          {alerts.map((item) => (
            <Link className={`apple-metric-insight ${item.tone}`} href={item.href} key={`${item.meta}-${item.title}`}>
              <AppleCategoryIcon name={item.icon} />
              <div>
                <span>{item.meta}</span>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="apple-panel apple-category-section">
        <div className="apple-panel-head">
          <div>
            <h3>常用入口</h3>
            <p>按真实使用场景整理，少看数字，多做决定。</p>
          </div>
        </div>
        <div className="apple-category-guide">
          {phaseCards().map((item) => (
            <Link className={`apple-category-guide-card ${item.tone}`} href={item.href} key={item.meta}>
              <AppleCategoryIcon name={item.icon} />
              <div>
                <span>{item.meta}</span>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
