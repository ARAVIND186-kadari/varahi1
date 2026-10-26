const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const paymentService = require('./services/paymentService');
const deliveryService = require('./services/deliveryService');

const app = express();
const PORT = process.env.PORT || 5000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'varahi_admin_secure_2026';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// Simple in-memory rate limiter for feedback
const feedbackRateLimit = new Map();
function rateLimitMiddleware(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 40; // Generous limit for testing & customer usage

  const userRecord = feedbackRateLimit.get(ip) || { count: 0, resetTime: now + windowMs };

  if (now > userRecord.resetTime) {
    userRecord.count = 1;
    userRecord.resetTime = now + windowMs;
  } else {
    userRecord.count++;
  }

  feedbackRateLimit.set(ip, userRecord);

  if (userRecord.count > maxAttempts) {
    return res.status(429).json({
      error: 'Too many feedback submissions from this IP. Please wait a few minutes before trying again.'
    });
  }

  next();
}

// Admin Auth Middleware
function requireAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized: Missing authorization header' });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (token !== ADMIN_TOKEN) {
    return res.status(403).json({ error: 'Forbidden: Invalid admin authorization token' });
  }

  next();
}

// Allowed Feedback Categories
const VALID_CATEGORIES = [
  "Food Quality and Taste",
  "Food Freshness",
  "Service",
  "Staff Behavior",
  "Cleanliness",
  "Order Accuracy",
  "Preparation Time",
  "Packaging and Delivery",
  "Overall Experience",
  "Other Suggestions"
];

// ==========================================
// BILLING ENGINE (shared by website checkout + WhatsApp orders)
// ==========================================
// Customer bill structure:
//   Item subtotal + Service charge (14.99/order) + Packaging fee (0)
//   + Delivery charge (pending integration OR labelled dev estimate)
//   + optional Chef tip  =  Final total
// GST is deliberately NOT part of the customer-facing bill. The business's
// actual tax-compliance figure is computed separately as
// `internalTaxReference` and is never added to the customer's total.

function round2(n) {
  const v = Number(n);
  return Math.round((Number.isFinite(v) ? v : 0) * 100) / 100;
}

function validateCartItems(items, menu) {
  if (!items || !Array.isArray(items) || items.length === 0) {
    const err = new Error('Cart cannot be empty');
    err.status = 400;
    throw err;
  }

  let subtotal = 0;
  const validated = [];

  for (const cartItem of items) {
    const menuItem = menu.find(m => m.id === cartItem.id);
    if (!menuItem) {
      const err = new Error(`Item with id ${cartItem.id} no longer exists.`);
      err.status = 400;
      throw err;
    }
    if (!menuItem.inStock) {
      const err = new Error(`"${menuItem.name}" is currently sold out.`);
      err.status = 400;
      throw err;
    }

    const qty = Math.max(1, parseInt(cartItem.quantity, 10) || 1);
    const itemTotal = round2(menuItem.price * qty);
    subtotal += itemTotal;

    validated.push({
      id: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      quantity: qty,
      itemTotal
    });
  }

  return { validatedItems: validated, subtotal: round2(subtotal) };
}

/**
 * Builds the full customer bill from validated items and settings.
 * Throws an Error with `.status = 400` for invalid customer input.
 */
