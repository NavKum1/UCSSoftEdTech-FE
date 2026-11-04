"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ShieldCheck, Share2, Calendar, Copy, Check, AlertTriangle } from "lucide-react";
import { Badge, brandFill, buttonClass } from "@/components/career/ui";
import { useEn } from "@/lib/english/EnglishProvider";

function LinkedInIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8m1.39 9.74v-8.37H5.07v8.37h2.78z"/>
    </svg>
  );
}

// GET /api/credential/{slug} (CredentialController.CredentialBadgeDto)
interface CredentialBadge {
  candidateName: string | null;
  instituteName: string;
  finalScore: number;
  publicUrlSlug: string;
  verifiedAt: string;
  badgeTitle: string;
  verificationStatus: string;
  verificationFlagged: boolean;
  flagReason?: string | null;
}

export default function CredentialBadgePage() {
  const en = useEn();
  const params = useParams();
  const router = useRouter();
  const slug = (params?.slug as string) || "";

  const [credential, setCredential] = useState<CredentialBadge | null>(null);
  // Only a credential the API returned is ever shown as verified; any failure shows that state instead
  const [lookup, setLookup] = useState<"loading" | "found" | "notFound" | "revoked" | "error">(slug ? "loading" : "notFound");
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    const fetchCredential = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/credential/${encodeURIComponent(slug)}`);
        if (res.ok) {
          setCredential(await res.json());
          setLookup("found");
        } else {
          setLookup(res.status === 404 ? "notFound" : res.status === 410 ? "revoked" : "error");
        }
      } catch {
        setLookup("error");
      }
    };

    if (slug) fetchCredential();
  }, [slug]);

  if (lookup !== "found" || !credential) {
    const message = {
      loading: { title: en("Checking credential…"), body: "" },
      notFound: { title: en("Credential not found"), body: "No credential matches this link. Check the link with the person who shared it." },
      revoked: { title: en("Credential revoked"), body: "The holder revoked this credential. It is no longer valid." },
      error: { title: en("Couldn't check this credential"), body: "The verification service didn't respond. Try again in a few minutes." },
      found: { title: "", body: "" },
    }[lookup];
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-3 rounded-xl border border-border bg-card p-8 text-center shadow-sm" role={lookup === "loading" ? "status" : "alert"}>
          {lookup !== "loading" && <AlertTriangle className="mx-auto h-8 w-8 text-amber-700 dark:text-amber-400" aria-hidden />}
          <h1 className="text-lg font-semibold">{message.title}</h1>
          {message.body && <p className="text-sm text-muted-foreground">{message.body}</p>}
        </div>
      </main>
    );
  }

  const candidateName = credential.candidateName;
  const badgeTitle = credential.badgeTitle;
  const instituteName = credential.instituteName;
  const finalScore = credential.finalScore;
  const issued = credential.verifiedAt ? new Date(credential.verifiedAt) : null;
  const credentialUrl = typeof window !== "undefined" ? `${window.location.origin}/credential/${slug}` : `/credential/${slug}`;

  // Task 4: 1-Click LinkedIn Add to Profile URL
  const linkedInCertUrl = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(
    badgeTitle
  )}&organizationName=${encodeURIComponent(
    instituteName
  )}${issued ? `&issueYear=${issued.getUTCFullYear()}&issueMonth=${issued.getUTCMonth() + 1}` : ""}&certUrl=${encodeURIComponent(credentialUrl)}&certId=${encodeURIComponent(slug)}`;

  // Task 4: 1-Click LinkedIn Share to Feed URL
  const linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(credentialUrl)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(credentialUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-foreground sm:p-6">
      <div className="w-full max-w-2xl space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-6">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">{en("Certificate of completion")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{en("A verifiable digital certificate.")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="good">
              <ShieldCheck className="me-1 h-3.5 w-3.5" aria-hidden />
              {en("Verified")}
            </Badge>
            {credential?.verificationFlagged && (
              <Badge tone="warn">
                <AlertTriangle className="me-1 h-3.5 w-3.5" aria-hidden />
                {en("Under review")}
              </Badge>
            )}
          </div>
        </div>

        {credential?.verificationFlagged && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-start dark:border-amber-900 dark:bg-amber-950/40">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">{en("Under academic review")}</p>
              <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-300">
                {credential?.flagReason || "An unusual submission pattern was flagged during this evaluation session and is awaiting review."}
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2 py-2 text-center">
          <p className="text-sm text-muted-foreground">{en("This certifies that")}</p>
          <h2 className="text-3xl font-semibold tracking-tight">{candidateName ?? "Name not shared"}</h2>
          <p className="text-sm text-muted-foreground">{en("earned this credential with the result below, graded by Edulexa.")}</p>
          <p className="pt-2 text-lg font-semibold">{badgeTitle}</p>
        </div>

        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <dt className="text-sm text-muted-foreground">{en("Final score")}</dt>
            <dd className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{finalScore}%</dd>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <dt className="text-sm text-muted-foreground">{en("Issued by")}</dt>
            <dd className="mt-2 text-base font-semibold">{instituteName}</dd>
          </div>
        </dl>

        <div className="space-y-3">
          <h3 className="text-sm font-medium">{en("Share this certificate")}</h3>
          <div className="flex flex-wrap gap-2">
            <a href={linkedInCertUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("primary")} style={brandFill}>
              <LinkedInIcon className="h-4 w-4" />
              {en("Add to LinkedIn profile")}
            </a>
            <a href={linkedInShareUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
              <Share2 className="h-4 w-4" aria-hidden />
              {en("Share on LinkedIn")}
            </a>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" aria-hidden />
            <span>{en("Issued: {value}", { value: issued ? issued.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }) : "—" })}</span>
          </div>

          <button type="button" onClick={handleCopyLink} className={`${buttonClass("secondary")} h-8 px-3 text-xs`}>
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
            <span className={copied ? undefined : "font-mono"}>{copied ? en("Link copied") : `ID: ${slug}`}</span>
          </button>
        </div>

        <button type="button" onClick={() => router.push("/")} className={`${buttonClass("ghost")} w-full`}>
          {en("Go to the home page")}
        </button>
      </div>
    </main>
  );
}
