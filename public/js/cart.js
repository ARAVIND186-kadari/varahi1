// Varahi Tiffins - Cart, Billing & Test-Order Checkout Engine
//
// BILLING STRUCTURE (must stay in sync with server.js `computeBill`):
//   Item subtotal + Service charge (₹14.99/order) + Packaging fee (₹0)
//   + Delivery charge (pending integration OR labelled dev estimate)
//   + optional Chef tip  =  Final total
// GST is intentionally NOT shown on the customer-facing bill. The business's
// tax-compliance figure is calculated separately on the server.
//
// PAYMENT / DELIVERY INTEGRATIONS:
//   Both are placeholders (see services/paymentService.js and
//   services/deliveryService.js). Nothing here opens Razorpay Checkout or
//   requests a Shiprocket rate — checkout stores a clearly labelled TEST order.

const Cart = {
  items: [],
  settings: null,
  integrations: null,
  tipAmount: 0,
  activeTipPreset: 0,

  // Default bill values, used until /api/settings responds.
  DEFAULTS: {
    serviceCharge: 14.99,
    packagingFee: 0,
    minimumTip: 5,
    tipPresets: [10, 20, 30, 50],
    enableDevelopmentDeliveryFee: false,
    developmentDeliveryFee: 30
  },

  init() {
    this.loadFromStorage();
    this.bindEvents();
    this.renderTipButtons();
    this.render();
  },

  // ------------------------------------------------------------------Storage
  loadFromStorage() {
    try {
      const stored = localStorage.getItem('varahi_cart');
      this.items = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(this.items)) this.items = [];

      const storedTip = localStorage.getItem('varahi_cart_tip');
      this.tipAmount = storedTip ? (parseFloat(storedTip) || 0) : 0;
      this.activeTipPreset = this.tipAmount;
    } catch (e) {
      this.items = [];
      this.tipAmount = 0;
    }
  },

  saveToStorage() {
    try {
      localStorage.setItem('varahi_cart', JSON.stringify(this.items));
      localStorage.setItem('varahi_cart_tip', String(this.tipAmount));
    } catch (e) {
      console.error('Failed to save cart to storage', e);
    }
  },

  setSettings(settings) {
    this.settings = settings;
    this.renderTipButtons();
    this.syncTipSelection();
    this.render();
  },

  setIntegrations(integrations) {
    this.integrations = integrations;
    const paymentEl = document.getElementById('paymentIntegrationStatus');
    const deliveryEl = document.getElementById('deliveryIntegrationStatus');
    if (paymentEl) {
      paymentEl.textContent = this.formatIntegrationStatus(integrations && integrations.payment);
    }
    if (deliveryEl) {
      deliveryEl.textContent = this.formatIntegrationStatus(integrations && integrations.delivery);
    }
  },

  formatIntegrationStatus(entry) {
    if (!entry) return 'Not configured';
    if (entry.status === 'configured') return `Configured — ${entry.provider}`;
    return 'Not configured';
  },

  // ----------------------------------------------------------------Settings
  getMinTip() {
    const v = this.settings && Number(this.settings.minimumTip);
    return Number.isFinite(v) && v > 0 ? v : this.DEFAULTS.minimumTip;
  },

  getServiceCharge() {
    if (this.settings && this.settings.serviceCharge !== undefined) {
      const v = Number(this.settings.serviceCharge);
      if (Number.isFinite(v)) return v;
    }
    return this.DEFAULTS.serviceCharge;
  },

  getPackagingFee() {
    if (this.settings && this.settings.packagingFee !== undefined) {
      const v = Number(this.settings.packagingFee);
      if (Number.isFinite(v)) return v;
    }
    return this.DEFAULTS.packagingFee;
  },

  round2(n) {
    const v = Number(n);
    return Math.round((Number.isFinite(v) ? v : 0) * 100) / 100;
  },

  // ----------------------------------------------------------------Cart data
  addItem(item) {
    const existing = this.items.find(i => i.id === item.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      this.items.push({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: 1,
        category: item.category || ''
      });
    }
    this.saveToStorage();
    this.render();
    // NOTE: the cart drawer is deliberately NOT opened here — the customer
    // stays on the menu and can keep adding items. Use "View Cart" instead.
    showToast(`Added ${item.name} to cart!`, 'success');
  },

  updateQuantity(id, delta) {
    const index = this.items.findIndex(i => i.id === id);
    if (index === -1) return;

    const item = this.items[index];
    const nextQty = item.quantity + delta;

    if (nextQty <= 0) {
      this.removeItem(id);
      return;
    }

    item.quantity = nextQty;
    this.saveToStorage();
    this.render();
  },

  removeItem(id) {
    const index = this.items.findIndex(i => i.id === id);
    if (index === -1) return;
    const name = this.items[index].name;
    this.items.splice(index, 1);
    this.saveToStorage();
    this.render();
    showToast(`Removed ${name} from cart.`, 'success');
  },

  clearCart() {
    this.items = [];
    this.tipAmount = 0;
    this.activeTipPreset = 0;
    this.saveToStorage();
    this.syncTipSelection();
    this.render();
  },

  getCount() {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  },

  getSubtotal() {
    return this.round2(this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0));
  },

  // -------------------------------------------------------------------Drawer
  isDrawerOpen() {
    const overlay = document.getElementById('cartDrawerOverlay');
    return !!overlay && overlay.classList.contains('active');
  },

  openDrawer() {
    const overlay = document.getElementById('cartDrawerOverlay');
    if (overlay) overlay.classList.add('active');
    this.updateViewCartButton();
  },

  closeDrawer() {
    const overlay = document.getElementById('cartDrawerOverlay');
    if (overlay) overlay.classList.remove('active');
    this.updateViewCartButton();
  },

  // --------------------------------------------------------------------Tips
  renderTipButtons() {
    const container = document.getElementById('tipSelector');
    if (!container) return;

    const presets = (this.settings && Array.isArray(this.settings.tipPresets) && this.settings.tipPresets.length)
      ? this.settings.tipPresets
      : this.DEFAULTS.tipPresets;

    container.innerHTML = [
      `<button type="button" class="tip-btn" data-tip="0">No Tip</button>`,
      ...presets.map(p => `<button type="button" class="tip-btn" data-tip="${Number(p)}">₹${Number(p)}</button>`),
      `<button type="button" class="tip-btn" data-tip="custom">Custom</button>`
    ].join('');

    container.querySelectorAll('.tip-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleTipClick(e.currentTarget));
    });

    this.syncTipSelection();
  },

  handleTipClick(btn) {
    const raw = btn.dataset.tip;
    const customRow = document.getElementById('customTipRow');

    if (raw === 'custom') {
      container_setActive(btn);
      if (customRow) customRow.style.display = 'flex';
      const input = document.getElementById('customTipInput');
      if (input) input.focus();
      return;
    }

    if (customRow) customRow.style.display = 'none';
    this.applyTip(Number(raw));
  },

  applyTip(amount) {
    const min = this.getMinTip();
    const value = this.round2(amount);

    if (value < 0) {
      showToast('Tip cannot be negative.', 'error');
      return false;
    }
    if (value > 0 && value < min) {
      showToast(`Minimum chef tip is ₹${min}. Enter ₹${min} or more, or choose No Tip.`, 'error');
      return false;
    }

    this.tipAmount = value;
    this.activeTipPreset = value;
    this.saveToStorage();
    this.syncTipSelection();
    this.render();
    if (value > 0) showToast(`Chef tip of ₹${value} added. You can remove it before checkout.`, 'success');
    return true;
  },

  removeTip() {
    this.tipAmount = 0;
    this.activeTipPreset = 0;
    const input = document.getElementById('customTipInput');
    if (input) input.value = '';
    const customRow = document.getElementById('customTipRow');
    if (customRow) customRow.style.display = 'none';
    this.saveToStorage();
    this.syncTipSelection();
    this.render();
    showToast('Chef tip removed.', 'success');
  },

  syncTipSelection() {
    const container = document.getElementById('tipSelector');
    if (container) {
      const presetValues = [];
      container.querySelectorAll('.tip-btn').forEach(btn => {
        if (btn.dataset.tip !== 'custom') presetValues.push(Number(btn.dataset.tip));
      });

      // A tip that matches no preset button belongs to the Custom control.
      const customIsActive = this.tipAmount > 0 && !presetValues.includes(Number(this.tipAmount));

      container.querySelectorAll('.tip-btn').forEach(btn => {
        const isActive = btn.dataset.tip === 'custom'
          ? customIsActive
          : (Number(btn.dataset.tip) === Number(this.tipAmount));
        btn.classList.toggle('active', isActive);
      });

      const customRow = document.getElementById('customTipRow');
      if (customRow) customRow.style.display = customIsActive ? 'flex' : 'none';
    }

    const removeBtn = document.getElementById('btnRemoveTip');
    if (removeBtn) removeBtn.style.display = this.tipAmount > 0 ? 'inline-block' : 'none';

    const hint = document.getElementById('tipHint');
    if (hint) {
      hint.textContent = this.tipAmount > 0
        ? `Tip applied: ₹${this.tipAmount}`
        : `Minimum tip ₹${this.getMinTip()}. You can skip or remove the tip at any time.`;
    }
  },

  // ----------------------------------------------------------------Billing
  isDelivery() {
    const typeBtn = document.querySelector('.order-type-btn.active');
    return !!(typeBtn && typeBtn.dataset.type === 'delivery');
  },

  /**
   * Calculates the customer bill exactly like the server does and paints it.
   * No GST line is rendered — by design.
   */
  renderTotals() {
    const hasItems = this.items.length > 0;
    const subtotal = hasItems ? this.getSubtotal() : 0;
    const isDelivery = this.isDelivery();

    const serviceCharge = hasItems ? this.getServiceCharge() : 0;
    const packagingFee = hasItems ? this.getPackagingFee() : 0;

    // Delivery charge: only a labelled DEVELOPMENT estimate is ever shown.
    // A live rate arrives from Shiprocket later — never invented here.
    const devEnabled = isDelivery && !!(this.settings && this.settings.enableDevelopmentDeliveryFee);
    const deliveryCharge = (hasItems && devEnabled)
      ? this.round2(Number(this.settings.developmentDeliveryFee) || 0)
      : 0;
    const deliveryLabel = !isDelivery
      ? { html: 'Not applicable (pickup)', pending: false }
      : (devEnabled
          ? { html: `₹${deliveryCharge} <small class="dev-estimate-tag">dev estimate</small>`, pending: false }
          : { html: 'Calculated when delivery integration is enabled', pending: true });

    const tip = hasItems ? this.tipAmount : 0;
    const grandTotal = this.round2(subtotal + serviceCharge + packagingFee + deliveryCharge + tip);

    const set = (id, html) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html;
    };

    set('cartSubtotal', `₹${subtotal.toFixed(2)}`);
    set('cartServiceCharge', `₹${serviceCharge.toFixed(2)}`);
    set('cartPackagingFee', `₹${packagingFee.toFixed(2)}`);
    set('cartTip', `₹${tip.toFixed(2)}`);
    set('cartGrandTotal', `₹${grandTotal.toFixed(2)}`);

    const deliveryEl = document.getElementById('cartDeliveryCharge');
    if (deliveryEl) {
      deliveryEl.innerHTML = deliveryLabel.html;
      deliveryEl.classList.toggle('pending-label', !!deliveryLabel.pending);
    }

    const btnTest = document.getElementById('btnPlaceTestOrder');
    const btnWhatsApp = document.getElementById('btnOrderWhatsApp');
    if (btnTest) btnTest.disabled = this.items.length === 0;
    if (btnWhatsApp) btnWhatsApp.disabled = this.items.length === 0;

    const deliveryLabelText = !isDelivery
      ? 'Not applicable (pickup)'
      : (devEnabled ? `₹${deliveryCharge} (development estimate)` : 'Calculated when delivery integration is enabled');

    return {
      subtotal,
      serviceCharge,
      packagingFee,
      deliveryCharge,
      deliveryLabelText,
      tip,
      grandTotal,
      isDelivery
    };
  },

  // -----------------------------------------------------------------Rendering
  updateViewCartButton() {
    const fab = document.getElementById('viewCartFab');
    if (!fab) return;
    const count = this.getCount();
    const show = count > 0 && !this.isDrawerOpen();
    fab.style.display = show ? 'flex' : 'none';
    if (show) {
      const totalEl = document.getElementById('viewCartFabTotal');
      if (totalEl) totalEl.textContent = `₹${this.renderTotals().grandTotal.toFixed(2)}`;
    }
  },

  render() {
    // Update badge counts
    const count = this.getCount();
    document.querySelectorAll('.js-cart-count').forEach(badge => {
      badge.textContent = count;
      if (badge.id !== 'viewCartFab') {
        badge.style.display = count > 0 ? 'flex' : 'none';
      }
    });

    // Render items list
    const container = document.getElementById('cartItemsList');
    if (container) {
      if (this.items.length === 0) {
        container.innerHTML = `
          <div class="cart-empty-message">
            <div style="font-size: 2.5rem; margin-bottom: 8px;">🍽️</div>
            <p style="font-weight: 700; margin-bottom: 4px;">Your cart is empty</p>
            <p style="font-size: 0.85rem;">Explore our delicious South Indian tiffins and add your favorites!</p>
          </div>
        `;
      } else {
        container.innerHTML = this.items.map(item => `
          <div class="cart-item-row" data-id="${escapeHtml(item.id)}">
            <div class="cart-item-details">
              <div class="name">${escapeHtml(item.name)}</div>
              <div class="price">₹${item.price} each &bull; <strong>₹${item.price * item.quantity}</strong></div>
            </div>
            <div class="cart-item-actions">
              <div class="qty-stepper">
                <button class="btn-qty" type="button" aria-label="Decrease quantity" onclick="Cart.updateQuantity('${escapeHtml(item.id)}', -1)">-</button>
                <span class="qty-val">${item.quantity}</span>
                <button class="btn-qty" type="button" aria-label="Increase quantity" onclick="Cart.updateQuantity('${escapeHtml(item.id)}', 1)">+</button>
              </div>
              <button class="btn-remove-item" type="button" aria-label="Remove item" title="Remove ${escapeHtml(item.name)}" onclick="Cart.removeItem('${escapeHtml(item.id)}')">🗑 Remove</button>
            </div>
          </div>
        `).join('');
      }
    }

    this.renderTotals();
    this.updateViewCartButton();
  },

  // ------------------------------------------------------------------Checkout
  readCheckoutForm() {
    const nameInput = document.getElementById('orderCustomerName');
    const phoneInput = document.getElementById('orderCustomerPhone');
    const addressInput = document.getElementById('orderDeliveryAddress');
    const pinInput = document.getElementById('orderPinCode');
    const notesInput = document.getElementById('orderSpecialInstructions');

    return {
      customerName: nameInput ? nameInput.value.trim() : '',
      customerPhone: phoneInput ? phoneInput.value.trim() : '',
      deliveryAddress: addressInput ? addressInput.value.trim() : '',
      pinCode: pinInput ? pinInput.value.trim() : '',
      specialInstructions: notesInput ? notesInput.value.trim() : '',
      isDelivery: this.isDelivery(),
      nameInput, phoneInput, addressInput, pinInput
    };
  },

  validateCheckoutForm() {
    const form = this.readCheckoutForm();

    if (this.items.length === 0) {
      showToast('Your cart is empty. Please add items to proceed.', 'error');
      return null;
    }
    if (form.customerName.length < 2) {
      showToast('Please enter your name for the order.', 'error');
      if (form.nameInput) form.nameInput.focus();
      return null;
    }
    if (form.customerPhone.replace(/\D/g, '').length < 10) {
      showToast('Please enter a valid 10-digit phone number.', 'error');
      if (form.phoneInput) form.phoneInput.focus();
      return null;
    }
    if (form.isDelivery) {
      if (form.deliveryAddress.length < 10) {
        showToast('Please enter your complete delivery address.', 'error');
        if (form.addressInput) form.addressInput.focus();
        return null;
      }
      if (!/^\d{6}$/.test(form.pinCode)) {
        showToast('Please enter a valid 6-digit delivery PIN code.', 'error');
        if (form.pinInput) form.pinInput.focus();
        return null;
      }
    }
    return form;
  },

  buildOrderPayload(form) {
    return {
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      orderType: form.isDelivery ? 'delivery' : 'pickup',
      deliveryAddress: form.isDelivery ? form.deliveryAddress : '',
      pinCode: form.isDelivery ? form.pinCode : '',
      items: this.items.map(i => ({ id: i.id, quantity: i.quantity })),
      tip: this.tipAmount,
      specialInstructions: form.specialInstructions
    };
  },

  /**
   * PLACE TEST ORDER — stores the order locally with a clear TEST flag.
   * No payment gateway is contacted and no delivery rate is requested.
   */
  async handlePlaceTestOrder() {
    const form = this.validateCheckoutForm();
    if (!form) return;

    const btn = document.getElementById('btnPlaceTestOrder');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span>Saving test order…</span>'; }

    try {
      const res = await fetch('/api/orders/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.buildOrderPayload(form))
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(data.error || 'Could not save the test order.', 'error');
        return;
      }

      this.showTestOrderModal(data.order, data.bill);
      this.clearCart();
      this.closeDrawer();
    } catch (err) {
      console.error('Test order error:', err);
      showToast('Could not reach the server. Please try again.', 'error');
    } finally {
      if (btn) {
        btn.disabled = this.items.length === 0;
        btn.innerHTML = '<span>🧪 Place Test Order — No Payment</span>';
      }
    }
  },

  showTestOrderModal(order, bill) {
    const itemsHtml = (order.items || [])
      .map(i => `<li>${escapeHtml(i.name)} × ${i.quantity} — ₹${i.itemTotal}</li>`)
      .join('');

    const modalHtml = `
      <div class="modal-overlay active" id="testOrderModal">
        <div class="modal-dialog" style="max-width: 520px;">
          <div class="modal-header">
            <h3>🧪 Test Order Saved (#${escapeHtml(order.id)})</h3>
            <button class="btn-close-drawer" onclick="document.getElementById('testOrderModal').remove()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="test-order-banner">
              <strong>THIS IS A TEST ORDER.</strong>
              Nothing was paid, no payment method was used, and no delivery has been confirmed.
            </div>

            <ul class="test-order-items">${itemsHtml}</ul>

            <div class="cart-summary-box" style="margin-top: 12px;">
              <div class="summary-line"><span>Items Subtotal:</span><span>₹${Number(bill.subtotal).toFixed(2)}</span></div>
              <div class="summary-line"><span>Service Charge:</span><span>₹${Number(bill.serviceCharge).toFixed(2)}</span></div>
              <div class="summary-line"><span>Packaging Fee:</span><span>₹${Number(bill.packagingFee).toFixed(2)}</span></div>
              <div class="summary-line"><span>Delivery Charge:</span><span>${escapeHtml(bill.deliveryChargeLabel || '—')}</span></div>
              <div class="summary-line"><span>Chef Tip:</span><span>₹${Number(bill.tip).toFixed(2)}</span></div>
              <div class="summary-line total"><span>Final Total:</span><span>₹${Number(bill.grandTotal).toFixed(2)}</span></div>
            </div>

            <p style="font-size: 0.82rem; color: var(--text-muted); margin-top: 14px; line-height: 1.5;">
              Payment integration: <strong>Not configured (Razorpay)</strong>.<br>
              Delivery integration: <strong>Not configured (Shiprocket)</strong>.<br>
              This order is stored for testing only and is not a confirmed, paid or deliverable order.
            </p>
          </div>
          <div class="modal-footer">
            <button class="btn-primary" onclick="document.getElementById('testOrderModal').remove()">Done</button>
          </div>
        </div>
      </div>
    `;

    const existing = document.getElementById('testOrderModal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  // -------------------------------------------------------Existing WhatsApp flow
  async handleWhatsAppOrder() {
    const form = this.validateCheckoutForm();
    if (!form) return;

    const { subtotal, serviceCharge, packagingFee, deliveryLabelText, tip, grandTotal, isDelivery } =
      this.renderTotals();

    // Record the order first with status: Awaiting WhatsApp Confirmation
    let orderId = `VT-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...this.buildOrderPayload(form), channel: 'whatsapp' })
      });
      const data = await response.json();
      if (data.order && data.order.id) {
        orderId = data.order.id;
      }
    } catch (err) {
      console.warn('Backend order recording note:', err);
    }

    const restaurantName = this.settings ? this.settings.restaurantName : 'Varahi Tiffins';
    const destinationNumber = this.settings ? (this.settings.whatsapp || '919494500646') : '919494500646';

    let message = `*Namaste! New Order for ${restaurantName}*\n`;
    message += `*Order Reference:* #${orderId}\n`;
    message += `------------------------------------\n`;
    message += `*Customer:* ${form.customerName}\n`;
    if (form.customerPhone) message += `*Contact:* ${form.customerPhone}\n`;
    message += `*Order Preference:* ${isDelivery ? '🛵 Home Delivery' : '🛍️ Takeaway / Pickup'}\n`;
    if (isDelivery && form.deliveryAddress) {
      message += `*Delivery Address:* ${form.deliveryAddress}\n`;
      if (form.pinCode) message += `*PIN Code:* ${form.pinCode}\n`;
    }
    message += `------------------------------------\n`;
    message += `*ITEMS ORDERED:*\n`;

    this.items.forEach((item, idx) => {
      message += `${idx + 1}. ${item.name} x ${item.quantity} = ₹${item.price * item.quantity}\n`;
    });

    message += `------------------------------------\n`;
    message += `*Subtotal:* ₹${subtotal.toFixed(2)}\n`;
    message += `*Service Charge:* ₹${serviceCharge.toFixed(2)}\n`;
    message += `*Packaging:* ₹${packagingFee.toFixed(2)}\n`;
    if (isDelivery) message += `*Delivery Charge:* ${deliveryLabelText}\n`;
    if (tip > 0) message += `*Chef Tip:* ₹${tip.toFixed(2)}\n`;
    message += `*GRAND TOTAL:* ₹${grandTotal.toFixed(2)}\n`;
    message += `------------------------------------\n`;

    if (form.specialInstructions) {
      message += `*Special Instructions:* ${form.specialInstructions}\n`;
    }

    message += `\n_Please confirm availability, estimated preparation time, and acceptance of this order._`;

    const encodedText = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${destinationNumber}?text=${encodedText}`;

    showWhatsAppConfirmationModal(whatsappUrl, orderId);
  },

  bindEvents() {
    // Open cart drawer triggers
    document.querySelectorAll('.js-open-cart').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.openDrawer();
      });
    });

    // Close cart drawer triggers
    document.querySelectorAll('.js-close-cart').forEach(btn => {
      btn.addEventListener('click', () => this.closeDrawer());
    });

    // Close when clicking the backdrop (but not the drawer itself)
    const overlay = document.getElementById('cartDrawerOverlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.closeDrawer();
      });
    }

    // Order Type toggle (Pickup vs Delivery)
    const typeButtons = document.querySelectorAll('.order-type-btn');
    typeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        typeButtons.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const isDelivery = e.currentTarget.dataset.type === 'delivery';
        const fieldGroup = document.getElementById('deliveryFieldGroup');
        if (fieldGroup) fieldGroup.style.display = isDelivery ? 'block' : 'none';
        this.renderTotals();
        this.updateViewCartButton();
      });
    });

    // Chef tip: custom amount
    const btnApplyTip = document.getElementById('btnApplyCustomTip');
    if (btnApplyTip) {
      btnApplyTip.addEventListener('click', () => {
        const input = document.getElementById('customTipInput');
        const raw = input ? input.value.trim() : '';
        const value = parseFloat(raw);

        if (raw === '' || !Number.isFinite(value)) {
          showToast('Enter a tip amount, or choose No Tip.', 'error');
          return;
        }
        if (value < 0) {
          showToast('Tip cannot be negative.', 'error');
          return;
        }
        if (value > 0 && value < this.getMinTip()) {
          showToast(`Tips below ₹${this.getMinTip()} are not accepted. Enter ₹${this.getMinTip()} or more.`, 'error');
          if (input) input.value = '';
          return;
        }
        this.applyTip(value);
      });
    }

    const btnRemoveTip = document.getElementById('btnRemoveTip');
    if (btnRemoveTip) {
      btnRemoveTip.addEventListener('click', () => this.removeTip());
    }

    // Place Test Order
    const btnTest = document.getElementById('btnPlaceTestOrder');
    if (btnTest) btnTest.addEventListener('click', () => this.handlePlaceTestOrder());

    // WhatsApp Order Button
    const btnWhatsApp = document.getElementById('btnOrderWhatsApp');
    if (btnWhatsApp) btnWhatsApp.addEventListener('click', () => this.handleWhatsAppOrder());

    // Call Button from Cart
    const btnCallCart = document.getElementById('btnCallFromCart');
    if (btnCallCart) {
      btnCallCart.addEventListener('click', () => {
        if (!this.settings || !this.settings.phone) return;
        const cleanPhone = this.settings.phone.replace(/[^0-9+]/g, '');
        window.location.href = `tel:${cleanPhone}`;
      });
    }
  }
};

// Small helper kept separate so tip buttons can be marked active safely.
function container_setActive(activeBtn) {
  const parent = activeBtn.parentElement;
  if (!parent) return;
  parent.querySelectorAll('.tip-btn').forEach(b => b.classList.remove('active'));
  activeBtn.classList.add('active');
}

function showWhatsAppConfirmationModal(url, orderId) {
  const modalHtml = `
    <div class="modal-overlay active" id="waOrderModal">
      <div class="modal-dialog" style="max-width: 480px;">
        <div class="modal-header">
          <h3>Order Prepared (#${orderId})</h3>
          <button class="btn-close-drawer" onclick="document.getElementById('waOrderModal').remove()">&times;</button>
        </div>
        <div class="modal-body" style="text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 12px; color: #25D366;">💬</div>
          <h4 style="font-family: var(--font-heading); font-size: 1.2rem; margin-bottom: 8px;">Review & Send on WhatsApp</h4>
          <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 18px;">
            We have prefilled your complete order message. Tapping the button below will open WhatsApp. 
            <strong style="color: var(--text-main); display: block; margin-top: 6px;">
              Please review the message and press 'Send' to submit your order to Varahi Tiffins.
            </strong>
          </p>
          <div style="background: #FFFBEB; border: 1px solid #FDE68A; color: #92400E; padding: 10px 14px; border-radius: 8px; font-size: 0.8rem; margin-bottom: 20px; text-align: left;">
            ℹ️ <strong>Note:</strong> Opening WhatsApp does not confirm order payment or acceptance. Our counter team will acknowledge and confirm your order on WhatsApp.
          </div>
          <a href="${url}" target="_blank" class="btn-primary" style="background: #25D366; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; width: 100%; padding: 14px; font-size: 1rem;" onclick="handleWhatsAppModalProceed()">
            Open WhatsApp to Send Order &rarr;
          </a>
        </div>
      </div>
    </div>
  `;

  const existing = document.getElementById('waOrderModal');
  if (existing) existing.remove();

  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function handleWhatsAppModalProceed() {
  const modal = document.getElementById('waOrderModal');
  if (modal) modal.remove();
  Cart.clearCart();
  Cart.closeDrawer();
  showToast('Order saved! Please tap Send in WhatsApp to complete.', 'success');
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// Global Toast Helper
function showToast(message, type = 'success') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : '⚠️'}</span>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}
