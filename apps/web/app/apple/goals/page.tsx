import Link from "next/link";
import type { CSSProperties } from "react";
import type { Metadata } from "next";

import type { AppleDailySummary, AppleRawDetail } from "../../lib/api";
import { safeAppleDailySummary, safeAppleRawDetail } from "../../lib/load";
import { AppleCategoryIcon, formatHours, formatRespiratoryRate, formatValue } from "../appleHealth";

export const metadata: Metadata = { title: "目标闭环 · 健康" };
export const dynamic = "force-dynamic";

type RawRow = AppleRawDetail["rows"][number];
type Tone = "good" | "warn" | "neutral";
type GoalIcon = "activity" | "sleep" | "recovery" | "cardio";

type DayRecord = {
  date: string;
  steps: number | null;
  activeMinutes: number | null;
  standMinutes: number | null;
  sleepMinutes: number | null;
  respiratoryRate: number | null;
  workouts: number;
};

type GoalCard = {
  title: string;
  value: string;
  target: string;
  progress: number;
  href: string;
  icon: GoalIcon;
  tone: Tone;
  action: string;
};

const GOALS = {
  stepsPerDay: 8000,
  activeMinutesPerDay: 30,
  standMinutesPerDay: 180,
  sleepMinutes: 420,
  workoutsPerWeek: 3,
};

function rawNumber(row: RawRow | null | undefined, key: string): number | null {
  const value = row?.[key];
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateKeyFromDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : "";
}

function localDateKey(value: string | number | null | undefined): string | null {
  if (!value) return null;
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return dateKeyFromDate(date);
}

