import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseConfig } from "@/lib/supabase/shared";
import type { Database } from "@/types/database";

export async function updateSession(request: NextRequest) {
  const { url, publicKey, isConfigured } = getSupabaseConfig();
  let response = NextResponse.next({
    request,
  });

  if (!isConfigured) {
    return {
      response,
      claims: null,
      error: null,
    };
  }

  const supabase = createServerClient<Database>(url, publicKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();

  return {
    response,
    claims: data?.claims ?? null,
    error,
  };
}
