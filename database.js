const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const MENU_FILE = path.join(DATA_DIR, 'menu.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const FEEDBACK_FILE = path.join(DATA_DIR, 'feedback.json');

// Default Settings
const defaultSettings = {
  restaurantName: "Varahi Tiffins",
  category: "South Indian vegetarian restaurant",
  address: "Plot No. 265, Vasavi Colony Road, beside TNR Apartment, Kothapet, Hyderabad, Telangana 500102, India.",
  googleMapsUrl: "https://maps.app.goo.gl/NxjV16Pa4WxCKj158?g_st=ac",
  phone: "+91 94945 00646",
  whatsapp: "919494500646",
  openingHours: "7:00 AM–12:00 PM and 6:00 PM–10:00 PM daily",
  statusNote: "Phone number and opening hours require owner confirmation before production launch.",

  // ---- Customer-facing billing (see README / services folder) ----
  serviceCharge: 14.99,        // Flat service charge per order (₹)
  packagingFee: 0,             // Packaging fee (₹) - currently 0
  enableDevelopmentDeliveryFee: false, // OFF = show "Calculated when delivery integration is enabled"
  developmentDeliveryFee: 30,  // Manually configured DEVELOPMENT estimate (₹), shown only when enabled

  // ---- Chef tip configuration ----
  minimumTip: 5,               // Lowest allowed positive tip (₹)
  tipPresets: [10, 20, 30, 50],// Preset tip buttons (₹)

  // ---- Business-only tax compliance (NEVER shown on the customer bill) ----
  taxPercentage: 5,

  // ---- Parcel defaults reserved for future Shiprocket integration ----
  parcelLengthCm: 25,
  parcelWidthCm: 20,
  parcelHeightCm: 10,
  parcelApproxGramsPerItem: 250,
  pickupPincode: "",

  // ---- Legacy key kept for backwards compatibility with older clients ----
  deliveryFee: 30,

  autoApproveReviews: false,
  enableWhatsAppApi: false,
  whatsAppApiConfig: {
    phoneNumberId: "",
    accessToken: "",
    webhookVerified: false
  }
};

// Default Menu with authentic South Indian Tiffins & corrected pricing
const defaultMenu = [
  {
    id: "item-1",
    name: "Ghee Karam Dosa",
    category: "Dosas",
    price: 80,
    description: "Crispy golden crepe smeared with house-special red chilli garlic spice chutney and generous pure desi ghee.",
    isVeg: true,
    isSpecial: true,
    spiceLevel: "Spicy",
    inStock: true,
    stockQuantity: 45,
    prepTime: "8-10 mins",
    image: "/assets/images/ghee-karam-dosa.jpg"
  },
  {
    id: "item-2",
    name: "Plain Dosa",
    category: "Dosas",
    price: 50,
    description: "Traditional thin, golden and crunchy rice-lentil dosa served with piping hot sambar & fresh chutneys.",
    isVeg: true,
    isSpecial: false,
    spiceLevel: "Mild",
    inStock: true,
    stockQuantity: 60,
    prepTime: "5-7 mins",
    image: "/assets/images/plain-dosa.jpg"
  },
  {
    id: "item-3",
    name: "Masala Dosa",
    category: "Dosas",
    price: 70,
    description: "Classic crisp dosa stuffed with savory mashed potato and onion masala with mustard tempering.",
    isVeg: true,
    isSpecial: false,
    spiceLevel: "Medium",
    inStock: true,
    stockQuantity: 50,
    prepTime: "7-9 mins",
    image: "/assets/images/masala-dosa.jpg"
  },
  {
    id: "item-4",
    name: "Butter Mysore Masala Dosa",
    category: "Dosas",
    price: 95,
    description: "Topped with Amul butter, smeared with tangy Mysore red paste and stuffed with flavorful aloo bhaji.",
    isVeg: true,
    isSpecial: true,
    spiceLevel: "Medium",
    inStock: true,
    stockQuantity: 35,
    prepTime: "9-12 mins",
    image: "/assets/images/mysore-dosa.jpg"
  },
  {
    id: "item-5",
    name: "Onion Rava Dosa",
    category: "Dosas",
    price: 85,
    description: "Lacy semolina crepe studded with chopped green chillies, ginger, cumin and sweet caramelized onions.",
    isVeg: true,
    isSpecial: false,
    spiceLevel: "Medium",
    inStock: true,
    stockQuantity: 40,
    prepTime: "10-12 mins",
    image: "/assets/images/rava-dosa.jpg"
  },
  {
    id: "item-6",
    name: "Steamed Idli (2 Pcs)",
    category: "Idli & Vada",
    price: 45,
    description: "Pillowy soft, cloud-like fermented rice & urad dal steamed cakes. Served with lentil sambar & 3 chutneys.",
    isVeg: true,
    isSpecial: false,
    spiceLevel: "Mild",
    inStock: true,
    stockQuantity: 80,
    prepTime: "3-5 mins",
    image: "/assets/images/idli.jpg"
  },
  {
    id: "item-7",
    name: "Ghee Sambar Idli (2 Pcs)",
    category: "Idli & Vada",
    price: 55,
    description: "Soft idlis submerged in aromatic shallot-drumstick sambar and drizzled with melted pure ghee.",
    isVeg: true,
    isSpecial: true,
    spiceLevel: "Medium",
    inStock: true,
    stockQuantity: 50,
    prepTime: "3-5 mins",
    image: "/assets/images/sambar-idli.jpg"
  },
  {
    id: "item-8",
    name: "Babai Idli with Gunpowder & Ghee",
    category: "Idli & Vada",
    price: 65,
    description: "Special Andhra style soft idli tossed in fragrant roasted lentil podi and crowned with a dollop of white butter/ghee.",
    isVeg: true,
    isSpecial: true,
    spiceLevel: "Spicy",
    inStock: true,
    stockQuantity: 30,
    prepTime: "4-6 mins",
    image: "/assets/images/babai-idli.jpg"
  },
  {
    id: "item-9",
    name: "Crispy Medu Vada (2 Pcs)",
    category: "Idli & Vada",
    price: 60,
    description: "Deep golden crispy urad dal fritters with soft fluffy interiors, pepper and curry leaves. Served with coconut chutney.",
    isVeg: true,
    isSpecial: false,
    spiceLevel: "Medium",
    inStock: true,
    stockQuantity: 40,
    prepTime: "5-7 mins",
    image: "/assets/images/vada.jpg"
  },
  {
    id: "item-10",
    name: "Idli Vada Combo (1 Idli + 1 Vada)",
    category: "Idli & Vada",
    price: 60,
    description: "The perfect pair! One soft steamed idli and one crispy medu vada with hot sambar and freshly ground chutneys.",
    isVeg: true,
    isSpecial: false,
    spiceLevel: "Mild",
    inStock: true,
    stockQuantity: 60,
    prepTime: "4-5 mins",
    image: "/assets/images/idli-vada.jpg"
  },
  {
    id: "item-11",
    name: "Special MLA Pesarattu with Upma",
    category: "Breakfast Combos",
    price: 90,
    description: "Whole green gram moong dosa stuffed with savory semolina upma, served with zesty allam (ginger) chutney.",
    isVeg: true,
    isSpecial: true,
    spiceLevel: "Medium",
    inStock: true,
    stockQuantity: 35,
    prepTime: "9-12 mins",
    image: "/assets/images/pesarattu.jpg"
  },
  {
    id: "item-12",
    name: "Poori Bhaji (3 Pcs)",
    category: "Breakfast Combos",
    price: 70,
    description: "Fluffy puffed golden whole wheat pooris paired with mildly spiced homestyle potato kurma & onion relish.",
    isVeg: true,
    isSpecial: false,
    spiceLevel: "Medium",
    inStock: true,
    stockQuantity: 45,
    prepTime: "8-10 mins",
    image: "/assets/images/poori.jpg"
  },
  {
    id: "item-13",
    name: "Ghee Ven Pongal",
    category: "Snacks & Upma",
    price: 65,
    description: "Rich comforting rice & yellow moong dal cooked with crushed black peppercorns, cumin, ginger, and fried cashews in ghee.",
    isVeg: true,
    isSpecial: false,
    spiceLevel: "Mild",
    inStock: true,
    stockQuantity: 30,
    prepTime: "4-6 mins",
    image: "/assets/images/pongal.jpg"
  },
  {
    id: "item-14",
    name: "Rava Upma with Podi & Ghee",
    category: "Snacks & Upma",
    price: 45,
    description: "Roasted rava tempered with mustard, chana dal, cashews and green chillies, served with coconut chutney & podi.",
    isVeg: true,
    isSpecial: false,
    spiceLevel: "Mild",
    inStock: true,
    stockQuantity: 30,
    prepTime: "4-5 mins",
    image: "/assets/images/upma.jpg"
  },
  {
    id: "item-15",
    name: "Rava Kesari (Desi Ghee)",
    category: "Sweets & Extras",
    price: 50,
    description: "Luscious melt-in-the-mouth semolina halwa infused with saffron, cardamom and roasted golden cashews & raisins.",
    isVeg: true,
    isSpecial: true,
    spiceLevel: "Mild",
    inStock: true,
    stockQuantity: 25,
    prepTime: "2-3 mins",
    image: "/assets/images/kesari.jpg"
  },
  {
    id: "item-16",
    name: "Authentic Degree Filter Coffee",
    category: "Beverages",
    price: 30,
    description: "Aromatic, freshly brewed South Indian chicory-blend decoction frothed with rich hot whole milk in a traditional dabarah.",
    isVeg: true,
    isSpecial: true,
    spiceLevel: "Mild",
    inStock: true,
    stockQuantity: 100,
    prepTime: "3-4 mins",
    image: "/assets/images/filter-coffee.jpg"
  },
  {
    id: "item-17",
    name: "Masala Chai",
    category: "Beverages",
    price: 25,
    description: "Strong Indian tea brewed with fresh ginger, crushed green cardamom and aromatic spice blend.",
    isVeg: true,
    isSpecial: false,
    spiceLevel: "Mild",
    inStock: true,
    stockQuantity: 90,
    prepTime: "3-4 mins",
    image: "/assets/images/masala-chai.jpg"
  },
  {
    id: "item-18",
    name: "Spiced Masala Buttermilk (Majjiga)",
    category: "Beverages",
    price: 30,
    description: "Refreshing churned yogurt cooler infused with roasted cumin, crushed ginger, green chilli, and fresh coriander.",
    isVeg: true,
    isSpecial: false,
    spiceLevel: "Mild",
    inStock: true,
    stockQuantity: 50,
    prepTime: "2 mins",
    image: "/assets/images/buttermilk.jpg"
  }
];

// Merge stored settings over defaults so newly added keys always exist,
// even for deployments whose data/settings.json predates this release.
function mergeWithDefaults(file, defaults) {
  const stored = readJSON(file, defaults);
  if (!stored || typeof stored !== 'object') return defaults;
  const merged = { ...defaults, ...stored };
  // Arrays/objects from defaults win only when missing.
  Object.keys(defaults).forEach(k => {
    if (merged[k] === undefined || merged[k] === null) merged[k] = defaults[k];
  });
  return merged;
}

function readJSON(file, fallback) {
  try {
    if (!fs.existsSync(file)) {
      writeJSON(file, fallback);
      return fallback;
    }
    const data = fs.readFileSync(file, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
    return fallback;
  }
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing ${file}:`, err);
    return false;
  }
}

// Initialize files if not present
readJSON(SETTINGS_FILE, defaultSettings);
readJSON(MENU_FILE, defaultMenu);
readJSON(ORDERS_FILE, []);
readJSON(FEEDBACK_FILE, []);

const db = {
  // Settings
  getSettings() {
    return mergeWithDefaults(SETTINGS_FILE, defaultSettings);
  },
  updateSettings(newSettings) {
    const current = this.getSettings();
    const updated = { ...current, ...newSettings };
    writeJSON(SETTINGS_FILE, updated);
    return updated;
  },

  // Menu
  getMenu() {
    return readJSON(MENU_FILE, defaultMenu);
  },
  updateMenuItem(id, updates) {
    const menu = this.getMenu();
    const index = menu.findIndex(item => item.id === id);
    if (index === -1) return null;
    menu[index] = { ...menu[index], ...updates };
    writeJSON(MENU_FILE, menu);
    return menu[index];
  },
  addMenuItem(item) {
    const menu = this.getMenu();
    const newItem = {
      id: "item-" + (Date.now()),
      ...item,
      inStock: item.inStock !== undefined ? item.inStock : true,
      stockQuantity: item.stockQuantity !== undefined ? parseInt(item.stockQuantity) : 50
    };
    menu.push(newItem);
    writeJSON(MENU_FILE, menu);
    return newItem;
  },
  deleteMenuItem(id) {
    let menu = this.getMenu();
    menu = menu.filter(item => item.id !== id);
    writeJSON(MENU_FILE, menu);
    return true;
  },

  // Orders
  getOrders() {
    return readJSON(ORDERS_FILE, []);
  },
  createOrder(orderData) {
    const orders = this.getOrders();
    const count = orders.length + 1;
    const orderId = `VT-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
    
    const newOrder = {
      id: orderId,
      customerName: orderData.customerName || 'Guest',
      customerPhone: orderData.customerPhone || '',
      orderType: orderData.orderType || 'pickup', // pickup or delivery
      deliveryAddress: orderData.deliveryAddress || '',
      pinCode: orderData.pinCode || '',           // reserved for Shiprocket rate lookup
      deliveryCity: orderData.deliveryCity || '',
      deliveryState: orderData.deliveryState || '',
      items: orderData.items || [],

      // ---- Customer bill (GST is intentionally NOT part of the customer total) ----
      subtotal: orderData.subtotal || 0,
      serviceCharge: orderData.serviceCharge || 0,
      packagingFee: orderData.packagingFee || 0,
      deliveryCharge: orderData.deliveryCharge || 0,
      deliveryChargeLabel: orderData.deliveryChargeLabel || '',
      tip: orderData.tip || 0,
      grandTotal: orderData.grandTotal || 0,

      // ---- Business-only tax compliance reference (never added to grandTotal) ----
      internalTaxReference: orderData.internalTaxReference || 0,
      taxPercentage: orderData.taxPercentage || 0,

      // ---- Payment integration state (Razorpay) ----
      isTestOrder: !!orderData.isTestOrder,
      paymentProvider: 'razorpay',
      paymentStatus: orderData.paymentStatus || 'not_configured',
      paymentMeta: orderData.paymentMeta || null,

      // ---- Delivery integration state (Shiprocket) ----
      deliveryStatus: orderData.deliveryStatus || 'not_configured',
      shipmentId: orderData.shipmentId || null,
      trackingId: orderData.trackingId || null,
      parcel: orderData.parcel || null,

      specialInstructions: orderData.specialInstructions || '',
      channel: orderData.channel || 'whatsapp', // whatsapp | website_test | call
      status: orderData.status || (orderData.channel === 'whatsapp' ? 'Awaiting WhatsApp Confirmation' : 'Pending Review'),
      createdAt: new Date().toISOString()
    };

    orders.unshift(newOrder);
    writeJSON(ORDERS_FILE, orders);

    // Test orders must never consume real inventory.
    if (orderData.skipStockUpdate) {
      return newOrder;
    }

    // Update stock if requested
    if (Array.isArray(orderData.items)) {
      const menu = this.getMenu();
      orderData.items.forEach(cartItem => {
        const item = menu.find(m => m.id === cartItem.id);
        if (item && item.stockQuantity !== undefined) {
          item.stockQuantity = Math.max(0, item.stockQuantity - (cartItem.quantity || 1));
          if (item.stockQuantity === 0) item.inStock = false;
        }
      });
      writeJSON(MENU_FILE, menu);
    }

    return newOrder;
  },
  getOrderById(id) {
    const orders = this.getOrders();
    return orders.find(o => o.id.toLowerCase() === id.trim().toLowerCase()) || null;
  },
  updateOrderPayment(id, paymentPatch) {
    const orders = this.getOrders();
    const order = orders.find(o => o.id === id);
    if (!order) return null;
    Object.assign(order, paymentPatch);
    order.updatedAt = new Date().toISOString();
    writeJSON(ORDERS_FILE, orders);
    return order;
  },
  deleteOrder(id) {
    let orders = this.getOrders();
    const before = orders.length;
    orders = orders.filter(o => o.id !== id);
    if (orders.length === before) return false;
    writeJSON(ORDERS_FILE, orders);
    return true;
  },
  updateOrderStatus(id, status) {
    const orders = this.getOrders();
    const order = orders.find(o => o.id === id);
    if (!order) return null;
    order.status = status;
    order.updatedAt = new Date().toISOString();
    writeJSON(ORDERS_FILE, orders);
    return order;
  },

  // Feedback & Reviews
  getFeedback(includeAll = true) {
    const all = readJSON(FEEDBACK_FILE, []);
    if (includeAll) return all;
    return all.filter(f => f.status === 'approved');
  },
  createFeedback(feedbackData) {
    const feedbackList = this.getFeedback(true);
    const id = `FB-${Date.now().toString().slice(-6)}`;
    
    // Check if orderRef is valid
    let isOrderVerified = false;
    if (feedbackData.orderRef && feedbackData.orderRef.trim()) {
      const order = this.getOrderById(feedbackData.orderRef);
      if (order) {
        isOrderVerified = true;
      }
    }

    const settings = this.getSettings();
    const initialStatus = feedbackData.status || (settings.autoApproveReviews ? 'approved' : 'pending');

    const newFeedback = {
      id,
      customerName: feedbackData.customerName.trim(),
      customerEmail: feedbackData.customerEmail ? feedbackData.customerEmail.trim() : null,
      rating: parseInt(feedbackData.rating, 10),
      category: feedbackData.category.trim(),
      reviewText: feedbackData.reviewText.trim(),
      suggestions: feedbackData.suggestions ? feedbackData.suggestions.trim() : null,
      orderRef: feedbackData.orderRef ? feedbackData.orderRef.trim() : null,
      isOrderVerified,
      status: initialStatus,
      adminResponse: null,
      createdAt: new Date().toISOString()
    };

    feedbackList.unshift(newFeedback);
    writeJSON(FEEDBACK_FILE, feedbackList);
    return newFeedback;
  },
  updateFeedbackStatus(id, status, adminResponse = null) {
    const feedbackList = this.getFeedback(true);
    const item = feedbackList.find(f => f.id === id);
    if (!item) return null;
    if (status) item.status = status;
    if (adminResponse !== null) item.adminResponse = adminResponse;
    item.updatedAt = new Date().toISOString();
    writeJSON(FEEDBACK_FILE, feedbackList);
    return item;
  },
  deleteFeedback(id) {
    let feedbackList = this.getFeedback(true);
    feedbackList = feedbackList.filter(f => f.id !== id);
    writeJSON(FEEDBACK_FILE, feedbackList);
    return true;
  },

  // Calculate review metrics based exclusively on approved feedback
  getApprovedReviewStats() {
    const approved = this.getFeedback(false);
    const totalCount = approved.length;

    if (totalCount === 0) {
      return {
        totalReviews: 0,
        averageRating: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        categoryBreakdown: {}
      };
    }

    let sum = 0;
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const categoryCounts = {};

    approved.forEach(rev => {
      const r = Math.min(5, Math.max(1, rev.rating));
      sum += r;
      distribution[r] = (distribution[r] || 0) + 1;
      categoryCounts[rev.category] = (categoryCounts[rev.category] || 0) + 1;
    });

    const averageRating = (sum / totalCount).toFixed(1);

    return {
      totalReviews: totalCount,
      averageRating: parseFloat(averageRating),
      ratingDistribution: distribution,
      categoryBreakdown: categoryCounts
    };
  }
};

module.exports = db;
