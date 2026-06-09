import Link from "next/link";
import type { Metadata } from "next";

import type { AppleRawDetail } from "../../lib/api";
import { safeAppleDailySummary, safeAppleRawDetail } from "../../lib/load";
import { AppleCategoryIcon, cleanRespiratoryRate, formatHours, formatRespiratoryRate, formatValue, workoutLabel } from "../appleHealth";

export const metadata: Metadata = { title: "健康日历 · 健康" };
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
  tone: Tone;
};

type PeriodStats = {
  days: number;
  activeDays: number;
  sleepNights: number;
  steps: number | null;
  activeMinutes: number | null;
  standMinutes: number | null;
  avgSleep: number | null;
  avgRespiration: number | null;
  workouts: number;
};

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

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

function displayMonth(dateKey: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    timeZone: "Asia/Shanghai",
  }).format(dateFromKey(dateKey));
}

function displayDate(dateKey: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    timeZone: "Asia/Shanghai",
  }).format(dateFromKey(dateKey));
}

function dayNumber(dateKey: string): string {
  return String(Number(dateKey.slice(-2)));
}

function pct(value: number | null | undefined, goal: number): number {
  if (value === null || value === undefined || !Number.isFinite(value) || goal <= 0) return 0;
  return Math.max(0.08, Math.min(1, value / goal));
}

function activityText(day: DayRecord | null): string {
  if (!day || (day.steps === null && day.activeMinutes === null)) return "暂无活动";
  if ((day.steps ?? 0) >= 8000 || (day.activeMinutes ?? 0) >= 30) return "活动充足";
  if ((day.steps ?? 0) >= 5000 || (day.activeMinutes ?? 0) >= 15) return "活动适中";
  return "活动偏少";
}

function sleepText(day: DayRecord | null): string {
  if (!day || day.sleepMinutes === null) return "暂无睡眠";
  if (day.sleepMinutes >= 420) return "睡眠充足";
  if (day.sleepMinutes >= 360) return "睡眠尚可";
  return "睡眠偏少";
}

function dayTone(day: DayRecord): Tone {
  const lowActivity = (day.steps ?? 0) > 0 && (day.steps ?? 0) < 5000 && (day.activeMinutes ?? 0) < 15;
  const lowSleep = day.sleepMinutes !== null && day.sleepMinutes < 360;
  const goodActivity = (day.steps ?? 0) >= 8000 || (day.activeMinutes ?? 0) >= 30;
  const goodSleep = day.sleepMinutes !== null && day.sleepMinutes >= 420;
  if (lowActivity || lowSleep) return "warn";
  if (goodActivity && goodSleep) return "good";
  return "neutral";
}

function ensureDay(days: Map<string, DayRecord>, date: string): DayRecord {
  const existing = days.get(date);
  if (existing) return existing;
  const created: DayRecord = {
    date,
    steps: null,
    activeMinutes: null,
    activeCalories: null,
    standMinutes: null,
    sleepMinutes: null,
    respiratoryRate: null,
    workouts: [],
    tone: "neutral",
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
    const nextSleep = rawNumber(row, "total_sleep_min");
    const currentSleep = day.sleepMinutes ?? 0;
    if (nextSleep !== null && nextSleep >= currentSleep) {
      day.sleepMinutes = nextSleep;
      day.respiratoryRate = cleanRespiratoryRate(rawNumber(row, "respiratory_rate"));
    }
  });

  workoutRows.forEach((row) => {
    const date = localDateKey(row.start_time ?? row.end_time);
    if (!date) return;
    ensureDay(days, date).workouts.push(row);
  });

  return [...days.values()]
    .map((day) => ({ ...day, tone: dayTone(day) }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function statsFor(days: DayRecord[]): PeriodStats {
  const steps = days.reduce((sum, day) => sum + (day.steps ?? 0), 0);
  const activeMinutes = days.reduce((sum, day) => sum + (day.activeMinutes ?? 0), 0);
  const standMinutes = days.reduce((sum, day) => sum + (day.standMinutes ?? 0), 0);
  const sleepValues = days.map((day) => day.sleepMinutes).filter((value): value is number => value !== null);
  const respirationValues = days.map((day) => day.respiratoryRate).filter((value): value is number => value !== null);
  const workouts = days.reduce((sum, day) => sum + day.workouts.length, 0);

  return {
    days: days.length,
    activeDays: days.filter((day) => (day.steps ?? 0) > 0 || (day.activeMinutes ?? 0) > 0).length,
    sleepNights: sleepValues.length,
    steps: steps > 0 ? steps : null,
    activeMinutes: activeMinutes > 0 ? activeMinutes : null,
    standMinutes: standMinutes > 0 ? standMinutes : null,
    avgSleep: sleepValues.length ? sleepValues.reduce((sum, value) => sum + value, 0) / sleepValues.length : null,
    avgRespiration: respirationValues.length ? respirationValues.reduce((sum, value) => sum + value, 0) / respirationValues.length : null,
    workouts,
  };
}

function weekRange(dateKey: string): Set<string> {
  const start = startOfWeek(dateKey);
  return new Set(Array.from({ length: 7 }, (_, index) => addDays(start, index)));
}

function calendarCells(activeMonthDate: string, dayMap: Map<string, DayRecord>) {
  const firstDay = monthStart(activeMonthDate);
  const gridStart = startOfWeek(firstDay);
  const month = activeMonthDate.slice(0, 7);
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index);
    return {
      date,
      day: dayMap.get(date) ?? null,
      inMonth: date.startsWith(month),
    };
  });
}

function latestWorkoutLabel(day: DayRecord): string {
  const workout = day.workouts[0];
  if (!workout) return "无训练";
  return workoutLabel(String(workout.sport_type ?? ""));
}

