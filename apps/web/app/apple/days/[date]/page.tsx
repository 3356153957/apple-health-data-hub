import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import type { Metadata } from "next";

import type { AppleDailySummary } from "../../../lib/api";
import { safeAppleDailySummary } from "../../../lib/load";
import { AppleCategoryIcon, SleepStageOverview, formatHours, formatRespiratoryRate, formatValue, workoutLabel, zhTime } from "../../appleHealth";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ date: string }>;
};

type Tone = "good" | "warn" | "neutral";

function validDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function displayDate(dateKey: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    timeZone: "Asia/Shanghai",
  }).format(new Date(`${dateKey}T12:00:00+08:00`));
}

function shortDate(dateKey: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    timeZone: "Asia/Shanghai",
  }).format(new Date(`${dateKey}T12:00:00+08:00`));
}

function shiftDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00+08:00`);
  date.setDate(date.getDate() + days);
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : dateKey;
}

function todayDateKey(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : "";
}

function activityTone(level: string | undefined): Tone {
  if (level === "充足") return "good";
  if (level === "偏少") return "warn";
  return "neutral";
}

function sleepTone(level: string | undefined): Tone {
  if (level === "恢复较好" || level === "基本够用") return "good";
  if (level === "偏少") return "warn";
  return "neutral";
}

function dayTitle(summary: AppleDailySummary | null): string {
  const activity = summary?.activity?.level;
  const sleep = summary?.sleep?.level;
  if (!summary) return "等待同步";
  if (activity === "充足" && sleep === "恢复较好") return "活动与恢复都不错";
  if (sleep === "偏少") return "恢复优先";
  if (activity === "偏少") return "活动量偏少";
  return "节奏平稳";
}

function dayCopy(value: string): string {
  return value.replaceAll("昨日", "当天").replaceAll("昨夜", "当晚").replaceAll("今天", "接下来");
}

function pct(value: number | null | undefined, goal: number): number {
  if (value === null || value === undefined || !Number.isFinite(value) || goal <= 0) return 0;
  return Math.max(0, Math.min(1, value / goal));
}

function goalStyle(value: number | null | undefined, goal: number, color: string): CSSProperties {
  return {
    "--goal-pct": `${pct(value, goal) * 100}%`,
    "--goal-color": color,
  } as CSSProperties;
}

function changeText(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "暂无 7 日对比";
  return `较近 7 日${value >= 0 ? "高" : "低"} ${formatValue(Math.abs(value), 1)}%`;
}

function stagePercent(value: number | null | undefined, total: number | null | undefined): string {
  if (!value || !total) return "0%";
  return `${Math.max(0, Math.min(100, (value / total) * 100))}%`;
}

function formatMinutes(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "暂无";
  return `${formatValue(value, 0)} 分钟`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { date } = await params;
  const dateKey = decodeURIComponent(date);
  return { title: `${validDateKey(dateKey) ? displayDate(dateKey) : "每日详情"} · 健康` };
}

export default async function AppleDayDetailPage({ params }: PageProps) {
  const { date } = await params;
  const dateKey = decodeURIComponent(date);
  if (!validDateKey(dateKey)) notFound();

  const summary = await safeAppleDailySummary(dateKey);
  const activity = summary?.activity ?? null;
  const sleep = summary?.sleep ?? null;
  const workouts = summary?.workouts ?? [];
  const activityState = activityTone(activity?.level);
  const sleepState = sleepTone(sleep?.level);
  const previousDate = shiftDateKey(dateKey, -1);
  const nextDate = shiftDateKey(dateKey, 1);
  const today = todayDateKey();
  const canOpenNextDate = !today || nextDate <= today;
  const dayKpis = [
    {
      href: "/apple/metrics/steps",
      label: "步数",
      value: formatValue(activity?.steps),
      detail: changeText(activity?.delta_pct?.steps),
    },
    {
      href: "/apple/categories/sleep",
      label: "睡眠",
      value: formatHours(sleep?.total_sleep_min),
      detail: `效率 ${formatValue(sleep?.efficiency_pct, 1)}%`,
    },
    {
      href: "/apple/metrics/stand-time",
      label: "站立时间",
      value: formatHours(activity?.stand_minutes),
      detail: "Apple Watch 站立记录",
    },
    {
      href: "/apple/metrics/respiratory-rate",
      label: "呼吸次数",
      value: formatRespiratoryRate(sleep?.respiratory_rate),
      detail: "睡眠期间记录",
    },
    {
      href: "/apple/raw/workouts",
      label: "训练",
      value: String(workouts.length),
      detail: workouts[0] ? workoutLabel(workouts[0].sport_type) : "未记录训练",
    },
  ];

  return (
    <>
      <section className="apple-detail-hero">
        <div>
          <Link href="/apple" className="apple-back-link">
            返回健康概览
          </Link>
          <div className="hero-eyebrow">每日详情</div>
          <h2>{dayTitle(summary)}</h2>
          <p>{summary?.headline ? dayCopy(summary.headline) : "这一天还没有同步到完整的活动、睡眠和训练记录。"}</p>
        </div>
        <div className="apple-hero-badges">
          <span className="apple-badge">{displayDate(dateKey)}</span>
          <span className={`apple-badge ${activityState === "good" ? "good" : ""}`}>
            活动 {activity?.level ?? "暂无"}
          </span>
          <span className={`apple-badge ${sleepState === "good" ? "good" : ""}`}>
            睡眠 {sleep?.level ?? "暂无"}
          </span>
        </div>
      </section>

      <nav className="apple-day-nav" aria-label="每日记录切换">
        <Link href={`/apple/days/${encodeURIComponent(previousDate)}`}>
          <span>前一天</span>
          <strong>{shortDate(previousDate)}</strong>
        </Link>
        <div>
          <span>当前日期</span>
          <strong>{shortDate(dateKey)}</strong>
        </div>
        {canOpenNextDate ? (
          <Link href={`/apple/days/${encodeURIComponent(nextDate)}`}>
            <span>后一天</span>
            <strong>{shortDate(nextDate)}</strong>
          </Link>
        ) : (
          <div className="disabled">
            <span>后一天</span>
            <strong>等待同步</strong>
          </div>
        )}
      </nav>

      <section className="apple-kpis">
        {dayKpis.map((item) => (
          <Link className="apple-kpi clickable" href={item.href} key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </Link>
        ))}
      </section>

      <section className="apple-day-detail-grid">
        <article className="apple-panel">
          <div className="apple-panel-head">
            <div>
              <h3>活动完成度</h3>
              <p>按常用目标看这一天的运动量、站立和能量消耗。</p>
            </div>
            <Link href="/apple/raw/daily_activity" className="apple-text-link">
              活动详情
            </Link>
          </div>
          <div className="apple-goal-list">
            <div className="apple-goal-row" style={goalStyle(activity?.steps, 10000, "var(--signal)")}>
              <AppleCategoryIcon name="activity" />
              <div>
                <span>步数</span>
                <strong>{formatValue(activity?.steps)} 步</strong>
                <div className="apple-goal-track" aria-hidden>
                  <i />
                </div>
              </div>
              <em>目标 10,000</em>
            </div>
            <div className="apple-goal-row" style={goalStyle(activity?.active_minutes, 30, "var(--up)")}>
              <AppleCategoryIcon name="recovery" />
              <div>
                <span>活动分钟</span>
                <strong>{formatMinutes(activity?.active_minutes)}</strong>
                <div className="apple-goal-track" aria-hidden>
                  <i />
                </div>
              </div>
              <em>目标 30</em>
            </div>
            <div className="apple-goal-row" style={goalStyle(activity?.stand_minutes, 180, "var(--accent)")}>
              <AppleCategoryIcon name="body" />
              <div>
                <span>站立时间</span>
                <strong>{formatHours(activity?.stand_minutes)}</strong>
                <div className="apple-goal-track" aria-hidden>
                  <i />
                </div>
              </div>
              <em>目标 3 小时</em>
            </div>
          </div>
        </article>

        <article className="apple-panel">
          <div className="apple-panel-head">
            <div>
              <h3>睡眠结构</h3>
              <p>{sleep ? `${zhTime(sleep.start_time)} 到 ${zhTime(sleep.end_time)}` : "暂无睡眠记录"}</p>
            </div>
            <Link href="/apple/raw/sleep_sessions" className="apple-text-link">
              睡眠详情
            </Link>
          </div>
          <SleepStageOverview
            deepMin={sleep?.deep_min}
            coreMin={sleep?.core_min}
            remMin={sleep?.rem_min}
            awakeMin={sleep?.awake_min}
            totalMin={sleep?.in_bed_min}
          />
          <div className="apple-sleep-bars day">
            {[
              ["深睡", sleep?.deep_min, "deep"],
              ["核心", sleep?.core_min, "core"],
              ["REM", sleep?.rem_min, "rem"],
              ["清醒", sleep?.awake_min, "awake"],
            ].map(([label, raw, tone]) => {
              const value = typeof raw === "number" ? raw : 0;
              return (
                <div className="apple-sleep-row" key={label}>
                  <span>{label}</span>
                  <div className="apple-sleep-track">
                    <i className={`apple-sleep-fill ${tone}`} style={{ width: stagePercent(value, sleep?.in_bed_min) }} />
                  </div>
                  <strong>{formatMinutes(value)}</strong>
                </div>
              );
            })}
          </div>
          <div className="apple-sleep-extra">
            <div>
              <span>呼吸次数</span>
              <strong>{formatRespiratoryRate(sleep?.respiratory_rate)}</strong>
            </div>
            <div>
              <span>在床时间</span>
              <strong>{formatHours(sleep?.in_bed_min)}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="apple-two-col apple-day-bottom">
        <article className="apple-panel">
          <div className="apple-panel-head">
            <div>
              <h3>建议</h3>
              <p>结合当天活动和睡眠给出的下一步安排。</p>
            </div>
          </div>
          <ul className="apple-day-advice-list">
            {(summary?.advice ?? ["暂无足够数据生成建议。"]).map((item) => (
              <li key={item}>{dayCopy(item)}</li>
            ))}
          </ul>
        </article>

        <article className="apple-panel">
          <div className="apple-panel-head">
            <div>
              <h3>训练记录</h3>
              <p>这一天由 Apple Watch 记录的体能训练。</p>
            </div>
            <Link href="/apple/raw/workouts" className="apple-text-link">
              训练详情
            </Link>
          </div>
          <div className="apple-record-grid day-workouts">
            {workouts.map((workout) => (
              <article className="apple-record-card" key={`${workout.start_time}-${workout.sport_type}`}>
                <AppleCategoryIcon name="cardio" />
                <div>
                  <span>{workoutLabel(workout.sport_type)}</span>
                  <strong>
                    {formatMinutes(workout.duration_min)}
                  </strong>
                  <p>{zhTime(workout.start_time)} 开始</p>
                  <div className="apple-record-tags">
                    <em>{formatValue(workout.calories, 1)} kcal</em>
                    <em>{formatValue(workout.distance_km, 2)} km</em>
                    <em>最高 {formatValue(workout.max_hr)} bpm</em>
                  </div>
                </div>
              </article>
            ))}
            {!workouts.length && <div className="apple-empty-chart compact">这一天没有训练记录</div>}
          </div>
        </article>
      </section>
    </>
  );
}
