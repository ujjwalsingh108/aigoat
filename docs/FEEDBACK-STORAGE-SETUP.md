# Feedback Storage Setup - Quick Guide

## What Changed

### ✅ Code Changes (Already Done)
- Updated `FeedbackForm.tsx` to use new storage structure
- Changed bucket name from `feedback-attachments` → `feedback`
- Changed path structure from `{uuid}/{timestamp}-{file}` → `{email}/{feedbackId}/{file}`
- Fixed delete function to extract correct file paths

### 🔧 Database Setup (You Need To Do)

1. **Run the SQL Migration**
   ```bash
   # Option 1: Using Supabase CLI
   supabase db push
   
   # Option 2: Run in Supabase SQL Editor
   # Copy and paste contents of: supabase/migrations/setup_feedback_storage.sql
   ```

2. **What the Migration Does**
   - Creates the `feedback` storage bucket (if not exists)
   - Sets up RLS policies for secure access
   - Configures file size limits (5MB) and allowed types (images only)

## Storage Path Structure

### New Format
```
feedback/{email}/{feedbackId}/{filename}
```

### Example
```
feedback/user@example.com/1706025600000-abc123/screenshot1.png
feedback/user@example.com/1706025600000-abc123/screenshot2.png
```

## Security (RLS Policies)

The migration creates 4 storage policies:

1. **Upload**: Users can only upload to folders matching their email
2. **View**: Users can only see their own screenshots  
3. **Delete**: Users can only delete their own files
4. **Admin**: Service role has full access (for maintenance)

## Testing

After running the migration, test the setup:

```bash
# Option 1: Use the test script
npm run dev
# Then visit your app and submit feedback with screenshots

# Option 2: Use the automated test
# Run in browser console when logged in:
# (paste contents of scripts/test-feedback-storage.ts)
```

## Verify Setup

1. ✅ Go to Supabase Dashboard → Storage → Buckets
2. ✅ Confirm `feedback` bucket exists and is public
3. ✅ Check Policies tab - should see 4 policies
4. ✅ Submit test feedback with screenshots in your app
5. ✅ Verify screenshots appear in UI
6. ✅ Check storage: Should see `{email}/{feedbackId}/` folders

## Migrating Old Data (Optional)

If you have existing feedback in `feedback-attachments` bucket:

1. Keep the old bucket (don't delete it yet)
2. New feedback will use the new structure automatically
3. Old feedback will still work with old URLs
4. Optionally migrate old data using the script in `FEEDBACK-STORAGE-MIGRATION.md`

## Troubleshooting

### Screenshots not visible?
- Check bucket is public in Supabase dashboard
- Verify RLS policies are created (run migration again if needed)
- Check browser console for errors

### Upload fails?
- Verify user is logged in
- Check file is under 5MB
- Ensure file is an image format
- Check RLS policies are applied

### Delete fails?
- Verify URL format is correct
- Check user owns the feedback entry
- Review browser console errors

## Important Notes

⚠️ **Your existing feedback table schema uses `jsonb` for attachments** - this is perfect and will work correctly. The code already handles this.

⚠️ **Old bucket `feedback-attachments`** - Keep it if you have existing data, or delete it if starting fresh.

✅ **No breaking changes** - New structure doesn't affect existing feedback records.

## Next Steps

1. Run the SQL migration
2. Test by submitting feedback with screenshots
3. Verify everything works
4. Optional: Migrate old data if needed
5. Optional: Delete old `feedback-attachments` bucket after migration

## Support

Check these files for more details:
- `docs/FEEDBACK-STORAGE-MIGRATION.md` - Detailed migration guide
- `supabase/migrations/setup_feedback_storage.sql` - SQL migration
- `src/components/settings/FeedbackForm.tsx` - Updated component
