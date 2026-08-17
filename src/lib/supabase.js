import { createClient } from '@supabase/supabase-js'

// These will be set via environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validate URL format
const isValidUrl = (url) => {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

// Check if credentials are valid — Supabase is required; no localStorage fallback
const hasValidCredentials = supabaseUrl && supabaseAnonKey && isValidUrl(supabaseUrl)

// Create Supabase client (null only when credentials are missing or invalid)
export const supabase = hasValidCredentials
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export const isSupabaseEnabled = () => supabase !== null
