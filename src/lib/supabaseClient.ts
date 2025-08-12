// src/lib/supabaseClient.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!; // Non-null assertion
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Non-null assertion

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);
