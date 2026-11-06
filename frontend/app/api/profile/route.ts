import { NextRequest, NextResponse } from "next/server";

const DJANGO_URL = (process.env.DJANGO_API_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");

export async function GET(request: NextRequest) {
  return forward(request, "GET");
}

export async function PATCH(request: NextRequest) {
  return forward(request, "PATCH");
}

async function forward(request: NextRequest, method: "GET" | "PATCH") {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const token = request.cookies.get("dormdesk_token")?.value;
  if (!token) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  let body: string | undefined;
  if (method === "PATCH") {
    try {
      const payload: unknown = await request.json();
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return NextResponse.json({ error: "Invalid request data." }, { status: 400 });
      }
      body = JSON.stringify(payload);
    } catch {
      return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 });
    }
  }

  try {
    const response = await fetch(`${DJANGO_URL}/api/profile/`, {
      method,
      headers: {
        Authorization: `Token ${token}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body } : {}),
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
