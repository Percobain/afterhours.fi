import type { Metadata } from "next";
import { AppFrame } from "@/components/app/AppFrame";
import { ActivityFeed } from "@/components/app/activity/ActivityFeed";

export const metadata: Metadata = { title: "My activity" };

export default function ActivityPage() {
  return (
    <AppFrame page="activity" eyebrow="My activity" title="Your protected weekends" subtitle="What’s active right now, and a receipt for every Monday that has already happened." wide>
      <ActivityFeed />
    </AppFrame>
  );
}
