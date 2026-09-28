import { redirect } from "next/navigation";

/** /learn now lives inside /docs (Part I, the story). */
export default function LearnRedirect() {
  redirect("/docs");
}
