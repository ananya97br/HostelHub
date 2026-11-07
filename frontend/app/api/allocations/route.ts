import { NextRequest, NextResponse } from "next/server";

const DJANGO_URL = (process.env.DJANGO_API_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");

function sameOrigin(request: NextRequest, requireOrigin = false) {
  const origin = request.headers.get("origin");
  return requireOrigin ? origin === request.nextUrl.origin : !origin || origin === request.nextUrl.origin;
}

function responseBody(response: Response) {
  return response.text().then((text) => {
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return { error: "The response could not be read." };
    }
  });
}

export async function GET(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const token = request.cookies.get("dormdesk_token")?.value;
  if (!token) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const resources: Record<string, string> = {
    allocations: "/api/allocations/",
    rooms: "/api/rooms/?available_only=true",
    students: "/api/students/",
  };
  const resource = request.nextUrl.searchParams.get("resource") ?? "allocations";
  const endpoint = resources[resource];
  if (!endpoint) return NextResponse.json({ error: "Unknown allocation resource." }, { status: 400 });

  try {
    const response = await fetch(`${DJANGO_URL}${endpoint}`, {
      headers: { Authorization: `Token ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    return NextResponse.json(await responseBody(response), { status: response.status });
  } catch {
    return NextResponse.json({ error: "The service is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request, true)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const token = request.cookies.get("dormdesk_token")?.value;
  if (!token) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Invalid request data." }, { status: 400 });
  }

  const body = payload as Record<string, unknown>;
  const action = body.action;
  const routes: Record<string, string> = {
    create: "/api/allocations/create/",
    vacate: "/api/allocations/vacate/",
    reassign: "/api/allocations/reassign/",
  };
  if (typeof action !== "string" || !routes[action]) {
    return NextResponse.json({ error: "Unknown allocation action." }, { status: 400 });
  }
  const forwarded = { ...body };
  delete forwarded.action;

  try {
    const response = await fetch(`${DJANGO_URL}${routes[action]}`, {
      method: "POST",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(forwarded),
      cache: "no-store",
    });
    return NextResponse.json(await responseBody(response), { status: response.status });
  } catch {
    return NextResponse.json({ error: "The service is temporarily unavailable." }, { status: 503 });
  }
}
