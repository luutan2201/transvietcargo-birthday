import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project values (also set them in Vercel → Project Settings → Environment Variables).'
  );
}

// Fall back to a syntactically-valid placeholder URL so createClient()
// doesn't throw at module load and take the whole app down before the
// person even sees a page — every actual request will just fail with a
// clear network/auth error until real credentials are configured.
export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder-anon-key');
