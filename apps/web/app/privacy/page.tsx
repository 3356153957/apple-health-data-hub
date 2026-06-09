import type { Metadata } from "next";

import { PrivacyCard } from "../components/PrivacyCard";
import { safePrivacy } from "../lib/load";

export const metadata: Metadata = { title: "隐私 · 健康" };
export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const privacy = await safePrivacy();
  return (
    <section className="lead">
      <PrivacyCard privacy={privacy} />
    </section>
  );
}
