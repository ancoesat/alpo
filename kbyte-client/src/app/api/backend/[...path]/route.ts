import { NextRequest, NextResponse } from "next/server";

// This route is the only thing that ever talks to the real C# API.
// It runs on the server, so the API key attached below never reaches
// the browser — the client only ever calls this same-origin path.
//
// Everything after /api/backend/ is forwarded as-is to the backend, e.g.
//   browser fetch("/api/backend/api/Dashboard/assets")
//   -> forwarded to  ${API_URL}/api/Dashboard/assets

async function handleProxy(request: NextRequest, path: string[]) {
  const apiUrl = process.env.API_URL;
  const apiKey = process.env.API_KEY;

  if (!apiUrl || !apiKey) {
    return NextResponse.json(
      { message: "Server is misconfigured (API_URL/API_KEY missing)." },
      { status: 500 }
    );
  }

  const targetUrl = `${apiUrl}/${path.join("/")}${request.nextUrl.search}`;

  const init: RequestInit = {
    method: request.method,
    headers: {
      "X-Api-Key": apiKey,
      ...(request.headers.get("content-type")
        ? { "Content-Type": request.headers.get("content-type")! }
        : {}),
    },
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetch(targetUrl, init);
  } catch {
    return NextResponse.json({ message: "Could not reach the backend API." }, { status: 502 });
  }

  const responseBody = await backendResponse.text();

  const headers: Record<string, string> = {
    "Content-Type": backendResponse.headers.get("content-type") ?? "application/json",
  };

  // Dosya indirmelerinde dosya adını taşıyan header — aktarılmazsa indirilen
  // dosya rastgele bir isimle kaydedilir.
  const disposition = backendResponse.headers.get("content-disposition");
  if (disposition) {
    headers["Content-Disposition"] = disposition;
  }

  return new NextResponse(responseBody, {
    status: backendResponse.status,
    headers,
  });
}

type RouteParams = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return handleProxy(request, path);
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return handleProxy(request, path);
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return handleProxy(request, path);
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return handleProxy(request, path);
}
