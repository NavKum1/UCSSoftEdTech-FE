import { NextResponse } from "next/server";

export async function GET() {
  const backendApiUrl = process.env.NEXT_PUBLIC_API_URL || `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}`;

  try {
    const res = await fetch(`${backendApiUrl}/health/ready`, {
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({ status: "Degraded" }));

    if (res.ok) {
      return NextResponse.json(
        {
          status: "Healthy",
          service: "Next.js Production Edge Gateway",
          timestamp: new Date().toISOString(),
          backendHealth: data,
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          status: "Unhealthy",
          service: "Next.js Production Edge Gateway",
          timestamp: new Date().toISOString(),
          backendHealth: data,
        },
        { status: 503 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "Degraded",
        service: "Next.js Production Edge Gateway",
        timestamp: new Date().toISOString(),
        error: error.message || "Backend API unreachable",
      },
      { status: 500 }
    );
  }
}
