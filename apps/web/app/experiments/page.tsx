import type { Metadata } from "next";
import Link from "next/link";

import { ExperimentsCard } from "../components/ExperimentsCard";
import { safeCandidates, safeExperiments } from "../lib/load";

export const metadata: Metadata = { title: "健康尝试 · 健康" };
export const dynamic = "force-dynamic";

export default async function ExperimentsPage() {
  const [experiments, candidates] = await Promise.all([safeExperiments(), safeCandidates()]);
  const running = experiments?.experiments.filter((item) => item.status === "collecting").length ?? 0;
  const completed = experiments?.experiments.filter((item) => item.status === "completed").length ?? 0;
  const startable = candidates?.testable_count ?? 0;
  const totalIdeas = candidates?.count ?? 0;

  return (
    <>
      <section className="apple-detail-hero health-lab-hero">
        <div>
          <Link href="/apple/coach" className="apple-back-link">
            返回健康教练
          </Link>
          <div className="hero-eyebrow">个人实验</div>
          <h2>把健康建议变成可验证的尝试</h2>
          <p>
            这里不是泛泛地告诉你“多睡、多运动”。它会从你的 Apple Watch 记录里挑出可以验证的习惯问题，例如睡眠、活动、训练和恢复之间的关系。
          </p>
        </div>
        <div className="apple-hero-badges">
          <span className="apple-badge good">{running} 个观察中</span>
          <span className="apple-badge">{startable} 个可开始</span>
        </div>
      </section>

      <section className="apple-kpis">
        <Link className="apple-kpi clickable" href="/experiments">
          <span>正在观察</span>
          <strong>{running}</strong>
          <small>按天跟踪习惯变化</small>
        </Link>
        <Link className="apple-kpi clickable" href="/apple/assistant">
          <span>健康问答</span>
          <strong>{totalIdeas}</strong>
          <small>可讨论的观察方向</small>
        </Link>
        <Link className="apple-kpi clickable" href="/apple/report">
          <span>已完成</span>
          <strong>{completed}</strong>
          <small>可进入周报复盘</small>
        </Link>
        <Link className="apple-kpi clickable" href="/apple/goals">
          <span>目标闭环</span>
          <strong>{startable}</strong>
          <small>从目标差距选择尝试</small>
        </Link>
      </section>

      <section className="health-lab-grid">
        <ExperimentsCard experiments={experiments} candidates={candidates} />

        <aside className="apple-panel health-lab-guide">
          <div className="apple-panel-head">
            <div>
              <h3>怎么做才靠谱</h3>
              <p>每次只改一个变量，持续记录，再看结果。</p>
            </div>
          </div>
          <div className="health-lab-steps">
            <article>
              <span>1</span>
              <strong>选一个问题</strong>
              <p>例如“睡得更早是否改善 HRV”或“晚间训练是否影响睡眠”。</p>
            </article>
            <article>
              <span>2</span>
              <strong>连续执行</strong>
              <p>保持 Apple Watch 佩戴和同步，实验期内尽量少改其他习惯。</p>
            </article>
            <article>
              <span>3</span>
              <strong>看结果再调整</strong>
              <p>结果只用于个人习惯优化，不把单次波动当成结论。</p>
            </article>
          </div>
          <Link href="/apple/assistant" className="health-lab-question-link">
            不知道先试什么？打开健康问答
          </Link>
        </aside>
      </section>

      <section className="apple-panel health-question-bank">
        <div className="apple-panel-head">
          <div>
            <h3>适合先问的问题</h3>
            <p>这些问题比“我健康吗”更容易得到可执行答案。</p>
          </div>
        </div>
        <div className="health-question-grid">
          {[
            ["最近睡眠少的时候，我第二天活动量是不是也下降？", "/apple/assistant"],
            ["站立时间少，是因为上课久坐还是运动少？", "/apple/metrics/stand-time"],
            ["呼吸次数变化时，睡眠时长和 HRV 有没有一起变化？", "/apple/metrics/respiratory-rate"],
            ["下周我应该先补睡眠、步数，还是训练？", "/apple/report"],
          ].map(([question, href]) => (
            <Link href={href} key={question}>
              {question}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
