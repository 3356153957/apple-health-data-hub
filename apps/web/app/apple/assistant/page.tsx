import Link from "next/link";
import type { Metadata } from "next";

import type { AppleDailySummary, MetricSeries } from "../../lib/api";
import { safeAppleDailySummary, safeCandidates, safeSeries } from "../../lib/load";
import {
  APPLE_METRICS,
  AppleCategoryIcon,
  formatHours,
  formatRespiratoryRate,
  formatValue,
  latestValue,
  metricSeriesValues,
  recentTrend,
  trendTone,
} from "../appleHealth";

export const metadata: Metadata = { title: "健康问答 · 健康" };
export const dynamic = "force-dynamic";

type Tone = "good" | "warn" | "neutral";

type AnswerCard = {
  question: string;
  answer: string;
  evidence: string[];
  href: string;
  tone: Tone;
  icon: "activity" | "sleep" | "recovery" | "cardio";
};

const ASSISTANT_METRICS = [
  "vital.hrv_sdnn",
  "vital.resting_heart_rate",
  "vital.respiratory_rate",
  "activity.steps",
  "activity.active_energy",
  "activity.stand_minutes",
];

function metricById(metricId: string) {
  return APPLE_METRICS.find((metric) => metric.id === metricId) ?? null;
}

function metricTrend(seriesList: Array<MetricSeries | null>, metricId: string) {
  const index = ASSISTANT_METRICS.indexOf(metricId);
  const metric = metricById(metricId);
  if (!metric || index < 0) return null;
  const nums = metricSeriesValues(metric, seriesList[index]);
  const trend = recentTrend(nums);
  return {
    metric,
    latest: nums.length ? nums[nums.length - 1] : latestValue(seriesList[index]),
    pct: trend.pct,
    tone: trendTone(metric, trend.delta) as Tone,
  };
}

function sleepAnswer(summary: AppleDailySummary | null, hrv: ReturnType<typeof metricTrend>): AnswerCard {
  const sleep = summary?.sleep ?? null;
  const lowSleep = sleep?.total_sleep_min !== null && sleep?.total_sleep_min !== undefined && sleep.total_sleep_min < 360;
  const hrvDown = hrv?.pct !== null && hrv?.pct !== undefined && hrv.pct < -5;
  return {
    question: "今天应该正常训练，还是先恢复？",
    answer: lowSleep || hrvDown
      ? "今天建议把恢复放在前面。可以保留轻活动，但高强度训练、熬夜和连续加量都先缓一缓。"
      : "今天可以按正常节奏安排。训练后继续看睡眠、HRV 和静息心率，避免连续几天堆强度。",
    evidence: [
      `昨夜睡眠：${formatHours(sleep?.total_sleep_min)}`,
      `睡眠呼吸：${formatRespiratoryRate(sleep?.respiratory_rate)}`,
      `HRV 趋势：${hrv?.pct === null || hrv?.pct === undefined ? "暂无明显趋势" : `${hrv.pct >= 0 ? "上升" : "下降"} ${formatValue(Math.abs(hrv.pct), 1)}%`}`,
    ],
    href: "/apple/daily",
    tone: lowSleep || hrvDown ? "warn" : "good",
    icon: "recovery",
  };
}

function activityAnswer(summary: AppleDailySummary | null): AnswerCard {
  const activity = summary?.activity ?? null;
  const lowActivity = (activity?.steps ?? 0) < 5000 && (activity?.active_minutes ?? 0) < 30;
  return {
    question: "我下一个最该补什么？",
    answer: lowActivity
      ? "优先补基础活动量。先做 20-30 分钟快走、骑行或轻力量，比直接加高强度训练更稳。"
      : "基础活动不算拖后腿。下一步更适合看睡眠和训练负荷，避免只追步数。",
    evidence: [
      `昨日步数：${formatValue(activity?.steps)} 步`,
      `活动分钟：${formatValue(activity?.active_minutes)} 分钟`,
      `站立时间：${formatHours(activity?.stand_minutes)}`,
    ],
    href: "/apple/goals",
    tone: lowActivity ? "warn" : "good",
    icon: "activity",
  };
}

function breathingAnswer(respiration: ReturnType<typeof metricTrend>, hrv: ReturnType<typeof metricTrend>): AnswerCard {
  const changed = respiration?.pct !== null && respiration?.pct !== undefined && Math.abs(respiration.pct) > 8;
  return {
    question: "呼吸次数变化需要担心吗？",
    answer: changed
      ? "它值得关注，但不应单独下结论。先和睡眠时长、HRV、当天疲劳感一起看；如果连续多晚异常，再降低训练强度并继续观察。"
      : "目前呼吸次数没有显示出很强的单独信号。它更适合和睡眠质量、HRV 一起判断恢复。",
    evidence: [
      `呼吸次数：${formatValue(respiration?.latest, respiration?.metric.digits ?? 1)} 次/分`,
      `30 天变化：${respiration?.pct === null || respiration?.pct === undefined ? "暂无明显趋势" : `${respiration.pct >= 0 ? "上升" : "下降"} ${formatValue(Math.abs(respiration.pct), 1)}%`}`,
      `HRV：${formatValue(hrv?.latest, hrv?.metric.digits ?? 1)} ms`,
    ],
    href: "/apple/metrics/respiratory-rate",
    tone: changed ? "warn" : "neutral",
    icon: "sleep",
  };
}

