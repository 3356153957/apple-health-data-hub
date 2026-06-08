import Link from "next/link";
import type { CSSProperties } from "react";
import type { Metadata } from "next";

import type { AppleDailySummary } from "../../lib/api";
import { safeAppleDailySummary, safeAppleRawDetail } from "../../lib/load";
import {
  AppleCategoryIcon,
  cleanRespiratoryRate,
  formatHours,
  formatRespiratoryRate,
  formatValue,
  workoutLabel,
  zhTime,
} from "../appleHealth";

export const metadata: Metadata = { title: "每日总结 · 健康" };
export const dynamic = "force-dynamic";

type Tone = "good" | "warn" | "neutral";

type RecentDay = {
  date: string;
  steps: number | null;
  activeMinutes: number | null;
  standMinutes: number | null;
  sleepMinutes: number | null;
  respiratoryRate: number | null;
  tone: Tone;
};

function rawNumber(row: Record<string, string | number | null> | undefined, key: string): number | null {
  if (!row) return null;
  const value = row[key];
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function rawString(row: Record<string, string | number | null> | undefined, key: string): string | null {
  if (!row) return null;
  const value = row[key];
  return typeof value === "string" && value ? value : null;
}

function dateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : null;
}

function displayDate(value: string | null | undefined): string {
  if (!value) return "等待同步";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    timeZone: "Asia/Shanghai",
  }).format(new Date(`${value}T12:00:00+08:00`));
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

function stagePercent(value: number | null | undefined, total: number | null | undefined): string {
  if (!value || !total) return "0%";
  return `${Math.max(0, Math.min(100, (value / total) * 100))}%`;
}

function minutes(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "暂无";
  return `${formatValue(value)} 分钟`;
}

function respirationBrief(value: number | null | undefined): string {
  const cleaned = cleanRespiratoryRate(value);
  return cleaned === null ? "暂无呼吸记录" : `${formatValue(cleaned, 1)} 次/分呼吸`;
}

function dailyTone(summary: AppleDailySummary | null): Tone {
  if (!summary) return "neutral";
  if (summary.sleep?.level === "偏少") return "warn";
  if (summary.activity?.level === "充足" && summary.sleep) return "good";
  return "neutral";
}

function dailyTitle(summary: AppleDailySummary | null): string {
  if (!summary) return "等待健康数据同步";
  if (summary.sleep?.level === "偏少") return "今天优先照顾恢复";
  if (summary.activity?.level === "偏少") return "今天补一点轻活动";
  if (summary.workouts.length > 0) return "训练后保持恢复节奏";
  return "今天保持稳定节奏";
}

function dailyCopy(summary: AppleDailySummary | null): string {
  if (!summary) return "同步完成后，这里会整理昨日运动、睡眠、训练和今天建议。";
  return summary.headline || "根据昨日运动和睡眠状态，整理今天最值得关注的安排。";
}

function actionItems(summary: AppleDailySummary | null): string[] {
  if (!summary) return ["完成一次同步后查看昨日总结。"];
  const items = [...(summary.advice ?? [])];
  if (summary.sleep?.level === "偏少") items.unshift("今天把恢复放在第一位，训练强度保守一点。");
  if (summary.activity?.level === "偏少") items.push("安排 20-30 分钟轻活动，先把基础活动量补上。");
  if (!items.length) items.push("继续保持当前节奏，晚上尽量固定入睡时间。");
  return Array.from(new Set(items)).slice(0, 4);
}

function workoutMeta(workout: AppleDailySummary["workouts"][number]): string {
  const items: string[] = [];
  if (workout.calories !== null) items.push(`${formatValue(workout.calories, 1)} kcal`);
  if (workout.distance_km !== null && workout.distance_km > 0) items.push(`${formatValue(workout.distance_km, 2)} km`);
  if (workout.max_hr !== null) items.push(`最高 ${formatValue(workout.max_hr)} bpm`);
  return items.length ? items.join(" · ") : "暂无更多训练细节";
}

