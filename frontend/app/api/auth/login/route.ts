import { NextRequest, NextResponse } from "next/server";

const DJANGO_URL = (process.env.DJANGO_API_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("username" in body) ||
    !("password" in body) ||
    typeof body.username !== "string" ||
    typeof body.password !== "string"
  ) {
    return NextResponse.json(
      { error: "Username and password are required." },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `${DJANGO_URL}/api/auth/login/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        { error: typeof data?.error === "string" ? data.error : "Invalid username or password." },
        { status: response.status }
      );
    }

    if (!data || typeof data.token !== "string") {
      return NextResponse.json({ error: "Sign-in is temporarily unavailable." }, { status: 502 });
    }

    const result = NextResponse.json({
      success: true,
      username: data.username,
      role: data.role,
      is_admin: data.is_admin,
    });

    result.cookies.set("dormdesk_token", data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return result;
  } catch {
    return NextResponse.json(
      { error: "Backend unavailable." },
      { status: 503 }
    );
  }
}
