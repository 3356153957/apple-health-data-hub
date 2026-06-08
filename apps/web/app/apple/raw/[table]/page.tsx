import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { safeAppleRawDetail } from "../../../lib/load";
import { RAW_TABLES, formatHours, formatValue, workoutLabel, zhTime } from "../../appleHealth";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ table: string }>;
};

const COLUMN_LABELS: Record<string, string> = {
  time: "时间",
  start_time: "开始",
  end_time: "结束",
  date: "日期",
  bpm: "心率",
  value_ms: "HRV",
  spo2_pct: "血氧",
  context: "场景",
  source_id: "来源",
  algorithm: "算法",
  steps: "步数",
  distance_m: "距离(m)",
  floors_climbed: "爬楼",
  active_calories: "活动能量",
  total_calories: "总能量",
  active_minutes: "活动分钟",
  stand_hours: "站立小时",
  stand_minutes: "站立时间",
  total_sleep_min: "睡眠分钟",
  awake_min: "清醒",
  core_min: "核心",
  deep_min: "深睡",
  rem_min: "REM",
  respiratory_rate: "呼吸频率",
  sport_type: "训练类型",
  duration_min: "训练分钟",
  calories: "能量",
  avg_hr: "平均心率",
  max_hr: "最高心率",
  metric_name: "指标",
  value: "数值",
  unit: "单位",
};

type RawRow = Record<string, string | number | null>;

type SummaryCard = {
  icon: IconName;
  label: string;
  value: string;
  unit?: string;
  helper: string;
};

type RecordCard = {
  icon: IconName;
  title: string;
  value: string;
  unit?: string;
  meta: string;
  details: string[];
};

type IconName = "activity" | "sleep" | "workout" | "heart" | "records" | "energy";

const ICON_PATHS: Record<IconName, string[]> = {
  activity: ["M13 5l3 6h5", "M11 19l-3-6H3", "M16 11l-4 8", "M8 13l4-8"],
  sleep: ["M21 12.8A8 8 0 1 1 11.2 3a6 6 0 1 0 9.8 9.8"],
  workout: ["M6 6v12", "M18 6v12", "M3 9v6", "M21 9v6", "M6 12h12"],
  heart: ["M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8"],
  records: ["M8 6h13", "M8 12h13", "M8 18h13", "M3.5 6h.01", "M3.5 12h.01", "M3.5 18h.01"],
  energy: ["M13 2L4 14h7l-1 8 10-13h-7l1-7z"],
};

