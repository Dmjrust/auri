# Migration: Prontuário Format Preference to Supabase

## Summary
Migrated the `prontuario_format` user preference from **localStorage** (device-specific) to **Supabase profiles table** (multi-device sync).

## Changes Made

### 1. Database Layer (`src/lib/db.ts`)

**Updated `fetchProfile()` function:**
- Added `prontuario_format` to the SELECT clause
- Now retrieves the user's format preference from the profiles table

```typescript
export async function fetchProfile(): Promise<ProfileData | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles')
    .select('...clinic_hours_end, prontuario_format')  // ← Added
    .eq('id', user.id).single();
  return data || null;
}
```

**ProfileData interface** already has the field:
```typescript
export interface ProfileData {
  // ... other fields
  prontuario_format?: 'narrativo' | 'escaneavel';
}
```

The `updateProfile()` function already accepts `Partial<ProfileData>`, so no changes needed there.

### 2. App Component (`src/App.tsx`)

**Removed localStorage dependency:**
- Old: `useState` initialized from `localStorage.getItem('prontuarioFormat')`
- New: `useState` defaults to `'narrativo'`, then loads from profile on auth

```typescript
// Before:
const [prontuarioFormat, setProntuarioFormatState] = useState<ProntuarioFormat>(() =>
  (localStorage.getItem('prontuarioFormat') as ProntuarioFormat) || 'narrativo'
);

// After:
const [prontuarioFormat, setProntuarioFormatState] = useState<ProntuarioFormat>('narrativo');
```

**Updated `setProntuarioFormat` setter:**
- Now calls `db.updateProfile()` to persist to Supabase
- State updates immediately (optimistic UI)
- DB save happens in the background

```typescript
const setProntuarioFormat = async (f: ProntuarioFormat) => {
  setProntuarioFormatState(f);
  try {
    await db.updateProfile({ prontuario_format: f });
  } catch (err) {
    console.error('Failed to save prontuario format:', err);
  }
};
```

**Added new useEffect** (after auth listener):
- Runs when user is authenticated
- Fetches profile and loads the saved `prontuario_format`
- Sets the format in app state

```typescript
useEffect(() => {
  if (!user) return;
  db.fetchProfile().then(profile => {
    if (profile?.prontuario_format) {
      setProntuarioFormatState(profile.prontuario_format as ProntuarioFormat);
    }
  }).catch(err => console.error('Failed to load prontuario format:', err));
}, [user]);
```

## Required SQL Migration

Run this SQL command in your Supabase SQL editor to add the column to the profiles table:

```sql
-- Add prontuario_format column to profiles table if it doesn't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS prontuario_format text DEFAULT 'narrativo' 
CHECK (prontuario_format IN ('narrativo', 'escaneavel'));
```

**Note:** If the column already exists in your Supabase schema, you can skip this step.

## Benefits

✅ **Multi-device sync:** Doctor's format preference syncs across all devices  
✅ **Persistent:** Preference survives browser cache clearing and tab reopens  
✅ **Backup:** Part of doctor's profile, backed up with regular Supabase backups  
✅ **GDPR-aligned:** Profile data stored in user's Supabase profile table with proper RLS  

## Testing Checklist

- [ ] Build succeeds: `npm run build`
- [ ] Login to app
- [ ] Format defaults to "Narrativo"
- [ ] Go to Settings → "Formato do Prontuário"
- [ ] Switch to "Escaneável"
- [ ] Refresh page — format should stay as "Escaneável"
- [ ] Open app in incognito/private window — format should still be "Escaneável" (via Supabase)
- [ ] Switch back to "Narrativo"
- [ ] Verify console has no errors

## Rollback (if needed)

If you need to revert to localStorage (not recommended):
1. Revert the changes in db.ts fetchProfile()
2. Revert the changes in App.tsx state initialization
3. Reinstate localStorage logic in setProntuarioFormat

## Notes

- The SettingsPage component requires no changes — it already uses the context
- The ConsultationDetail component already respects the format preference via context
- No breaking changes to existing functionality
