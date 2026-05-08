import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://cpzjaeurqeeljgsypwsh.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_tofU93ebSInzxA1ZQv-F7w_B9ARq7Rx'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
