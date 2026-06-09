import type { Metadata } from "next";

import { UnlockForm } from "./UnlockForm";

export const metadata: Metadata = { title: "访问验证 · 健康" };

type PageProps = {
  searchParams?: Promise<{ error?: string | string[]; next?: string | string[] }>;
};

function nextPath(value: string | string[] | undefined): string {
  const next = Array.isArray(value) ? value[0] : value;
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/unlock")) return "/apple/coach";
  return next;
}

export default async function UnlockPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const next = nextPath(params?.next);
  const errorCode = Array.isArray(params?.error) ? params?.error[0] : params?.error;
  const error = errorCode === "missing" ? "访问密码还没有配置。" : errorCode === "bad" ? "密码不正确，请重新输入。" : "";

  return (
    <main className="unlock-page">
      <section className="unlock-card">
        <div className="unlock-mark" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l7 3v5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6z" />
            <path d="M9.5 12l1.7 1.7 3.4-3.7" />
          </svg>
        </div>
        <span>私密健康记录</span>
        <h1>请输入访问密码</h1>
        <p>此页面包含 Apple Watch 和 iPhone 健康记录。通过验证后，本设备会保持一段时间的访问权限。</p>
        <UnlockForm error={error} next={next} />
      </section>
    </main>
  );
}
