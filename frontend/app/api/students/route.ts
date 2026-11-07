import { NextRequest, NextResponse } from "next/server";

const DJANGO_URL = (process.env.DJANGO_API_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");

export async function POST(request: NextRequest) {
  return forward(request, "POST");
}

export async function PATCH(request: NextRequest) {
  return forward(request, "PATCH");
}

async function forward(request: NextRequest, method: "POST" | "PATCH") {
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const token = request.cookies.get("dormdesk_token")?.value;
  if (!token) return NextResponse.json({ error: "Please log in first." }, { status: 401 });
  try {
    const payload: unknown = await request.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return NextResponse.json({ error: "Invalid request data." }, { status: 400 });
    const body = { ...(payload as Record<string, unknown>) };
    let endpoint = "/api/students/";
    if (method === "PATCH") {
      const studentId = body.id;
      if (typeof studentId !== "number" || !Number.isSafeInteger(studentId) || studentId <= 0) return NextResponse.json({ error: "Valid student ID required." }, { status: 400 });
      endpoint = `/api/students/${studentId}/`;
      delete body.id;
    }
    const response = await fetch(`${DJANGO_URL}${endpoint}`, { method, headers: { Authorization: `Token ${token}`, Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
    const text = await response.text();
    let data: unknown;
    try { data = text ? JSON.parse(text) : null; } catch { data = { error: "The response could not be read." }; }
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: "The service is temporarily unavailable." }, { status: 503 });
  }
}