function computeBill({ settings, validatedItems, subtotal, orderType, tip }) {
  const isDelivery = orderType === 'delivery';

  const serviceCharge = round2(settings.serviceCharge !== undefined ? settings.serviceCharge : 14.99);
  const packagingFee = round2(settings.packagingFee || 0);

  // --- Delivery charge -----------------------------------------------------
  // INTEGRATION NOTE: when Shiprocket is connected (services/deliveryService.js)
  // this value is replaced by a live quoted rate. Until then we either show the
  // "pending integration" label or a clearly marked DEVELOPMENT estimate.
  const devDeliveryEnabled = isDelivery && !!settings.enableDevelopmentDeliveryFee;
  const deliveryCharge = devDeliveryEnabled ? round2(settings.developmentDeliveryFee || 0) : 0;
  const deliveryChargeLabel = !isDelivery
    ? 'Not applicable — customer pickup'
    : (devDeliveryEnabled
        ? 'Development estimate (not a live shipping rate)'
        : 'Calculated when delivery integration is enabled');

  // --- Chef tip ------------------------------------------------------------
  const minimumTip = Number(settings.minimumTip) > 0 ? Number(settings.minimumTip) : 5;
  const tipAmount = round2(tip);
  if (tipAmount < 0) {
    const err = new Error('Chef tip cannot be negative.');
    err.status = 400;
    throw err;
  }
  if (tipAmount > 0 && tipAmount < minimumTip) {
    const err = new Error(`Minimum chef tip is ₹${minimumTip}. Enter ₹${minimumTip} or more, or no tip.`);
    err.status = 400;
    throw err;
  }

  const grandTotal = round2(subtotal + serviceCharge + packagingFee + deliveryCharge + tipAmount);

  // Business-only tax reference. NEVER added to the customer's grandTotal.
  const internalTaxReference = round2((subtotal * (Number(settings.taxPercentage) || 0)) / 100);

  return {
    subtotal: round2(subtotal),
    serviceCharge,
    packagingFee,
    deliveryCharge,
    deliveryChargeLabel,
    deliveryIntegrationEnabled: devDeliveryEnabled,
    tip: tipAmount,
    grandTotal,
    internalTaxReference,
    taxPercentage: Number(settings.taxPercentage) || 0
  };
}

/** Parcel details kept ready for the future Shiprocket integration. */
function buildParcel(settings, validatedItems) {
  const units = validatedItems.reduce((sum, i) => sum + i.quantity, 0);
  const perItem = Number(settings.parcelApproxGramsPerItem) > 0
    ? Number(settings.parcelApproxGramsPerItem)
    : 250;
  return {
    // PLACEHOLDER ESTIMATE: replace with weighed packaging data later.
    weightGrams: units * perItem,
    weightIsEstimate: true,
    lengthCm: Number(settings.parcelLengthCm) || 25,
    widthCm: Number(settings.parcelWidthCm) || 20,
    heightCm: Number(settings.parcelHeightCm) || 10
  };
}

// ==========================================
// PUBLIC API ROUTES
// ==========================================

