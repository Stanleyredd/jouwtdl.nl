import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  return {
    response: NextResponse.next({
      request,
    }),
    claims: null,
    error: null,
  };
}
