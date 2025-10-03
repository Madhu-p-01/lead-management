# Lead Management System - Setup Instructions

## New Features Implemented

### 1. Notifications System ✅

- **Notifications Modal**: Click the bell icon in the navbar to view notifications
- **Real-time Updates**: Notifications update automatically when new ones are added
- **Notification Types**: Supports reminders, follow-ups, calls, meetings, and tasks
- **Features**:
  - Unread count badge
  - Filter by all/unread
  - Mark as read/delete notifications
  - Smooth slide-down animation
  - Color-coded by type

### 2. User Access Control ✅

- **Authorized Users Only**: Only users added to the `authorized_users` table can access the application
- **Role-Based Access**: Supports admin, user, and viewer roles
- **Unauthorized Page**: Users not authorized see a friendly access denied page
- **Automatic Profile Creation**: User profiles are created automatically on signup

## Database Setup

### Step 1: Run the SQL Script

Execute the `database-notifications-and-access.sql` file in your Supabase SQL Editor:

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the entire contents of `database-notifications-and-access.sql`
5. Click **Run** or press `Ctrl/Cmd + Enter`

This will create:

- `notifications` table
- `authorized_users` table
- `user_profiles` table
- All necessary indexes
- Row Level Security (RLS) policies
- Triggers for automatic profile creation

### Step 2: Add Authorized Users

Add emails of users who should have access to the application:

```sql
-- Add authorized users (run this in Supabase SQL Editor)
INSERT INTO authorized_users (email, role, is_active)
VALUES
  ('your-email@example.com', 'admin', true),
  ('colleague1@example.com', 'user', true),
  ('colleague2@example.com', 'user', true)
ON CONFLICT (email) DO UPDATE
SET is_active = EXCLUDED.is_active, role = EXCLUDED.role;
```

**Roles:**

- `admin`: Full access + can manage authorized users
- `user`: Standard access to all features
- `viewer`: Read-only access (for future implementation)

### Step 3: Verify Setup

1. Check that tables were created:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('notifications', 'authorized_users', 'user_profiles');
```

2. Verify authorized users:

```sql
SELECT * FROM authorized_users;
```

## How It Works

### User Access Control Flow

1. **User Signs In** → Google OAuth
2. **Profile Check** → System checks if email is in `authorized_users` table
3. **Authorization**:
   - ✅ **Authorized**: User can access the application
   - ❌ **Not Authorized**: Redirected to `/unauthorized` page
4. **Profile Creation**: User profile is automatically created with authorization status

### Notifications System

#### Creating Notifications

You can create notifications programmatically or through the database:

**Option 1: Through Code (in your components)**

```typescript
import supabase from "../utils/supabase";

const createNotification = async () => {
  const { data, error } = await supabase.from("notifications").insert({
    user_id: user.id,
    type: "reminder", // or 'followup', 'call', 'meeting', 'task'
    title: "Follow up with John Doe",
    message: "Discuss the proposal details",
    scheduled_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
    is_read: false,
  });
};
```

**Option 2: Through SQL**

```sql
INSERT INTO notifications (user_id, type, title, message, scheduled_time)
VALUES
  ('user-uuid-here', 'reminder', 'Follow up with ABC Corp', 'Call regarding pricing', NOW() + INTERVAL '2 hours'),
  ('user-uuid-here', 'call', 'Schedule call with XYZ Ltd', 'Discuss timeline', NOW() + INTERVAL '1 day');
```

#### Notification Types

- **reminder**: General reminders (yellow icon)
- **followup**: Follow-up tasks (blue icon)
- **call**: Phone call reminders (green icon)
- **meeting**: Meeting schedules (purple icon)
- **task**: General tasks (gray icon)

## Managing Authorized Users

### Adding New Users

```sql
INSERT INTO authorized_users (email, role, is_active)
VALUES ('newuser@example.com', 'user', true)
ON CONFLICT (email) DO UPDATE SET is_active = true;
```

### Removing Access

```sql
UPDATE authorized_users
SET is_active = false
WHERE email = 'user@example.com';
```

### Changing Roles

```sql
UPDATE authorized_users
SET role = 'admin'
WHERE email = 'user@example.com';
```

### Viewing All Authorized Users

```sql
SELECT email, role, is_active, created_at
FROM authorized_users
ORDER BY created_at DESC;
```

## Testing the Features

### Test Notifications

1. **Add a test notification**:

```sql
INSERT INTO notifications (user_id, type, title, message, scheduled_time)
VALUES
  ((SELECT id FROM auth.users WHERE email = 'your-email@example.com'),
   'reminder',
   'Test Notification',
   'This is a test notification',
   NOW());
```

2. **Click the bell icon** in the navbar
3. **Verify**:
   - Notification appears in the modal
   - Unread count shows on the bell icon
   - You can mark as read or delete

### Test Access Control

1. **Sign in with an authorized email** → Should access the app
2. **Sign in with an unauthorized email** → Should see "Access Denied" page
3. **Add the unauthorized email to `authorized_users`** → Refresh → Should now have access

## Troubleshooting

### Issue: Notifications not showing

**Solution:**

1. Check if the notifications table exists
2. Verify RLS policies are enabled
3. Ensure user_id matches the authenticated user's ID

### Issue: User can't access despite being in authorized_users

**Solution:**

1. Check if `is_active` is `true`
2. Verify the email matches exactly (case-sensitive)
3. Try signing out and signing in again
4. Check browser console for errors

### Issue: Profile not created automatically

**Solution:**

1. Verify the trigger exists:

```sql
SELECT * FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
```

2. Manually create profile if needed:

```sql
INSERT INTO user_profiles (id, email, is_authorized)
VALUES
  ((SELECT id FROM auth.users WHERE email = 'user@example.com'),
   'user@example.com',
   true);
```

## Future Enhancements

### Planned Features

- [ ] Admin panel UI for managing authorized users
- [ ] Notification scheduling system
- [ ] Email notifications for important reminders
- [ ] Notification preferences/settings
- [ ] Bulk notification creation
- [ ] Notification templates

### Admin Panel (Coming Soon)

A dedicated admin interface will allow:

- Adding/removing authorized users through UI
- Managing user roles
- Viewing user activity
- Bulk user management

## Security Notes

- ✅ Row Level Security (RLS) is enabled on all tables
- ✅ Users can only see their own notifications
- ✅ Only admins can manage authorized users
- ✅ User profiles are automatically synced with auth
- ✅ Unauthorized users cannot access protected routes

## Support

For issues or questions:

- Email: careers@syntellite.com
- Check Supabase logs for database errors
- Review browser console for client-side errors

---

**Last Updated**: January 3, 2025
**Version**: 2.0.0
