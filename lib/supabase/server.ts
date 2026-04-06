import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { assertSupabaseConfigured } from "@/lib/supabase/shared";
import type { Database } from "@/types/database";

export async function createClient() {
  const cookieStore = await cookies();
  const { url, publicKey } = assertSupabaseConfigured();

  return createServerClient<Database>(url, publicKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies directly. Proxy handles refresh.
        }
      },
    },
  });
}