// 1. Restaurant Settings (Public)
app.get('/api/settings', (req, res) => {
  try {
    const settings = db.getSettings();
    // Return sanitized public settings
    const publicSettings = {
      restaurantName: settings.restaurantName,
      category: settings.category,
      address: settings.address,
      googleMapsUrl: settings.googleMapsUrl,
      phone: settings.phone,
      whatsapp: settings.whatsapp,
      openingHours: settings.openingHours,
      statusNote: settings.statusNote,
      // --- Customer-facing billing configuration ---
      serviceCharge: settings.serviceCharge,
      packagingFee: settings.packagingFee,
      enableDevelopmentDeliveryFee: !!settings.enableDevelopmentDeliveryFee,
      developmentDeliveryFee: settings.developmentDeliveryFee,
      // Legacy key kept so older clients keep working
      deliveryFee: settings.enableDevelopmentDeliveryFee
        ? settings.developmentDeliveryFee
        : settings.deliveryFee,
      // --- Chef tip configuration ---
      minimumTip: settings.minimumTip,
      tipPresets: settings.tipPresets,
      taxPercentage: settings.taxPercentage,
      autoApproveReviews: !!settings.autoApproveReviews,
      enableWhatsAppApi: !!settings.enableWhatsAppApi
    };
    res.json(publicSettings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve settings' });
  }
});

// 1b. Integration Status (Public - no secrets, no credentials ever exposed)
// Used by the checkout to decide which delivery/payment copy to display.
app.get('/api/integrations', (req, res) => {
  try {
    const payment = paymentService.getStatus();
    const delivery = deliveryService.getStatus();
    // Public payload: provider + status only. Credential flags stay server-side.
    res.json({
      payment: { provider: payment.provider, status: payment.status, message: payment.message },
      delivery: { provider: delivery.provider, status: delivery.status, message: delivery.message }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve integration status' });
  }
});

// 2. Menu Items (Public)
app.get('/api/menu', (req, res) => {
  try {
    const menu = db.getMenu();
    res.json(menu);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve menu' });
  }
});

// 3. Create Order (Public: Website or WhatsApp initiate)
// The customer bill is always recomputed server-side from the live menu and
// live settings — the client never dictates prices or charges.
function createOrderFromRequest(req, res, opts = {}) {
  const {
    customerName, customerPhone, orderType, deliveryAddress,
    pinCode, items, specialInstructions, channel, tip
  } = req.body;

  const settings = db.getSettings();
  const menu = db.getMenu();

  let validatedItems;
  let subtotal;
  try {
    ({ validatedItems, subtotal } = validateCartItems(items, menu));
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }

  const type = orderType === 'delivery' ? 'delivery' : 'pickup';

  // Required customer details
  const name = (customerName || '').trim();
  const phone = (customerPhone || '').trim().replace(/[^0-9+]/g, '');
  if (name.length < 2) {
    return res.status(400).json({ error: 'Please provide your name (at least 2 characters).' });
  }
  if (phone.length < 10) {
    return res.status(400).json({ error: 'Please provide a valid 10-digit phone number.' });
  }

  const address = type === 'delivery' ? (deliveryAddress || '').trim() : '';
  const pin = (pinCode || '').trim();
  if (type === 'delivery') {
    if (address.length < 10) {
      return res.status(400).json({ error: 'Please provide a complete delivery address.' });
    }
    // PIN code is mandatory on the new website test-order checkout (it feeds
    // the future Shiprocket rate lookup). The pre-existing WhatsApp order API
    // keeps its original contract, so a missing PIN is tolerated there.
    if (opts.isTestOrder && !/^\d{6}$/.test(pin)) {
      return res.status(400).json({ error: 'Please provide a valid 6-digit PIN code.' });
    }
  }

  let bill;
  try {
    bill = computeBill({
      settings,
      validatedItems,
      subtotal,
      orderType: type,
      tip: tip === undefined || tip === null || tip === '' ? 0 : Number(tip)
    });
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }

  const isTestOrder = !!opts.isTestOrder;

  const orderRecord = db.createOrder({
    customerName: name || 'Guest Customer',
    customerPhone: phone,
    orderType: type,
    deliveryAddress: address,
    pinCode: pin,
    items: validatedItems,
    subtotal: bill.subtotal,
    serviceCharge: bill.serviceCharge,
    packagingFee: bill.packagingFee,
    deliveryCharge: bill.deliveryCharge,
    deliveryChargeLabel: bill.deliveryChargeLabel,
    tip: bill.tip,
    grandTotal: bill.grandTotal,
    internalTaxReference: bill.internalTaxReference,
    taxPercentage: bill.taxPercentage,
    specialInstructions: (specialInstructions || '').trim(),
    channel: isTestOrder ? 'website_test' : (channel || 'whatsapp'),
    isTestOrder,
    // --- Integration state (both services are placeholders today) ---
    paymentStatus: paymentService.isConfigured() ? 'pending' : 'not_configured',
    deliveryStatus: deliveryService.isConfigured() ? 'pending' : 'not_configured',
    shipmentId: null,
    trackingId: null,
    parcel: buildParcel(settings, validatedItems),
    // Test orders must not consume real menu stock
    skipStockUpdate: isTestOrder,
    status: isTestOrder
      ? 'TEST ORDER — Not paid, not confirmed'
      : (channel === 'whatsapp' ? 'Awaiting WhatsApp Confirmation' : 'Order Placed')
  });

  return { orderRecord, bill, isTestOrder };
}

app.post('/api/orders', (req, res) => {
  try {
    const { orderRecord } = createOrderFromRequest(req, res, { isTestOrder: false });
    if (!orderRecord) return; // helper already sent an error response

    res.status(201).json({
      success: true,
      message: req.body.channel === 'whatsapp'
        ? 'Order recorded. Awaiting confirmation on WhatsApp.'
        : 'Order placed successfully.',
      order: orderRecord
    });
  } catch (err) {
    console.error('Order creation error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to process order' });
  }
});

// 3b. PLACE TEST ORDER — checkout without a payment gateway.
// No Razorpay call is made, no money is collected, no delivery is promised.
app.post('/api/orders/test', (req, res) => {
  try {
    const { orderRecord, bill } = createOrderFromRequest(req, res, { isTestOrder: true });
    if (!orderRecord) return; // helper already sent an error response

    res.status(201).json({
      success: true,
      isTestOrder: true,
      message: 'TEST order saved for testing. Nothing was paid and no delivery has been confirmed.',
      notice: 'This is a test order. Payment and delivery integrations are not configured.',
      paymentStatus: 'not_configured',
      deliveryStatus: 'not_configured',
      bill,
      order: orderRecord
    });
  } catch (err) {
    console.error('Test order creation error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to save test order' });
  }
});

// 3c. PAYMENT PLACEHOLDER ROUTES (Razorpay) -------------------------------
// These exist so the checkout can be swapped to live payments later by
// completing services/paymentService.js — no frontend rebuild required.
// SECRET KEYS BELONG IN SERVER ENV VARS: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET,
// RAZORPAY_WEBHOOK_SECRET. They must never be sent to the browser.
app.post('/api/payments/create-order', async (req, res) => {
  const result = await paymentService.createPaymentOrder({
    orderId: req.body && req.body.orderId,
    amount: req.body && req.body.amount
  });
  res.status(result.status === 'not_configured' ? 503 : 201).json(result);
});

app.post('/api/payments/verify', async (req, res) => {
  const result = await paymentService.verifyPayment(req.body || {});
  res.status(result.status === 'not_configured' ? 503 : 200).json(result);
});

// NOTE FOR FUTURE WORK: add `express.raw({ type: 'application/json' })` for this
// route when Razorpay webhooks are enabled — the raw body is required for the
// HMAC signature comparison inside paymentService.handleWebhook().
app.post('/api/payments/webhook', async (req, res) => {
  const signature = req.headers['x-razorpay-signature'] || '';
  const result = await paymentService.handleWebhook(JSON.stringify(req.body || {}), signature);
  res.status(result.status === 'not_configured' ? 503 : 200).json(result);
});

// 3d. DELIVERY PLACEHOLDER ROUTES (Shiprocket) -----------------------------
// Never returns a shipping rate while unconfigured, so the UI cannot show a
// fake delivery price. Complete services/deliveryService.js to enable these.
app.post('/api/delivery/quote', async (req, res) => {
  const settings = db.getSettings();
  const result = await deliveryService.quoteDelivery({
    pinCode: req.body && req.body.pinCode,
    weightGrams: req.body && req.body.weightGrams,
    pickupPincode: settings.pickupPincode
  });
  res.status(result.status === 'not_configured' ? 503 : 200).json(result);
});

app.post('/api/delivery/shipment', async (req, res) => {
  const settings = db.getSettings();
  const order = db.getOrderById((req.body && req.body.orderId) || '');
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const result = await deliveryService.createShipment(order);
  res.status(result.status === 'not_configured' ? 503 : 200).json({
    ...result,
    context: deliveryService.buildShipmentContext(order, settings)
  });
});

// 4. Track Order Status (Public)
app.get('/api/orders/:id', (req, res) => {
  try {
    const order = db.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    // Return sanitized status
    res.json({
      id: order.id,
      customerName: order.customerName,
      status: order.status,
      orderType: order.orderType,
      itemsCount: order.items.length,
      grandTotal: order.grandTotal,
      createdAt: order.createdAt
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to track order' });
  }
});

// 5. Public Customer Reviews (APPROVED ONLY)
app.get('/api/feedback/public', (req, res) => {
  try {
    const approvedReviews = db.getFeedback(false);
    const stats = db.getApprovedReviewStats();

    // Map to sanitized public records (strip private email, phone, IP)
    const sanitizedReviews = approvedReviews.map(r => ({
      id: r.id,
      customerName: r.customerName,
      rating: r.rating,
      category: r.category,
      reviewText: r.reviewText,
      suggestions: r.suggestions,
      isOrderVerified: r.isOrderVerified,
      adminResponse: r.adminResponse,
      createdAt: r.createdAt
    }));

    res.json({
      stats,
      reviews: sanitizedReviews
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch public reviews' });
  }
});

// 6. Submit Customer Feedback
app.post('/api/feedback', rateLimitMiddleware, (req, res) => {
  try {
    const { customerName, customerEmail, rating, category, reviewText, suggestions, orderRef, honeypot } = req.body;

    // Honeypot spam trap
    if (honeypot) {
      return res.status(400).json({ error: 'Bot submission detected.' });
    }

    // Validation
    const errors = [];

    const numRating = parseInt(rating, 10);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      errors.push('Rating must be an integer between 1 and 5 stars.');
    }

    if (!customerName || customerName.trim().length < 2) {
      errors.push('Please provide your name (at least 2 characters).');
    } else if (customerName.trim().length > 60) {
      errors.push('Customer name cannot exceed 60 characters.');
    }

    if (!category || !VALID_CATEGORIES.includes(category.trim())) {
      errors.push('Please select a valid feedback category.');
    }

    if (!reviewText || reviewText.trim().length < 10) {
      errors.push('Please share your review or comments (at least 10 characters).');
    } else if (reviewText.trim().length > 1000) {
      errors.push('Review cannot exceed 1000 characters.');
    }

    if (customerEmail && customerEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customerEmail.trim())) {
        errors.push('Invalid email address format.');
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(' ') });
    }

    const newFeedback = db.createFeedback({
      customerName,
      customerEmail,
      rating: numRating,
      category,
      reviewText,
      suggestions,
      orderRef
    });

    const isApproved = newFeedback.status === 'approved';
    res.status(201).json({
      success: true,
      status: newFeedback.status,
      message: isApproved
        ? 'Thank you for your valuable feedback! Your review is now published on our website.'
        : 'Thank you for your valuable feedback! Your review has been submitted for moderation and will appear publicly once approved by our team.',
      feedbackId: newFeedback.id,
      isOrderVerified: newFeedback.isOrderVerified
    });
  } catch (err) {
    console.error('Feedback creation error:', err);
    res.status(500).json({ error: 'Failed to submit feedback. Please try again.' });
  }
});

// ==========================================
// ADMIN API ROUTES (PROTECTED)
// ==========================================

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  // Default credentials check
  if (password === 'admin123' || password === ADMIN_TOKEN) {
    return res.json({
      success: true,
      token: ADMIN_TOKEN,
      admin: { username: 'manager', role: 'admin' }
    });
  }

  res.status(401).json({ error: 'Invalid administrator password.' });
});

