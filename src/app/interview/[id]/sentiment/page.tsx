import { redirect } from "next/navigation";

// Phase E (24 Oct 2026): this page scored stress, sentiment, confidence and "executive presence" from voice signals
// (with sliders to make up the readings). Speaking practice replaces it: pace, filler words and pauses only, practice-only.
export default function SentimentCoachPage() {
  redirect("/prep/delivery");
}
