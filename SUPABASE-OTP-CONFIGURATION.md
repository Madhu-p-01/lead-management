# Supabase OTP Configuration Guide

## Issue: Receiving Magic Link Instead of 6-Digit OTP

By default, Supabase's `signInWithOtp` sends a **magic link** email, not a numeric OTP code. To receive a 6-digit OTP code instead, you need to configure Supabase properly.

## Solution: Configure Supabase for Numeric OTP

### Step 1: Access Supabase Dashboard

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Authentication** → **Email Templates**

### Step 2: Modify Email Template

You have two options:

#### Option A: Use Magic Link (Current Behavior)

The current implementation sends a magic link. Users click the link in their email to log in automatically.

**Pros:**

- No need to type anything
- One-click login
- More user-friendly

**Cons:**

- Requires clicking email link
- May not work if email client blocks links

#### Option B: Configure for 6-Digit OTP (Recommended for Your Use Case)

To get a 6-digit OTP code, you need to:

1. **Enable OTP in Supabase Settings**:

   - Go to **Authentication** → **Settings**
   - Scroll to **Email Auth**
   - Enable "Enable email confirmations"
   - Set OTP expiry time (default: 3600 seconds / 1 hour)

2. **Customize Email Template**:
   - Go to **Authentication** → **Email Templates**
   - Select "Magic Link" template
   - Replace the template with this OTP-focused version:

```html
<h2>Your Login Code for LeadFlow</h2>

<p>Hello,</p>

<p>Use the following 6-digit code to log in to your LeadFlow account:</p>

<div
  style="background-color: #f0f0f0; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;"
>
  <h1
    style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #2563eb; margin: 0;"
  >
    {{ .Token }}
  </h1>
</div>

<p><strong>This code will expire in 60 minutes.</strong></p>

<p>If you didn't request this code, you can safely ignore this email.</p>

<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />

<p style="color: #6b7280; font-size: 12px;">
  This is an automated message from LeadFlow by Syntellite Innovations Private
  Limited.
</p>
```

### Step 3: Update Supabase Configuration

In your Supabase Dashboard:

1. **Authentication** → **URL Configuration**:

   - Site URL: `https://leadflow.syntellite.com`
   - Redirect URLs:
     ```
     http://localhost:3000
     http://localhost:3000/auth/callback
     https://leadflow.syntellite.com
     https://leadflow.syntellite.com/auth/callback
     ```

2. **Authentication** → **Providers**:
   - Ensure "Email" provider is enabled
   - Disable "Confirm email" if you want passwordless OTP only

### Step 4: Test the Configuration

1. Clear your browser cache and cookies
2. Go to your login page
3. Enter a @syntellite.com email
4. Check your email - you should now receive a 6-digit code
5. Enter the code to complete login

## Alternative: Use Magic Link Flow

If you prefer to keep the magic link flow (which is actually more secure and user-friendly), you can modify the login page to support both:

### Modified Login Flow for Magic Link

```typescript
const handleSendMagicLink = async (e: React.FormEvent) => {
  e.preventDefault();
  setError("");

  if (!email || !validateEmail(email)) {
    setError("Please use a valid @syntellite.com email address");
    return;
  }

  setIsLoading(true);

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) throw error;

    // Show success message
    setStep("check-email");
    setError("");
  } catch (error: any) {
    console.error("Magic link send error:", error);
    setError(error.message || "Failed to send magic link. Please try again.");
  } finally {
    setIsLoading(false);
  }
};
```

Then update the UI to show:

```
"Check your email! We've sent you a magic link to log in."
```

## Recommended Approach

For your use case with @syntellite.com domain restriction, I recommend:

### Option 1: Numeric OTP (Current Implementation)

**Best for:** Internal tools, corporate environments

- More familiar to users
- Works even if email links are blocked
- Users can type the code from any device

### Option 2: Magic Link

**Best for:** Consumer applications, ease of use

- One-click login
- No typing required
- More secure (link expires after use)

## Current Code Status

The current implementation in `app/login/page.tsx` is set up for **numeric OTP verification**. However, Supabase by default sends magic links.

### To Make It Work with Numeric OTP:

You need to configure Supabase to send the token in the email template as shown above. The `{{ .Token }}` variable in the email template will contain the 6-digit code.

### To Switch to Magic Link:

If you prefer magic link, update the login page to remove the OTP input step and instead show a "Check your email" message after sending the link.

## Testing

### Test Numeric OTP:

1. Configure email template with `{{ .Token }}`
2. Send OTP
3. Check email for 6-digit code
4. Enter code in app
5. Verify login works

### Test Magic Link:

1. Keep default email template
2. Send magic link
3. Click link in email
4. Verify automatic login

## Troubleshooting

### Still Receiving Magic Link?

- Clear Supabase email template cache
- Wait 5 minutes for changes to propagate
- Check email template is saved correctly
- Verify `{{ .Token }}` is in the template

### OTP Not Working?

- Check OTP expiry time in settings
- Verify email template shows token
- Check spam folder
- Try resending OTP

### Email Not Received?

- Check Supabase email quota
- Verify email provider settings
- Check spam/junk folder
- Try different email address

## Production Checklist

- [ ] Configure Supabase email template for OTP
- [ ] Set appropriate OTP expiry time
- [ ] Test OTP flow end-to-end
- [ ] Configure production redirect URLs
- [ ] Test email delivery in production
- [ ] Set up email monitoring
- [ ] Document user instructions

## Support

If you continue to have issues:

1. Check Supabase logs in Dashboard → Logs
2. Verify email template configuration
3. Test with different email addresses
4. Contact Supabase support if needed

## Next Steps

1. **Decide on authentication method**: OTP vs Magic Link
2. **Configure Supabase accordingly**
3. **Update email template**
4. **Test thoroughly**
5. **Deploy to production**