function experimentAnswer(testableCount: number): AnswerCard {
  return {
    question: "我应该从哪个个人实验开始？",
    answer: testableCount > 0
      ? "从一个最容易执行的习惯开始。每次只改一个变量，连续观察，结果才有解释价值。"
      : "先继续同步几天数据。等记录覆盖更多睡眠、活动和恢复指标后，再开始实验更可靠。",
    evidence: [
      `可开始尝试：${testableCount} 个`,
      "建议周期：至少连续几天",
      "观察重点：睡眠、活动、HRV、呼吸次数",
    ],
    href: "/experiments",
    tone: testableCount > 0 ? "good" : "neutral",
    icon: "cardio",
  };
}

export default async function AppleAssistantPage() {
  const [summary, candidates, seriesList] = await Promise.all([
    safeAppleDailySummary(),
    safeCandidates(),
    Promise.all(ASSISTANT_METRICS.map((metricId) => safeSeries(metricId, "30d"))),
  ]);
  const hrv = metricTrend(seriesList, "vital.hrv_sdnn");
  const respiration = metricTrend(seriesList, "vital.respiratory_rate");
  const answers = [
    sleepAnswer(summary, hrv),
    activityAnswer(summary),
    breathingAnswer(respiration, hrv),
    experimentAnswer(candidates?.testable_count ?? 0),
  ];
  const warningCount = answers.filter((answer) => answer.tone === "warn").length;

  return (
    <>
      <section className={`apple-detail-hero health-assistant-hero ${warningCount ? "" : "good"}`}>
        <div>
          <Link href="/apple" className="apple-back-link">
            返回健康概览
          </Link>
          <div className="hero-eyebrow">健康问答</div>
          <h2>{warningCount ? "先回答最影响今天安排的问题" : "当前状态适合稳定推进"}</h2>
          <p>
            用你已经同步的运动、睡眠和恢复记录，先给出能执行的回答。这里只做日常健康决策支持，不替代医学诊断。
          </p>
        </div>
        <div className="apple-hero-badges">
          <span className="apple-badge">{answers.length} 个常见问题</span>
          <span className={`apple-badge ${warningCount ? "" : "good"}`}>{warningCount ? `${warningCount} 个需关注` : "暂无优先提醒"}</span>
        </div>
      </section>

      <section className="health-answer-grid">
        {answers.map((item) => (
          <Link className={`health-answer-card ${item.tone}`} href={item.href} key={item.question}>
            <AppleCategoryIcon name={item.icon} />
            <div>
              <span>可以这样问</span>
              <strong>{item.question}</strong>
              <p>{item.answer}</p>
              <div className="health-answer-evidence">
                {item.evidence.map((evidence) => (
                  <em key={evidence}>{evidence}</em>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </section>

      <section className="apple-two-col">
        <article className="apple-panel health-assistant-script">
          <div className="apple-panel-head">
            <div>
              <h3>更好的提问方式</h3>
              <p>越具体，答案越能变成行动。</p>
            </div>
          </div>
          <div className="health-question-grid compact">
            {[
              "这周睡眠减少时，HRV 是否也下降？",
              "我今天应该补步数还是补睡眠？",
              "站立时间少和当天训练有没有关系？",
              "呼吸次数变高时，第二天运动状态有没有变化？",
            ].map((question) => (
              <span key={question}>{question}</span>
            ))}
          </div>
        </article>

        <article className="apple-panel health-assistant-script">
          <div className="apple-panel-head">
            <div>
              <h3>下一步会升级什么</h3>
              <p>先把答案做准，再做真正的对话。</p>
            </div>
          </div>
          <div className="health-lab-steps small">
            <article>
              <span>1</span>
              <strong>引用具体日期</strong>
              <p>回答时直接指出是哪几天影响了判断。</p>
            </article>
            <article>
              <span>2</span>
              <strong>关联个人实验</strong>
              <p>把回答直接转成一次可跟踪的习惯尝试。</p>
            </article>
            <article>
              <span>3</span>
              <strong>接入更多来源</strong>
              <p>把体重、饮食、心情和学习压力加入判断。</p>
            </article>
          </div>
        </article>
      </section>
    </>
  );
}
