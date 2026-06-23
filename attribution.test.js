/**
 * Phone Click & Email Click Tracking Tests
 * Verifies that phone_click and email_click events fire correctly to dataLayer and gtag
 */

// Mock setup
const mockDataLayer = [];
const mockGtagCalls = [];

function setupMocks() {
  window.dataLayer = mockDataLayer;
  window.gtag = function() {
    mockGtagCalls.push(Array.from(arguments));
  };
  window.__bwmLoadAnalytics = function() {};
}

function cleanupMocks() {
  mockDataLayer.length = 0;
  mockGtagCalls.length = 0;
  delete window.dataLayer;
  delete window.gtag;
  delete window.__bwmLoadAnalytics;
}

function test(name, fn) {
  try {
    fn();
    console.log('✓ ' + name);
    return true;
  } catch (e) {
    console.error('✗ ' + name);
    console.error('  ' + e.message);
    return false;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// Test: phone_click event includes required fields
test('phone_click event includes required fields', function() {
  setupMocks();

  const link = document.createElement('a');
  link.href = 'tel:7706913636';
  document.body.appendChild(link);

  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  link.dispatchEvent(event);

  const phoneClickEvent = mockDataLayer.find(e => e && e.event === 'phone_click');
  assert(phoneClickEvent, 'phone_click event should be in dataLayer');
  assert(phoneClickEvent.phone_number_redacted === '3636', 'phone_number_redacted should be last 4 digits');
  assert(phoneClickEvent.page_path !== undefined, 'page_path should be present');
  assert(phoneClickEvent.page_referrer !== undefined, 'page_referrer should be present');

  document.body.removeChild(link);
  cleanupMocks();
});

// Test: email_click event structure
test('email_click event includes required fields', function() {
  setupMocks();

  const link = document.createElement('a');
  link.href = 'mailto:info@removeasap.com';
  document.body.appendChild(link);

  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  link.dispatchEvent(event);

  const emailClickEvent = mockDataLayer.find(e => e && e.event === 'email_click');
  assert(emailClickEvent, 'email_click event should be in dataLayer');
  assert(emailClickEvent.email_domain === 'removeasap.com', 'email_domain should extract domain');
  assert(emailClickEvent.page_path !== undefined, 'page_path should be present');

  document.body.removeChild(link);
  cleanupMocks();
});

// Test: phone number redaction
test('phone number is properly redacted', function() {
  const testCases = [
    { input: 'tel:7706913636', expected: '3636' },
    { input: 'tel:+1-770-691-3636', expected: '3636' }
  ];

  testCases.forEach(function(testCase) {
    const digits = String(testCase.input).replace(/\D/g, '');
    const redacted = digits.length >= 4 ? digits.slice(-4) : '';
    assert(redacted === testCase.expected, 'Redaction failed for ' + testCase.input);
  });
});

// Test: email domain extraction
test('email domain is properly extracted', function() {
  const testCases = [
    { input: 'mailto:info@removeasap.com', expected: 'removeasap.com' }
  ];

  testCases.forEach(function(testCase) {
    const addr = String(testCase.input).replace(/^mailto:/i, '').split(/[?#]/)[0];
    const at = addr.indexOf('@');
    const domain = at >= 0 ? addr.slice(at + 1).toLowerCase() : '';
    assert(domain === testCase.expected, 'Domain extraction failed');
  });
});

console.log('=== Phone Click & Email Click Tracking Tests ===');