function recentDays(
  activityRows: Array<Record<string, string | number | null>>,
  sleepRows: Array<Record<string, string | number | null>>,
): RecentDay[] {
  const sleepByDate = new Map<string, Record<string, string | number | null>>();
  sleepRows.forEach((row) => {
    const key = dateKey(rawString(row, "end_time") ?? rawString(row, "start_time"));
    if (!key) return;
    const current = sleepByDate.get(key);
    const currentSleep = rawNumber(current, "total_sleep_min") ?? 0;
    const nextSleep = rawNumber(row, "total_sleep_min") ?? 0;
    if (!current || nextSleep > currentSleep) sleepByDate.set(key, row);
  });

  return activityRows.slice(0, 7).map((row) => {
    const date = rawString(row, "date") ?? "";
    const sleep = sleepByDate.get(date);
    const steps = rawNumber(row, "steps");
    const sleepMinutes = rawNumber(sleep, "total_sleep_min");
    const tone: Tone = sleepMinutes !== null && sleepMinutes < 360 ? "warn" : steps !== null && steps >= 8000 ? "good" : "neutral";
    return {
      date,
      steps,
      activeMinutes: rawNumber(row, "active_minutes"),
      standMinutes: rawNumber(row, "stand_minutes"),
      sleepMinutes,
      respiratoryRate: cleanRespiratoryRate(rawNumber(sleep, "respiratory_rate")),
      tone,
    };
  }).filter((day) => day.date);
}