function RawIcon({ name }: { name: IconName }) {
  return (
    <span className={`apple-mini-icon ${name}`} aria-hidden>
      <svg viewBox="0 0 24 24" focusable="false">
        {ICON_PATHS[name].map((path) => (
          <path d={path} key={path} />
        ))}
      </svg>
    </span>
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { table } = await params;
  const spec = RAW_TABLES[decodeURIComponent(table)];
  return { title: `${spec?.label ?? "同步明细"} · HealthSave` };
}

function formatCell(key: string, value: string | number | null): string {
  if (value === null || value === undefined || value === "") return "暂无";
  if (key.includes("time")) return zhTime(String(value));
  if (key === "date") return String(value);
  if (key === "sport_type") return workoutLabel(String(value));
  if (typeof value === "number") {
    const digits = Number.isInteger(value) ? 0 : 1;
    return formatValue(value, digits);
  }
  return String(value);
}

function numeric(row: RawRow, key: string): number | null {
  const value = row[key];
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (key === "respiratory_rate" && parsed <= 0) return null;
  if ((key === "avg_hr" || key === "max_hr") && parsed <= 0) return null;
  return parsed;
}

function sum(rows: RawRow[], key: string): number | null {
  const values = rows.map((row) => numeric(row, key)).filter((value): value is number => value !== null);
  return values.length ? values.reduce((total, value) => total + value, 0) : null;
}

function avg(rows: RawRow[], key: string): number | null {
  const values = rows.map((row) => numeric(row, key)).filter((value): value is number => value !== null);
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

function max(rows: RawRow[], key: string): number | null {
  const values = rows.map((row) => numeric(row, key)).filter((value): value is number => value !== null);
  return values.length ? Math.max(...values) : null;
}

function min(rows: RawRow[], key: string): number | null {
  const values = rows.map((row) => numeric(row, key)).filter((value): value is number => value !== null);
  return values.length ? Math.min(...values) : null;
}

function rowDate(row: RawRow): Date | null {
  const raw = row.end_time ?? row.start_time ?? row.time ?? row.date;
  if (!raw) return null;
  const value = String(raw);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00+08:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfWeek(now: Date): Date {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date;
}

function startOfMonth(now: Date): Date {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(1);
  return date;
}

function rowsSince(rows: RawRow[], start: Date, end: Date): RawRow[] {
  return rows.filter((row) => {
    const date = rowDate(row);
    return date !== null && date >= start && date < end;
  });
}

function formatMinutes(value: number | null): string {
  return value === null ? "暂无" : `${formatValue(value, 0)} 分钟`;
}

function formatKm(value: number | null): string {
  return value === null ? "暂无" : `${formatValue(value / 1000, 2)} km`;
}

function summaryCards(decodedTable: string, rows: RawRow[], weekRows: RawRow[], monthRows: RawRow[]): SummaryCard[] {
  if (decodedTable === "workouts") {
    const monthMaxHr = max(monthRows, "max_hr");
    return [
      {
        icon: "workout",
        label: "本周训练",
        value: formatValue(weekRows.length),
        unit: "次",
        helper: `${formatMinutes(sum(weekRows, "duration_min"))} · ${formatValue(sum(weekRows, "calories"))} kcal`,
      },
      {
        icon: "energy",
        label: "本月训练能量",
        value: formatValue(sum(monthRows, "calories")),
        unit: "kcal",
        helper: `${formatValue(monthRows.length)} 次训练 · ${formatMinutes(sum(monthRows, "duration_min"))}`,
      },
      {
        icon: "activity",
        label: "平均时长",
        value: formatValue(avg(monthRows, "duration_min")),
        unit: "分钟",
        helper: "按本月训练记录计算",
      },
      {
        icon: "heart",
        label: "本月最高心率",
        value: formatValue(monthMaxHr),
        unit: monthMaxHr === null ? undefined : "bpm",
        helper: "来自训练记录",
      },
    ];
  }

  if (decodedTable === "daily_activity") {
    return [
      {
        icon: "activity",
        label: "本周步数",
        value: formatValue(sum(weekRows, "steps")),
        unit: "步",
        helper: `日均 ${formatValue(avg(weekRows, "steps"))} 步`,
      },
      {
        icon: "energy",
        label: "本周活动分钟",
        value: formatValue(sum(weekRows, "active_minutes")),
        unit: "分钟",
        helper: `${formatValue(sum(weekRows, "active_calories"))} kcal 主动消耗`,
      },
      {
        icon: "activity",
        label: "本月距离",
        value: formatValue((sum(monthRows, "distance_m") ?? 0) / 1000, 2),
        unit: "km",
        helper: `${formatValue(monthRows.length)} 天活动记录`,
      },
      {
        icon: "records",
        label: "本月站立时间",
        value: formatHours(sum(monthRows, "stand_minutes")),
        helper: `日均 ${formatHours(avg(monthRows, "stand_minutes"))}`,
      },
    ];
  }

  if (decodedTable === "sleep_sessions") {
    return [
      {
        icon: "sleep",
        label: "本周平均睡眠",
        value: formatHours(avg(weekRows, "total_sleep_min")),
        helper: `${formatValue(weekRows.length)} 晚记录`,
      },
      {
        icon: "sleep",
        label: "本月平均睡眠",
        value: formatHours(avg(monthRows, "total_sleep_min")),
        helper: `${formatValue(monthRows.length)} 晚记录`,
      },
      {
        icon: "records",
        label: "本月深睡",
        value: formatMinutes(sum(monthRows, "deep_min")),
        helper: "深睡阶段累计",
      },
      {
        icon: "heart",
        label: "呼吸频率",
        value: formatValue(avg(monthRows, "respiratory_rate"), 1),
        unit: "次/分",
        helper: "本月睡眠平均",
      },
    ];
  }

  if (decodedTable === "heart_rate") {
    return [
      { icon: "heart", label: "本周平均", value: formatValue(avg(weekRows, "bpm")), unit: "bpm", helper: `${formatValue(weekRows.length)} 条记录` },
      { icon: "heart", label: "本月平均", value: formatValue(avg(monthRows, "bpm")), unit: "bpm", helper: `${formatValue(monthRows.length)} 条记录` },
      { icon: "activity", label: "本月最高", value: formatValue(max(monthRows, "bpm")), unit: "bpm", helper: "记录到的最高心率" },
      { icon: "records", label: "本月最低", value: formatValue(min(monthRows, "bpm")), unit: "bpm", helper: "记录到的最低心率" },
    ];
  }

  if (decodedTable === "hrv") {
    return [
      { icon: "heart", label: "本周平均", value: formatValue(avg(weekRows, "value_ms"), 1), unit: "ms", helper: `${formatValue(weekRows.length)} 条记录` },
      { icon: "heart", label: "本月平均", value: formatValue(avg(monthRows, "value_ms"), 1), unit: "ms", helper: `${formatValue(monthRows.length)} 条记录` },
      { icon: "activity", label: "本月最高", value: formatValue(max(monthRows, "value_ms"), 1), unit: "ms", helper: "恢复状态参考" },
      { icon: "records", label: "本月记录数", value: formatValue(monthRows.length), unit: "条", helper: "来自 Apple Watch" },
    ];
  }

  if (decodedTable === "blood_oxygen") {
    return [
      { icon: "heart", label: "本周平均", value: formatValue(avg(weekRows, "spo2_pct"), 1), unit: "%", helper: `${formatValue(weekRows.length)} 条记录` },
      { icon: "heart", label: "本月平均", value: formatValue(avg(monthRows, "spo2_pct"), 1), unit: "%", helper: `${formatValue(monthRows.length)} 条记录` },
      { icon: "records", label: "本月最低", value: formatValue(min(monthRows, "spo2_pct"), 1), unit: "%", helper: "用于观察稳定性" },
      { icon: "activity", label: "本月最高", value: formatValue(max(monthRows, "spo2_pct"), 1), unit: "%", helper: "用于观察稳定性" },
    ];
  }

  const metricNames = new Set(rows.map((row) => String(row.metric_name ?? "")).filter(Boolean));
  return [
    { icon: "records", label: "本周记录", value: formatValue(weekRows.length), unit: "条", helper: "最近 7 天所在自然周" },
    { icon: "records", label: "本月记录", value: formatValue(monthRows.length), unit: "条", helper: "当前自然月" },
    { icon: "activity", label: "指标种类", value: formatValue(metricNames.size), unit: "类", helper: Array.from(metricNames).slice(0, 3).join("、") || "暂无分类" },
    { icon: "heart", label: "本月平均值", value: formatValue(avg(monthRows, "value"), 1), helper: "不同指标仅作快速浏览" },
  ];
}

function recordCards(decodedTable: string, rows: RawRow[]): RecordCard[] {
  return rows.slice(0, 12).map((row) => {
    if (decodedTable === "workouts") {
      const maxHr = numeric(row, "max_hr");
      return {
        icon: "workout",
        title: workoutLabel(String(row.sport_type ?? "")),
        value: formatValue(numeric(row, "duration_min"), 1),
        unit: "分钟",
        meta: `${zhTime(String(row.start_time ?? ""))} 开始`,
        details: [
          `${formatValue(numeric(row, "calories"), 1)} kcal`,
          maxHr === null ? "最高心率暂无" : `最高 ${formatValue(maxHr)} bpm`,
        ],
      };
    }

    if (decodedTable === "daily_activity") {
      return {
        icon: "activity",
        title: String(row.date ?? "每日活动"),
        value: formatValue(numeric(row, "steps")),
        unit: "步",
        meta: `${formatMinutes(numeric(row, "active_minutes"))} 活动`,
        details: [
          `${formatKm(numeric(row, "distance_m"))}`,
          `${formatHours(numeric(row, "stand_minutes"))} 站立`,
          `${formatValue(numeric(row, "active_calories"))} kcal`,
        ],
      };
    }

    if (decodedTable === "sleep_sessions") {
      return {
        icon: "sleep",
        title: "睡眠记录",
        value: formatHours(numeric(row, "total_sleep_min")),
        meta: `${zhTime(String(row.start_time ?? ""))} - ${zhTime(String(row.end_time ?? ""))}`,
        details: [
          `深睡 ${formatMinutes(numeric(row, "deep_min"))}`,
          `REM ${formatMinutes(numeric(row, "rem_min"))}`,
          `呼吸 ${formatValue(numeric(row, "respiratory_rate"), 1)} 次/分`,
        ],
      };
    }

    if (decodedTable === "heart_rate") {
      return {
        icon: "heart",
        title: zhTime(String(row.time ?? "")),
        value: formatValue(numeric(row, "bpm")),
        unit: "bpm",
        meta: String(row.context ?? "心率记录"),
        details: [String(row.source_id ?? "本机同步")],
      };
    }

    if (decodedTable === "hrv") {
      return {
        icon: "heart",
        title: zhTime(String(row.time ?? "")),
        value: formatValue(numeric(row, "value_ms"), 1),
        unit: "ms",
        meta: String(row.context ?? "HRV 记录"),
        details: [String(row.source_id ?? "本机同步")],
      };
    }

    if (decodedTable === "blood_oxygen") {
      return {
        icon: "heart",
        title: zhTime(String(row.time ?? "")),
        value: formatValue(numeric(row, "spo2_pct"), 1),
        unit: "%",
        meta: String(row.context ?? "血氧记录"),
        details: [String(row.source_id ?? "本机同步")],
      };
    }

    return {
      icon: "records",
      title: String(row.metric_name ?? row.date ?? row.time ?? "同步记录"),
      value: formatValue(numeric(row, "value"), 1),
      unit: String(row.unit ?? ""),
      meta: zhTime(String(row.time ?? row.date ?? "")),
      details: [String(row.source_id ?? "本机同步")],
    };
  });
}

export default async function AppleRawTablePage({ params }: PageProps) {
  const { table } = await params;
  const decodedTable = decodeURIComponent(table);
  const spec = RAW_TABLES[decodedTable];
  if (!spec) notFound();

  const detail = await safeAppleRawDetail(decodedTable, 200);
  const columns = detail?.columns ?? [];
  const rows = detail?.rows ?? [];
  const now = new Date();
  const weekRows = rowsSince(rows, startOfWeek(now), now);
  const monthRows = rowsSince(rows, startOfMonth(now), now);
  const cards = summaryCards(decodedTable, rows, weekRows, monthRows);
  const records = recordCards(decodedTable, rows);

  return (
    <>
      <section className="apple-detail-hero">
        <div>
          <Link href="/apple" className="apple-back-link">
            返回健康概览
          </Link>
          <div className="hero-eyebrow">同步明细</div>
          <h2>{spec.label}</h2>
          <p>{spec.description}</p>
        </div>
        <div className="apple-hero-badges">
          <span className="apple-badge">{decodedTable}</span>
          <span className="apple-badge good">{rows.length.toLocaleString("zh-CN")} 条</span>
        </div>
      </section>

      <section className="apple-panel apple-period-overview">
        <div className="apple-panel-head">
          <div>
            <h3>总体情况</h3>
            <p>按本周和本月汇总，先看结论，再看明细。</p>
          </div>
        </div>
        <div className="apple-period-grid four">
          {cards.map((card) => (
            <article className="apple-period-card compact" key={`${card.label}-${card.value}`}>
              <RawIcon name={card.icon} />
              <div>
                <span>{card.label}</span>
                <strong>
                  {card.value}
                  {card.unit && <small>{card.unit}</small>}
                </strong>
                <p>{card.helper}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="apple-panel">
        <div className="apple-panel-head">
          <div>
            <h3>最近记录</h3>
            <p>最近 12 条以卡片展示；需要核对字段时可以展开表格。</p>
          </div>
        </div>
        <div className="apple-record-grid raw">
          {records.map((record, index) => (
            <article className="apple-record-card" key={`${record.title}-${index}`}>
              <RawIcon name={record.icon} />
              <div>
                <span>{record.title}</span>
                <strong>
                  {record.value}
                  {record.unit && <small>{record.unit}</small>}
                </strong>
                <p>{record.meta}</p>
                <div className="apple-record-tags">
                  {record.details.map((detailText) => (
                    <em key={detailText}>{detailText}</em>
                  ))}
                </div>
              </div>
            </article>
          ))}
          {!records.length && <div className="apple-empty-chart compact">暂无最近记录</div>}
        </div>

        <details className="apple-disclosure">
          <summary>查看表格明细</summary>
        <div className="apple-table-wrap">
          <table className="apple-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{COLUMN_LABELS[column] ?? column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  {columns.map((column) => (
                    <td key={column}>{formatCell(column, row[column])}</td>
                  ))}
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={Math.max(1, columns.length)}>暂无明细数据。</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </details>
      </section>
    </>
  );
}
