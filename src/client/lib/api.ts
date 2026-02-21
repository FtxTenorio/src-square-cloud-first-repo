export function getApiUrl(): string {
  if (typeof window !== "undefined") {
    return (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "") || "http://localhost:4000";
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}
