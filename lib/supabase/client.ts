"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { assertSupabaseConfigured } from "@/lib/supabase/shared";
import type { Database } from "@/types/database";

let browserClient: SupabaseClient<Database> | null = null;

export function createClient() {
  if (browserClient) {
    return browserClient;
  }

  const { url, publicKey } = assertSupabaseConfigured();

  browserClient = createBrowserClient<Database>(url, publicKey);
  return browserClient;
}
