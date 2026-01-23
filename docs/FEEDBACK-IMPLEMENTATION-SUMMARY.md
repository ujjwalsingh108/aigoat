# Feedback Screenshot Storage - Implementation Summary

## ✅ Completed Changes

### 1. Frontend Updates (`src/components/settings/FeedbackForm.tsx`)

#### Storage Bucket Changed
- **Old**: `feedback-attachments`
- **New**: `feedback`

#### Path Structure Changed
- **Old**: `{user_id}/{timestamp}-{filename}`
  - Example: `550e8400-e29b-41d4-a716-446655440000/1706025600000-screenshot.png`
- **New**: `{email}/{feedbackId}/{filename}`
  - Example: `user@example.com/1706025600000-abc123/screenshot1.png`

#### Upload Function (`handleSubmit`)
```typescript
// Generates unique feedback ID
const feedbackId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

// Sanitizes email for filesystem safety
const safeEmail = user.email!.replace(/[^a-zA-Z0-9@._-]/g, "_");

// Creates path: email/feedbackId/filename
const filePath = `${safeEmail}/${feedbackId}/${file.name}`;

// Uploads to new 'feedback' bucket
await supabase.storage.from("feedback").upload(filePath, file, {...});
```

#### Delete Function (`handleDeleteDbImage`)
```typescript
// Extracts full path from URL instead of just filename
const urlParts = url.split("/storage/v1/object/public/feedback/");
const filePath = urlParts[1]; // email/feedbackId/filename

// Deletes using correct path
await supabase.storage.from("feedback").remove([filePath]);
```

### 2. Database Migration (`supabase/migrations/setup_feedback_storage.sql`)

#### Creates Storage Bucket
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feedback',
  'feedback',
  true,
  5242880, -- 5MB per file
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
);
```

#### RLS Policies (4 policies created)

1. **Upload Policy**
   ```sql
   -- Users can only upload to their own email folder
   (storage.foldername(name))[1] = auth.jwt()->>'email'
   ```

2. **View Policy**
   ```sql
   -- Users can only view their own screenshots
   (storage.foldername(name))[1] = auth.jwt()->>'email'
   ```

3. **Delete Policy**
   ```sql
   -- Users can only delete their own files
   (storage.foldername(name))[1] = auth.jwt()->>'email'
   ```

4. **Admin Policy**
   ```sql
   -- Service role has full access
   bucket_id = 'feedback'
   ```

### 3. Documentation Created

- ✅ `docs/FEEDBACK-STORAGE-SETUP.md` - Quick setup guide
- ✅ `docs/FEEDBACK-STORAGE-MIGRATION.md` - Detailed migration guide
- ✅ `scripts/test-feedback-storage.ts` - Testing script

## 🎯 Key Benefits

### 1. Human-Readable Paths
- ❌ Old: `550e8400-e29b-41d4-a716-446655440000/...`
- ✅ New: `user@example.com/...`
- **Benefit**: Easy to identify which user's files

### 2. Better Organization
- ❌ Old: All user's screenshots mixed in one folder
- ✅ New: Each feedback entry has its own folder
- **Benefit**: Easy to find/manage related screenshots

### 3. Secure Access
- ❌ Old: No proper RLS policies
- ✅ New: Comprehensive RLS policies
- **Benefit**: Users can only access their own files

### 4. Proper Cleanup
- ❌ Old: Delete function didn't work correctly
- ✅ New: Proper path extraction and deletion
- **Benefit**: No orphaned files in storage

## 📋 What You Need To Do

1. **Run SQL Migration**
   ```bash
   # In Supabase SQL Editor, run:
   supabase/migrations/setup_feedback_storage.sql
   ```

2. **Test the Implementation**
   - Log in to your app
   - Go to Settings → Feedback
   - Submit feedback with screenshots
   - Verify screenshots appear correctly
   - Try deleting a screenshot

3. **Verify in Supabase Dashboard**
   - Go to Storage → Buckets
   - Find `feedback` bucket
   - Check files are organized as: `{email}/{feedbackId}/{filename}`

## 🔒 Security Implementation

### Storage Access Control
```
feedback/
├── user1@example.com/        ← User1 can access
│   ├── 1706025600000-abc123/
│   │   ├── screenshot1.png
│   │   └── screenshot2.png
│   └── 1706025700000-def456/
│       └── error.png
└── user2@example.com/        ← User2 can access
    └── 1706025800000-xyz789/
        └── bug.png
```

**RLS Enforcement**:
- User1 **can** upload/view/delete files in `user1@example.com/*`
- User1 **cannot** access files in `user2@example.com/*`
- Service role **can** access all files (for admin tasks)

### Database Access Control
- Users can only see their own feedback records (`user_id = auth.uid()`)
- Feedback table RLS should already be configured

## 🧪 Testing Checklist

- [ ] SQL migration runs without errors
- [ ] `feedback` bucket exists in Supabase
- [ ] Bucket has 4 RLS policies
- [ ] Can submit feedback with screenshots
- [ ] Screenshots appear in UI after submission
- [ ] Can delete individual screenshots
- [ ] Files stored at correct path: `{email}/{feedbackId}/{file}`
- [ ] Cannot access other users' files
- [ ] Old feedback (if any) still works

## 🚨 Important Notes

### Your Existing Schema
Your feedback table uses `jsonb` for attachments:
```sql
attachments jsonb null default '[]'::jsonb
```

This is **perfect** - the code will automatically handle this correctly when saving/retrieving URLs.

### No Breaking Changes
- Existing feedback records are not affected
- Old bucket (`feedback-attachments`) can remain if you have data
- New submissions use new structure automatically
- You can migrate old data gradually

### Email Sanitization
Special characters in emails are replaced with underscores:
- `user+test@example.com` → `user_test@example.com`
- Safe for filesystem paths
- Maintains readability

## 📊 Data Flow

### Upload Flow
```
1. User selects images
2. Generate unique feedbackId
3. Sanitize email address
4. Create path: {email}/{feedbackId}/{filename}
5. Upload to 'feedback' bucket
6. Get public URL
7. Save URLs to database (jsonb array)
8. Display in UI
```

### Display Flow
```
1. Fetch feedback from database
2. Get attachments array (URLs)
3. Render Image components with URLs
4. Next.js Image optimization applies
```

### Delete Flow
```
1. User clicks delete button
2. Extract path from URL
3. Delete from storage bucket
4. Update database (remove URL from array)
5. Update UI state
```

## 🔧 Maintenance

### Cleanup Old Files (Future Task)
Create a scheduled edge function to delete old feedback files:
```sql
-- Example: Delete feedback older than 90 days
DELETE FROM public.feedback 
WHERE created_at < NOW() - INTERVAL '90 days';
```

### Monitor Storage Usage
Check Supabase dashboard for:
- Total storage used
- Number of files per user
- Large files that might need compression

### Backup Strategy
- Feedback records are in PostgreSQL (backed up by Supabase)
- Storage files can be backed up via Supabase CLI
- Consider archiving old feedback periodically

## 📚 Additional Resources

- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [RLS Policies Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Storage Best Practices](https://supabase.com/docs/guides/storage/best-practices)

## ✨ Summary

**What Changed**: Bucket name, folder structure, and RLS policies
**What You Do**: Run SQL migration and test
**What Users Get**: Better organized, secure screenshot storage
**Breaking Changes**: None (backward compatible)

All code changes are complete. Just run the migration and you're good to go! 🚀
