/**
 * Royal Mail Tracking API v2
 * Authentication: IBM API Connect key-based (Client ID + Secret as headers)
 */

// Result cache — avoids burning through rate limit on repeated lookups
const resultCache = new Map();
const RESULT_CACHE_TTL = 60 * 60 * 1000; // 1 hour

function detectCarrier(trackingCompany, trackingNumber) {
  const company = (trackingCompany || '').toLowerCase();
  if (company.includes('royal mail')) return 'royal_mail';
  if (company.includes('ups')) return 'ups';
  if (company.includes('dpd')) return 'dpd';
  // Pattern fallback: Royal Mail tracked format e.g. AB123456789GB
  if (trackingNumber && /^[A-Z]{2}\d{9}[A-Z]{2}$/i.test(trackingNumber)) return 'royal_mail';
  return 'unknown';
}

async function getRoyalMailDeliveryDate(trackingNumber) {
  const clientId = process.env.ROYAL_MAIL_CLIENT_ID;
  const clientSecret = process.env.ROYAL_MAIL_CLIENT_SECRET;

  const resp = await fetch(
    `https://api.royalmail.net/mailpieces/v2/${encodeURIComponent(trackingNumber)}/events`,
    {
      headers: {
        'X-IBM-Client-Id': clientId,
        'X-IBM-Client-Secret': clientSecret,
        'Accept': 'application/json',
      },
    }
  );

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Royal Mail tracking API ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  const events = data?.mailPieces?.events || [];

  const deliveryEvent = events.find(e =>
    e.eventName?.toLowerCase().includes('delivered')
  );

  return deliveryEvent ? new Date(deliveryEvent.eventDateTime) : null;
}

/**
 * Main entry point. Returns a normalised delivery check object.
 * status: 'delivered' | 'in_transit' | 'unavailable' | 'error'
 * isEligibleForReturn: true | false | null
 */
async function checkDelivery(trackingNumber, trackingCompany) {
  const carrier = detectCarrier(trackingCompany, trackingNumber);

  if (carrier !== 'royal_mail') {
    return { status: 'unavailable', isEligibleForReturn: null, deliveredDate: null, daysRemaining: null, carrier };
  }

  // Check result cache
  const cached = resultCache.get(trackingNumber);
  if (cached && (Date.now() - cached.timestamp) < RESULT_CACHE_TTL) {
    return cached.result;
  }

  try {
    const deliveredDate = await getRoyalMailDeliveryDate(trackingNumber);

    let result;
    if (!deliveredDate) {
      result = { status: 'in_transit', isEligibleForReturn: null, deliveredDate: null, daysRemaining: null, carrier };
    } else {
      const diffDays = Math.floor((Date.now() - deliveredDate.getTime()) / (1000 * 60 * 60 * 24));
      result = {
        status: 'delivered',
        isEligibleForReturn: diffDays <= 14,
        deliveredDate: deliveredDate.toISOString(),
        daysRemaining: Math.max(0, 14 - diffDays),
        carrier,
      };
    }

    resultCache.set(trackingNumber, { result, timestamp: Date.now() });
    return result;
  } catch (err) {
    const fs = require('fs'), path = require('path');
    fs.appendFileSync(path.join(__dirname, '..', 'data', 'tracking-debug.log'), new Date().toISOString() + ' RM_ERROR: ' + err.message + ' | cause: ' + (err.cause?.message || err.cause || 'none') + '\n');
    return { status: 'error', isEligibleForReturn: null, deliveredDate: null, daysRemaining: null, carrier };
  }
}

module.exports = { checkDelivery };
