#!/bin/bash
# Gate-build validation for ASAP Pest & Wildlife GTM phone_click tracking

set -e

ERRORS=0
WARNINGS=0

echo "=== ASAP Pest & Wildlife GTM Tag Mapping Validation ==="
echo ""

# Check 1: Verify attribution.js exists and contains phone_click handler
echo "✓ Checking attribution.js has phone_click event..."
if grep -q "phone_click" attribution.js; then
  echo "  ✓ phone_click event handler found"
else
  echo "  ✗ phone_click event handler NOT found"
  ERRORS=$((ERRORS + 1))
fi

# Check 2: Verify dataLayer event firing
if grep -q "window.dataLayer.push" attribution.js; then
  echo "  ✓ dataLayer.push found for GTM integration"
else
  echo "  ✗ dataLayer.push NOT found"
  ERRORS=$((ERRORS + 1))
fi

# Check 3: Verify gtag event firing with beacon transport
if grep -q "transport_type.*beacon" attribution.js; then
  echo "  ✓ beacon transport configured for tel/mailto navigation"
else
  echo "  ✗ beacon transport NOT configured"
  ERRORS=$((ERRORS + 1))
fi

# Check 4: Verify privacy redaction (last 4 digits only)
if grep -q "phone_number_redacted" attribution.js; then
  echo "  ✓ phone_number_redacted parameter found (privacy protection)"
else
  echo "  ✗ phone_number_redacted NOT found"
  ERRORS=$((ERRORS + 1))
fi

# Check 5: Verify email_click handler
if grep -q "email_click" attribution.js && grep -q "email_domain" attribution.js; then
  echo "  ✓ email_click event with email_domain extraction found"
else
  echo "  ✗ email_click handler incomplete"
  ERRORS=$((ERRORS + 1))
fi

# Check 6: Verify HTML files have GTM container
echo ""
echo "✓ Checking GTM container ID in HTML..."
if grep -q "GTM-K953HZ9R" index.html; then
  echo "  ✓ GTM container ID found"
else
  echo "  ✗ GTM container ID NOT found"
  ERRORS=$((ERRORS + 1))
fi

# Check 7: Verify GA4 measurement ID
if grep -q "G-8M705Z89TE" index.html; then
  echo "  ✓ GA4 measurement ID found"
else
  echo "  ✗ GA4 measurement ID NOT found"
  ERRORS=$((ERRORS + 1))
fi

# Check 8: Verify attribution.js is loaded in HTML
echo ""
echo "✓ Checking attribution.js is included in HTML..."
if grep -q "attribution.js" index.html; then
  echo "  ✓ attribution.js included in HTML"
else
  echo "  ✗ attribution.js NOT included in HTML"
  ERRORS=$((ERRORS + 1))
fi

# Check 9: Verify tel: and mailto: links exist on site
echo ""
echo "✓ Checking for tel: and mailto: links..."
TEL_COUNT=$(grep -r "href=\"tel:" . --include="*.html" 2>/dev/null | wc -l)
MAILTO_COUNT=$(grep -r "href=\"mailto:" . --include="*.html" 2>/dev/null | wc -l)

if [ "$TEL_COUNT" -gt 0 ]; then
  echo "  ✓ Found $TEL_COUNT tel: links"
else
  echo "  ✗ No tel: links found"
  WARNINGS=$((WARNINGS + 1))
fi

if [ "$MAILTO_COUNT" -gt 0 ]; then
  echo "  ✓ Found $MAILTO_COUNT mailto: links"
else
  echo "  ✗ No mailto: links found"
  WARNINGS=$((WARNINGS + 1))
fi

# Check 10: Verify test file exists
echo ""
echo "✓ Checking test file..."
if [ -f "attribution.test.js" ]; then
  echo "  ✓ attribution.test.js exists"
else
  echo "  ✗ attribution.test.js NOT found"
  ERRORS=$((ERRORS + 1))
fi

# Summary
echo ""
echo "=== Validation Summary ==="
if [ $ERRORS -eq 0 ]; then
  echo "✓ All checks passed"
else
  echo "✗ $ERRORS error(s) found"
fi

if [ $WARNINGS -gt 0 ]; then
  echo "⚠ $WARNINGS warning(s)"
fi

echo ""
echo "GTM Tag Configuration Required:"
echo "1. In Google Tag Manager, create a tag for the 'phone_click' event:"
echo "   - Trigger: Custom Event → Event name = 'phone_click'"
echo "   - Tag: Google Analytics 4 Event"
echo "   - Event name: phone_click"
echo "   - Event parameters:"
echo "     - phone_number_redacted (from dataLayer)"
echo "     - page_path (from dataLayer)"
echo "     - page_referrer (from dataLayer)"
echo ""
echo "2. Create a tag for the 'email_click' event:"
echo "   - Trigger: Custom Event → Event name = 'email_click'"
echo "   - Tag: Google Analytics 4 Event"
echo "   - Event name: email_click"
echo "   - Event parameters:"
echo "     - email_domain (from dataLayer)"
echo "     - page_path (from dataLayer)"
echo "     - page_referrer (from dataLayer)"
echo ""

exit $ERRORS
