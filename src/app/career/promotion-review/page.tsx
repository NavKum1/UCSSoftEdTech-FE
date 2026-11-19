import { redirect } from "next/navigation";

// B3 (18 Nov 2026): promotion-case practice is a track of Workplace practice.
export default function Page() {
  redirect("/practice/workplace?track=promotion");
}
