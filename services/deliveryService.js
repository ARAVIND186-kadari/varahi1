/**
 * ============================================================================
 *  DELIVERY SERVICE  —  Shiprocket integration module (PLACEHOLDER / NOT WIRED)
 * ============================================================================
 *
 *  STATUS: `not_configured`
 *
 *  This module is the single place where Shiprocket will be wired in later.
 *  The checkout, the order record and the admin dashboard already call into
 *  it, so enabling real delivery later does NOT require rebuilding checkout.
 *
 *  ---------------------------------------------------------------------------
 *  WHAT TO DO WHEN YOU HAVE SHIPROCKET CREDENTIALS  (future work, not now)
 *  ---------------------------------------------------------------------------
 *  1. Put the credentials in SERVER environment variables — never frontend:
 *         SHIPROCKET_EMAIL      (or)  SHIPROCKET_API_TOKEN
 *         SHIPROCKET_PASSWORD
 *  2. Complete the section marked  `>>> FUTURE SHIPROCKET INTEGRATION <<<`
 *     inside each function below.
 *  3. Flip `getStatus()` to return `configured` and switch the customer-facing
 *     delivery charge from the "development estimate" to live rates.
 *
 *  RULES ENFORCED TODAY:
 *    - No shipping rate is ever requested from Shiprocket.
 *    - No location-based delivery charge is ever invented.
 *    - Any manual fee is labelled a DEVELOPMENT ESTIMATE by the caller.
 * ============================================================================
 */

const NOT_CONFIGURED_MESSAGE =
  'Delivery integration is not configured yet. No shipping rate was requested.';

function envFlags() {
  return {
    hasEmail: !!process.env.SHIPROCKET_EMAIL,
    hasPassword: !!process.env.SHIPROCKET_PASSWORD,
    hasApiToken: !!(process.env.SHIPROCKET_API_TOKEN || process.env.SHIPROCKET_TOKEN)
  };
}

function anyCredentialsPresent() {
  const f = envFlags();
  return f.hasApiToken || (f.hasEmail && f.hasPassword);
}

