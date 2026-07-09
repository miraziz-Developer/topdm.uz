import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { PROXY_FORWARD_REQUEST_HEADERS, filterProxyResponseHeaders } from "@/lib/api-proxy";
import { adminApiKey, backendApiOrigin } from "@/lib/backend";
import { ADMIN_SESSION_COOKIE, verifySessionToken } from "@/lib/admin-session";

export const runtime = "nodejs";

function buildBackendUrl(pathSegments: string[], search: string): string {
  const path = pathSegments.join("/");
  const base = `${backendApiOrigin()}/api/v1/${path}`;
  return search ? `${base}${search}` : base;
}

async function proxy(request: NextRequest, pathSegments: string[]): Promise<NextResponse> {
  const jar = await cookies();
  const session = verifySessionToken(jar.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const key = adminApiKey();
  if (!key) {
    return NextResponse.json({ detail: "ADMIN_API_KEY not configured" }, { status: 503 });
  }

  const targetUrl = buildBackendUrl(pathSegments, request.nextUrl.search);
  const headers = new Headers();
  for (const name of PROXY_FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("X-Admin-Key", key);

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, init);
  } catch {
    return NextResponse.json({ detail: "Backend unavailable" }, { status: 502 });
  }

  const body = upstream.status === 204 || request.method === "HEAD" ? null : await upstream.arrayBuffer();
  return new NextResponse(body, {
    status: upstream.status,
    headers: filterProxyResponseHeaders(upstream.headers),
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

async function resolvePath(context: RouteContext): Promise<string[]> {
  const { path } = await context.params;
  return path ?? [];
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, await resolvePath(context));
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, await resolvePath(context));
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxy(request, await resolvePath(context));
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, await resolvePath(context));
}
