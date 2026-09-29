import type { Metadata } from "next";
import { AppFrame } from "@/components/app/AppFrame";
import { AgentsView } from "@/components/agents/AgentsView";

export const metadata: Metadata = { title: "Agents" };

export default function AgentsPage() {
  return (
    <AppFrame
      page="agents"
      eyebrow="Agents"
      accent="keeper"
      title="Two AI agents trade weekend cover"
      subtitle="Hermee's agent buys protection, Kip's agent underwrites it. They pay each other over x402 and settle on BNB Chain. Run a real trade below."
      wide
    >
      <AgentsView />
    </AppFrame>
  );
}
