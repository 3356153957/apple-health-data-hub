"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";

import { AppleCategoryIcon, type AppleIconName } from "../appleHealth";

export type AssistantTone = "good" | "warn" | "neutral";

export type AssistantAnswer = {
  question: string;
  answer: string;
  evidence: string[];
  href: string;
  tone: AssistantTone;
  icon: Extract<AppleIconName, "activity" | "sleep" | "recovery" | "cardio">;
};

function scoreQuestion(answer: AssistantAnswer, text: string): number {
  const haystack = `${answer.question} ${answer.answer} ${answer.evidence.join(" ")}`;
  return text
    .split(/\s+/)
    .filter(Boolean)
    .reduce((score, word) => score + (haystack.includes(word) ? 1 : 0), 0);
}

function keywordAnswer(answers: AssistantAnswer[], text: string): AssistantAnswer | null {
  const normalized = text.trim();
  if (!normalized) return null;
  const direct = [
    { keys: ["睡", "恢复", "累", "训练", "强度"], icon: "recovery" },
    { keys: ["步", "活动", "站立", "久坐"], icon: "activity" },
    { keys: ["呼吸", "HRV", "心率", "夜间"], icon: "sleep" },
    { keys: ["实验", "尝试", "习惯", "咖啡"], icon: "cardio" },
  ];
  const matchedIcon = direct.find((group) => group.keys.some((key) => normalized.includes(key)))?.icon;
  const byIcon = matchedIcon ? answers.find((answer) => answer.icon === matchedIcon) : null;
  if (byIcon) return byIcon;
  return [...answers].sort((a, b) => scoreQuestion(b, normalized) - scoreQuestion(a, normalized))[0] ?? null;
}

const QUICK_PROMPTS = [
  "我今天适合训练吗？",
  "今晚应该优先补睡眠吗？",
  "我下周先补步数还是训练？",
  "呼吸次数变高要怎么处理？",
];

export function HealthAssistantPanel({ answers }: { answers: AssistantAnswer[] }) {
  const firstQuestion = answers[0]?.question ?? "";
  const [selectedQuestion, setSelectedQuestion] = useState(firstQuestion);
  const [draft, setDraft] = useState("");
  const [asked, setAsked] = useState(firstQuestion);
  const [history, setHistory] = useState<string[]>(firstQuestion ? [firstQuestion] : []);

  const selected = useMemo(
    () => answers.find((answer) => answer.question === selectedQuestion) ?? answers[0] ?? null,
    [answers, selectedQuestion],
  );

  const current = useMemo(() => keywordAnswer(answers, asked) ?? selected, [answers, asked, selected]);
  const hasCustomQuestion = asked.trim() && asked !== current?.question;

  function choose(answer: AssistantAnswer) {
    setSelectedQuestion(answer.question);
    setAsked(answer.question);
    setDraft("");
    setHistory((items) => [answer.question, ...items.filter((item) => item !== answer.question)].slice(0, 4));
  }

  function ask(value: string) {
    const question = value.trim();
    if (!question) return;
    const match = keywordAnswer(answers, question);
    if (match) setSelectedQuestion(match.question);
    setAsked(question);
    setDraft("");
    setHistory((items) => [question, ...items.filter((item) => item !== question)].slice(0, 4));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    ask(draft);
  }

  if (!current) {
    return (
      <section className="health-chat-panel">
        <p>同步更多记录后，这里会生成可回答的问题。</p>
      </section>
    );
  }

  return (
    <section className="health-chat-panel" aria-label="健康问答助手">
      <div className="health-chat-copy">
        <span>健康问答</span>
        <strong>问一个具体问题，先得到可执行回答</strong>
        <p>当前版本先基于你的健康记录做快速判断，不上传额外内容，也不替代医生诊断。</p>
      </div>

      <form className="health-chat-form" onSubmit={submit}>
        <input
          aria-label="输入健康问题"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="例如：我今天适合训练吗？"
        />
        <button type="submit">提问</button>
      </form>

      <div className="health-chat-suggestions" aria-label="常见问题">
        {answers.map((answer) => (
          <button
            type="button"
            className={answer.question === current.question ? "active" : ""}
            aria-pressed={answer.question === current.question}
            onClick={() => choose(answer)}
            key={answer.question}
          >
            {answer.question}
          </button>
        ))}
      </div>

      <div className="health-chat-prompts" aria-label="快捷提问">
        {QUICK_PROMPTS.map((prompt) => (
          <button type="button" onClick={() => ask(prompt)} key={prompt}>
            {prompt}
          </button>
        ))}
      </div>

      <div className="health-chat-window">
        <div className="health-chat-bubble user">
          <span>你的问题</span>
          <p>{asked || current.question}</p>
        </div>
        <div className={`health-chat-bubble assistant ${current.tone}`}>
          <AppleCategoryIcon name={current.icon} />
          <div>
            <span>{hasCustomQuestion ? "已匹配到最接近的问题" : "回答"}</span>
            <strong>{current.question}</strong>
            <p>{current.answer}</p>
            <div className="health-answer-evidence">
              {current.evidence.map((item) => (
                <em key={item}>{item}</em>
              ))}
            </div>
            <Link href={current.href}>查看相关记录</Link>
          </div>
        </div>
      </div>

      <div className="health-chat-history" aria-live="polite">
        <span>最近提问</span>
        {history.map((item) => (
          <button type="button" onClick={() => ask(item)} key={item}>
            {item}
          </button>
        ))}
      </div>
    </section>
  );
}
