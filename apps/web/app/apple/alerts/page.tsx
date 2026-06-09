import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "提醒处理 · 健康" };

export default function AppleAlertsRedirect() {
  redirect("/apple/coach#alerts");
}
