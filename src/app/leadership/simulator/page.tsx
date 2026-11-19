import { redirect } from "next/navigation";

// B3 (18 Nov 2026): leadership practice is a track of Workplace practice.
export default function Page() {
  redirect("/practice/workplace?track=leadership");
}
