import type { Metadata } from "next";
import { AppFrame } from "@/components/app/AppFrame";
import { EarnFlow } from "@/components/app/earn/EarnFlow";

export const metadata: Metadata = { title: "Earn" };

export default function EarnPage() {
  return (
    <AppFrame page="earn" accent="keeper" eyebrow="Earn" title="Earn by backing other people’s weekends" subtitle="Add USDT to the protection pool. It collects every weekly fee and pays out on the rare bad Monday.">
      <EarnFlow />
    </AppFrame>
  );
}
