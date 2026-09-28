import { redirect } from "next/navigation";

/** Old /app?tab= links keep working. */
export default function AppRedirect({ searchParams }: { searchParams: { tab?: string } }) {
  const t = searchParams.tab;
  if (t === "keep" || t === "earn") redirect("/earn");
  if (t === "weekends" || t === "activity") redirect("/activity");
  redirect("/protect");
}
