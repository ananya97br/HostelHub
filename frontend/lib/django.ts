import "server-only";

import { cookies } from "next/headers";

const API_URL =
  (process.env.DJANGO_API_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");

export async function djangoFetch<T>(
  endpoint: string
): Promise<{
  data: T | null;
  status: number;
}> {
  const cookieStore = await cookies();
  const token = cookieStore.get("dormdesk_token")?.value;

  if (!token) {
    return {
      data: null,
      status: 401,
    };
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: {
        Authorization: `Token ${token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        data: null,
        status: response.status,
      };
    }

    return {
      data: (await response.json()) as T,
      status: response.status,
    };
  } catch {
    return {
      data: null,
      status: 503,
    };
  }
}
