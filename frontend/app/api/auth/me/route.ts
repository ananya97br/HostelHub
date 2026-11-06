import { NextRequest, NextResponse } from "next/server";

const DJANGO_URL = (process.env.DJANGO_API_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const token = request.cookies.get("dormdesk_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Please log in first." }, { status: 401 });
  }

  try {
    const response = await fetch(`${DJANGO_URL}/api/auth/me/`, {
      headers: { Authorization: `Token ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    const text = await response.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { error: "The response could not be read." };
    }
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: "The service is temporarily unavailable." }, { status: 503 });
  }
}
