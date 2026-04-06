export function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

export function getSupabasePublicKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    ""
  );
}

export function isSupabaseConfigured() {
  return getSupabaseUrl().length > 0 && getSupabasePublicKey().length > 0;
}

export function getSupabaseConfig() {
  return {
    url: getSupabaseUrl(),
    publicKey: getSupabasePublicKey(),
    isConfigured: isSupabaseConfigured(),
  };
}

export function assertSupabaseConfigured() {
  const { url, publicKey, isConfigured } = getSupabaseConfig();

  if (!isConfigured) {
    throw new Error(
      "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.",
    );
  }

  return { url, publicKey };
}
