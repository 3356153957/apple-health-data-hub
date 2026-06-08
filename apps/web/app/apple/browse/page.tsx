import Link from "next/link";
import type { Metadata } from "next";

import type { AppleStatus } from "../../lib/api";
import { safeAppleStatus } from "../../lib/load";
import {
  APPLE_METRICS,
  AppleCategoryIcon,
  BROWSE_CATEGORIES,
  RAW_TABLES,
  relativeZh,
  zhTime,
} from "../appleHealth";

export const metadata: Metadata = { title: "浏览 · HealthSave" };
export const dynamic = "force-dynamic";

function rawNewest(status: AppleStatus | null, tables?: string[]): string | null {
  const rows = tables?.length
    ? tables.map((table) => status?.[table]).filter(Boolean)
    : Object.values(status ?? {});
  const newest = rows
    .map((row) => row?.newest)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  return newest[0] ?? null;
}

function rawTotal(status: AppleStatus | null, tables?: string[]): number {
  const rows = tables?.length
    ? tables.map((table) => status?.[table]).filter(Boolean)
    : Object.values(status ?? {});
  return rows.reduce((sum, row) => sum + (row?.count ?? 0), 0);
}

function metricLabels(metricIds: string[]): string[] {
  return metricIds
    .map((id) => APPLE_METRICS.find((metric) => metric.id === id)?.label)
    .filter((label): label is string => Boolean(label))
    .slice(0, 4);
}

export default async function AppleBrowsePage() {
  const status = await safeAppleStatus();
  const userCategories = BROWSE_CATEGORIES.filter((category) => category.slug !== "data");
  const metricCount = new Set(userCategories.flatMap((category) => category.metricIds)).size;
  const sourceTables = Object.keys(RAW_TABLES);

  return (
    <>
      <section className="apple-detail-hero">
        <div>
          <Link href="/apple" className="apple-back-link">
            返回健康概览
          </Link>
          <div className="hero-eyebrow">浏览</div>
          <h2>按健康分类查看</h2>
          <p>把活动、心脏、睡眠、恢复、身体和心肺数据分开看，先进入分类，再查看具体指标和同步记录。</p>
        </div>
        <div className="apple-hero-badges">
          <span className="apple-badge">{userCategories.length} 个分类</span>
          <span className="apple-badge good">{relativeZh(rawNewest(status))}</span>
        </div>
      </section>

      <section className="apple-kpis">
        <div className="apple-kpi">
          <span>健康分类</span>
          <strong>{userCategories.length}</strong>
          <small>活动、睡眠、恢复等入口</small>
        </div>
        <div className="apple-kpi">
          <span>可查看指标</span>
          <strong>{metricCount}</strong>
          <small>来自 Apple Watch 和 iPhone</small>
        </div>
        <div className="apple-kpi">
          <span>同步记录</span>
          <strong>{rawTotal(status).toLocaleString("zh-CN")}</strong>
          <small>本机 Health Data Hub</small>
        </div>
        <div className="apple-kpi">
          <span>最近同步</span>
          <strong className="compact">{relativeZh(rawNewest(status)).replace("同步", "")}</strong>
          <small>只读取本地数据</small>
        </div>
      </section>

      <section className="apple-panel apple-category-section">
        <div className="apple-panel-head">
          <div>
            <h3>健康分类</h3>
            <p>按 Apple 健康的浏览方式，把相关指标和记录放在同一个入口下。</p>
          </div>
        </div>
        <div className="apple-browse-list">
          {userCategories.map((category) => {
            const newest = rawNewest(status, category.rawTables);
            const labels = metricLabels(category.metricIds);
            return (
              <Link className="apple-browse-row" href={`/apple/categories/${category.slug}`} key={category.slug}>
                <AppleCategoryIcon name={category.icon} />
                <div>
                  <span>{category.title}</span>
                  <strong>{category.subtitle}</strong>
                  <p>{category.description}</p>
                  {!!labels.length && (
                    <div className="apple-browse-tags">
                      {labels.map((label) => (
                        <em key={label}>{label}</em>
                      ))}
                    </div>
                  )}
                </div>
                <small>
                  {rawTotal(status, category.rawTables).toLocaleString("zh-CN")} 条
                  <br />
                  {relativeZh(newest)}
                </small>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="apple-panel apple-category-section">
        <div className="apple-panel-head">
          <div>
            <h3>数据来源</h3>
            <p>需要核对同步是否完整时，再进入原始记录。日常查看优先使用上面的分类和指标详情。</p>
          </div>
        </div>
        <div className="apple-source-grid">
          {sourceTables.map((table) => {
            const row = status?.[table] ?? null;
            return (
              <Link className="apple-source-card" href={`/apple/raw/${encodeURIComponent(table)}`} key={table}>
                <span>{RAW_TABLES[table]?.label ?? table}</span>
                <strong>{(row?.count ?? 0).toLocaleString("zh-CN")}</strong>
                <small>{row?.newest ? `最近：${zhTime(row.newest)}` : "暂无同步记录"}</small>
                <p>{RAW_TABLES[table]?.description ?? "同步数据明细。"}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
