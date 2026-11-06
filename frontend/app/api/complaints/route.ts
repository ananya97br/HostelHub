import { NextRequest, NextResponse } from "next/server";

const DJANGO_URL = (
  process.env.DJANGO_API_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

async function forwardRequest(
  request: NextRequest,
  method: "POST" | "PATCH"
) {
  const origin = request.headers.get("origin");

  // Only accept same-origin browser requests.
  if (!origin || origin !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 }
    );
  }

  const token = request.cookies.get("dormdesk_token")?.value;

  if (!token) {
    return NextResponse.json(
      { error: "Please log in first." },
      { status: 401 }
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request." },
      { status: 400 }
    );
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return NextResponse.json(
      { error: "Invalid request data." },
      { status: 400 }
    );
  }

  const body = payload as Record<string, unknown>;

  let endpoint = "/api/complaints/";
  const forwardedBody = { ...body };

  if (method === "PATCH") {
    const complaintId = body.complaint_id;

    if (
      typeof complaintId !== "number" ||
      !Number.isSafeInteger(complaintId) ||
      complaintId <= 0
    ) {
      return NextResponse.json(
        { error: "Valid complaint ID required." },
        { status: 400 }
      );
    }

    endpoint = `/api/complaints/${complaintId}/`;

    delete forwardedBody.complaint_id;
  }

  try {
    const response = await fetch(
      `${DJANGO_URL}${endpoint}`,
      {
        method,
        headers: {
          Authorization: `Token ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(forwardedBody),
        cache: "no-store",
      }
    );

    const text = await response.text();

    let data: unknown;

    try {
      data = JSON.parse(text);
    } catch {
      data = {
        error: "The response could not be read.",
      };
    }

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch {
    return NextResponse.json(
      { error: "The service is temporarily unavailable." },
      { status: 503 }
    );
  }
}

export async function POST(request: NextRequest) {
  return forwardRequest(request, "POST");
}

export async function PATCH(request: NextRequest) {
  return forwardRequest(request, "PATCH");
}
