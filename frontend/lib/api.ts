import "server-only";
import { connection } from "next/server";

const API_URL =
  process.env.DJANGO_API_URL ?? "http://127.0.0.1:8000";

export async function checkBackend() {
  await connection();

  try {
    const response = await fetch(`${API_URL}/api/health/`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        connected: false,
        message: "Please try again shortly.",
      };
    }

    return {
      connected: true,
      message: "Workspace is ready.",
    };
  } catch {
    return {
      connected: false,
      message: "The workspace is temporarily unavailable.",
    };
  }
}
