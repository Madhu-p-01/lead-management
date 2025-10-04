# Deployment Guide - Lead Management System

## Vercel Deployment Error Fix

### Error
```
Error: supabaseUrl is required.
```

This error occurs because environment variables are not configured in Vercel.

## Solution: Configure Environment Variables in Vercel

### Step 1: Go to Vercel Dashboard
1. Open https://vercel.com/dashboard
2. Select your project: `lead-management`
3. Go to **Settings** → **Environment Variables**

### Step 2: Add Required Environment Variables

Add these two environment variables:

#### Variable 1: NEXT_PUBLIC_SUPABASE_URL
- **Key**: `NEXT_PUBLIC_SUPABASE_URL`
- **Value**: `https://ykhdjojwsgcoiduxdlte.supabase.co`
- **Environment**: Select all (Production, Preview, Development)

#### Variable 2: NEXT_PUBLIC_SUPABASE_ANON_KEY
- **Key**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Value**: Your Supabase anon key (from `.env.local` file)
- **Environment**: Select all (Production, Preview, Development)

### Step 3: Get Your Supabase Anon Key

If you don't have it handy:
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **API**
4. Copy the `anon` `public` key

### Step 4: Redeploy

After adding the environment variables:
1. Go to **Deployments** tab in Vercel
2. Click on the latest failed deployment
3. Click **Redeploy** button
4. Or push a new commit to trigger automatic deployment

## Verification

After successful deployment:
1. Visit your deployed URL
2. Test login functionality
3. Verify all features work correctly

## Important Notes

- ✅ The loading issues we fixed are code-level fixes and will work in production
- ✅ Environment variables are required for the build to succeed
- ✅ Make sure to select all environments when adding variables
- ✅ Never commit `.env.local` to Git (it's already in `.gitignore`)

## Supabase Configuration for Production

Make sure your Supabase project has these redirect URLs configured:

### In Supabase Dashboard → Authentication → URL Configuration

**Site URL**: `https://your-app.vercel.app`

**Redirect URLs**:
- `http://localhost:3000`
- `http://localhost:3000/auth/callback`
- `https://your-app.vercel.app`
- `https://your-app.vercel.app/auth/callback`

Replace `your-app.vercel.app` with your actual Vercel deployment URL.

## Troubleshooting

### Build Still Failing?
1. Double-check environment variable names (they're case-sensitive)
2. Ensure values don't have extra spaces
3. Make sure you selected all environments
4. Try clearing build cache in Vercel settings

### OAuth Not Working in Production?
1. Verify redirect URLs in Supabase
2. Check that environment variables are set correctly
3. Ensure Site URL matches your production domain

## Summary of Fixes Applied

### Code Fixes (Already Implemented)
✅ Fixed infinite loop in loadCategories
✅ Fixed duplicate authorization checks
✅ Fixed tab switching issues
✅ Added proper session persistence
✅ Optimized auth state management

### Deployment Requirements
⚠️ Add environment variables in Vercel
⚠️ Configure Supabase redirect URLs
⚠️ Redeploy after configuration
