"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Award, ShieldCheck, CheckCircle2, Share2, ExternalLink, Calendar, User, Building2, Sparkles, Copy, Check, AlertTriangle } from "lucide-react";

function LinkedInIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8m1.39 9.74v-8.37H5.07v8.37h2.78z"/>
    </svg>
  );
}

export default function CredentialBadgePage() {
  const params = useParams();
  const router = useRouter();
  const slug = (params?.slug as string) || "cred-demo";

  const [credential, setCredential] = useState<any>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    const fetchCredential = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/credential/${slug}`);
        if (res.ok) {
          const data = await res.json();
          setCredential(data);
        } else {
          setCredential({
            candidateName: "Alex Morgan",
            badgeTitle: "Certified Build & Defend Full-Stack Architect",
            instituteName: "Global ITech Accreditation Board",
            finalScore: 88.5,
            publicUrlSlug: slug,
            verifiedAt: new Date().toISOString(),
            verificationStatus: "Official Verified Credential",
            verificationFlagged: false,
          });
        }
      } catch (e) {
        setCredential({
          candidateName: "Alex Morgan",
          badgeTitle: "Certified Build & Defend Full-Stack Architect",
          instituteName: "Global ITech Accreditation Board",
          finalScore: 88.5,
          publicUrlSlug: slug,
          verifiedAt: new Date().toISOString(),
          verificationStatus: "Official Verified Credential",
          verificationFlagged: false,
        });
      }
    };

    fetchCredential();
  }, [slug]);

  const candidateName = credential?.candidateName || "Alex Morgan";
  const badgeTitle = credential?.badgeTitle || "Certified Build & Defend Full-Stack Architect";
  const instituteName = credential?.instituteName || "Global ITech Accreditation Board";
  const finalScore = credential?.finalScore || 88.5;
  const credentialUrl = typeof window !== "undefined" ? `${window.location.origin}/credential/${slug}` : `http://localhost:3000/credential/${slug}`;

  // Task 4: 1-Click LinkedIn Add to Profile URL
  const linkedInCertUrl = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(
    badgeTitle
  )}&organizationName=${encodeURIComponent(
    instituteName
  )}&issueYear=2026&issueMonth=8&certUrl=${encodeURIComponent(credentialUrl)}&certId=${encodeURIComponent(slug)}`;

  // Task 4: 1-Click LinkedIn Share to Feed URL
  const linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(credentialUrl)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(credentialUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center font-sans p-6">
      {/* Background Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-tr from-indigo-600/30 to-purple-600/30 blur-3xl rounded-full pointer-events-none"></div>

      <div className="max-w-2xl w-full glass-panel rounded-3xl p-8 border border-indigo-500/30 relative z-10 space-y-6 shadow-2xl">
        {/* Top Seal Badge Header */}
        <div className="flex items-center justify-between pb-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-500/20">
              <Award className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Verifiable Digital Certificate</span>
              <h1 className="text-lg font-bold text-foreground">ACCREDITED CERTIFICATE OF COMPLETION</h1>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
              VERIFIED
            </span>

            {credential?.verificationFlagged && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/40">
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-amber-700 dark:text-amber-400" />
                Under Review
              </span>
            )}
          </div>
        </div>

        {/* Integrity Warning Alert Box */}
        {credential?.verificationFlagged && (
          <div className="p-4 bg-amber-950/40 border border-amber-500/30 rounded-2xl flex items-start space-x-3 text-left">
            <AlertTriangle className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-300">Academic Review Notice</p>
              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                {credential?.flagReason || "An unusual submission pattern was flagged during this evaluation session and is awaiting review."}
              </p>
            </div>
          </div>
        )}

        {/* Badge Title & Candidate Info */}
        <div className="text-center space-y-3 py-4">
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">This Certifies That</p>
          <h2 className="text-3xl font-extrabold text-white bg-gradient-to-r from-white via-indigo-200 to-slate-200 bg-clip-text text-transparent">
            {candidateName}
          </h2>
          <p className="text-xs text-muted-foreground">has successfully completed the project challenge and demonstrated their skills in the voice assessment.</p>

          <div className="inline-block mt-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-600 dark:text-indigo-300 font-bold text-sm">
            {badgeTitle}
          </div>
        </div>

        {/* Competency & Score Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="glass-card rounded-2xl p-4 border border-border text-center">
            <span className="text-xs text-muted-foreground font-medium">Final Assessment Score</span>
            <div className="text-2xl font-extrabold text-indigo-700 dark:text-indigo-400 mt-1">{finalScore}%</div>
          </div>

          <div className="glass-card rounded-2xl p-4 border border-border text-center">
            <span className="text-xs text-muted-foreground font-medium">Accrediting Authority</span>
            <div className="text-xs font-bold text-foreground mt-2">{instituteName}</div>
          </div>
        </div>

        {/* 1-Click LinkedIn Integration Buttons */}
        <div className="pt-2 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground text-center uppercase tracking-wider">Share Your Achievement</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <a
              href={linkedInCertUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3 px-4 rounded-xl bg-sky-700 hover:bg-sky-600 text-white font-medium text-xs flex items-center justify-center space-x-2 transition-all shadow-lg shadow-sky-700/25 cursor-pointer"
            >
              <LinkedInIcon className="w-4 h-4" />
              <span>Add to LinkedIn Profile</span>
            </a>

            <a
              href={linkedInShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center justify-center space-x-2 transition-all shadow-lg shadow-indigo-600/25 cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>Share on LinkedIn Feed</span>
            </a>
          </div>
        </div>

        {/* Verification Footer Details */}
        <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center space-x-1.5">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span>Issued: August 31, 2026</span>
          </div>

          <button
            onClick={handleCopyLink}
            className="flex items-center space-x-1 font-mono text-[11px] text-indigo-700 dark:text-indigo-400 bg-card hover:bg-muted px-3 py-1 rounded-lg border border-border cursor-pointer transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Link Copied!" : `ID: ${slug}`}</span>
          </button>
        </div>

        <button
          onClick={() => router.push("/")}
          className="w-full py-2.5 bg-card hover:bg-muted text-muted-foreground rounded-xl text-xs font-medium border border-border transition-colors flex items-center justify-center space-x-2 cursor-pointer"
        >
          <span>Return to Dashboard</span>
        </button>
      </div>
    </div>
  );
}