function dateFromKey(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00+08:00`);
}

function addDays(dateKey: string, days: number): string {
  const date = dateFromKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKeyFromDate(date);
}

function startOfWeek(dateKey: string): string {
  const date = dateFromKey(dateKey);
  const day = date.getUTCDay() || 7;
  return addDays(dateKey, -day + 1);
}

function displayDate(dateKey: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    timeZone: "Asia/Shanghai",
  }).format(dateFromKey(dateKey));
}

function ensureDay(days: Map<string, DayRecord>, date: string): DayRecord {
  const current = days.get(date);
  if (current) return current;
  const created: DayRecord = {
    date,
    steps: null,
    activeMinutes: null,
    standMinutes: null,
    sleepMinutes: null,
    respiratoryRate: null,
    workouts: 0,
  };
  days.set(date, created);
  return created;
}

function buildDays(activityRows: RawRow[], sleepRows: RawRow[], workoutRows: RawRow[]): DayRecord[] {
  const days = new Map<string, DayRecord>();

  activityRows.forEach((row) => {
    const date = localDateKey(row.date);
    if (!date) return;
    const day = ensureDay(days, date);
    day.steps = rawNumber(row, "steps");
    day.activeMinutes = rawNumber(row, "active_minutes");
    day.standMinutes = rawNumber(row, "stand_minutes");
  });

  sleepRows.forEach((row) => {
    const date = localDateKey(row.end_time ?? row.start_time);
    if (!date) return;
    const day = ensureDay(days, date);
    const sleepMinutes = rawNumber(row, "total_sleep_min");
    if (sleepMinutes !== null && sleepMinutes >= (day.sleepMinutes ?? 0)) {
      day.sleepMinutes = sleepMinutes;
      day.respiratoryRate = rawNumber(row, "respiratory_rate");
    }
  });

  workoutRows.forEach((row) => {
    const date = localDateKey(row.start_time ?? row.end_time);
    if (!date) return;
    ensureDay(days, date).workouts += 1;
  });

  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date));
}

function daysInRange(days: DayRecord[], start: string, end: string): DayRecord[] {
  return days.filter((day) => day.date >= start && day.date <= end);
}

function average(values: Array<number | null>): number | null {
  const nums = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return nums.length ? nums.reduce((sum, value) => sum + value, 0) / nums.length : null;
}

function sum(values: Array<number | null>): number | null {
  const nums = values.filter((value): value is number => value !== null && Number.isFinite(value));
  const total = nums.reduce((acc, value) => acc + value, 0);
  return total > 0 ? total : null;
}

function daySpan(start: string, end: string): number {
  const ms = dateFromKey(end).getTime() - dateFromKey(start).getTime();
  return Math.max(1, Math.floor(ms / 86400000) + 1);
}

function boundedPct(value: number | null, goal: number): number {
  if (value === null || goal <= 0) return 0;
  return Math.max(0, Math.min(1.2, value / goal));
}

function progressStyle(progress: number, color: string): CSSProperties {
  return {
    "--report-pct": `${Math.max(0, Math.min(1, progress)) * 100}%`,
    "--report-color": color,
  } as CSSProperties;
}

function toneFor(progress: number, warnAt = 0.55): Tone {
  if (progress >= 1) return "good";
  if (progress < warnAt) return "warn";
  return "neutral";
}

function gap(value: number | null, target: number): number {
  return Math.max(0, Math.ceil(target - (value ?? 0)));
}

function buildGoalCards(summary: AppleDailySummary | null, weekDays: DayRecord[], targetDays: number): GoalCard[] {
  const latestActivity = summary?.activity ?? null;
  const latestSleep = summary?.sleep ?? null;
  const steps = sum(weekDays.map((day) => day.steps));
  const activeMinutes = sum(weekDays.map((day) => day.activeMinutes));
  const standMinutes = sum(weekDays.map((day) => day.standMinutes));
  const avgSleep = average(weekDays.map((day) => day.sleepMinutes));
  const workouts = weekDays.reduce((total, day) => total + day.workouts, 0);
  const workoutTarget = Math.max(1, Math.ceil((GOALS.workoutsPerWeek / 7) * targetDays));
  const stepTarget = GOALS.stepsPerDay * targetDays;
  const activeTarget = GOALS.activeMinutesPerDay * targetDays;
  const standTarget = GOALS.standMinutesPerDay * targetDays;
  const stepsProgress = boundedPct(steps, stepTarget);
  const activeProgress = boundedPct(activeMinutes, activeTarget);
  const standProgress = boundedPct(standMinutes, standTarget);
  const sleepProgress = boundedPct(avgSleep, GOALS.sleepMinutes);
  const workoutProgress = boundedPct(workouts, workoutTarget);

  return [
    {
      title: "步数",
      value: formatValue(steps),
      target: `${formatValue(stepTarget)} 步`,
      progress: stepsProgress,
      href: "/apple/metrics/steps",
      icon: "activity",
      tone: toneFor(stepsProgress),
      action: stepsProgress >= 1 ? "本周基础活动已达标，保持日常走动。" : `本周还差约 ${formatValue(gap(steps, stepTarget))} 步，优先补短距离步行。`,
    },
    {
      title: "活动分钟",
      value: `${formatValue(activeMinutes)} 分钟`,
      target: `${formatValue(activeTarget)} 分钟`,
      progress: activeProgress,
      href: "/apple/categories/activity",
      icon: "activity",
      tone: toneFor(activeProgress),
      action: activeProgress >= 1 ? "活动分钟已达标，下一步看睡眠恢复。" : `还差 ${formatValue(gap(activeMinutes, activeTarget))} 分钟，安排一次快走、骑行或力量训练。`,
    },
    {
      title: "站立时间",
      value: formatHours(standMinutes),
      target: formatHours(standTarget),
      progress: standProgress,
      href: "/apple/metrics/stand-time",
      icon: "activity",
      tone: toneFor(standProgress),
      action: standProgress >= 1 ? "站立节奏不错，继续减少久坐间隔。" : "今天每节课或学习段结束后起身走 3-5 分钟。",
    },
    {
      title: "睡眠",
      value: formatHours(avgSleep),
      target: "7 小时",
      progress: sleepProgress,
      href: latestSleep ? `/apple/days/${encodeURIComponent(summary?.date ?? "")}` : "/apple/categories/sleep",
      icon: "sleep",
      tone: avgSleep !== null && avgSleep < 360 ? "warn" : toneFor(sleepProgress, 0.85),
      action: sleepProgress >= 1 ? "平均睡眠达到目标，保持固定入睡时间。" : "今晚优先保证睡眠时长，训练强度保守一点。",
    },
    {
      title: "训练",
      value: `${workouts} 次`,
      target: `${workoutTarget} 次`,
      progress: workoutProgress,
      href: "/apple/raw/workouts",
      icon: "cardio",
      tone: toneFor(workoutProgress),
      action:
        workoutProgress >= 1
          ? "训练次数已达标，接下来重点看恢复。"
          : latestActivity?.level === "偏少"
            ? "先补低强度活动，再决定是否训练。"
            : "本周还可以补一次可记录的体能训练。",
    },
  ];
}

function goalTitle(cards: GoalCard[]): string {
  const weak = cards.filter((card) => card.tone === "warn");
  if (weak.some((card) => card.title === "睡眠")) return "本周先把睡眠目标拉回来";
  if (weak.some((card) => card.title === "活动分钟" || card.title === "步数")) return "本周先补基础活动";
  if (weak.some((card) => card.title === "训练")) return "本周补一次可记录训练";
  return "本周目标闭环稳定";
}

function completion(cards: GoalCard[]): number {
  if (!cards.length) return 0;
  const done = cards.filter((card) => card.progress >= 1).length;
  return Math.round((done / cards.length) * 100);
}

export default async function AppleGoalsPage() {
  const [summary, activityDetail, sleepDetail, workoutDetail] = await Promise.all([
    safeAppleDailySummary(),
    safeAppleRawDetail("daily_activity", 90),
    safeAppleRawDetail("sleep_sessions", 120),
    safeAppleRawDetail("workouts", 90),
  ]);
  const days = buildDays(activityDetail?.rows ?? [], sleepDetail?.rows ?? [], workoutDetail?.rows ?? []);
  const activeDate = summary?.date ?? days[0]?.date ?? dateKeyFromDate(new Date());
  const weekStart = startOfWeek(activeDate);
  const targetDays = daySpan(weekStart, activeDate);
  const weekDays = daysInRange(days, weekStart, activeDate);
  const cards = buildGoalCards(summary, weekDays, targetDays);
  const nextActions = cards.filter((card) => card.progress < 1).slice(0, 3);
  const donePct = completion(cards);
  const latestSleep = summary?.sleep ?? null;

  return (
    <>
      <section className={`apple-detail-hero ${donePct >= 80 ? "good" : ""}`}>
        <div>
          <Link href="/apple/coach" className="apple-back-link">
            返回健康教练
          </Link>
          <div className="hero-eyebrow">目标闭环</div>
          <h2>{goalTitle(cards)}</h2>
          <p>
            把 Apple Watch 记录转成一周目标：先看完成度，再给下一步动作。目标不会停在数字上，每一项都能点进对应记录检查原因。
          </p>
        </div>
        <div className="apple-hero-badges">
          <span className="apple-badge">本周 {displayDate(weekStart)} 起</span>
          <span className="apple-badge good">{donePct}% 闭环</span>
        </div>
      </section>

      <section className="apple-report-score-panel">
        <article className="apple-panel apple-report-score-card">
          <div>
            <span>目标闭环</span>
            <strong>{donePct}</strong>
            <small>步数、活动、站立、睡眠和训练</small>
          </div>
          <div className="apple-report-score-ring" style={progressStyle(donePct / 100, "var(--signal)")}>
            <i aria-hidden />
          </div>
        </article>
        <article className="apple-panel apple-report-advice-card">
          <div className="apple-panel-head">
            <div>
              <h3>下一步动作</h3>
              <p>按当前差距排序，先做最能补齐闭环的事情。</p>
            </div>
            <Link href="/apple/report" className="apple-text-link">
              每周报告
            </Link>
          </div>
          <div className="apple-goal-action-list">
            {(nextActions.length ? nextActions : cards.slice(0, 2)).map((item) => (
              <Link className={`apple-goal-action ${item.tone}`} href={item.href} key={item.title}>
                <span>{item.title}</span>
                <strong>{item.action}</strong>
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section className="apple-report-insight-grid">
        {cards.map((card) => (
          <Link className={`apple-report-insight ${card.tone}`} href={card.href} key={card.title}>
            <AppleCategoryIcon name={card.icon} />
            <div>
              <span>{formatValue(card.progress * 100)}% · 目标 {card.target}</span>
              <strong>{card.title}</strong>
              <p>
                当前 {card.value}。{card.action}
              </p>
            </div>
          </Link>
        ))}
      </section>

      <section className="apple-panel apple-report-progress-panel">
        <div className="apple-panel-head">
          <div>
            <h3>本周完成度</h3>
            <p>每一行都是一个目标闭环，点上方卡片进入对应详情。</p>
          </div>
          <Link href="/apple/calendar" className="apple-text-link">
            打开日历
          </Link>
        </div>
        <div className="apple-report-progress-list">
          {cards.map((card) => (
            <div className="apple-report-progress-row" style={progressStyle(card.progress, "var(--signal)")} key={card.title}>
              <span>{card.title}</span>
              <div><i /></div>
              <strong>{card.value} / {card.target}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="apple-two-col">
        <article className="apple-panel">
          <div className="apple-panel-head">
            <div>
              <h3>今日检查</h3>
              <p>用最近一天的数据确认今天该偏向活动还是恢复。</p>
            </div>
            <Link href="/apple/daily" className="apple-text-link">
              每日总结
            </Link>
          </div>
          <div className="apple-source-summary-list">
            <article className="apple-source-summary-row">
              <span>昨日活动</span>
              <strong>{formatValue(summary?.activity?.steps)} 步</strong>
              <p>{formatValue(summary?.activity?.active_minutes)} 分钟活动 · {formatHours(summary?.activity?.stand_minutes)} 站立</p>
            </article>
            <article className="apple-source-summary-row">
              <span>昨夜睡眠</span>
              <strong>{formatHours(latestSleep?.total_sleep_min)}</strong>
              <p>效率 {formatValue(latestSleep?.efficiency_pct, 1)}% · 呼吸 {formatRespiratoryRate(latestSleep?.respiratory_rate)}</p>
            </article>
          </div>
        </article>

        <article className="apple-panel">
          <div className="apple-panel-head">
            <div>
              <h3>闭环规则</h3>
              <p>固定目标先保持简单，等数据稳定后再按个人状态调整。</p>
            </div>
          </div>
          <div className="apple-source-summary-list">
            <article className="apple-source-summary-row">
              <span>活动目标</span>
              <strong>{formatValue(GOALS.stepsPerDay)} 步</strong>
              <p>每天 {formatValue(GOALS.activeMinutesPerDay)} 分钟活动，站立 {formatHours(GOALS.standMinutesPerDay)}。</p>
            </article>
            <article className="apple-source-summary-row">
              <span>恢复目标</span>
              <strong>7 小时</strong>
              <p>睡眠低于 6 小时时，训练建议自动转向保守。</p>
            </article>
          </div>
        </article>
      </section>
    </>
  );
}
