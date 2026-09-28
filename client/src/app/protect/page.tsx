import type { Metadata } from "next";
import { AppFrame } from "@/components/app/AppFrame";
import { ProtectFlow } from "@/components/app/protect/ProtectFlow";

export const metadata: Metadata = { title: "Protect a weekend" };

export default function ProtectPage() {
  return (
    <AppFrame page="protect" eyebrow="Protect" title="Protect your stock for the weekend" subtitle="Four quick steps. You’ll see the exact cost before you pay, and after that there is nothing to do until Monday.">
      <ProtectFlow />
    </AppFrame>
  );
}
