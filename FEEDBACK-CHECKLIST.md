# Feedback Storage Setup Checklist

## Pre-Deployment Checklist

### ✅ Code Changes (Already Done)
- [x] Updated bucket name: `feedback-attachments` → `feedback`
- [x] Changed path structure: `{uuid}/...` → `{email}/{feedbackId}/...`
- [x] Fixed upload function to use new structure
- [x] Fixed delete function to extract correct paths
- [x] Email sanitization implemented
- [x] Unique feedback ID generation

### 🔧 Database Setup (You Need To Do)

- [ ] **Step 1**: Open Supabase SQL Editor
  - Dashboard → SQL Editor → New Query

- [ ] **Step 2**: Copy and run migration
  - File: `supabase/migrations/setup_feedback_storage.sql`
  - Click "Run" button

- [ ] **Step 3**: Verify bucket created
  - Dashboard → Storage → Buckets
  - Check for `feedback` bucket
  - Verify it's marked as "Public"

- [ ] **Step 4**: Verify RLS policies
  - Dashboard → Storage → Buckets → feedback → Policies
  - Should see 4 policies:
    - [ ] Users can upload feedback screenshots to their folder
    - [ ] Users can view their own feedback screenshots
    - [ ] Users can delete their own feedback screenshots
    - [ ] Service role has full access to feedback bucket

### 🧪 Testing

- [ ] **Test 1**: Basic functionality
  - [ ] Log in to your application
  - [ ] Navigate to Settings → Feedback
  - [ ] Submit feedback with 1-3 screenshots
  - [ ] Verify screenshots appear in the UI
  - [ ] Screenshots should display correctly

- [ ] **Test 2**: Delete functionality
  - [ ] Click the × button on a screenshot
  - [ ] Screenshot should disappear from UI
  - [ ] Verify file deleted from storage

- [ ] **Test 3**: Multiple feedback entries
  - [ ] Submit another feedback with different screenshots
  - [ ] Verify both entries visible in history
  - [ ] Each entry shows correct screenshots

- [ ] **Test 4**: Storage structure
  - [ ] Go to Supabase Dashboard → Storage → feedback
  - [ ] Browse folders - should see email addresses
  - [ ] Click into email folder - should see timestamped folders
  - [ ] Each timestamped folder has the correct screenshots

- [ ] **Test 5**: Security (RLS)
  - [ ] Try to access another user's URL (if available)
  - [ ] Should either work (public) or deny (if using signed URLs)
  - [ ] In Supabase, verify users can't query other users' files

### 🔍 Verification

- [ ] Check browser console - no errors during upload
- [ ] Check browser console - no errors during delete
- [ ] Check Supabase Logs for any RLS policy violations
- [ ] Verify file paths match pattern: `{email}/{feedbackId}/{filename}`
- [ ] Check database - `attachments` field contains correct URLs

### 📊 Supabase Dashboard Verification

#### Storage Tab
- [ ] Bucket `feedback` exists
- [ ] Bucket is public: Yes
- [ ] File size limit: 5 MB
- [ ] Allowed MIME types: image/jpeg, image/png, image/gif, image/webp
- [ ] Files organized in email folders
- [ ] Each email folder contains timestamped subfolders

#### Policies Tab (Storage)
- [ ] 4 policies visible for `feedback` bucket
- [ ] All policies status: Active
- [ ] No conflicting policies

#### Database Tab
- [ ] Table `public.feedback` exists
- [ ] RLS enabled on `feedback` table
- [ ] Recent entries show in table
- [ ] `attachments` field is populated with URLs

### 🐛 Troubleshooting Checks

If something doesn't work, check these:

#### Upload Fails
- [ ] User is authenticated (logged in)
- [ ] File is under 5MB
- [ ] File is an image format (jpg, png, gif, webp)
- [ ] RLS policies are created correctly
- [ ] No typos in bucket name in code

#### Screenshots Don't Display
- [ ] Check browser console for 404 errors
- [ ] Verify URLs in database match actual file locations
- [ ] Bucket is public (or use signed URLs)
- [ ] CORS settings allow image loading

#### Delete Doesn't Work
- [ ] Path extraction from URL is correct
- [ ] User owns the feedback entry
- [ ] RLS delete policy exists
- [ ] No console errors

#### Wrong Folder Structure
- [ ] Check email sanitization is working
- [ ] Verify feedbackId is generated correctly
- [ ] Confirm path format: `{email}/{feedbackId}/{filename}`

### 🎯 Post-Deployment

- [ ] Monitor first few real submissions
- [ ] Check storage usage in Supabase dashboard
- [ ] Review any error logs
- [ ] Verify no orphaned files from testing
- [ ] Document any edge cases found

### 📝 Optional Tasks

- [ ] Migrate old data from `feedback-attachments` bucket
- [ ] Delete old `feedback-attachments` bucket (after migration)
- [ ] Set up automated cleanup for old feedback (90+ days)
- [ ] Add file compression before upload
- [ ] Implement progress bar for uploads
- [ ] Add thumbnail generation

### ✨ Success Criteria

You're done when:

✅ Users can submit feedback with screenshots
✅ Screenshots display correctly in the UI
✅ Users can delete screenshots
✅ Files are organized by email/feedbackId in storage
✅ RLS prevents users from accessing others' files
✅ No console errors during normal operations
✅ Storage dashboard shows correct folder structure

---

## Quick Commands

### View logs in Supabase
```
Dashboard → Database → Logs
Dashboard → Storage → Logs
```

### Check RLS policies
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage';
```

### List files in bucket
```sql
SELECT * FROM storage.objects 
WHERE bucket_id = 'feedback' 
ORDER BY created_at DESC 
LIMIT 10;
```

### Check feedback entries
```sql
SELECT id, email, type, 
       jsonb_array_length(attachments) as attachment_count,
       created_at 
FROM public.feedback 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## Support & Documentation

📄 Detailed guides:
- `docs/FEEDBACK-STORAGE-SETUP.md` - Quick setup
- `docs/FEEDBACK-STORAGE-MIGRATION.md` - Full migration guide
- `docs/FEEDBACK-IMPLEMENTATION-SUMMARY.md` - Technical details
- `docs/FEEDBACK-STORAGE-ARCHITECTURE.md` - Visual diagrams

🧪 Test script:
- `scripts/test-feedback-storage.ts` - Automated testing

---

**Last Updated**: January 23, 2026
**Status**: Ready for deployment ✅
