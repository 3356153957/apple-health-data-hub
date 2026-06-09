import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { safeAppleRawDetail } from "../../../lib/load";
import { RAW_TABLES, formatHours, formatRespiratoryRate, formatValue, workoutLabel, zhTime } from "../../appleHealth";

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
  stand_hours: "站立圆环小时",
  stand_minutes: "站立时间",
  total_sleep_min: "睡眠分钟",
  awake_min: "清醒",
  core_min: "核心",
  deep_min: "深睡",
  rem_min: "REM",
  respiratory_rate: "呼吸次数",
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
  href?: string;
};

type TableNotice = {
  icon: IconName;
  title: string;
  body: string;
  href: string;
  action: string;
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

const METRIC_LABELS: Record<string, string> = {
  apple_stand_time: "站立时间",
  respiratory_rate: "呼吸次数",
  resting_heart_rate: "静息心率",
  walking_heart_rate_average: "步行心率",
  wrist_temperature: "腕温",
  vo2_max: "VO2 max",
};

const UNIT_LABELS: Record<string, string> = {
  "breaths/min": "次/分",
  count: "次",
  kcal: "kcal",
  m: "m",
  min: "分钟",
  ms: "ms",
  bpm: "bpm",
  "%": "%",
  "ml/kg/min": "ml/kg/min",
  "degC": "°C",
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
  return { title: `${spec?.label ?? "记录详情"} · 健康` };
}

function formatCell(key: string, value: string | number | null): string {
  if (value === null || value === undefined || value === "") return "暂无";
  if (key.includes("time")) return zhTime(String(value));
  if (key === "date") return String(value);
  if (key === "sport_type") return workoutLabel(String(value));
  if (key === "metric_name") return metricLabel(String(value));
  if (key === "unit") return unitLabel(String(value));
  if (key === "source_id") return sourceLabel(String(value));
  if (typeof value === "number") {
    const digits = Number.isInteger(value) ? 0 : 1;
    return formatValue(value, digits);
  }
  return String(value);
}

function numeric(row: RawRow, key: string): number | null {
  const value = row[key];
  if (value === null || value === undefined || value === "") return null;
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

function localDateKeyFromDate(date: Date | null): string | null {
  if (!date) return null;
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

function rowDayHref(row: RawRow): string | undefined {
  const dateKey = localDateKeyFromDate(rowDate(row));
  return dateKey ? `/apple/days/${encodeURIComponent(dateKey)}` : undefined;
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

function metricLabel(value: string | null | undefined): string {
  if (!value) return "健康指标";
  return METRIC_LABELS[value] ?? value.replaceAll("_", " ");
}

function unitLabel(value: string | null | undefined): string {
  if (!value) return "";
  return UNIT_LABELS[value] ?? value;
}

function sourceLabel(value: string | null | undefined): string {
  if (!value) return "已同步";
  if (value === "apple-health-healthsave") return "Apple 健康同步";
  return value;
}

function valueDigits(unit: string | null | undefined): number {
  const normalized = unitLabel(unit);
  if (normalized === "°C" || normalized === "ml/kg/min") return 1;
  if (normalized === "次/分") return 1;
  return 0;
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
        label: "呼吸次数",
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

  const metricNames = new Set(rows.map((row) => metricLabel(String(row.metric_name ?? ""))).filter((value) => value !== "健康指标"));
  const latestRow = rows[0];
  const latestUnit = latestRow ? unitLabel(String(latestRow.unit ?? "")) : "";
  const latestMetric = latestRow ? metricLabel(String(latestRow.metric_name ?? "")) : "健康指标";
  return [
    { icon: "records", label: "本周记录", value: formatValue(weekRows.length), unit: "条", helper: "当前自然周" },
    { icon: "records", label: "本月记录", value: formatValue(monthRows.length), unit: "条", helper: "当前自然月" },
    { icon: "activity", label: "指标种类", value: formatValue(metricNames.size), unit: "类", helper: Array.from(metricNames).slice(0, 3).join("、") || "暂无分类" },
    {
      icon: "heart",
      label: "最近记录",
      value: formatValue(numeric(latestRow ?? {}, "value"), valueDigits(latestUnit)),
      unit: latestUnit,
      helper: latestMetric,
    },
  ];
}

function recordCards(decodedTable: string, rows: RawRow[]): RecordCard[] {
  return rows.slice(0, 12).map((row) => {
    if (decodedTable === "workouts") {
      const maxHr = numeric(row, "max_hr");
      const calories = numeric(row, "calories");
      return {
        icon: "workout",
        title: workoutLabel(String(row.sport_type ?? "")),
        value: formatValue(numeric(row, "duration_min"), 1),
        unit: "分钟",
        meta: `${zhTime(String(row.start_time ?? ""))} 开始`,
        details: [
          calories === null ? "训练能量未记录" : `${formatValue(calories, 1)} kcal`,
          maxHr === null ? "最高心率未记录" : `最高 ${formatValue(maxHr)} bpm`,
        ],
        href: rowDayHref(row),
      };
    }

    if (decodedTable === "daily_activity") {
      const activeMinutes = numeric(row, "active_minutes");
      const distance = numeric(row, "distance_m");
      const standMinutes = numeric(row, "stand_minutes");
      const activeCalories = numeric(row, "active_calories");
      return {
        icon: "activity",
        title: String(row.date ?? "每日活动"),
        value: formatValue(numeric(row, "steps")),
        unit: "步",
        meta: activeMinutes === null ? "活动分钟未记录" : `${formatMinutes(activeMinutes)} 活动`,
        details: [
          distance === null ? "距离未记录" : `${formatKm(distance)} 距离`,
          standMinutes === null ? "站立时间未记录" : `${formatHours(standMinutes)} 站立`,
          activeCalories === null ? "活动能量未记录" : `${formatValue(activeCalories)} kcal`,
        ],
        href: rowDayHref(row),
      };
    }

    if (decodedTable === "sleep_sessions") {
      const dateKey = localDateKeyFromDate(rowDate(row));
      const deepMin = numeric(row, "deep_min");
      const remMin = numeric(row, "rem_min");
      const respiratoryRate = numeric(row, "respiratory_rate");
      return {
        icon: "sleep",
        title: dateKey ?? "睡眠记录",
        value: formatHours(numeric(row, "total_sleep_min")),
        meta: `${zhTime(String(row.start_time ?? ""))} - ${zhTime(String(row.end_time ?? ""))}`,
        details: [
          deepMin === null ? "深睡未记录" : `深睡 ${formatMinutes(deepMin)}`,
          remMin === null ? "REM 未记录" : `REM ${formatMinutes(remMin)}`,
          respiratoryRate === null ? "呼吸未记录" : `呼吸 ${formatRespiratoryRate(respiratoryRate)}`,
        ],
        href: rowDayHref(row),
      };
    }

    if (decodedTable === "heart_rate") {
      return {
        icon: "heart",
        title: zhTime(String(row.time ?? "")),
        value: formatValue(numeric(row, "bpm")),
        unit: "bpm",
        meta: String(row.context ?? "心率记录"),
        details: [sourceLabel(String(row.source_id ?? ""))],
      };
    }

    if (decodedTable === "hrv") {
      return {
        icon: "heart",
        title: zhTime(String(row.time ?? "")),
        value: formatValue(numeric(row, "value_ms"), 1),
        unit: "ms",
        meta: String(row.context ?? "HRV 记录"),
        details: [sourceLabel(String(row.source_id ?? ""))],
      };
    }

    if (decodedTable === "blood_oxygen") {
      return {
        icon: "heart",
        title: zhTime(String(row.time ?? "")),
        value: formatValue(numeric(row, "spo2_pct"), 1),
        unit: "%",
        meta: String(row.context ?? "血氧记录"),
        details: [sourceLabel(String(row.source_id ?? ""))],
      };
    }

    const rawUnit = String(row.unit ?? "");
    return {
      icon: "records",
      title: metricLabel(String(row.metric_name ?? "")),
      value: formatValue(numeric(row, "value"), valueDigits(rawUnit)),
      unit: unitLabel(rawUnit),
      meta: zhTime(String(row.time ?? row.date ?? "")),
      details: [sourceLabel(String(row.source_id ?? ""))],
    };
  });
}

function tableNotice(decodedTable: string, rows: RawRow[]): TableNotice | null {
  if (decodedTable === "daily_activity") {
    const latestRow = rows[0];
    const hasStandMinutes = rows.some((row) => numeric(row, "stand_minutes") !== null);
    const hasStandHours = latestRow ? numeric(latestRow, "stand_hours") !== null : false;
    return {
      icon: "activity",
      title: hasStandHours ? "站立数据已同步" : "站立时间按分钟展示",
      body: hasStandHours
        ? "这里同时保留 Apple 站立圆环小时和 Apple Watch 站立时间。趋势页会优先使用更细的站立分钟。"
        : hasStandMinutes
          ? "Apple Watch 当前同步到了站立时间分钟数；健身圆环里的站立圆环小时是另一种口径，所以这一列暂时为空。"
          : "这张表还没有站立分钟记录。保持 Apple Watch 佩戴并手动同步一次后，这里会显示站立时间。",
      href: "/apple/metrics/stand-time",
      action: "查看站立时间",
    };
  }

  if (decodedTable === "sleep_sessions") {
    const hasRespiration = rows.some((row) => numeric(row, "respiratory_rate") !== null);
    return {
      icon: "sleep",
      title: hasRespiration ? "呼吸次数来自睡眠期间" : "等待睡眠呼吸记录",
      body: hasRespiration
        ? "呼吸次数通常由 Apple Watch 在睡眠时记录，白天不会像心率一样连续出现。"
        : "这几条睡眠记录里暂时没有呼吸次数；开启睡眠追踪并佩戴 Apple Watch 入睡后会逐步补齐。",
      href: "/apple/metrics/respiratory-rate",
      action: "查看呼吸次数",
    };
  }

  return null;
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
  const notice = tableNotice(decodedTable, rows);

  return (
    <>
      <section className="apple-detail-hero">
        <div>
          <Link href="/apple" className="apple-back-link">
            返回健康概览
          </Link>
          <div className="hero-eyebrow">记录详情</div>
          <h2>{spec.label}</h2>
          <p>{spec.description}</p>
        </div>
        <div className="apple-hero-badges">
          <span className="apple-badge">私密记录</span>
          <span className="apple-badge good">{rows.length.toLocaleString("zh-CN")} 条</span>
        </div>
      </section>

      {notice && (
        <section className="apple-context-note">
          <RawIcon name={notice.icon} />
          <div>
            <strong>{notice.title}</strong>
            <p>{notice.body}</p>
          </div>
          <Link href={notice.href}>{notice.action}</Link>
        </section>
      )}

      <section className="apple-panel apple-period-overview">
        <div className="apple-panel-head">
          <div>
            <h3>总体情况</h3>
            <p>按本周和本月汇总，先看结论，再看详情。</p>
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
            <p>最近 12 条以卡片展示；需要核对更多字段时可以展开详情。</p>
          </div>
        </div>
        <div className="apple-record-grid raw">
          {records.map((record, index) => (
            record.href ? (
              <Link className="apple-record-card clickable" href={record.href} key={`${record.title}-${index}`}>
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
              </Link>
            ) : (
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
            )
          ))}
          {!records.length && <div className="apple-empty-chart compact">暂无最近记录</div>}
        </div>

        <details className="apple-disclosure">
          <summary>查看完整字段</summary>
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
                  <td colSpan={Math.max(1, columns.length)}>暂无详细记录。</td>
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