function DailyRing({
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
    <div className="apple-daily-ring-card">
      <i className="apple-daily-ring" style={ringStyle(value, goal, color)} />
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

export default async function AppleDailyPage() {
  const [summary, activityRaw, sleepRaw] = await Promise.all([
    safeAppleDailySummary(),
    safeAppleRawDetail("daily_activity", 14),
    safeAppleRawDetail("sleep_sessions", 14),
  ]);
  const activity = summary?.activity ?? null;
  const sleep = summary?.sleep ?? null;
  const workouts = summary?.workouts ?? [];
  const tone = dailyTone(summary);
  const days = recentDays(activityRaw?.rows ?? [], sleepRaw?.rows ?? []);

  return (
    <>
      <section className={`apple-detail-hero apple-daily-hero ${tone}`}>
        <div>
          <Link href="/apple" className="apple-back-link">
            返回健康概览
          </Link>
          <div className="hero-eyebrow">每日总结</div>
          <h2>{dailyTitle(summary)}</h2>
          <p>{dailyCopy(summary)}</p>
        </div>
        <div className="apple-hero-badges">
          <span className="apple-badge">{summary?.date ? displayDate(summary.date) : "等待同步"}</span>
          <span className={`apple-badge ${activity?.level === "充足" ? "good" : ""}`}>活动 {activity?.level ?? "暂无"}</span>
          <span className={`apple-badge ${sleep && sleep.level !== "偏少" ? "good" : ""}`}>睡眠 {sleep?.level ?? "暂无"}</span>
        </div>
      </section>

      <section className="apple-daily-action-grid">
        <article className="apple-daily-action-card">
          <div className="apple-panel-head">
            <div>
              <h3>今天先做什么</h3>
              <p>根据昨日运动和睡眠整理成可以直接执行的安排。</p>
            </div>
            {summary?.date && (
              <Link href={`/apple/days/${encodeURIComponent(summary.date)}`} className="apple-text-link">
                当天详情
              </Link>
            )}
          </div>
          <ul className="apple-daily-action-list">
            {actionItems(summary).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="apple-daily-rhythm-card">
          <span>昨日概览</span>
          <strong>{summary?.date ? displayDate(summary.date) : "暂无日期"}</strong>
          <p>
            {formatValue(activity?.steps)} 步 · {formatHours(sleep?.total_sleep_min)} 睡眠 · {workouts.length} 次训练
          </p>
          <div className="apple-daily-mini-row">
            <em>{formatValue(activity?.active_minutes)} 分钟活动</em>
            <em>{formatHours(activity?.stand_minutes)} 站立</em>
            <em>{respirationBrief(sleep?.respiratory_rate)}</em>
          </div>
        </article>
      </section>

      <section className="apple-kpis">
        <div className="apple-kpi">
          <span>昨日步数</span>
          <strong>{formatValue(activity?.steps)}</strong>
          <small>{activity?.level ?? "暂无活动记录"}</small>
        </div>
        <div className="apple-kpi">
          <span>活动分钟</span>
          <strong>{formatValue(activity?.active_minutes)}</strong>
          <small>目标 30 分钟</small>
        </div>
        <div className="apple-kpi">
          <span>站立时间</span>
          <strong>{formatHours(activity?.stand_minutes)}</strong>
          <small>目标 3 小时</small>
        </div>
        <div className="apple-kpi">
          <span>昨夜睡眠</span>
          <strong>{formatHours(sleep?.total_sleep_min)}</strong>
          <small>效率 {formatValue(sleep?.efficiency_pct, 1)}%</small>
        </div>
        <div className="apple-kpi">
          <span>呼吸次数</span>
          <strong>{formatRespiratoryRate(sleep?.respiratory_rate)}</strong>
          <small>睡眠期间</small>
        </div>
        <div className="apple-kpi">
          <span>训练记录</span>
          <strong>{workouts.length}</strong>
          <small>{workouts[0] ? workoutLabel(workouts[0].sport_type) : "昨日未记录训练"}</small>
        </div>
      </section>

      <section className="apple-two-col apple-daily-main">
        <article className="apple-panel">
          <div className="apple-panel-head">
            <div>
              <h3>活动圆环</h3>
              <p>用常用目标快速看昨日运动量是否够用。</p>
            </div>
            <Link href="/apple/categories/activity" className="apple-text-link">
              查看活动
            </Link>
          </div>
          <div className="apple-daily-ring-grid">
            <DailyRing label="活动能量" value={activity?.active_calories} goal={600} unit="kcal" color="var(--down)" />
            <DailyRing label="活动分钟" value={activity?.active_minutes} goal={30} unit="分钟" color="var(--up)" />
            <DailyRing label="站立时间" value={activity?.stand_minutes} goal={180} unit="分钟" color="var(--accent)" />
          </div>
        </article>

        <article className="apple-panel">
          <div className="apple-panel-head">
            <div>
              <h3>睡眠结构</h3>
              <p>{sleep ? `${zhTime(sleep.start_time)} 到 ${zhTime(sleep.end_time)}` : "暂无睡眠记录"}</p>
            </div>
            <Link href="/apple/categories/sleep" className="apple-text-link">
              查看睡眠
            </Link>
          </div>
          <div className="apple-sleep-bars day">
            {[
              ["深睡", sleep?.deep_min, "deep"],
              ["核心", sleep?.core_min, "core"],
              ["REM", sleep?.rem_min, "rem"],
              ["清醒", sleep?.awake_min, "awake"],
            ].map(([label, raw, stage]) => {
              const value = typeof raw === "number" ? raw : 0;
              return (
                <div className="apple-sleep-row" key={label}>
                  <span>{label}</span>
                  <div className="apple-sleep-track">
                    <i className={`apple-sleep-fill ${stage}`} style={{ width: stagePercent(value, sleep?.in_bed_min) }} />
                  </div>
                  <strong>{minutes(value)}</strong>
                </div>
              );
            })}
          </div>
          <div className="apple-sleep-extra">
            <div>
              <span>睡眠效率</span>
              <strong>{formatValue(sleep?.efficiency_pct, 1)}%</strong>
            </div>
            <div>
              <span>呼吸次数</span>
              <strong>{formatRespiratoryRate(sleep?.respiratory_rate)}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="apple-two-col apple-daily-bottom">
        <article className="apple-panel">
          <div className="apple-panel-head">
            <div>
              <h3>训练</h3>
              <p>昨日由 Apple Watch 记录的体能训练。</p>
            </div>
            <Link href="/apple/raw/workouts" className="apple-text-link">
              查看训练
            </Link>
          </div>
          <div className="apple-daily-workout-list">
            {workouts.map((workout) => (
              <div className="apple-daily-workout" key={`${workout.start_time}-${workout.sport_type}`}>
                <AppleCategoryIcon name="cardio" />
                <div>
                  <span>{workoutLabel(workout.sport_type)}</span>
                  <strong>{minutes(workout.duration_min)}</strong>
                  <p>
                    {zhTime(workout.start_time)} · {workoutMeta(workout)}
                  </p>
                </div>
              </div>
            ))}
            {!workouts.length && <div className="apple-empty-chart compact">昨日没有训练记录</div>}
          </div>
        </article>

        <article className="apple-panel">
          <div className="apple-panel-head">
            <div>
              <h3>最近 7 天参考</h3>
              <p>把最近几天的活动和睡眠放在一起扫一眼。</p>
            </div>
            <Link href="/apple/calendar" className="apple-text-link">
              打开日历
            </Link>
          </div>
          <div className="apple-daily-day-list">
            {days.map((day) => (
              <Link className={`apple-daily-day ${day.tone}`} href={`/apple/days/${encodeURIComponent(day.date)}`} key={day.date}>
                <span>{displayDate(day.date)}</span>
                <strong>{formatValue(day.steps)} 步</strong>
                <p>
                  {formatHours(day.sleepMinutes)} 睡眠 · {formatHours(day.standMinutes)} 站立
                  {day.respiratoryRate !== null ? ` · 呼吸 ${formatValue(day.respiratoryRate, 1)} 次/分` : ""}
                </p>
              </Link>
            ))}
            {!days.length && <div className="apple-empty-chart compact">暂无最近 7 天记录</div>}
          </div>
        </article>
      </section>
    </>
  );
}
