import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  PROXY_FORWARD_REQUEST_HEADERS,
  filterProxyResponseHeaders,
  shouldStreamProxyResponse,
} from "@/lib/api-proxy";
import { SESSION_COOKIE_NAME, backendApiOrigin } from "@/lib/session-cookie";

export const runtime = "nodejs";

function buildBackendUrl(pathSegments: string[], search: string): string {
  const path = pathSegments.join("/");
  const base = `${backendApiOrigin()}/api/v1/${path}`;
  return search ? `${base}${search}` : base;
}

function forwardRequestHeaders(request: NextRequest, token: string | undefined): Headers {
  const headers = new Headers();

  for (const name of PROXY_FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return headers;
}

async function proxy(request: NextRequest, pathSegments: string[]): Promise<NextResponse> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  const targetUrl = buildBackendUrl(pathSegments, request.nextUrl.search);

  const init: RequestInit = {
    method: request.method,
    headers: forwardRequestHeaders(request, token),
    cache: "no-store",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, init);
  } catch {
    return NextResponse.json({ detail: "Backend service unavailable" }, { status: 502 });
  }

  const responseHeaders = filterProxyResponseHeaders(upstream.headers);
  const contentType = upstream.headers.get("content-type") ?? "";
  const streamBody = shouldStreamProxyResponse(pathSegments, contentType);

  if (streamBody && upstream.body) {
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  }

  const body = upstream.status === 204 || request.method === "HEAD" ? null : await upstream.arrayBuffer();

  return new NextResponse(body, {
    status: upstream.status,
    headers: responseHeaders,
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

export async function HEAD(request: NextRequest, context: RouteContext) {
  return proxy(request, await resolvePath(context));
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, await resolvePath(context));
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxy(request, await resolvePath(context));
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxy(request, await resolvePath(context));
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, await resolvePath(context));
}
