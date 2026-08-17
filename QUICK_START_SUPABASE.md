# Quick Start: Supabase Integration

## What Was Added

✅ **Supabase client** (`src/lib/supabase.js`) - Connects to your Supabase project  
✅ **Database hooks** (`src/hooks/useSupabaseState.js`) - Real-time state management  
✅ **Updated persistence** (`src/hooks/usePersistedState.js`) - Now uses Supabase automatically  
✅ **Database schema** (`supabase/schema.sql`) - Ready-to-run SQL  
✅ **Setup guide** (`SUPABASE_SETUP.md`) - Complete instructions  

## 3-Minute Setup

### 1. Create Supabase Project
- Go to https://app.supabase.com
- Click "New Project"
- Wait ~2 minutes for setup

### 2. Run Database Schema
- In Supabase dashboard → **SQL Editor**
- Copy/paste `supabase/schema.sql`
- Click **Run**

### 3. Get API Keys
- Settings → **API**
- Copy **Project URL** and **anon key**

### 4. Configure App
```bash
# Create .env file
echo "VITE_SUPABASE_URL=your-url-here" > .env
echo "VITE_SUPABASE_ANON_KEY=your-key-here" >> .env
```

### 5. Install & Run
```bash
npm install
npm start
```

## How It Works

- **Without Supabase**: App uses localStorage (original behavior)
- **With Supabase**: App automatically uses Supabase + real-time sync
- **No code changes needed**: Existing `usePersistedState` hooks work automatically

## Features

✨ **Real-time sync** - Changes appear instantly across all devices  
✨ **Cross-device** - Access from any browser/device  
✨ **Automatic fallback** - Works with or without Supabase  
✨ **Zero breaking changes** - Existing code works as-is  

## Testing

1. Open app in Browser A
2. Create a room and add participants
3. Open same room in Browser B (or different device)
4. See changes sync in real-time! 🎉

## Need Help?

See `SUPABASE_SETUP.md` for detailed instructions and troubleshooting.
