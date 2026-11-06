import { NextRequest, NextResponse } from "next/server";

const DJANGO_URL = (process.env.DJANGO_API_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");

function responseBody(response: Response) {
  return response.text().then((text) => {
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return { error: "The response could not be read." };
    }
  });
}

function sameOrigin(request: NextRequest, requireOrigin = false) {
  const origin = request.headers.get("origin");
  return requireOrigin ? origin === request.nextUrl.origin : !origin || origin === request.nextUrl.origin;
}

async function forward(request: NextRequest, method: "GET" | "POST" | "PATCH") {
  if (!sameOrigin(request, method !== "GET")) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const token = request.cookies.get("dormdesk_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Please log in first." }, { status: 401 });
  }

  let body: string | undefined;
  let endpoint = "/api/accounts/";
  if (method === "POST" || method === "PATCH") {
    try {
      const payload: unknown = await request.json();
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return NextResponse.json({ error: "Invalid request data." }, { status: 400 });
      }
      const forwarded = { ...(payload as Record<string, unknown>) };
      if (method === "PATCH") {
        const accountId = forwarded.id;
        if (typeof accountId !== "number" || !Number.isSafeInteger(accountId) || accountId <= 0) {
          return NextResponse.json({ error: "Valid account ID required." }, { status: 400 });
        }
        endpoint = `/api/accounts/${accountId}/`;
        delete forwarded.id;
      }
      body = JSON.stringify(forwarded);
    } catch {
      return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 });
    }
  }

  try {
    const response = await fetch(`${DJANGO_URL}${endpoint}`, {
      method,
      headers: {
        Authorization: `Token ${token}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body } : {}),
      cache: "no-store",
    });
    return NextResponse.json(await responseBody(response), { status: response.status });
  } catch {
    return NextResponse.json({ error: "The service is temporarily unavailable." }, { status: 503 });
  }
}

export async function GET(request: NextRequest) {
  return forward(request, "GET");
}

export async function POST(request: NextRequest) {
  return forward(request, "POST");
}

export async function PATCH(request: NextRequest) {
  return forward(request, "PATCH");
}
