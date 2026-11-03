/**
 * Checks the British to US spelling (src/lib/english): known sentences come out right, and web addresses, e-mail
 * addresses and words that aren't in the list are left alone. Run: npx tsx scripts/check-english.ts
 */
import { toAmerican } from "../src/lib/english";

const cases: [string, string][] = [
  ["Choose a colour for your counselling centre.", "Choose a color for your counseling center."],
  ["Counsellors organise the programme; the CATALOGUE is cancelled.", "Counselors organize the program; the CATALOG is canceled."],
  ["Your organisation's licence", "Your organization's license"],
  ["We analysed it and recognised the behaviour", "We analyzed it and recognized the behavior"],
  ["Practise maths whilst travelling", "Practice math while traveling"],
  ["Enrolment is 40 per cent full; enrol now", "Enrollment is 40 percent full; enroll now"],
  ["Visit https://example.com/counselling-centre or /institute/counselling", "Visit https://example.com/counselling-centre or /institute/counselling"],
  ["Write to centre@school.edu", "Write to centre@school.edu"],
  ["A well-organised, customisable form", "A well-organized, customizable form"],
  ["Advise, revise and supervise; the analysis and its emphasis", "Advise, revise and supervise; the analysis and its emphasis"],
  ["Emphasise realistic goals", "Emphasize realistic goals"],
  ["Enrolled and fulfilled; fulfil it", "Enrolled and fulfilled; fulfill it"],
  ["Hi {name}, your counsellor {counsellor} cancelled", "Hi {name}, your counselor {counsellor} canceled"],
];
let failed = 0;
for (const [gb, us] of cases) {
  const got = toAmerican(gb);
  if (got !== us) {
    failed++;
    console.log(`FAIL ${JSON.stringify(gb)}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(us)}`);
  }
}
console.log(failed ? `${failed} failed` : `all ${cases.length} passed`);
process.exit(failed ? 1 : 0);
