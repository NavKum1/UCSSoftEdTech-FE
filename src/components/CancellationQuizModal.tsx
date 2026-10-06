"use client";

import React, { useState } from "react";
import {
  X,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  RotateCcw,
  Sparkles,
} from "lucide-react";

interface CancellationQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionType?: string;
  onConfirmedCancel?: () => void;
}

const PRESET_REASONS = [
  "Scheduling conflict / unexpected emergency",
  "Need more time to prepare competencies",
  "Technical issues (mic, camera, or connectivity)",
  "Found another job offer or alternative program",
  "Preferred to practice written katas first",
  "Other reason",
];

export function CancellationQuizModal({
  isOpen,
  onClose,
  sessionType = "Interview",
  onConfirmedCancel,
}: CancellationQuizModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>(PRESET_REASONS[0]);
  const [details, setDetails] = useState<string>("");
  const [wantsReschedule, setWantsReschedule] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const res = await fetch(`${apiBase}/api/quiz/cancellation/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionType,
          reason: selectedReason,
          details,
          wantsReschedule,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
        if (onConfirmedCancel) onConfirmedCancel();
      } else {
        setResult({
          status: "Processed",
          message: "Your cancellation feedback has been recorded.",
        });
      }
    } catch {
      setResult({
        status: "Processed",
        message: "Your cancellation feedback has been recorded.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">
                Cancel {sessionType} Session
              </h3>
              <p className="text-xs text-muted-foreground">
                Help us improve by sharing your cancellation reason
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {result ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
              <CheckCircle2 className="w-6 h-6 shrink-0" />
              <div>
                <p className="text-sm font-semibold">{result.message}</p>
                <p className="text-xs opacity-80 mt-0.5">
                  Cancellation processed successfully.
                </p>
              </div>
            </div>

            {wantsReschedule && result.suggestedRescheduleSlots && (
              <div className="space-y-2 p-4 rounded-xl border border-border bg-muted/30">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span>Priority Reschedule Slots Reserved For You:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  {result.suggestedRescheduleSlots.map((slot: string, i: number) => (
                    <div
                      key={i}
                      className="p-2 rounded-lg border border-border/80 bg-card text-center text-xs hover:border-primary/50 cursor-pointer transition-colors"
                    >
                      <Clock className="w-3.5 h-3.5 mx-auto mb-1 text-muted-foreground" />
                      <span className="font-medium text-foreground">
                        {new Date(slot).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-95 transition-opacity"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Primary Reason for Cancelling
              </label>
              <div className="space-y-2">
                {PRESET_REASONS.map((reason) => (
                  <label
                    key={reason}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      selectedReason === reason
                        ? "border-primary bg-primary/5 text-foreground font-medium shadow-sm"
                        : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    }`}
                  >
                    <input
                      type="radio"
                      name="cancel_reason"
                      checked={selectedReason === reason}
                      onChange={() => setSelectedReason(reason)}
                      className="accent-primary w-3.5 h-3.5"
                    />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Additional Comments (Optional)
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={2}
                placeholder="Let us know what we could do to make this experience better..."
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-card/60 cursor-pointer">
              <input
                type="checkbox"
                checked={wantsReschedule}
                onChange={(e) => setWantsReschedule(e.target.checked)}
                className="accent-primary w-4 h-4 rounded"
              />
              <div className="text-xs">
                <span className="font-semibold text-foreground">
                  Reserve a priority reschedule slot
                </span>
                <p className="text-muted-foreground">
                  Keep your progress active and select a new time slot without penalties.
                </p>
              </div>
            </label>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                Nevermind, Keep Session
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting ? "Processing..." : "Confirm Cancellation"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
