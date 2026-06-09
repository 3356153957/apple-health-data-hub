import type { Metadata } from "next";

import { BaselineRibbon } from "../components/BaselineRibbon";
import { LocalVaultReceipt, type VaultStep } from "../components/LocalVaultReceipt";

// A seeded "first 60 seconds" Today — a believable 30-day story with one
// recovery dip, so a fresh clone (or the README screenshot) shows the product
// alive before any real data is synced. Pure fixtures; no API required.

export const metadata: Metadata = { title: "今日演示 · 健康" };

// HRV (ms) over 30 days — steady, then a clear multi-day decline at the end.
const HRV_30D = [
  64, 61, 66, 63, 68, 62, 65, 67, 60, 63, 66, 64, 69, 62, 65, 63, 67, 61, 64, 66, 62, 60, 58, 55,
  52, 49, 47, 45, 44, 46,
];
const HRV_BAND: [number, number] = [55, 71];
const HRV_ANOMALIES = [27, 28];

const CONTRIBUTORS = [
  { name: "HRV", val: "−18%", pct: 78, dir: "down" as const },
  { name: "静息心率", val: "+6 bpm", pct: 54, dir: "down" as const },
  { name: "深睡", val: "−42 分钟", pct: 46, dir: "down" as const },
  { name: "训练负荷", val: "+31%", pct: 33, dir: "down" as const },
];

const VAULT: VaultStep[] = [
  { label: "Apple Watch → 接收", meta: "07:42" },
  { label: "私密健康库", meta: "142 万条记录" },
  { label: "健康分析", meta: "07:45" },
  { label: "本地模型整理", meta: "07:46" },
  { label: "云端出口", meta: "已阻止", blocked: true },
];

const EVIDENCE = [
  {
    title: "HRV 异常",
    calc: "42 ms，对比预期 55-71 ms · z = -2.1",
    conf: "置信度高 · 来自 Apple Watch",
  },
  {
    title: "睡眠结构变化",
    calc: "深睡比 30 天基线少 42 分钟",
    conf: "置信度中等 · 来自 Apple Watch",
  },
  {
    title: "训练负荷升高",
    calc: "两天前比基线高 31%",
    conf: "背景信息 · 来自体能训练",
  },
];

export default function DemoToday() {
  return (
    <>
      <div className="today-grid">
        <section className="hero col-8">
          <div className="hero-eyebrow">今日 · 今天早上</div>
          <div className="recovery">
            <div className="recovery-score">63</div>
            <div className="recovery-state state-caution">需要留意</div>
          </div>
          <p className="recovery-line">
            低于你的个人基线。<strong>三个独立信号指向同一件事</strong>：HRV 下降、
            静息心率上升，深睡减少。
          </p>
          <BaselineRibbon
            values={HRV_30D}
            band={HRV_BAND}
            anomalies={HRV_ANOMALIES}
            axis={["30 天前", "今天"]}
          />
          <ul className="contribs">
            {CONTRIBUTORS.map((c) => (
              <li className="contrib" key={c.name}>
                <span className="contrib-name">{c.name}</span>
                <span className="contrib-track">
                  <span className={`contrib-fill ${c.dir}`} style={{ width: `${c.pct}%` }} />
                </span>
                <span className={`contrib-val ${c.dir}`}>{c.val}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="col-4">
          <LocalVaultReceipt steps={VAULT} />
        </div>

        <section className="card col-12">
          <div className="card-title">证据</div>
          <p className="empty" style={{ margin: "0 0 6px" }}>
            每条发现都来自可追溯计算，而不是凭空猜测。
          </p>
          <div>
            {EVIDENCE.map((e) => (
              <div className="ev-pin" key={e.title}>
                <span className="ev-dot" />
                <div className="ev-body">
                  <div className="ev-title">{e.title}</div>
                  <div className="ev-calc">{e.calc}</div>
                  <div className="ev-conf">{e.conf}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <footer className="foot">演示数据 · 30 天健康故事 · 健康明细不外发</footer>
    </>
  );
}
