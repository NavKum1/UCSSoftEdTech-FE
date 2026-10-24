import { redirect } from "next/navigation";

// Phase D (24 Oct 2026): the paid "book a mentor" marketplace (invented mentors and prices) is retired; mentoring is the
// free network at /mentors.
export default function MentorBookingPage() {
  redirect("/mentors");
}