export default async function AppleCalendarPage() {
  const [dailySummary, activityDetail, sleepDetail, workoutDetail] = await Promise.all([
    safeAppleDailySummary(),
    safeAppleRawDetail("daily_activity", 140),
    safeAppleRawDetail("sleep_sessions", 180),
    safeAppleRawDetail("workouts", 120),
  ]);
  const days = buildDays(activityDetail?.rows ?? [], sleepDetail?.rows ?? [], workoutDetail?.rows ?? []);
  const dayMap = new Map(days.map((day) => [day.date, day] as const));
  const activeDate = dailySummary?.date ?? days[0]?.date ?? dateKeyFromDate(new Date());
  const month = activeDate.slice(0, 7);
  const weekDates = weekRange(activeDate);
  const monthDays = days.filter((day) => day.date.startsWith(month));
  const weekDays = days.filter((day) => weekDates.has(day.date));
  const monthStats = statsFor(monthDays);
  const weekStats = statsFor(weekDays);
  const cells = calendarCells(activeDate, dayMap);
  const recentDays = days.slice(0, 14);
  const calendarKpis = [
    {
      href: "/apple/metrics/steps",
      label: "本月步数",
      value: formatValue(monthStats.steps),
      detail: `${monthStats.activeDays} 天有活动记录`,
    },
    {
      href: "/apple/categories/activity",
      label: "本周活动",
      value: formatValue(weekStats.activeMinutes),
      detail: `分钟 · ${formatHours(weekStats.standMinutes)} 站立`,
    },
    {
      href: "/apple/categories/sleep",
      label: "平均睡眠",
      value: formatHours(monthStats.avgSleep),
      detail: `本月 ${monthStats.sleepNights} 晚记录`,
    },
    {
      href: "/apple/metrics/respiratory-rate",
      label: "夜间呼吸",
      value: formatRespiratoryRate(monthStats.avgRespiration),
      detail: "本月睡眠平均",
    },
    {
      href: "/apple/raw/workouts",
      label: "训练",
      value: String(monthStats.workouts),
      detail: "本月 Apple Watch 训练记录",
    },
  ];

  return (
    <>
      <section className="apple-detail-hero">
        <div>
          <Link href="/apple" className="apple-back-link">
            返回健康概览
          </Link>
          <div className="hero-eyebrow">健康日历</div>
          <h2>{displayMonth(activeDate)}</h2>
          <p>按日期回看运动、站立、睡眠和训练记录。颜色和柱形只做快速浏览，点进某一天可以查看完整摘要和建议。</p>
        </div>
        <div className="apple-hero-badges">
          <span className="apple-badge">{monthStats.activeDays} 天活动</span>
          <span className="apple-badge good">{monthStats.sleepNights} 晚睡眠</span>
        </div>
      </section>

      <section className="apple-kpis">
        {calendarKpis.map((item) => (
          <Link className="apple-kpi clickable" href={item.href} key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </Link>
        ))}
      </section>

      <section className="apple-panel apple-calendar-panel">
        <div className="apple-panel-head">
          <div>
            <h3>月份视图</h3>
            <p>每格显示步数、睡眠和训练状态；较深颜色表示这天更值得回看。</p>
          </div>
          <Link href="/apple/highlights" className="apple-text-link">
            查看亮点
          </Link>
        </div>
        <div className="apple-calendar-weekdays" aria-hidden>
          {WEEKDAYS.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="apple-calendar-grid">
          {cells.map(({ date, day, inMonth }) => (
            <Link
              className={`apple-calendar-day ${day?.tone ?? "neutral"} ${inMonth ? "" : "outside"} ${day ? "" : "empty"}`}
              href={`/apple/days/${encodeURIComponent(date)}`}
              key={date}
            >
              <span className="apple-calendar-date">{dayNumber(date)}</span>
              {day ? (
                <>
                  <div className="apple-calendar-bars" aria-hidden>
                    <i className="move" style={{ height: `${pct(day.steps, 10000) * 100}%` }} />
                    <i className="exercise" style={{ height: `${pct(day.activeMinutes, 60) * 100}%` }} />
                    <i className="sleep" style={{ height: `${pct(day.sleepMinutes, 480) * 100}%` }} />
                  </div>
                  <strong>{formatValue(day.steps)}</strong>
                  <small>步</small>
                  <p>{formatHours(day.sleepMinutes)} 睡眠</p>
                </>
              ) : (
                <em>暂无记录</em>
              )}
            </Link>
          ))}
        </div>
      </section>

      <section className="apple-panel apple-calendar-list-panel">
        <div className="apple-panel-head">
          <div>
            <h3>最近日期</h3>
            <p>把每天的活动、睡眠、站立和训练放在一行里，适合快速扫一遍。</p>
          </div>
        </div>
        <div className="apple-calendar-list">
          {recentDays.map((day) => (
            <Link className={`apple-calendar-row ${day.tone}`} href={`/apple/days/${encodeURIComponent(day.date)}`} key={day.date}>
              <AppleCategoryIcon name={day.tone === "warn" ? "sleep" : "activity"} />
              <div>
                <span>{displayDate(day.date)}</span>
                <strong>
                  {formatValue(day.steps)} 步 · {formatHours(day.sleepMinutes)} 睡眠
                </strong>
                <p>
                  {activityText(day)} · {sleepText(day)} · {latestWorkoutLabel(day)}
                </p>
              </div>
              <em>
                {formatHours(day.standMinutes)} 站立
                {day.respiratoryRate !== null ? ` · 呼吸 ${formatValue(day.respiratoryRate, 1)} 次/分` : ""}
              </em>
            </Link>
          ))}
          {!recentDays.length && <div className="apple-empty-chart compact">还没有可展示的日期记录</div>}
        </div>
      </section>
    </>
  );
}
