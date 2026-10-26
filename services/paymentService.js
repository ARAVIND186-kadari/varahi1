/**
 * ============================================================================
 *  PAYMENT SERVICE  —  Razorpay integration module (PLACEHOLDER / NOT WIRED)
 * ============================================================================
 *
 *  STATUS: `not_configured`
 *
 *  This module is the single place where Razorpay will be wired in later.
 *  The checkout flow, the order record and the admin dashboard already call
 *  into it, so enabling real payments later does NOT require rebuilding the
 *  checkout — only filling in the marked sections below.
 *
 *  ---------------------------------------------------------------------------
 *  WHAT TO DO WHEN YOU HAVE RAZORPAY KEYS  (future work, not now)
 *  ---------------------------------------------------------------------------
 *  1. `npm install razorpay`                       (server-side only)
 *  2. Put the keys in SERVER environment variables — never in frontend code:
 *         RAZORPAY_KEY_ID          (Dashboard -> Settings -> API Keys)
 *         RAZORPAY_KEY_SECRET      (Dashboard -> Settings -> API Keys)
 *         RAZORPAY_WEBHOOK_SECRET  (Dashboard -> Webhooks -> your webhook secret)
 *  3. Complete the section marked  `>>> FUTURE RAZORPAY INTEGRATION <<<`
 *     inside each function below.
 *  4. Flip `getStatus()` to return `configured` once the keys are present.
 *
 *  SECURITY RULES THAT ALREADY APPLY HERE:
 *    - Secret keys are read from `process.env` only. They are NEVER returned
 *      to the browser, never logged, and never written to data/*.json.
 *    - `describeConfig()` only reports whether a key EXISTS (boolean).
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// Environment presence checks — booleans only, the values never leave server.
// ---------------------------------------------------------------------------
function envFlags() {
  return {
    hasKeyId: !!process.env.RAZORPAY_KEY_ID,
    hasKeySecret: !!process.env.RAZORPAY_KEY_SECRET,
    hasWebhookSecret: !!process.env.RAZORPAY_WEBHOOK_SECRET
  };
}

function allCredentialsPresent() {
  const f = envFlags();
  return f.hasKeyId && f.hasKeySecret && f.hasWebhookSecret;
}

const NOT_CONFIGURED_MESSAGE =
  'Online payment is not configured yet. No payment was attempted and no money was collected.';

const paymentService = {
  provider: 'razorpay',

  /**
   * Single source of truth for the payment integration status.
   * Consumed by: GET /api/integrations (customer checkout)
   *              GET /api/admin/integrations (admin dashboard)
   */
  getStatus() {
    if (!allCredentialsPresent()) {
      return {
        provider: 'razorpay',
        status: 'not_configured',
        message: NOT_CONFIGURED_MESSAGE,
        credentials: envFlags()
      };
    }
    // >>> FUTURE RAZORPAY INTEGRATION <<<
    // When credentials exist but the SDK is still not installed/verified,
    // keep reporting 'not_configured' so the UI never claims a working gateway.
    return {
      provider: 'razorpay',
      status: 'not_configured',
      message: 'Credentials present — SDK wiring still required.',
      credentials: envFlags()
    };
  },

  /** Safe, secret-free description used by the admin dashboard. */
  describeConfig() {
    const flags = envFlags();
    return {
      provider: 'razorpay',
      status: allCredentialsPresent() ? 'not_configured' : 'not_configured',
      label: 'Not configured',
      requiredEnvVars: [
        'RAZORPAY_KEY_ID',
        'RAZORPAY_KEY_SECRET',
        'RAZORPAY_WEBHOOK_SECRET'
      ],
      configuredEnvVars: Object.keys(flags).filter(k => flags[k]),
      docs: 'https://razorpay.com/docs/payments/server-integration/nodejs/'
    };
  },

  /**
   * STEP 1 — Create a payment order on the gateway.
   *
   * >>> FUTURE RAZORPAY INTEGRATION <<<
   *   const Razorpay = require('razorpay');
   *   const instance = new Razorpay({
   *     key_id: process.env.RAZORPAY_KEY_ID,
   *     key_secret: process.env.RAZORPAY_KEY_SECRET
   *   });
   *   const rzpOrder = await instance.orders.create({
   *     amount: Math.round(amountRupees * 100), // paise
   *     currency: 'INR',
   *     receipt: orderRef,
   *     notes: { orderRef }
   *   });
   *   return { status: 'created', gatewayOrderId: rzpOrder.id, ... };
   *
   * @param {{orderId:string, amount:number, currency?:string}} input
   * @returns {Promise<object>} never opens Razorpay Checkout while unconfigured
   */
  async createPaymentOrder(input) {
    if (!allCredentialsPresent()) {
      return {
        status: 'not_configured',
        gatewayOrderId: null,
        error: 'RAZORPAY_NOT_CONFIGURED',
        message: NOT_CONFIGURED_MESSAGE,
        received: input ? { orderId: input.orderId, amount: input.amount } : null
      };
    }
    // >>> FUTURE RAZORPAY INTEGRATION <<<  (see docblock above)
    return { status: 'not_configured', gatewayOrderId: null };
  },

  /**
   * STEP 2 — Verify the checkout callback signature server-side.
   *
   * >>> FUTURE RAZORPAY INTEGRATION <<<
   *   const crypto = require('crypto');
   *   const expected = crypto
   *     .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
   *     .update(`${razorpayOrderId}|${razorpayPaymentId}`)
   *     .digest('hex');
   *   const valid = expected === razorpaySignature;
   *   return { status: valid ? 'paid' : 'failed', verified: valid };
   *
   * @returns {Promise<object>} `verified:false` while unconfigured — the UI
   *          must never treat this as a successful payment.
   */
  async verifyPayment({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
    if (!allCredentialsPresent()) {
      return {
        status: 'not_configured',
        verified: false,
        error: 'RAZORPAY_NOT_CONFIGURED',
        message: NOT_CONFIGURED_MESSAGE
      };
    }
    // >>> FUTURE RAZORPAY INTEGRATION <<<  (see docblock above)
    return { status: 'not_configured', verified: false };
  },

  /**
   * STEP 3 — Handle Razorpay webhooks (payment.captured, payment.failed, ...).
   *
   * >>> FUTURE RAZORPAY INTEGRATION <<<
   *   1. Verify header `x-razorpay-signature` with process.env.RAZORPAY_WEBHOOK_SECRET
   *   2. JSON.parse(rawBody)
   *   3. On payment.captured -> recordPaymentStatus(orderRef, 'paid', ...)
   *   4. On payment.failed   -> recordPaymentStatus(orderRef, 'failed', ...)
   *   5. Return res.status(200) quickly (Razorpay retries on non-2xx).
   *
   * @param {string} rawBody  exact raw request body (needed for HMAC compare)
   * @param {string} signature value of the x-razorpay-signature header
   */
  async handleWebhook(rawBody, signature) {
    if (!allCredentialsPresent()) {
      return {
        status: 'not_configured',
        accepted: false,
        error: 'RAZORPAY_NOT_CONFIGURED',
        message: 'Webhook ignored: payment gateway is not configured.'
      };
    }
    // >>> FUTURE RAZORPAY INTEGRATION <<<  (see docblock above)
    return { status: 'not_configured', accepted: false };
  },

  /**
   * STEP 4 — Persist payment status on the order record.
   *
   * This one WORKS TODAY with local storage: it only writes a status field to
   * data/orders.json, so the admin dashboard can already display it. No
   * gateway call is involved, therefore it can never fake a successful payment
   * while the gateway is unconfigured — callers pass 'not_configured'.
   *
   * @param {string} orderId   internal order ref, e.g. VT-2026-0007
   * @param {string} status    'not_configured' | 'created' | 'paid' | 'failed' | 'refunded'
   * @param {object} [meta]    gateway ids / error details (never secrets)
   */
  recordPaymentStatus(orderId, status, meta = {}) {
    const db = require('../database');
    const order = db.getOrderById(orderId);
    if (!order) return null;
    return db.updateOrderPayment(orderId, {
      paymentStatus: status,
      paymentProvider: 'razorpay',
      paymentMeta: meta,
      paymentUpdatedAt: new Date().toISOString()
    });
  },

  /** Convenience flag used by the checkout UI copy. */
  isConfigured() {
    return false; // flip to `allCredentialsPresent()` once the SDK is wired up
  }
};

module.exports = paymentService;
