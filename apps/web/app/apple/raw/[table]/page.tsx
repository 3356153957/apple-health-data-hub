import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { safeAppleRawDetail } from "../../../lib/load";
import { RAW_TABLES, formatValue, workoutLabel, zhTime } from "../../appleHealth";

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

export default async function AppleRawTablePage({ params }: PageProps) {
  const { table } = await params;
  const decodedTable = decodeURIComponent(table);
  const spec = RAW_TABLES[decodedTable];
  if (!spec) notFound();

  const detail = await safeAppleRawDetail(decodedTable, 200);
  const columns = detail?.columns ?? [];
  const rows = detail?.rows ?? [];

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

      <section className="apple-panel">
        <div className="apple-panel-head">
          <div>
            <h3>最近同步记录</h3>
            <p>最多显示最近 200 条。数据来自本机 Health Data Hub。</p>
          </div>
        </div>
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
      </section>
    </>
  );
}
