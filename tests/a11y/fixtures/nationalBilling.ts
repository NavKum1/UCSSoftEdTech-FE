/**
 * Fixtures for G9 school billing (/career-center/billing) and G6 national credentials
 * (/career-center/national-credentials, /student/national-credentials).
 */
import type { A11yRoute, ApiFixture } from "./types";
import { INSTITUTE_ID, SCHOOL_NAME, USER_ID, days } from "./types";

const ymd = (n: number) => days(n).slice(0, 10);
const INVOICE_PAID = "aaaa0001-0000-4000-8000-000000000001";
const INVOICE_DUE = "aaaa0001-0000-4000-8000-000000000002";

const invoice = (id: string, number: string, status: string, paid: number, refunds: unknown[] = []) => ({
  id,
  instituteId: INSTITUTE_ID,
  number,
  financialYear: "26-27",
  issueDate: ymd(-30),
  currency: "INR",
  provider: "razorpay",
  status,
  supplier: { LegalName: "Supplier Pvt Ltd" },
  customer: { LegalName: SCHOOL_NAME },
  lines: [
    { Description: "Career services licence, 1,200 students", Quantity: 1200, UnitAmountMinor: 25000, AmountMinor: 30000000 },
    { Description: "Minimum annual fee", Quantity: 1, UnitAmountMinor: 0, AmountMinor: 0 },
  ],
  placeOfSupply: { code: "27", name: "Maharashtra" },
  taxType: "IntraState",
  sacCode: "9999",
  reverseCharge: false,
  taxableValueMinor: 30000000,
  cgst: { rate: 9, amountMinor: 2700000 },
  stateTax: { label: "SGST", rate: 9, amountMinor: 2700000 },
  igst: { rate: 0, amountMinor: 0 },
  roundOffMinor: 0,
  totalMinor: 35400000,
  amountPaidMinor: paid,
  amountRefundedMinor: refunds.length ? 100000 : 0,
  payment: { orderId: null, paymentLinkUrl: null, paymentId: paid ? "pay_1" : null, paidAt: paid ? days(-20) : null, paymentAttempts: paid ? 1 : 0, lastError: null },
  refunds,
  notes: "Term 2026-27",
  cancelledAt: null,
  createdAt: days(-30),
});