// Update Restaurant Settings
app.put('/api/admin/settings', requireAdmin, (req, res) => {
  try {
    const {
      restaurantName,
      category,
      address,
      googleMapsUrl,
      phone,
      whatsapp,
      openingHours,
      statusNote,
      deliveryFee,
      packagingFee,
      taxPercentage,
      serviceCharge,
      enableDevelopmentDeliveryFee,
      developmentDeliveryFee,
      minimumTip,
      tipPresets,
      autoApproveReviews,
      enableWhatsAppApi,
      whatsAppApiConfig
    } = req.body;

    const updates = {};
    if (restaurantName) updates.restaurantName = restaurantName.trim();
    if (category) updates.category = category.trim();
    if (address) updates.address = address.trim();
    if (googleMapsUrl) updates.googleMapsUrl = googleMapsUrl.trim();
    if (phone) updates.phone = phone.trim();
    if (whatsapp) updates.whatsapp = whatsapp.trim().replace(/\D/g, '');
    if (openingHours) updates.openingHours = openingHours.trim();
    if (statusNote !== undefined) updates.statusNote = statusNote.trim();
    if (deliveryFee !== undefined) updates.deliveryFee = Number(deliveryFee);
    if (packagingFee !== undefined) updates.packagingFee = Number(packagingFee);
    if (taxPercentage !== undefined) updates.taxPercentage = Number(taxPercentage);

    // --- Billing configuration (see services/README notes) ---
    if (serviceCharge !== undefined) {
      const v = Number(serviceCharge);
      if (!Number.isFinite(v) || v < 0) return res.status(400).json({ error: 'Service charge must be 0 or more.' });
      updates.serviceCharge = round2(v);
    }
    if (enableDevelopmentDeliveryFee !== undefined) {
      updates.enableDevelopmentDeliveryFee = Boolean(enableDevelopmentDeliveryFee);
    }
    if (developmentDeliveryFee !== undefined) {
      const v = Number(developmentDeliveryFee);
      if (!Number.isFinite(v) || v < 0) return res.status(400).json({ error: 'Development delivery fee must be 0 or more.' });
      updates.developmentDeliveryFee = round2(v);
    }
    if (minimumTip !== undefined) {
      const v = Number(minimumTip);
      if (!Number.isFinite(v) || v < 0) return res.status(400).json({ error: 'Minimum tip must be 0 or more.' });
      updates.minimumTip = v;
    }
    if (Array.isArray(tipPresets)) {
      const cleaned = tipPresets.map(Number).filter(v => Number.isFinite(v) && v > 0);
      if (cleaned.length) updates.tipPresets = cleaned;
    }
    if (autoApproveReviews !== undefined) updates.autoApproveReviews = Boolean(autoApproveReviews);
    if (enableWhatsAppApi !== undefined) updates.enableWhatsAppApi = Boolean(enableWhatsAppApi);
    if (whatsAppApiConfig) updates.whatsAppApiConfig = whatsAppApiConfig;

    const updated = db.updateSettings(updates);
    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Manage Menu (Admin)
app.post('/api/admin/menu', requireAdmin, (req, res) => {
  try {
    const { name, category, price, description, isVeg, isSpecial, spiceLevel, stockQuantity, prepTime } = req.body;
    if (!name || !price || !category) {
      return res.status(400).json({ error: 'Name, category, and price are required.' });
    }
    const newItem = db.addMenuItem({
      name,
      category,
      price: parseFloat(price),
      description: description || '',
      isVeg: isVeg !== undefined ? Boolean(isVeg) : true,
      isSpecial: Boolean(isSpecial),
      spiceLevel: spiceLevel || 'Mild',
      stockQuantity: stockQuantity !== undefined ? parseInt(stockQuantity, 10) : 50,
      prepTime: prepTime || '5-10 mins'
    });
    res.status(201).json({ success: true, item: newItem });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add menu item' });
  }
});

app.put('/api/admin/menu/:id', requireAdmin, (req, res) => {
  try {
    const updated = db.updateMenuItem(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Menu item not found' });
    }
    res.json({ success: true, item: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update menu item' });
  }
});

app.delete('/api/admin/menu/:id', requireAdmin, (req, res) => {
  try {
    db.deleteMenuItem(req.params.id);
    res.json({ success: true, message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete menu item' });
  }
});

// Manage Orders (Admin)
app.get('/api/admin/orders', requireAdmin, (req, res) => {
  try {
    const orders = db.getOrders();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.put('/api/admin/orders/:id/status', requireAdmin, (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required' });
    const order = db.updateOrderStatus(req.params.id, status);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Delete an order — ONLY test orders can be deleted, so live order history
// can never be destroyed by accident.
app.delete('/api/admin/orders/:id', requireAdmin, (req, res) => {
  try {
    const order = db.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!order.isTestOrder) {
      return res.status(403).json({ error: 'Only orders flagged as TEST orders can be deleted.' });
    }
    db.deleteOrder(order.id);
    res.json({ success: true, message: `Test order ${order.id} deleted.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete test order' });
  }
});

// ---- Integration status + billing analytics for the admin dashboard -------
// Reports BOOLEAN credential presence only — secret values are never returned.
app.get('/api/admin/integrations', requireAdmin, (req, res) => {
  try {
    const settings = db.getSettings();
    const orders = db.getOrders();

    const testOrders = orders.filter(o => o.isTestOrder);
    const liveOrders = orders.filter(o => !o.isTestOrder);

    const sum = (list, key) => round2(list.reduce((t, o) => t + (Number(o[key]) || 0), 0));

    res.json({
      payment: paymentService.describeConfig(),
      delivery: deliveryService.describeConfig(),
      billing: {
        serviceCharge: settings.serviceCharge,
        packagingFee: settings.packagingFee,
        enableDevelopmentDeliveryFee: !!settings.enableDevelopmentDeliveryFee,
        developmentDeliveryFee: settings.developmentDeliveryFee,
        minimumTip: settings.minimumTip,
        tipPresets: settings.tipPresets,
        taxPercentage: settings.taxPercentage
      },
      totals: {
        orderCount: orders.length,
        testOrderCount: testOrders.length,
        liveOrderCount: liveOrders.length,
        subtotal: sum(orders, 'subtotal'),
        serviceCharge: sum(orders, 'serviceCharge'),
        packagingFee: sum(orders, 'packagingFee'),
        deliveryCharge: sum(orders, 'deliveryCharge'),
        tips: sum(orders, 'tip'),
        grandTotal: sum(orders, 'grandTotal'),
        testOrderValue: sum(testOrders, 'grandTotal')
      },
      testOrders: testOrders.map(o => ({
        id: o.id,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        orderType: o.orderType,
        grandTotal: o.grandTotal,
        tip: o.tip || 0,
        status: o.status,
        paymentStatus: o.paymentStatus || 'not_configured',
        deliveryStatus: o.deliveryStatus || 'not_configured',
        createdAt: o.createdAt
      }))
    });
  } catch (err) {
    console.error('Integrations status error:', err);
    res.status(500).json({ error: 'Failed to load integration status' });
  }
});

// Manage Feedback (Admin)
app.get('/api/admin/feedback', requireAdmin, (req, res) => {
  try {
    const feedbackList = db.getFeedback(true);
    const stats = db.getApprovedReviewStats();
    
    // Also calculate admin-level comprehensive analytics
    let totalPending = 0;
    let totalApproved = 0;
    let totalRejected = 0;
    feedbackList.forEach(f => {
      if (f.status === 'pending') totalPending++;
      if (f.status === 'approved') totalApproved++;
      if (f.status === 'rejected') totalRejected++;
    });

    res.json({
      allCount: feedbackList.length,
      pendingCount: totalPending,
      approvedCount: totalApproved,
      rejectedCount: totalRejected,
      stats,
      feedback: feedbackList
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// Moderate Feedback (Approve / Reject / Respond)
// Explicit check: Do not allow admin to rewrite customer's reviewText!
app.put('/api/admin/feedback/:id', requireAdmin, (req, res) => {
  try {
    const { status, adminResponse } = req.body;
    if (status && !['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid moderation status. Must be pending, approved, or rejected.' });
    }

    const updated = db.updateFeedbackStatus(req.params.id, status, adminResponse);
    if (!updated) {
      return res.status(404).json({ error: 'Feedback record not found' });
    }
    res.json({ success: true, feedback: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update feedback status' });
  }
});

app.delete('/api/admin/feedback/:id', requireAdmin, (req, res) => {
  try {
    db.deleteFeedback(req.params.id);
    res.json({ success: true, message: 'Feedback entry deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete feedback' });
  }
});

// Export Feedback Report (CSV)
app.get('/api/admin/export-feedback', requireAdmin, (req, res) => {
  try {
    const feedbackList = db.getFeedback(true);
    let csv = "ID,Customer Name,Rating,Category,Review,Suggestions,Order Ref,Status,Date,Admin Response\n";
    
    feedbackList.forEach(f => {
      const escape = (val) => `"${(val || '').toString().replace(/"/g, '""')}"`;
      csv += [
        escape(f.id),
        escape(f.customerName),
        escape(f.rating),
        escape(f.category),
        escape(f.reviewText),
        escape(f.suggestions),
        escape(f.orderRef),
        escape(f.status),
        escape(f.createdAt),
        escape(f.adminResponse)
      ].join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="varahi_tiffins_feedback.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: 'Failed to export feedback' });
  }
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`Varahi Tiffins Server running on http://localhost:${PORT}`);
});
