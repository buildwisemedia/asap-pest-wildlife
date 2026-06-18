# GTM Phone Click & Email Click Tracking Setup

## Overview
This document describes how to configure Google Tag Manager to properly track `phone_click` and `email_click` events fired by the attribution.js tracking script on the ASAP Pest & Wildlife website.

## Current Implementation
The website fires two types of events via a delegated event listener on tel: and mailto: links:
- **phone_click**: Fired when users click tel: links
- **email_click**: Fired when users click mailto: links

Both events are sent to:
1. **dataLayer** (for GTM capture)
2. **gtag/GA4** (direct to Google Analytics 4)

## Event Parameters

### phone_click Event
```javascript
{
  event: 'phone_click',
  phone_number_redacted: '3636',        // Last 4 digits only (privacy protection)
  page_path: '/path/to/page',          // The page where click occurred
  page_referrer: 'https://...'         // Referrer URL
}
```

### email_click Event
```javascript
{
  event: 'email_click',
  email_domain: 'removeasap.com',      // Domain extracted from email (privacy protection)
  page_path: '/path/to/page',          // The page where click occurred
  page_referrer: 'https://...'         // Referrer URL
}
```

## GTM Configuration

### Step 1: Create Custom Event Trigger for phone_click

1. Go to **Google Tag Manager** → **Triggers**
2. Click **New** to create a new trigger
3. Configure as follows:
   - **Trigger Name**: `Phone Click`
   - **Trigger Type**: `Custom Event`
   - **Event name**: `phone_click`
   - **This trigger fires on**: `All Custom Events`
4. Save the trigger

### Step 2: Create GA4 Tag for phone_click

1. Go to **Google Tag Manager** → **Tags**
2. Click **New** to create a new tag
3. Configure as follows:
   - **Tag Name**: `GA4 - Phone Click`
   - **Tag Type**: `Google Analytics: GA4 Event`
   - **Measurement ID**: `G-8M705Z89TE`
   - **Event name**: `phone_click`
   - **Event parameters**: Click **Add Row** for each parameter:
     - **Parameter name**: `phone_number_redacted` | **Value**: `{{phone_number_redacted}}`
     - **Parameter name**: `page_path` | **Value**: `{{page_path}}`
     - **Parameter name**: `page_referrer` | **Value**: `{{page_referrer}}`
   - **Firing trigger**: Select `Phone Click` (from Step 1)
4. Save the tag

### Step 3: Create Custom Event Trigger for email_click

1. Go to **Google Tag Manager** → **Triggers**
2. Click **New** to create a new trigger
3. Configure as follows:
   - **Trigger Name**: `Email Click`
   - **Trigger Type**: `Custom Event`
   - **Event name**: `email_click`
   - **This trigger fires on**: `All Custom Events`
4. Save the trigger

### Step 4: Create GA4 Tag for email_click

1. Go to **Google Tag Manager** → **Tags**
2. Click **New** to create a new tag
3. Configure as follows:
   - **Tag Name**: `GA4 - Email Click`
   - **Tag Type**: `Google Analytics: GA4 Event`
   - **Measurement ID**: `G-8M705Z89TE`
   - **Event name**: `email_click`
   - **Event parameters**: Click **Add Row** for each parameter:
     - **Parameter name**: `email_domain` | **Value**: `{{email_domain}}`
     - **Parameter name**: `page_path` | **Value**: `{{page_path}}`
     - **Parameter name**: `page_referrer` | **Value**: `{{page_referrer}}`
   - **Firing trigger**: Select `Email Click` (from Step 3)
4. Save the tag

## Optional: Add as GA4 Conversions

To track phone clicks and email clicks as conversions:

1. In **Google Analytics 4**, go to **Admin** → **Events**
2. Click **Create event**
3. Configure:
   - **Event name**: `phone_click`
   - **Matching condition**: `event_name` equals `phone_click`
4. Mark as conversion (toggle **Mark as conversion** in GA4 interface)
5. Repeat for `email_click`

## Optional: Add to Meta Pixel

To also track these events in Meta Pixel, add the following to a custom tag:

```javascript
if (typeof window.fbq === 'function') {
  fbq('track', 'Contact', {
    phone_last4: {{phone_number_redacted}},
    source_page: {{page_path}}
  });
}
```

Trigger: `Phone Click` custom event

## Testing

To verify the setup is working:

1. Go to **Google Tag Manager** → **Preview** mode
2. Navigate to the website in the preview window
3. Click a tel: or mailto: link
4. In the GTM preview panel, you should see the `phone_click` or `email_click` custom event fire
5. The GA4 tag should also fire with the event parameters

## Privacy Considerations

- **Phone numbers**: Only the last 4 digits are captured
- **Email addresses**: Only the domain is captured (not the full email)
- **Page referrer**: Full URL is captured; ensure GTM's data retention policy is appropriate

## Support

For questions about this setup, contact the Buildwise team.