const deliveryService = {
  provider: 'shiprocket',

  /** Default parcel profile used until real packaging data is available. */
  defaultParcel: {
    // PLACEHOLDER DIMENSIONS — replace with actual packaging sizes later.
    lengthCm: 25,
    widthCm: 20,
    heightCm: 10,
    // PLACEHOLDER WEIGHT per unit — replace with weighed packaging later.
    approxGramsPerItem: 250
  },

  getStatus() {
    return {
      provider: 'shiprocket',
      status: anyCredentialsPresent() ? 'not_configured' : 'not_configured',
      message: NOT_CONFIGURED_MESSAGE,
      credentials: envFlags()
    };
  },

  /** Safe, secret-free description used by the admin dashboard. */
  describeConfig() {
    const flags = envFlags();
    return {
      provider: 'shiprocket',
      status: 'not_configured',
      label: 'Not configured',
      requiredEnvVars: ['SHIPROCKET_EMAIL', 'SHIPROCKET_PASSWORD'],
      optionalEnvVars: ['SHIPROCKET_API_TOKEN'],
      configuredEnvVars: Object.keys(flags).filter(k => flags[k]),
      docs: 'https://apiv2.shiprocket.co/'
    };
  },

  /**
   * Build the exact payload Shiprocket will need for a shipment.
   * Works today so the checkout/order model is already integration-ready:
   *   - restaurant pickup address  (from settings.address)
   *   - customer PIN code          (order.pinCode)
   *   - parcel weight              (order.parcel.weightGrams)
   *   - parcel dimensions          (order.parcel.lengthCm/widthCm/heightCm)
   *
   * @param {object} order  stored order record
   * @param {object} settings restaurant settings
   */
  buildShipmentContext(order, settings) {
    const parcel = order.parcel || {};
    return {
      pickup: {
        pickup_name: (settings && settings.restaurantName) || 'Varahi Tiffins',
        pickup_address: (settings && settings.address) || '',
        pickup_pincode: (settings && settings.pickupPincode) || '', // set once confirmed
        pickup_phone: (settings && settings.phone) || ''
      },
      delivery: {
        // Full address is already stored on the order; PIN drives rate lookup.
        address: order.deliveryAddress || '',
        pincode: order.pinCode || '',
        city: order.deliveryCity || '',
        state: order.deliveryState || '',
        phone: order.customerPhone || '',
        name: order.customerName || ''
      },
      parcel: {
        weight: parcel.weightGrams || null,     // grams
        length: parcel.lengthCm || null,        // cm
        width: parcel.widthCm || null,
        height: parcel.heightCm || null
      },
      orderReference: order.id
    };
  },

  /**
   * STEP 1 — Quote a delivery charge for a destination PIN code.
   *
   * >>> FUTURE SHIPROCKET INTEGRATION <<<
   *   1. Authenticate: POST https://apiv2.shiprocket.co/v1/auth/login
   *      { email: process.env.SHIPROCKET_EMAIL, password: process.env.SHIPROCKET_PASSWORD }
   *   2. POST https://apiv2.shiprocket.co/v1/account/serviceability/
   *        ?pickup_postcode=<restaurant pin>&delivery_postcode=<customer pin>
   *        &weight=<grams>&cod=0
   *      with header `Authorization: Bearer <token>`
   *   3. Pick the selected courier and return its freight_charge.
   *
   * @returns {Promise<object>} `{ rate: null }` while unconfigured. Callers
   *          must show "Calculated when delivery integration is enabled".
   */
  async quoteDelivery({ pinCode, weightGrams, pickupPincode }) {
    if (!anyCredentialsPresent()) {
      return {
        status: 'not_configured',
        rate: null,
        currency: 'INR',
        error: 'SHIPROCKET_NOT_CONFIGURED',
        message: NOT_CONFIGURED_MESSAGE,
        received: { pinCode: pinCode || null, weightGrams: weightGrams || null }
      };
    }
    // >>> FUTURE SHIPROCKET INTEGRATION <<<  (see docblock above)
    return { status: 'not_configured', rate: null, currency: 'INR' };
  },

  /**
   * STEP 2 — Create the shipment and get an AWB.
   *
   * >>> FUTURE SHIPROCKET INTEGRATION <<<
   *   POST https://apiv2.shiprocket.co/v1/orders/create/shipment/
   *   { order_id: <shiprocket order id>, shipment_id: ... }
   *   -> response.shipment_id, response.awb_code (tracking id)
   *
   * Reserved fields `shipmentId` and `trackingId` are already written onto the
   * order record so no schema change is needed later.
   */
  async createShipment(order) {
    if (!anyCredentialsPresent()) {
      return {
        status: 'not_configured',
        shipmentId: null,
        trackingId: null,
        deliveryStatus: 'not_configured',
        error: 'SHIPROCKET_NOT_CONFIGURED',
        message: 'No shipment was created — delivery integration is not configured.'
      };
    }
    // >>> FUTURE SHIPROCKET INTEGRATION <<<  (see docblock above)
    return {
      status: 'not_configured',
      shipmentId: null,
      trackingId: null,
      deliveryStatus: 'not_configured'
    };
  },

  /**
   * STEP 3 — Poll shipment tracking.
   *
   * >>> FUTURE SHIPROCKET INTEGRATION <<<
   *   GET https://apiv2.shiprocket.co/v1/track/shipment/:shipment_id
   *   -> tracking data + status (pending / in_transit / delivered / ...)
   */
  async trackShipment(shipmentId) {
    if (!anyCredentialsPresent()) {
      return {
        status: 'not_configured',
        shipmentId: shipmentId || null,
        trackingId: null,
        deliveryStatus: 'not_configured',
        message: NOT_CONFIGURED_MESSAGE
      };
    }
    // >>> FUTURE SHIPROCKET INTEGRATION <<<  (see docblock above)
    return { status: 'not_configured', shipmentId, deliveryStatus: 'not_configured' };
  },

  isConfigured() {
    return false; // flip to `anyCredentialsPresent()` once the API is wired up
  }
};

module.exports = deliveryService;
