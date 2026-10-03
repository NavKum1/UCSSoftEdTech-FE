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

    let candidateName = "";
    let badgeTitle = "";
    let finalScore = "";
    let isVerified = false;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/credential/${slug}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.candidateName) {
          candidateName = data.candidateName;
          badgeTitle = data.badgeTitle || "Certified Build & Defend Architect";
          finalScore = data.finalScore ? String(data.finalScore) : "100.0";
          isVerified = true;
        }
      }
    } catch (e) {
      // Database unavailable or network error
    }

    if (!isVerified) {
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
              backgroundImage: "radial-gradient(circle at 50% 0%, #31101e 0%, #020617 75%)",
              color: "#f8fafc",
              padding: "60px",
              fontFamily: "sans-serif",
              border: "8px solid #e11d48",
            }}
          >
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
                    backgroundColor: "#e11d48",
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
                  backgroundColor: "rgba(225, 29, 72, 0.15)",
                  color: "#fb7185",
                  padding: "8px 20px",
                  borderRadius: "9999px",
                  fontSize: "18px",
                  fontWeight: "600",
                  border: "1px solid rgba(225, 29, 72, 0.4)",
                }}
              >
                UNVERIFIED RECORD
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                gap: "14px",
              }}
            >
              <span style={{ fontSize: "18px", color: "#fb7185", textTransform: "uppercase", letterSpacing: "4px" }}>
                Accreditation Status
              </span>
              <span style={{ fontSize: "44px", fontWeight: "900", color: "#ffffff" }}>
                Credential Record Not Found
              </span>
              <span style={{ fontSize: "18px", color: "#94a3b8", maxWidth: "800px" }}>
                This credential ID could not be found or has not yet been issued by the institution.
              </span>
            </div>

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
                <span style={{ fontSize: "14px", color: "#94a3b8" }}>Credential Status</span>
                <span style={{ fontSize: "24px", fontWeight: "bold", color: "#fb7185" }}>Not Verified</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <span style={{ fontSize: "14px", color: "#94a3b8" }}>Verification ID</span>
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
              <span style={{ fontSize: "14px", color: "#94a3b8" }}>Assessment Score</span>
              <span style={{ fontSize: "32px", fontWeight: "bold", color: "#818cf8" }}>{finalScore}%</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <span style={{ fontSize: "14px", color: "#94a3b8" }}>Verification ID</span>
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
