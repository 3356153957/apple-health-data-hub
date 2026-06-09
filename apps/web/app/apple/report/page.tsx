import Link from "next/link";
import type { CSSProperties } from "react";
import type { Metadata } from "next";

import type { AppleRawDetail } from "../../lib/api";
import { safeAppleDailySummary, safeAppleRawDetail } from "../../lib/load";
import { AppleCategoryIcon, cleanRespiratoryRate, formatHours, formatRespiratoryRate, formatValue, workoutLabel } from "../appleHealth";

export const metadata: Metadata = { title: "健康报告 · 健康" };
export const dynamic = "force-dynamic";

type RawRow = AppleRawDetail["rows"][number];
type Tone = "good" | "warn" | "neutral";

type DayRecord = {
  date: string;
  steps: number | null;
  activeMinutes: number | null;
  activeCalories: number | null;
  standMinutes: number | null;
  sleepMinutes: number | null;
  respiratoryRate: number | null;
  workouts: RawRow[];
};

type ReportStats = {
  days: number;
  activeDays: number;
  sleepNights: number;
  steps: number | null;
  avgSteps: number | null;
  activeMinutes: number | null;
  activeCalories: number | null;
  standMinutes: number | null;
  avgSleep: number | null;
  avgRespiration: number | null;
  workouts: number;
};

type InsightCard = {
  title: string;
  body: string;
  href: string;
  icon: "activity" | "sleep" | "recovery" | "cardio";
  tone: Tone;
  meta: string;
};

