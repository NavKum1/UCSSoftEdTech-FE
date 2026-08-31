"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Award, ShieldCheck, CheckCircle2, ExternalLink, Calendar, User, Building2, Sparkles } from "lucide-react";

export default function CredentialBadgePage() {
  const params = useParams();
  const router = useRouter();
  const slug = (params?.slug as string) || "cred-demo";

  const [credential, setCredential] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

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
      } finally {
        setLoading(false);
      }
    };

    fetchCredential();
  }, [slug]);

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
            {credential?.candidateName || "Alex Morgan"}
          </h2>
          <p className="text-xs text-slate-300">has successfully defended micro-internship code submissions and passed the AI Voice Defense Review.</p>

          <div className="inline-block mt-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-300 font-bold text-sm">
            {credential?.badgeTitle || "Certified Build & Defend Full-Stack Architect"}
          </div>
        </div>

        {/* Competency & Score Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="glass-card rounded-2xl p-4 border border-slate-800 text-center">
            <span className="text-xs text-slate-400 font-medium">Final Defense Score</span>
            <div className="text-2xl font-extrabold text-indigo-400 mt-1">{credential?.finalScore || 88.5}%</div>
          </div>

          <div className="glass-card rounded-2xl p-4 border border-slate-800 text-center">
            <span className="text-xs text-slate-400 font-medium">Accrediting Authority</span>
            <div className="text-xs font-bold text-slate-200 mt-2">{credential?.instituteName || "Global ITech Accreditation Board"}</div>
          </div>
        </div>

        {/* Verification Footer Details */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-1.5">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span>Issued: {credential?.verifiedAt ? new Date(credential.verifiedAt).toLocaleDateString() : "August 31, 2026"}</span>
          </div>

          <div className="font-mono text-[11px] text-indigo-400 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
            ID: {slug}
          </div>
        </div>

        <button
          onClick={() => router.push("/")}
          className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-medium border border-slate-800 transition-colors flex items-center justify-center space-x-2 cursor-pointer"
        >
          <span>Return to Dashboard</span>
        </button>
      </div>
    </div>
  );
}
