"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  CheckCircle2,
  Star,
  ShieldCheck,
  Clock,
  Video,
  ArrowRight,
  Sparkles,
  UserCheck,
  AlertCircle,
  Copy,
  Download,
} from "lucide-react";
import { useGeo } from "@/context/GeoContext";
import { AccessNotice, useLegacyApi } from "@/lib/legacyApi";

interface MentorProfile {
  mentorId: string;
  name: string;
  roleTitle: string;
  company: string;
  email: string;
  panNumber: string;
  rating: number;
  totalReviews: number;
  ratePerSessionInr: number;
  specialties: string[];
  availableSlots: string[];
  bio: string;
}

interface BookingResponse {
  bookingId: string;
  mentorName: string;
  candidateName: string;
  sessionTopic: string;
  scheduledSlot: string;
  meetingUrl: string;
  grossFee: number;
  tdsWithheldSection194J: number;
  mentorNetPayout: number;
  batchReference: string;
  confirmationStatus: string;
  bookedAt: string;
}

export default function BookMentorOfficeHoursPage() {
  const { apiFetch, ready, access } = useLegacyApi();
  const { region, config, formatCurrency, convertFromInr } = useGeo();
  const [mentors, setMentors] = useState<MentorProfile[]>([]);
  const [selectedMentor, setSelectedMentor] = useState<MentorProfile | null>(null);
  const [isLoadingMentors, setIsLoadingMentors] = useState<boolean>(true);
  const [sessionTopic, setSessionTopic] = useState<string>("Distributed Architecture & Consensus Defense");
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [candidateName, setCandidateName] = useState<string>("Alex Morgan");
  const [candidateEmail, setCandidateEmail] = useState<string>("alex.morgan@member360.dev");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [bookingResult, setBookingResult] = useState<BookingResponse | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  useEffect(() => {
    if (!ready) return;
    const fetchMentors = async () => {
      try {
        setIsLoadingMentors(true);
        const res = await apiFetch(`/v1/mentors`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setMentors(data);
            setSelectedMentor(data[0]);
            setSelectedSlot(data[0].availableSlots[0] || "Tomorrow 10:00 AM IST");
          } else {
            setBookingError("No vetted mentors currently available in database.");
          }
        } else {
          setBookingError(`Unable to load mentor roster (HTTP ${res.status}).`);
        }
      } catch (err) {
        setBookingError("Failed to connect to mentor service: " + (err as Error).message);
      } finally {
        setIsLoadingMentors(false);
      }
    };
    fetchMentors();
  }, [ready, apiFetch]);

  const handleSelectMentor = (m: MentorProfile) => {
    setSelectedMentor(m);
    setSelectedSlot(m.availableSlots[0] || "Tomorrow 10:00 AM IST");
  };

  const handleConfirmBooking = async () => {
    if (!selectedMentor) return;
    setIsSubmitting(true);
    try {
      const payload = {
        mentorId: selectedMentor.mentorId,
        mentorName: selectedMentor.name,
        mentorEmail: selectedMentor.email,
        mentorPan: selectedMentor.panNumber,
        candidateName,
        candidateEmail,
        sessionTopic,
        scheduledSlot: selectedSlot,
        amountInr: selectedMentor.ratePerSessionInr,
      };

      const res = await apiFetch(`/v1/mentors/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data: BookingResponse = await res.json();
        setBookingResult(data);
        setBookingError(null);
      } else {
        const errJson = await res.json().catch(() => ({}));
        setBookingError(errJson.error || "Failed to process mentor booking with TDS ledger record. Please try again.");
      }
    } catch (err) {
      console.error("Booking error:", err);
      setBookingError((err as Error)?.message || "Network error contacting booking service. Please verify server connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadIcsInvite = () => {
    if (!bookingResult) return;
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//BuildAndDefend//Member360 Mentor Office Hours//EN
BEGIN:VEVENT
SUMMARY:1-on-1 Office Hours: ${bookingResult.mentorName} & ${bookingResult.candidateName}
DESCRIPTION:Topic: ${bookingResult.sessionTopic}\\nMeeting URL: ${bookingResult.meetingUrl}\\nBatch Ref: ${bookingResult.batchReference}
LOCATION:${bookingResult.meetingUrl}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Mentor_Session_${bookingResult.mentorName.replace(/\s+/g, "_")}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyMeetingLink = () => {
    if (!bookingResult) return;
    navigator.clipboard.writeText(bookingResult.meetingUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (access) return <AccessNotice problem={access} feature="Mentor booking" />;

  if (isLoadingMentors || !selectedMentor) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading Vetted Staff+ Mentors Roster...</p>
          {bookingError && <p className="text-xs text-rose-400 max-w-md text-center">{bookingError}</p>}
        </div>
      </div>
    );
  }

  const grossFee = convertFromInr(selectedMentor.ratePerSessionInr);
  const statutoryTds = Math.round(grossFee * (config.tax.withholdingRatePercent / 100));
  const netTakeHome = grossFee - statutoryTds;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans pb-24">
      {/* Hero Header */}
      <section className="border-b border-border/80 bg-card/90 backdrop-blur-xl dark:bg-gradient-to-b dark:from-indigo-950/30 dark:via-slate-900/40 dark:to-slate-950 px-6 py-10 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 text-xs font-semibold uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              Two-Sided Mentorship Marketplace
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
              1-on-1 Staff &amp; Principal Mentor Office Hours
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base mt-2 max-w-2xl">
              Book private 45-minute architectural defenses, incident war-room debriefs, and career coaching with verified Staff+ leaders from AWS, Stripe, Razorpay, and Cloudflare.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-3 rounded-2xl bg-card border border-border shadow-md flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
              <div>
                <div className="text-xs font-bold text-foreground">Edulexa Payout Engine</div>
                <div className="text-[11px] text-muted-foreground">{config.tax.withholdingLabel}</div>
              </div>
            </div>
            <Link
              href="/dashboard"
              className="px-4 py-2.5 rounded-xl bg-card hover:bg-muted border border-border text-foreground hover:border-border text-xs font-medium transition-colors"
            >
              Back to Member 360
            </Link>
          </div>
        </div>
      </section>

      {/* Main Booking Workspace */}
      <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Mentor Selection Roster (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-indigo-700 dark:text-indigo-400" />
              Select Your Staff+ Mentor
            </h2>
            <span className="text-xs text-muted-foreground font-mono">
              {mentors.length} Vetted Mentors Online
            </span>
          </div>

          <div className="space-y-4">
            {mentors.map((m) => {
              const isSelected = selectedMentor.mentorId === m.mentorId;
              return (
                <div
                  key={m.mentorId}
                  onClick={() => handleSelectMentor(m)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-card/90 border-indigo-500 shadow-xl shadow-indigo-500/10 ring-1 ring-indigo-500/50"
                      : "bg-card/40 border-border/80 hover:border-border hover:bg-card/70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      {/* Avatar Initials */}
                      <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-amber-500 p-0.5 shadow-md">
                        <div className="w-full h-full bg-background rounded-[14px] flex items-center justify-center font-bold text-foreground text-base">
                          {m.name.split(" ").map((n) => n[0]).join("")}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base text-foreground">{m.name}</h3>
                          <span className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-semibold">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-700 dark:text-amber-400" />
                            {m.rating.toFixed(2)}
                          </span>
                        </div>
                        <p className="text-xs text-indigo-600 dark:text-indigo-300 font-medium">{m.roleTitle}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{m.company}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-black text-foreground">
                        {formatCurrency(convertFromInr(m.ratePerSessionInr))}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono">per 45m session</div>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mt-3 line-clamp-2 leading-relaxed">
                    {m.bio}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {m.specialties.map((spec) => (
                      <span
                        key={spec}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-muted/80 border border-border/60 text-muted-foreground font-mono"
                      >
                        {spec}
                      </span>
                    ))}
                  </div>

                  {/* Slot Badges */}
                  <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      Next available: {m.availableSlots[0]}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{m.totalReviews} sessions completed</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Session Configuration & Statutory TDS Ledger (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="sticky top-24 space-y-6">
            <div className="p-6 rounded-2xl bg-card/90 border border-border shadow-2xl backdrop-blur-xl space-y-5">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-indigo-700 dark:text-indigo-400" />
                Configure Session Details
              </h2>

              {/* Selected Mentor Capsule */}
              <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 dark:bg-indigo-950/30 dark:border-indigo-500/20 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-indigo-700 dark:text-indigo-400 font-mono uppercase font-semibold">Assigned Mentor</div>
                  <div className="text-sm font-bold text-foreground">{selectedMentor.name}</div>
                  <div className="text-xs text-muted-foreground">{selectedMentor.company}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono text-emerald-700 dark:text-emerald-400 font-bold">Verified Staff+</div>
                  <div className="text-[10px] text-muted-foreground font-mono">PAN: {selectedMentor.panNumber}</div>
                </div>
              </div>

              {/* Topic Select */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Defense &amp; Review Topic</label>
                <select
                  value={sessionTopic}
                  onChange={(e) => setSessionTopic(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-indigo-500"
                >
                  <option value="Distributed Architecture & Consensus Mock Defense">
                    Distributed Architecture &amp; Consensus Mock Defense
                  </option>
                  <option value="Real-World Production Incident Postmortem & MTTR">
                    Real-World Production Incident Postmortem &amp; MTTR
                  </option>
                  <option value="Staff+ Engineering Promotion Dossier & Committee Defense">
                    Staff+ Engineering Promotion Dossier &amp; Committee Defense
                  </option>
                  <option value="Zero-Day CVE Remediation & Security Architecture">
                    Zero-Day CVE Remediation &amp; Security Architecture
                  </option>
                  <option value="Compensation & Offer Negotiation Strategy">
                    Compensation &amp; Offer Negotiation Strategy
                  </option>
                </select>
              </div>

              {/* Slot Select */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Available Office Hours Slot</label>
                <div className="grid grid-cols-1 gap-2">
                  {selectedMentor.availableSlots.map((slot) => {
                    const isSlotSelected = selectedSlot === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`px-3 py-2 rounded-xl text-left text-xs font-mono transition-all flex items-center justify-between ${
                          isSlotSelected
                            ? "bg-indigo-600/20 text-indigo-600 dark:text-indigo-300 border border-indigo-500 font-semibold"
                            : "bg-background border border-border text-muted-foreground hover:text-foreground hover:border-border"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5" />
                          {slot}
                        </span>
                        {isSlotSelected && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Candidate Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">Candidate Name</label>
                  <input
                    type="text"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">Candidate Email</label>
                  <input
                    type="email"
                    value={candidateEmail}
                    onChange={(e) => setCandidateEmail(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Transparent Regional Statutory Financial Ledger */}
              <div className="p-4 rounded-xl bg-background border border-border/90 space-y-2.5">
                <div className="text-[11px] font-mono uppercase text-indigo-700 dark:text-indigo-400 font-semibold mb-1">
                  {config.tax.regimeTitle}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold text-muted-foreground">Candidate Session Fee:</span>
                  <span className="font-bold text-foreground font-mono">{formatCurrency(grossFee)}.00</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold text-muted-foreground">Gross Mentor Earning:</span>
                  <span className="font-mono text-foreground">{formatCurrency(grossFee)}.00</span>
                </div>
                <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1.5 rounded-lg border border-amber-500/20">
                  <span className="font-semibold">{config.tax.withholdingLabel}:</span>
                  <span className="font-mono font-bold">-{formatCurrency(statutoryTds)}.00</span>
                </div>
                <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">Net Mentor Bank Payout ({config.tax.payoutRail}):</span>
                  <span className="font-black text-emerald-700 dark:text-emerald-400 font-mono text-sm">
                    {formatCurrency(netTakeHome)}.00
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground font-mono leading-tight">
                  {config.tax.institutionLegalNotice}
                </div>
              </div>

              {bookingError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{bookingError}</span>
                </div>
              )}

              {/* Submit CTA */}
              <button
                type="button"
                onClick={handleConfirmBooking}
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs tracking-wider uppercase shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Processing Payout &amp; Room...</span>
                  </>
                ) : (
                  <>
                    <Video className="w-4 h-4" />
                    <span>Confirm &amp; Book Office Hours ({formatCurrency(grossFee)})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal / Card */}
      {bookingResult && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-xl w-full bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-foreground">Office Hours Confirmed!</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Meeting room initialized &amp; Edulexa {config.tax.regimeTitle} updated.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-background border border-border space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Assigned Mentor:</span>
                <span className="font-bold text-foreground">{bookingResult.mentorName}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Session Slot:</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-300 font-semibold">{bookingResult.scheduledSlot}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Defense Topic:</span>
                <span className="text-foreground line-clamp-1">{bookingResult.sessionTopic}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Payment Batch Reference:</span>
                <span className="font-mono text-muted-foreground">{bookingResult.batchReference}</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-border/80">
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Net Payout to Mentor ({config.tax.withholdingLabel}):</span>
                <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                  {formatCurrency(convertFromInr(bookingResult.mentorNetPayout))}.00
                </span>
              </div>
            </div>

            {/* Direct Virtual Meeting Link */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">Encrypted Video Defense Link:</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={bookingResult.meetingUrl}
                  className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-xs font-mono text-indigo-600 dark:text-indigo-300"
                />
                <button
                  onClick={copyMeetingLink}
                  className="px-3 py-2 rounded-xl bg-muted hover:bg-muted/80 text-xs font-semibold text-foreground flex items-center gap-1.5 transition-colors border border-border"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedLink ? "Copied!" : "Copy"}</span>
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={downloadIcsInvite}
                className="w-full sm:w-auto flex-1 py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-600 dark:text-indigo-300 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Add to Calendar (.ics)</span>
              </button>

              <Link
                href="/dashboard"
                className="w-full sm:w-auto flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
              >
                <span>Return to Member 360</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