type PlanItem = InsightCard & {
  action: string;
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

function monthStart(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`;
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
    activeCalories: null,
    standMinutes: null,
    sleepMinutes: null,
    respiratoryRate: null,
    workouts: [],
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
    day.activeCalories = rawNumber(row, "active_calories");
    day.standMinutes = rawNumber(row, "stand_minutes");
  });

  sleepRows.forEach((row) => {
    const date = localDateKey(row.end_time ?? row.start_time);
    if (!date) return;
    const day = ensureDay(days, date);
    const sleepMinutes = rawNumber(row, "total_sleep_min");
    if (sleepMinutes !== null && sleepMinutes >= (day.sleepMinutes ?? 0)) {
      day.sleepMinutes = sleepMinutes;
      day.respiratoryRate = cleanRespiratoryRate(rawNumber(row, "respiratory_rate"));
    }
  });

  workoutRows.forEach((row) => {
    const date = localDateKey(row.start_time ?? row.end_time);
    if (!date) return;
    ensureDay(days, date).workouts.push(row);
  });

  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date));
}

function statsFor(days: DayRecord[]): ReportStats {
  const steps = days.reduce((sum, day) => sum + (day.steps ?? 0), 0);
  const activeMinutes = days.reduce((sum, day) => sum + (day.activeMinutes ?? 0), 0);
  const activeCalories = days.reduce((sum, day) => sum + (day.activeCalories ?? 0), 0);
  const standMinutes = days.reduce((sum, day) => sum + (day.standMinutes ?? 0), 0);
  const sleepValues = days.map((day) => day.sleepMinutes).filter((value): value is number => value !== null);
  const respirationValues = days.map((day) => day.respiratoryRate).filter((value): value is number => value !== null);
  const workouts = days.reduce((sum, day) => sum + day.workouts.length, 0);

  return {
    days: days.length,
    activeDays: days.filter((day) => (day.steps ?? 0) > 0 || (day.activeMinutes ?? 0) > 0).length,
    sleepNights: sleepValues.length,
    steps: steps > 0 ? steps : null,
    avgSteps: days.length && steps > 0 ? steps / days.length : null,
    activeMinutes: activeMinutes > 0 ? activeMinutes : null,
    activeCalories: activeCalories > 0 ? activeCalories : null,
    standMinutes: standMinutes > 0 ? standMinutes : null,
    avgSleep: sleepValues.length ? sleepValues.reduce((sum, value) => sum + value, 0) / sleepValues.length : null,
    avgRespiration: respirationValues.length ? respirationValues.reduce((sum, value) => sum + value, 0) / respirationValues.length : null,
    workouts,
  };
}

function daysInRange(days: DayRecord[], start: string, end: string): DayRecord[] {
  return days.filter((day) => day.date >= start && day.date <= end);
}

function changePct(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function changeText(current: number | null, previous: number | null, higherIsBetter = true): { label: string; tone: Tone } {
  const pct = changePct(current, previous);
  if (pct === null || Math.abs(pct) < 0.05) return { label: "较上周平稳", tone: "neutral" };
  const good = higherIsBetter ? pct > 0 : pct < 0;
  return {
    label: `较上周${pct > 0 ? "高" : "低"} ${formatValue(Math.abs(pct), 1)}%`,
    tone: good ? "good" : "warn",
  };
}

function progressStyle(value: number | null, goal: number, color: string): CSSProperties {
  const pct = value === null || goal <= 0 ? 0 : Math.max(0, Math.min(1, value / goal));
  return {
    "--report-pct": `${pct * 100}%`,
    "--report-color": color,
  } as CSSProperties;
}

function daySpan(start: string, end: string): number {
  const ms = dateFromKey(end).getTime() - dateFromKey(start).getTime();
  return Math.max(1, Math.floor(ms / 86400000) + 1);
}

function scoreFor(stats: ReportStats, targetDays: number): number {
  const activeGoal = 30 * targetDays;
  const trainingGoal = Math.max(1, Math.ceil((targetDays / 7) * 3));
  const activity = Math.min(1, (stats.avgSteps ?? 0) / 8000) * 34;
  const activeMinutes = Math.min(1, (stats.activeMinutes ?? 0) / activeGoal) * 22;
  const sleep = Math.min(1, (stats.avgSleep ?? 0) / 420) * 34;
  const training = Math.min(1, stats.workouts / trainingGoal) * 10;
  const raw = Math.round(activity + activeMinutes + sleep + training);
  if ((stats.avgSleep ?? 0) > 0 && (stats.avgSleep ?? 0) < 360) return Math.min(raw, 68);
  if ((stats.avgSteps ?? 0) > 0 && (stats.avgSteps ?? 0) < 5000) return Math.min(raw, 72);
  return raw;
}

function reportTitle(score: number, stats: ReportStats): string {
  if ((stats.avgSleep ?? 0) > 0 && (stats.avgSleep ?? 0) < 360) return "本周恢复需要优先照顾";
  if ((stats.avgSteps ?? 0) >= 8000 && (stats.avgSleep ?? 0) >= 420) return "本周活动与恢复都不错";
  if (score >= 72) return "本周节奏稳定";
  if ((stats.avgSteps ?? 0) < 5000) return "本周活动量可以补一点";
  return "本周健康节奏";
}

function adviceFor(stats: ReportStats, previous: ReportStats): string[] {
  const advice: string[] = [];
  if ((stats.avgSleep ?? 0) < 360 && stats.sleepNights > 0) {
    advice.push("本周平均睡眠少于 6 小时，训练强度建议保守一点，先把睡眠时长补回来。");
  } else if ((stats.avgSleep ?? 0) >= 420) {
    advice.push("本周平均睡眠达到 7 小时左右，可以保持正常学习和训练节奏。");
  }

  if ((stats.avgSteps ?? 0) < 5000 && stats.activeDays > 0) {
    advice.push("日均步数偏少，接下来可以安排 20-30 分钟轻松步行，把基础活动量补起来。");
  } else if ((stats.avgSteps ?? 0) >= 8000) {
    advice.push("本周基础活动量不错，继续保持；如果腿部疲劳明显，可以用拉伸或轻松骑行替代高强度训练。");
  }

  if ((stats.activeMinutes ?? 0) < 90) {
    advice.push("本周活动分钟偏少，优先补短时段训练，例如快走、骑车或力量训练各一次。");
  }

  if (stats.workouts === 0) {
    advice.push("本周没有记录到体能训练；如果实际训练过，记得从 Apple Watch 开始体能训练再同步。");
  }

  const sleepChange = changePct(stats.avgSleep, previous.avgSleep);
  if (sleepChange !== null && sleepChange < -10) {
    advice.push("本周睡眠比上周下降较明显，睡前减少强光和刺激内容，先观察下一周是否回升。");
  }

  return advice.slice(0, 4);
}

function buildInsights(stats: ReportStats, previous: ReportStats): InsightCard[] {
  const stepsChange = changeText(stats.avgSteps, previous.avgSteps);
  const sleepChange = changeText(stats.avgSleep, previous.avgSleep);
  const activeChange = changeText(stats.activeMinutes, previous.activeMinutes);
  const respiratoryChange = changeText(stats.avgRespiration, previous.avgRespiration, false);

  return [
    {
      title: "活动",
      body: `日均 ${formatValue(stats.avgSteps)} 步，本周活动 ${formatValue(stats.activeMinutes)} 分钟。`,
      href: "/apple/categories/activity",
      icon: "activity",
      tone: stepsChange.tone,
      meta: stepsChange.label,
    },
    {
      title: "睡眠",
      body: `平均 ${formatHours(stats.avgSleep)}，共有 ${stats.sleepNights} 晚睡眠记录。`,
      href: "/apple/categories/sleep",
      icon: "sleep",
      tone: sleepChange.tone,
      meta: sleepChange.label,
    },
    {
      title: "恢复",
      body:
        stats.avgRespiration === null
          ? "本周暂时没有可用的夜间呼吸记录，先结合睡眠时长和 HRV 看恢复。"
          : `夜间呼吸平均 ${formatRespiratoryRate(stats.avgRespiration)}，适合和睡眠质量一起看。`,
      href: "/apple/categories/recovery",
      icon: "recovery",
      tone: respiratoryChange.tone,
      meta: respiratoryChange.label,
    },
    {
      title: "训练",
      body: `本周记录到 ${stats.workouts} 次体能训练，站立时间 ${formatHours(stats.standMinutes)}。`,
      href: "/apple/raw/workouts",
      icon: "cardio",
      tone: activeChange.tone,
      meta: activeChange.label,
    },
  ];
}

function buildSignals(stats: ReportStats, previous: ReportStats): InsightCard[] {
  const signals: InsightCard[] = [];
  const sleepChange = changePct(stats.avgSleep, previous.avgSleep);
  const stepsChange = changePct(stats.avgSteps, previous.avgSteps);
  const respirationChange = changePct(stats.avgRespiration, previous.avgRespiration);

  if ((stats.avgSleep ?? 0) > 0 && (stats.avgSleep ?? 0) < 360) {
    signals.push({
      title: "睡眠是本周优先项",
      body: `平均睡眠 ${formatHours(stats.avgSleep)}，已经低于 6 小时。下周先把入睡时间和起床时间稳定下来。`,
      href: "/apple/categories/sleep",
      icon: "sleep",
      tone: "warn",
      meta: "恢复提醒",
    });
  } else if ((stats.avgSleep ?? 0) >= 420) {
    signals.push({
      title: "睡眠恢复表现不错",
      body: `平均睡眠 ${formatHours(stats.avgSleep)}，能支撑正常学习和训练。继续保持固定作息。`,
      href: "/apple/categories/sleep",
      icon: "sleep",
      tone: "good",
      meta: "恢复优势",
    });
  }

  if ((stats.avgSteps ?? 0) > 0 && (stats.avgSteps ?? 0) < 5000) {
    signals.push({
      title: "基础活动偏少",
      body: `日均 ${formatValue(stats.avgSteps)} 步，低于基础活动目标。下周先补低门槛活动，而不是直接追高强度。`,
      href: "/apple/categories/activity",
      icon: "activity",
      tone: "warn",
      meta: "活动提醒",
    });
  } else if ((stats.avgSteps ?? 0) >= 8000) {
    signals.push({
      title: "基础活动已经够用",
      body: `日均 ${formatValue(stats.avgSteps)} 步，本周活动底盘比较稳。下周重点看训练后的恢复。`,
      href: "/apple/categories/activity",
      icon: "activity",
      tone: "good",
      meta: "活动优势",
    });
  }

  if (stats.workouts === 0) {
    signals.push({
      title: "训练记录缺口",
      body: "本周没有同步到体能训练记录。如果实际训练过，下次从 Apple Watch 开始记录，周报才能判断训练负荷。",
      href: "/apple/raw/workouts",
      icon: "cardio",
      tone: "warn",
      meta: "记录提醒",
    });
  }

  if (sleepChange !== null && sleepChange < -10) {
    signals.push({
      title: "睡眠较上周下降",
      body: `平均睡眠较上周低 ${formatValue(Math.abs(sleepChange), 1)}%。如果同时训练增加，下周需要留恢复日。`,
      href: "/apple/report",
      icon: "recovery",
      tone: "warn",
      meta: "周间变化",
    });
  }

  if (stepsChange !== null && stepsChange > 15) {
    signals.push({
      title: "活动量明显增加",
      body: `日均步数较上周高 ${formatValue(Math.abs(stepsChange), 1)}%。如果腿部疲劳明显，下周不要继续加量。`,
      href: "/apple/categories/activity",
      icon: "activity",
      tone: "good",
      meta: "周间变化",
    });
  }

  if (respirationChange !== null && Math.abs(respirationChange) > 8) {
    signals.push({
      title: "夜间呼吸变化较大",
      body: `呼吸次数较上周${respirationChange > 0 ? "高" : "低"} ${formatValue(Math.abs(respirationChange), 1)}%，建议结合睡眠时长和疲劳感一起看。`,
      href: "/apple/metrics/respiratory-rate",
      icon: "recovery",
      tone: "warn",
      meta: "睡眠呼吸",
    });
  }

  if (!signals.length) {
    signals.push({
      title: "本周没有明显风险点",
      body: "活动、睡眠和训练没有出现特别突出的偏离。下周继续用目标闭环保持节奏。",
      href: "/apple/goals",
      icon: "recovery",
      tone: "good",
      meta: "本周复盘",
    });
  }

  return signals.slice(0, 4);
}

function buildNextWeekPlan(stats: ReportStats, previous: ReportStats): PlanItem[] {
  const plan: PlanItem[] = [];
  const sleepChange = changePct(stats.avgSleep, previous.avgSleep);

  if ((stats.avgSleep ?? 0) > 0 && (stats.avgSleep ?? 0) < 390) {
    plan.push({
      title: "先把睡眠拉回 6.5 小时以上",
      body: "连续 3 晚把睡前强刺激内容提前结束，训练安排转为保守。",
      action: "今晚先把入睡时间提前 30 分钟。",
      href: "/apple/categories/sleep",
      icon: "sleep",
      tone: "warn",
      meta: "下周优先级 1",
    });
  } else {
    plan.push({
      title: "保持固定作息",
      body: "睡眠没有成为明显短板，下周重点保持节奏，不为了训练牺牲睡眠。",
      action: "把入睡和起床时间控制在固定区间。",
      href: "/apple/categories/sleep",
      icon: "sleep",
      tone: "good",
      meta: "下周优先级 1",
    });
  }

  if ((stats.avgSteps ?? 0) < 6500 || (stats.activeMinutes ?? 0) < 120) {
    plan.push({
      title: "补基础活动，不先追强度",
      body: "下周安排 4 次 20-30 分钟轻活动，优先快走、骑行或低强度力量。",
      action: "明天先补一段 20 分钟步行。",
      href: "/apple/goals",
      icon: "activity",
      tone: "warn",
      meta: "下周优先级 2",
    });
  } else {
    plan.push({
      title: "活动底盘保持住",
      body: "基础活动已经有支撑，下周可以把注意力放到训练质量和恢复。",
      action: "继续保持每天至少一次主动活动。",
      href: "/apple/goals",
      icon: "activity",
      tone: "good",
      meta: "下周优先级 2",
    });
  }

  if (stats.workouts < 2) {
    plan.push({
      title: "补一到两次可记录训练",
      body: "下周选择能稳定完成的训练，关键是开始记录，让后续周报能判断负荷。",
      action: "训练时从 Apple Watch 开始体能训练。",
      href: "/apple/raw/workouts",
      icon: "cardio",
      tone: "neutral",
      meta: "下周优先级 3",
    });
  } else {
    plan.push({
      title: "训练后留恢复窗口",
      body: "已有训练记录时，下周不要连续加量。观察睡眠、HRV 和腿部疲劳。",
      action: "训练后第二天优先看睡眠和恢复指标。",
      href: "/apple/coach",
      icon: "recovery",
      tone: sleepChange !== null && sleepChange < -10 ? "warn" : "neutral",
      meta: "下周优先级 3",
    });
  }

  return plan;
}

function latestWorkout(day: DayRecord): string {
  const workout = day.workouts[0];
  return workout ? workoutLabel(String(workout.sport_type ?? "")) : "无训练";
}

export default async function AppleReportPage() {
  const [dailySummary, activityDetail, sleepDetail, workoutDetail] = await Promise.all([
    safeAppleDailySummary(),
    safeAppleRawDetail("daily_activity", 140),
    safeAppleRawDetail("sleep_sessions", 180),
    safeAppleRawDetail("workouts", 120),
  ]);
  const days = buildDays(activityDetail?.rows ?? [], sleepDetail?.rows ?? [], workoutDetail?.rows ?? []);
  const activeDate = dailySummary?.date ?? days[0]?.date ?? dateKeyFromDate(new Date());
  const weekStart = startOfWeek(activeDate);
  const weekEnd = activeDate;
  const targetDays = daySpan(weekStart, weekEnd);
  const previousWeekStart = addDays(weekStart, -7);
  const previousWeekEnd = addDays(previousWeekStart, targetDays - 1);
  const monthStartKey = monthStart(activeDate);
  const monthDays = daysInRange(days, monthStartKey, activeDate);
  const weekDays = daysInRange(days, weekStart, weekEnd);
  const previousWeekDays = daysInRange(days, previousWeekStart, previousWeekEnd);
  const weekStats = statsFor(weekDays);
  const previousStats = statsFor(previousWeekDays);
  const monthStats = statsFor(monthDays);
  const score = scoreFor(weekStats, targetDays);
  const insights = buildInsights(weekStats, previousStats);
  const signals = buildSignals(weekStats, previousStats);
  const nextWeekPlan = buildNextWeekPlan(weekStats, previousStats);
  const advice = adviceFor(weekStats, previousStats);
  const recentDays = days.slice(0, 10);
  const reportKpis = [
    {
      href: "/apple/metrics/steps",
      label: "本周步数",
      value: formatValue(weekStats.steps),
      detail: changeText(weekStats.avgSteps, previousStats.avgSteps).label,
    },
    {
      href: "/apple/categories/sleep",
      label: "平均睡眠",
      value: formatHours(weekStats.avgSleep),
      detail: `${weekStats.sleepNights} 晚 · ${changeText(weekStats.avgSleep, previousStats.avgSleep).label}`,
    },
    {
      href: "/apple/metrics/stand-time",
      label: "站立时间",
      value: formatHours(weekStats.standMinutes),
      detail: "Apple Watch 站立分钟数",
    },
    {
      href: "/apple/metrics/respiratory-rate",
      label: "夜间呼吸",
      value: formatRespiratoryRate(weekStats.avgRespiration),
      detail: "本周睡眠平均",
    },
    {
      href: "/apple/raw/workouts",
      label: "训练",
      value: String(weekStats.workouts),
      detail: "本周体能训练记录",
    },
  ];

  return (
    <>
      <section className="apple-detail-hero apple-report-hero">
        <div>
          <Link href="/apple" className="apple-back-link">
            返回健康概览
          </Link>
          <div className="hero-eyebrow">健康报告</div>
          <h2>{reportTitle(score, weekStats)}</h2>
          <p>
            本周截至 {displayDate(weekEnd)} 的运动、站立、睡眠和训练回顾。这里优先给出可执行建议，再把细节交给日历和指标页。
          </p>
        </div>
        <div className="apple-hero-badges">
          <span className="apple-badge">本周 {weekStats.activeDays} 天活动</span>
          <span className="apple-badge good">本月 {monthStats.days} 天记录</span>
        </div>
      </section>

      <section className="apple-report-score-panel">
        <article className="apple-panel apple-report-score-card">
          <div>
            <span>本周节奏</span>
            <strong>{score}</strong>
            <small>综合活动、睡眠和训练记录</small>
          </div>
          <div className="apple-report-score-ring" style={progressStyle(score, 100, "var(--signal)")}>
            <i aria-hidden />
          </div>
        </article>
        <article className="apple-panel apple-report-advice-card">
          <div className="apple-panel-head">
            <div>
              <h3>接下来建议</h3>
              <p>根据这一周的数据给出一组实际安排。</p>
            </div>
          </div>
          <ul className="apple-report-advice-list">
            {(advice.length ? advice : ["继续保持 Apple Watch 佩戴和同步，下周这里会形成更完整的回顾。"]).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="apple-kpis">
        {reportKpis.map((item) => (
          <Link className="apple-kpi clickable" href={item.href} key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </Link>
        ))}
      </section>

      <section className="apple-report-insight-grid">
        {insights.map((item) => (
          <Link className={`apple-report-insight ${item.tone}`} href={item.href} key={item.title}>
            <AppleCategoryIcon name={item.icon} />
            <div>
              <span>{item.meta}</span>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </div>
          </Link>
        ))}
      </section>

      <section className="apple-panel health-next-plan-panel">
        <div className="apple-panel-head">
          <div>
            <h3>下周计划</h3>
            <p>把周报结论拆成可以直接执行的 3 个动作。</p>
          </div>
          <Link href="/apple/coach" className="apple-text-link">
            今日教练
          </Link>
        </div>
        <div className="health-plan-grid">
          {nextWeekPlan.map((item) => (
            <Link className={`health-plan-card ${item.tone}`} href={item.href} key={item.title}>
              <AppleCategoryIcon name={item.icon} />
              <div>
                <span>{item.meta}</span>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
                <em>{item.action}</em>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="apple-panel health-signal-panel">
        <div className="apple-panel-head">
          <div>
            <h3>本周复盘</h3>
            <p>先看哪些信号值得保留，哪些需要下周修正。</p>
          </div>
          <Link href="/apple/assistant" className="apple-text-link">
            健康问答
          </Link>
        </div>
        <div className="health-signal-grid">
          {signals.map((item) => (
            <Link className={`health-signal-card ${item.tone}`} href={item.href} key={item.title}>
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

      <section className="apple-panel apple-report-progress-panel">
        <div className="apple-panel-head">
          <div>
            <h3>本周完成度</h3>
            <p>按一周常用目标看运动、站立和睡眠节奏。</p>
          </div>
          <Link href="/apple/calendar" className="apple-text-link">
            打开日历
          </Link>
        </div>
        <div className="apple-report-progress-list">
          <div className="apple-report-progress-row" style={progressStyle(weekStats.steps, 8000 * targetDays, "var(--signal)")}>
            <span>步数</span>
            <div><i /></div>
            <strong>{formatValue(weekStats.steps)} / {formatValue(8000 * targetDays)}</strong>
          </div>
          <div className="apple-report-progress-row" style={progressStyle(weekStats.activeMinutes, 30 * targetDays, "var(--up)")}>
            <span>活动分钟</span>
            <div><i /></div>
            <strong>{formatValue(weekStats.activeMinutes)} / {formatValue(30 * targetDays)}</strong>
          </div>
          <div className="apple-report-progress-row" style={progressStyle(weekStats.standMinutes, 180 * targetDays, "var(--accent)")}>
            <span>站立时间</span>
            <div><i /></div>
            <strong>{formatHours(weekStats.standMinutes)} / {formatHours(180 * targetDays)}</strong>
          </div>
          <div className="apple-report-progress-row" style={progressStyle(weekStats.avgSleep, 420, "var(--warn)")}>
            <span>平均睡眠</span>
            <div><i /></div>
            <strong>{formatHours(weekStats.avgSleep)} / 7 小时</strong>
          </div>
        </div>
      </section>

      <section className="apple-panel apple-report-days-panel">
        <div className="apple-panel-head">
          <div>
            <h3>最近日期</h3>
            <p>从最近 10 天里挑一天进入详情。</p>
          </div>
        </div>
        <div className="apple-report-day-strip">
          {recentDays.map((day) => (
            <Link href={`/apple/days/${encodeURIComponent(day.date)}`} className="apple-report-day" key={day.date}>
              <span>{displayDate(day.date)}</span>
              <strong>{formatValue(day.steps)}</strong>
              <small>步</small>
              <div className="apple-report-day-bars" aria-hidden>
                <i style={{ height: `${Math.max(8, Math.min(100, ((day.steps ?? 0) / 10000) * 100))}%` }} />
                <i style={{ height: `${Math.max(8, Math.min(100, ((day.activeMinutes ?? 0) / 60) * 100))}%` }} />
                <i style={{ height: `${Math.max(8, Math.min(100, ((day.sleepMinutes ?? 0) / 480) * 100))}%` }} />
              </div>
              <p>{formatHours(day.sleepMinutes)} 睡眠</p>
              <em>{latestWorkout(day)}</em>
            </Link>
          ))}
          {!recentDays.length && <div className="apple-empty-chart compact">还没有可展示的日期记录</div>}
        </div>
      </section>
    </>
  );
}