export const nationalBillingFixtures: ApiFixture[] = [
  {
    path: "/api/career/billing/profile",
    body: {
      instituteId: INSTITUTE_ID,
      exists: true,
      legalName: "Lakeside Education Trust",
      gstin: "27AAPFU0939F1ZV",
      addressLine1: "1 MG Road",
      addressLine2: null,
      city: "Pune",
      stateCode: "27",
      stateName: "Maharashtra",
      pincode: "411001",
      countryCode: "IN",
      billingEmail: "fees@lakeside.edu",
      provider: "razorpay",
      currency: "INR",
      updatedAt: days(-40),
    },
  },
  {
    path: "/api/career/billing/invoices",
    body: [
      invoice(INVOICE_DUE, "INV/26-27/00002", "Issued", 0),
      invoice(INVOICE_PAID, "INV/26-27/00001", "PartiallyRefunded", 35400000, [
        { id: "r1", amountMinor: 100000, status: "processed", reason: "Fewer students", creditNoteNumber: "CN/26-27/00001", creditNoteDate: ymd(-10), taxableMinor: 84746, cgstMinor: 7627, sgstMinor: 7627, igstMinor: 0, createdAt: days(-10) },
      ]),
    ],
  },
  {
    path: "/api/career/national-credentials/connections",
    body: {
      note: "Documents reach a repository only for students who consented. Open Badges 3.0 credentials are unchanged; repositories receive a PDF copy.",
      repositories: [
        {
          provider: "digilocker",
          displayName: "DigiLocker (issuer, pull model)",
          country: "IN",
          model: "DigiLocker pulls documents from this server's issuer API when a student fetches them.",
          status: "Implemented against the Issuer API spec 3.0.0; confirm in the NeGD demo environment.",
          ownerMustDo: ["Register the school as an issuer on the DigiLocker Partner Portal", "Register the pull endpoints and API key"],
          sources: [],
          implemented: true,
          testOnly: false,
          settings: [
            { key: "orgId", label: "Issuer id", secret: false, required: true, hint: "From the DigiLocker Partner Portal" },
            { key: "docTypeInternship", label: "Internship document type", secret: false, required: true, hint: null },
            { key: "requireNameMatch", label: "Require Aadhaar name match", secret: false, required: false, hint: null },
            { key: "apiKey", label: "API key", secret: true, required: true, hint: null },
          ],
          endpoints: { pullUri: `https://api.example.edu/api/digilocker/issuer/${INSTITUTE_ID}/pull-uri`, pullDoc: `https://api.example.edu/api/digilocker/issuer/${INSTITUTE_ID}/pull-doc`, method: "POST, Content-Type application/xml" },
          connection: { id: "c1", enabled: true, updatedAt: days(-5), lastActivityAt: days(-1), lastStatus: "pull-doc ok", settings: { orgId: "in.lakeside", docTypeInternship: "INTRN", requireNameMatch: "true" }, secretsSet: ["apiKey"] },
        },
        {
          provider: "abc",
          displayName: "Academic Bank of Credits (NAD/ABC upload)",
          country: "IN",
          model: "Credit-bearing internships are reported through the NAD/ABC portal.",
          status: "Draft CSV export only.",
          ownerMustDo: ["Register the institution on NAD/ABC"],
          sources: [],
          implemented: false,
          testOnly: false,
          settings: [],
          endpoints: null,
          connection: null,
        },
      ],
    },
  },
  {
    path: "/api/career/national-credentials/coverage",
    body: { students: 1840, withApaar: 1202, withoutApaar: 638, repositories: [{ provider: "digilocker", name: "DigiLocker (issuer, pull model)", consented: 412, published: 380, withdrawn: 12, failed: 2 }] },
  },
  {
    path: "/api/career/national-credentials/documents",
    body: [
      { id: "d1", studentUserId: USER_ID, holderName: "Priya Sharma", provider: "digilocker", sourceType: "internship", sourceId: "x1", docType: "INTRN", docNumber: "LSU-INT-000123", uri: "in.lakeside-INTRN-000123", title: "Internship: Data intern at Acme Labs", status: "Published", publishedAt: days(-12), withdrawnAt: null, withdrawReason: null, lastPulledAt: days(-2), pullCount: 3, providerReference: null, lastError: null },
      { id: "d2", studentUserId: USER_ID, holderName: "Arjun Mehta", provider: "digilocker", sourceType: "credential", sourceId: "x2", docType: "SKILL", docNumber: "LSU-SKL-000044", uri: "in.lakeside-SKILL-000044", title: "Verified skills credential", status: "Withdrawn", publishedAt: days(-40), withdrawnAt: days(-8), withdrawReason: "Consent withdrawn", lastPulledAt: null, pullCount: 0, providerReference: null, lastError: null },
    ],
  },
  {
    path: "/api/career/national-credentials/me",
    body: {
      apaarId: "123456789012",
      apaarSource: "student",
      apaarNotice: "Your APAAR ID is used only to match documents you publish to your national academic records. It is never sent to a government system by this site.",
      repositories: [{ provider: "digilocker", name: "DigiLocker (issuer, pull model)", recipient: "DigiLocker (Government of India)", consented: true, consentedAt: days(-14) }],
      items: [
        { sourceType: "internship", sourceId: "x1", title: "Internship: Data intern at Acme Labs", completedAt: days(-20) },
        { sourceType: "credential", sourceId: "x3", title: "Verified skills credential: SQL", completedAt: days(-6) },
      ],
      documents: [
        { id: "d1", provider: "digilocker", sourceType: "internship", sourceId: "x1", docNumber: "LSU-INT-000123", title: "Internship: Data intern at Acme Labs", status: "Published", publishedAt: days(-12), withdrawnAt: null, withdrawReason: null, lastPulledAt: days(-2), pullCount: 3 },
      ],
    },
  },
];

export const nationalBillingRoutes: A11yRoute[] = [
  { name: "cc-billing", path: "/career-center/billing", persona: "career-center" },
  { name: "cc-national-credentials", path: "/career-center/national-credentials", persona: "career-center" },
  { name: "student-national-credentials", path: "/student/national-credentials", persona: "student" },
];
