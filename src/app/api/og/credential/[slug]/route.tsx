import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const resolvedParams = await params;
    const slug = resolvedParams.slug || "cred-demo";

    // Fetch credential data or fallback
    let candidateName = "Alex Morgan";
    let badgeTitle = "Certified Build & Defend Full-Stack Architect";
    let finalScore = "88.5";

    try {
      const res = await fetch(`http://localhost:5000/api/credential/${slug}`);
      if (res.ok) {
        const data = await res.json();
        candidateName = data.candidateName || candidateName;
        badgeTitle = data.badgeTitle || badgeTitle;
        finalScore = data.finalScore ? String(data.finalScore) : finalScore;
      }
    } catch (e) {
      // Fallback defaults for static generation
    }

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#020617",
            backgroundImage: "radial-gradient(circle at 50% 0%, #1e1b4b 0%, #020617 75%)",
            color: "#f8fafc",
            padding: "60px",
            fontFamily: "sans-serif",
            border: "8px solid #4f46e5",
          }}
        >
          {/* Header Seal */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "16px",
                  backgroundColor: "#10b981",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "28px",
                  fontWeight: "bold",
                  color: "#ffffff",
                }}
              >
                BD
              </div>
              <span style={{ fontSize: "24px", fontWeight: "bold", color: "#ffffff", letterSpacing: "2px" }}>
                BUILD & DEFEND ACCREDITATION
              </span>
            </div>

            <div
              style={{
                backgroundColor: "rgba(16, 185, 129, 0.15)",
                color: "#34d399",
                padding: "8px 20px",
                borderRadius: "9999px",
                fontSize: "18px",
                fontWeight: "600",
                border: "1px solid rgba(16, 185, 129, 0.4)",
              }}
            >
              OFFICIAL VERIFIED BADGE
            </div>
          </div>

          {/* Body Candidate Info */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: "12px",
            }}
          >
            <span style={{ fontSize: "18px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "4px" }}>
              This Certifies That
            </span>
            <span style={{ fontSize: "52px", fontWeight: "900", color: "#ffffff" }}>
              {candidateName}
            </span>
            <span style={{ fontSize: "22px", color: "#c084fc", fontWeight: "bold" }}>
              {badgeTitle}
            </span>
          </div>

          {/* Footer Grid */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              backgroundColor: "rgba(15, 23, 42, 0.8)",
              padding: "24px 36px",
              borderRadius: "20px",
              border: "1px solid #1e293b",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "14px", color: "#94a3b8" }}>Defense Review Score</span>
              <span style={{ fontSize: "32px", fontWeight: "bold", color: "#818cf8" }}>{finalScore}%</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <span style={{ fontSize: "14px", color: "#94a3b8" }}>Cryptographic Verification Slug</span>
              <span style={{ fontSize: "18px", fontWeight: "bold", color: "#e2e8f0", fontFamily: "monospace" }}>
                {slug}
              </span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    return new Response(`Failed to generate OG image`, { status: 500 });
  }
}
