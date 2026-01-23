# Feedback Storage Migration Guide

## Overview
This guide explains the changes made to the feedback screenshot storage system and how to migrate from the old structure to the new one.

## Changes Made

### 1. Storage Bucket
- **Old**: `feedback-attachments`
- **New**: `feedback`

### 2. Folder Structure
- **Old**: `{user_id}/{timestamp}-{filename}`
  - Example: `550e8400-e29b-41d4-a716-446655440000/1234567890-screenshot.png`
- **New**: `{email}/{feedbackId}/{filename}`
  - Example: `user@example.com/1234567890-abc123/screenshot.png`

### 3. Benefits of New Structure
- **Human-readable**: Email addresses are easier to identify than UUIDs
- **Better organization**: Each feedback submission has its own folder
- **Easier debugging**: Can quickly find user's feedback by their email
- **Better grouping**: All screenshots for a feedback entry are together

## Storage Path Structure

### Format
```
feedback/{email}/{feedbackId}/{filename}
```

### Components
- **email**: User's email address (sanitized for filesystem safety)
- **feedbackId**: Unique identifier for each feedback submission (timestamp + random string)
- **filename**: Original filename of the uploaded screenshot

### Example Paths
```
feedback/user@example.com/1706025600000-abc123/screenshot1.png
feedback/user@example.com/1706025600000-abc123/screenshot2.png
feedback/user@example.com/1706025700000-def456/error-screen.png
```

## RLS (Row Level Security) Policies

### Storage Policies

1. **Upload Policy**: Users can only upload to folders matching their email
   ```sql
   (storage.foldername(name))[1] = auth.jwt()->>'email'
   ```

2. **Read Policy**: Users can only view screenshots from their own email folder
   ```sql
   (storage.foldername(name))[1] = auth.jwt()->>'email'
   ```

3. **Delete Policy**: Users can only delete their own screenshots
   ```sql
   (storage.foldername(name))[1] = auth.jwt()->>'email'
   ```

4. **Admin Policy**: Service role has full access for maintenance

### Database Policies
- Users can only see, create, update, and delete their own feedback entries
- All operations are restricted by `user_id = auth.uid()`

## Implementation Details

### Frontend Changes (FeedbackForm.tsx)

#### Upload Function
```typescript
// Generate unique feedback ID
const feedbackId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

// Sanitize email for safe folder naming
const safeEmail = user.email!.replace(/[^a-zA-Z0-9@._-]/g, "_");

// New path structure
const filePath = `${safeEmail}/${feedbackId}/${file.name}`;

// Upload to 'feedback' bucket
await supabase.storage.from("feedback").upload(filePath, file, {
  cacheControl: "3600",
  upsert: false,
});
```

#### Delete Function
```typescript
// Extract full path from URL
const urlParts = url.split("/storage/v1/object/public/feedback/");
const filePath = urlParts[1];

// Delete from 'feedback' bucket
await supabase.storage.from("feedback").remove([filePath]);
```

### Database Schema

#### feedback Table
```sql
CREATE TABLE public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID,
  email TEXT NOT NULL,
  type TEXT NOT NULL,
  detail TEXT,
  attachments TEXT[] DEFAULT '{}',  -- Array of public URLs
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Migration Steps

### Step 1: Create New Bucket
Run the SQL migration:
```bash
supabase db push
# or manually run setup_feedback_storage.sql in Supabase SQL Editor
```

### Step 2: Migrate Existing Data (Optional)

If you have existing feedback attachments in `feedback-attachments` bucket, you can migrate them:

```typescript
// This is a one-time migration script
async function migrateExistingFeedback() {
  const { data: feedbacks } = await supabase
    .from('feedback')
    .select('*')
    .not('attachments', 'is', null);

  for (const feedback of feedbacks) {
    if (!feedback.attachments?.length) continue;

    const newAttachments = [];
    
    for (const oldUrl of feedback.attachments) {
      // Download from old location
      const oldPath = extractPathFromUrl(oldUrl, 'feedback-attachments');
      const { data: file } = await supabase.storage
        .from('feedback-attachments')
        .download(oldPath);

      if (!file) continue;

      // Get user email
      const { data: user } = await supabase.auth.admin.getUserById(feedback.user_id);
      const safeEmail = user.email.replace(/[^a-zA-Z0-9@._-]/g, "_");
      
      // Upload to new location
      const filename = oldPath.split('/').pop();
      const newPath = `${safeEmail}/${feedback.id}/${filename}`;
      
      await supabase.storage
        .from('feedback')
        .upload(newPath, file);

      // Get new public URL
      const { data: publicUrl } = supabase.storage
        .from('feedback')
        .getPublicUrl(newPath);

      newAttachments.push(publicUrl.publicUrl);
    }

    // Update feedback with new URLs
    await supabase
      .from('feedback')
      .update({ attachments: newAttachments })
      .eq('id', feedback.id);
  }
}
```

### Step 3: Update Environment
No environment variables need to be changed.

### Step 4: Test
1. Log in as a test user
2. Submit feedback with screenshots
3. Verify screenshots are visible in the UI
4. Verify files are stored at: `feedback/{email}/{feedbackId}/filename.ext`
5. Test deleting screenshots
6. Verify RLS policies work (users can't see other users' screenshots)

## Troubleshooting

### Screenshots Not Visible
- Check Supabase Storage bucket is public: `public: true`
- Verify RLS policies are enabled and correct
- Check browser console for CORS or 404 errors
- Verify the URL format is correct

### Upload Fails
- Check file size limits (default: 5MB per file)
- Verify MIME types are allowed (images only)
- Ensure user is authenticated
- Check email doesn't contain invalid characters

### Delete Fails
- Verify user owns the feedback entry
- Check RLS policies allow deletion
- Ensure path extraction from URL is correct

## Security Considerations

1. **Email Sanitization**: Special characters in emails are replaced with underscores
2. **RLS Enforcement**: All storage operations check user ownership via email
3. **Public Access**: Screenshots are publicly accessible via URL, but URLs are hard to guess
4. **File Size Limits**: 5MB per file prevents abuse
5. **MIME Type Restrictions**: Only image formats are allowed

## Testing RLS Policies

### Test User Isolation
```sql
-- As user1@example.com, try to access user2's files
SELECT * FROM storage.objects 
WHERE bucket_id = 'feedback' 
AND name LIKE 'user2@example.com%';
-- Should return empty if RLS is working
```

### Test Upload Permission
```typescript
// Try uploading to another user's folder (should fail)
await supabase.storage
  .from('feedback')
  .upload('otheruser@example.com/test/file.png', file);
// Should return permission denied error
```

## Rollback Plan

If issues occur, you can rollback by:

1. Revert FeedbackForm.tsx to use `feedback-attachments` bucket
2. Keep old bucket until all data is migrated
3. Use the old bucket name in code temporarily

## Future Enhancements

1. **Signed URLs**: For better security, use signed URLs instead of public URLs
2. **Image Optimization**: Compress images before upload
3. **Thumbnails**: Generate thumbnails for faster loading
4. **Cleanup Job**: Scheduled function to delete old feedback screenshots
5. **Quota Management**: Track and limit storage per user

## Support

For questions or issues:
- Check Supabase Storage logs in dashboard
- Review RLS policies in Supabase SQL Editor
- Test with different user accounts
- Check browser console for errors
