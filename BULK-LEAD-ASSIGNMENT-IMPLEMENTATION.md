# Bulk Lead Assignment Feature - Implementation Summary

## Overview

This document describes the implementation of the bulk lead assignment feature that allows admins to assign leads to specific users in the lead management system.

## Features Implemented

### 1. Database Changes

- **File**: `add-lead-assignment.sql`
- Added `assigned_to` column to `leads` table (UUID, foreign key to auth.users)
- Created index on `assigned_to` for performance
- Added documentation comment

### 2. Bulk Edit Mode in LeadList

- **File**: `app/components/LeadList.js`
- Added "Bulk Edit" button that toggles bulk selection mode
- Added checkboxes to each lead row for selection
- Added "Select All" checkbox in table header
- Added "Assigned To" column showing user email
- Shows "Assign" button when leads are selected
- Integrated with AuthContext to get user role
- Regular users only see their assigned leads (filtered by `assigned_to`)
- Admins/superadmins see all leads

### 3. Assign Leads Modal

- **File**: `app/components/AssignLeadsModal.js`
- New modal component for assigning leads to users
- Search functionality to find users by email
- Dropdown showing user suggestions
- Displays selected user with role badge
- Assigns selected leads to chosen user
- Success/error messaging
- Fetches only authorized users from `user_profiles` table

### 4. Role-Based Visibility in Sidebar

- **File**: `app/components/Sidebar.tsx`
- Import CSV button only visible to admin/superadmin
- Bulk CSV button only visible to admin/superadmin
- Delete category button only visible to admin/superadmin
- Regular users only see:
  - View Leads button
  - Category selector
  - Refresh button
  - Analytics tab

### 5. Existing Role-Based Access in page.tsx

- Already implements category restrictions for regular users
- Users with `has_category_restrictions` only see assigned categories
- Admins/superadmins see all categories

## User Roles and Permissions

### Regular User (role: "user")

- Can view only their assigned leads
- Can view only their assigned categories
- Cannot import CSV files
- Cannot delete categories
- Can use bulk edit to assign leads (if they have permission)
- Can view analytics for their assigned leads

### Admin/Superadmin (role: "admin" or "superadmin")

- Can view all leads
- Can view all categories
- Can import CSV files (single and bulk)
- Can delete categories
- Can use bulk edit to assign leads
- Can view analytics for all leads
- Can access User Management

## Database Schema

```sql
-- leads table now includes:
ALTER TABLE leads
ADD COLUMN assigned_to UUID REFERENCES auth.users(id);

-- Index for performance
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
```

## Component Flow

### Bulk Assignment Workflow

1. User clicks "Bulk Edit" button
2. Checkboxes appear on each lead row
3. User selects leads (individual or "Select All")
4. "Assign" button appears in header
5. User clicks "Assign" button
6. AssignLeadsModal opens
7. User searches for and selects a user
8. User clicks "Assign Leads"
9. Selected leads are updated with `assigned_to` field
10. Modal closes and leads list refreshes
11. Bulk edit mode exits

### Lead Filtering for Regular Users

1. When fetching leads, check user role
2. If role is "user", add filter: `.eq("assigned_to", user.id)`
3. Only leads assigned to that user are returned
4. User sees only their assigned leads in the table

## Installation Instructions

### 1. Run Database Migration

Execute the SQL migration in your Supabase SQL Editor:

```bash
# Copy the contents of add-lead-assignment.sql and run in Supabase SQL Editor
```

Or use the Supabase CLI:

```bash
supabase db push
```

### 2. Verify Database Changes

Check that the `assigned_to` column exists:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'leads' AND column_name = 'assigned_to';
```

### 3. Test the Feature

1. Log in as an admin/superadmin
2. Navigate to a category with leads
3. Click "Bulk Edit" button
4. Select one or more leads
5. Click "Assign" button
6. Search for a user and select them
7. Click "Assign Leads"
8. Verify the "Assigned To" column shows the user's email
9. Log in as a regular user
10. Verify they only see their assigned leads

## Files Modified

### New Files

- `add-lead-assignment.sql` - Database migration
- `app/components/AssignLeadsModal.js` - Assignment modal component
- `BULK-LEAD-ASSIGNMENT-IMPLEMENTATION.md` - This documentation

### Modified Files

- `app/components/LeadList.js` - Added bulk edit mode, checkboxes, assigned column, role-based filtering
- `app/components/Sidebar.tsx` - Added role-based visibility for admin buttons

### Existing Files (No Changes Needed)

- `app/page.tsx` - Already has role-based category filtering
- `app/contexts/AuthContext.tsx` - Already provides user role information

## Key Features

### Bulk Selection

- Individual checkbox per lead
- "Select All" checkbox in header
- Visual feedback (highlighted rows) for selected leads
- Badge showing count of selected leads

### User Assignment

- Search users by email
- Shows user role in dropdown
- Visual confirmation of selected user
- Batch update of all selected leads

### Role-Based Access

- Regular users see only assigned leads
- Admins see all leads
- Import/delete buttons hidden from regular users
- Category restrictions enforced

### Performance Optimizations

- Index on `assigned_to` column for fast filtering
- Efficient user email fetching (batch query)
- Optimistic UI updates

## Security Considerations

1. **Row-Level Security**: Ensure RLS policies are updated to respect `assigned_to` field
2. **User Validation**: Only authorized users can be assigned leads
3. **Role Verification**: User role is verified server-side via AuthContext
4. **Category Restrictions**: Existing category restrictions still apply

## Future Enhancements

Potential improvements for future iterations:

- Bulk unassign functionality
- Assign to multiple users
- Assignment history/audit log
- Email notifications on assignment
- Reassignment workflow
- Lead ownership transfer
- Assignment analytics

## Troubleshooting

### Leads not filtering for regular users

- Check that user role is correctly set in `user_profiles` table
- Verify AuthContext is providing correct `userRole`
- Check browser console for any errors

### Assigned user email not showing

- Verify `assigned_to` column exists in database
- Check that user exists in `user_profiles` table
- Ensure user email is populated

### Cannot assign leads

- Verify user has permission to update leads
- Check Supabase RLS policies
- Ensure `assigned_to` column accepts UUID values

## Testing Checklist

- [ ] Database migration runs successfully
- [ ] Bulk Edit button appears for all users
- [ ] Checkboxes appear when Bulk Edit is active
- [ ] Select All checkbox works correctly
- [ ] Assign button appears when leads are selected
- [ ] AssignLeadsModal opens and closes properly
- [ ] User search works correctly
- [ ] Lead assignment updates database
- [ ] Assigned To column shows user email
- [ ] Regular users only see their assigned leads
- [ ] Admins see all leads
- [ ] Import/Delete buttons hidden from regular users
- [ ] Category restrictions still work
- [ ] Analytics shows correct data based on role

## Support

For issues or questions:

1. Check browser console for errors
2. Verify database schema matches expected structure
3. Check Supabase logs for any backend errors
4. Review RLS policies for leads table
5. Ensure user roles are correctly set

## Version History

- **v1.0** (Current) - Initial implementation
  - Bulk lead assignment
  - Role-based lead filtering
  - User assignment modal
  - Role-based UI visibility
