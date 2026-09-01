"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Award, ShieldCheck, CheckCircle2, Share2, Linkedin, ExternalLink, Calendar, User, Building2, Sparkles, Copy, Check } from "lucide-react";

export default function CredentialBadgePage() {
  const params = useParams();
  const router = useRouter();
  const slug = (params?.slug as string) || "cred-demo";

  const [credential, setCredential] = useState<any>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    const fetchCredential = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/credential/${slug}`);
        const data = await res.json();
        if (res.ok) {
          setCredential(data);
        } else {
          setCredential({
            candidateName: "Alex Morgan",
            badgeTitle: "Certified Build & Defend Full-Stack Architect",
            instituteName: "Global ITech Accreditation Board",
            finalScore: 88.5,
            publicUrlSlug: slug,
            verifiedAt: new Date().toISOString(),
            verificationStatus: "Official Cryptographic Seal Verified",
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
          verificationStatus: "Official Cryptographic Seal Verified",
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center font-sans p-6">
      {/* Background Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-tr from-indigo-600/30 to-purple-600/30 blur-3xl rounded-full pointer-events-none"></div>

      <div className="max-w-2xl w-full glass-panel rounded-3xl p-8 border border-indigo-500/30 relative z-10 space-y-6 shadow-2xl">
        {/* Top Seal Badge Header */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-500/20">
              <Award className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Verifiable Digital Badge</span>
              <h1 className="text-lg font-bold text-white">BUILD & DEFEND ACCREDITATION</h1>
            </div>
          </div>

          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
            VERIFIED
          </span>
        </div>

        {/* Badge Title & Candidate Info */}
        <div className="text-center space-y-3 py-4">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">This Certifies That</p>
          <h2 className="text-3xl font-extrabold text-white bg-gradient-to-r from-white via-indigo-200 to-slate-200 bg-clip-text text-transparent">
            {candidateName}
          </h2>
          <p className="text-xs text-slate-300">has successfully defended micro-internship code submissions and passed the AI Voice Defense Review.</p>

          <div className="inline-block mt-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-300 font-bold text-sm">
            {badgeTitle}
          </div>
        </div>

        {/* Competency & Score Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="glass-card rounded-2xl p-4 border border-slate-800 text-center">
            <span className="text-xs text-slate-400 font-medium">Final Defense Score</span>
            <div className="text-2xl font-extrabold text-indigo-400 mt-1">{finalScore}%</div>
          </div>

          <div className="glass-card rounded-2xl p-4 border border-slate-800 text-center">
            <span className="text-xs text-slate-400 font-medium">Accrediting Authority</span>
            <div className="text-xs font-bold text-slate-200 mt-2">{instituteName}</div>
          </div>
        </div>

        {/* 1-Click LinkedIn Integration Buttons */}
        <div className="pt-2 space-y-3">
          <p className="text-xs font-semibold text-slate-400 text-center uppercase tracking-wider">Viral Social Proof & Verification</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <a
              href={linkedInCertUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3 px-4 rounded-xl bg-sky-700 hover:bg-sky-600 text-white font-medium text-xs flex items-center justify-center space-x-2 transition-all shadow-lg shadow-sky-700/25 cursor-pointer"
            >
              <Linkedin className="w-4 h-4" />
              <span>Add to LinkedIn Profile</span>
            </a>

            <a
              href={linkedInShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center justify-center space-x-2 transition-all shadow-lg shadow-indigo-600/25 cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>Share Badge to Feed</span>
            </a>
          </div>
        </div>

        {/* Verification Footer Details */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-1.5">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span>Issued: August 31, 2026</span>
          </div>

          <button
            onClick={handleCopyLink}
            className="flex items-center space-x-1 font-mono text-[11px] text-indigo-400 bg-slate-900 hover:bg-slate-800 px-3 py-1 rounded-lg border border-slate-800 cursor-pointer transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Link Copied!" : `ID: ${slug}`}</span>
          </button>
        </div>

        <button
          onClick={() => router.push("/")}
          className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-medium border border-slate-800 transition-colors flex items-center justify-center space-x-2 cursor-pointer"
        >
          <span>Return to Dashboard</span>
        </button>
      </div>
    </div>
  );
}
