// Varahi Tiffins - Admin Portal Controller

// Safe HTML Escape Utility
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// Global Toast Notification Helper for Admin Dashboard
function showToast(message, type = 'success') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const borderColor = type === 'success' ? '#10B981' : (type === 'error' ? '#EF4444' : '#F59E0B');
  toast.style.cssText = `
    background: #1E293B;
    color: #FFFFFF;
    padding: 12px 20px;
    border-radius: 10px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.25);
    font-size: 0.9rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 10px;
    border-left: 4px solid ${borderColor};
    pointer-events: auto;
    animation: toastSlideIn 0.25s ease forwards;
  `;
  toast.innerHTML = `<span>${type === 'success' ? '✓' : '⚠️'}</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

const Admin = {
  token: null,
  currentTab: 'overview',
  orders: [],
  menu: [],
  feedbackList: [],
  settings: {},

  init() {
    this.token = sessionStorage.getItem('varahi_admin_token');
    if (this.token) {
      this.showDashboard();
    } else {
      this.showLogin();
    }
    this.bindEvents();

    // Live auto-refresh interval for orders and feedback (every 10 seconds)
    setInterval(() => {
      if (this.token && document.getElementById('adminDashboardView').style.display !== 'none') {
        if (this.currentTab === 'overview') this.loadOverview();
        if (this.currentTab === 'orders') this.loadOrders();
        if (this.currentTab === 'feedback') this.loadFeedback();
      }
    }, 10000);
  },

  bindEvents() {
    // Login form
    const loginForm = document.getElementById('adminLoginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }

    // Mobile sidebar toggle
    const toggleBtn = document.getElementById('btnToggleSidebar');
    const closeBtn = document.getElementById('btnCloseSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const sidebar = document.querySelector('.admin-sidebar');

    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => this.toggleSidebar(true));
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.toggleSidebar(false));
    }
    if (overlay) {
      overlay.addEventListener('click', () => this.toggleSidebar(false));
    }

    // Show/hide close button based on viewport
    this.updateCloseBtnVisibility();
    window.addEventListener('resize', () => this.updateCloseBtnVisibility());

    // Sidebar tab buttons
    document.querySelectorAll('.js-admin-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        this.switchTab(tab);
        // Close sidebar on mobile after tab selection
        if (window.innerWidth < 768) {
          this.toggleSidebar(false);
        }
      });
    });

    // Logout button
    const logoutBtn = document.getElementById('btnAdminLogout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    // Settings form
    const settingsForm = document.getElementById('restaurantSettingsForm');
    if (settingsForm) {
      settingsForm.addEventListener('submit', (e) => this.handleSaveSettings(e));
    }

    // Add Menu Item form
    const addDishForm = document.getElementById('addDishForm');
    if (addDishForm) {
      addDishForm.addEventListener('submit', (e) => this.handleAddDish(e));
    }

    // Export Feedback CSV
    const exportBtn = document.getElementById('btnExportFeedback');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.handleExportFeedback());
    }

    // Hash routing for browser Back / Forward buttons
    window.addEventListener('hashchange', () => {
      const hashTab = window.location.hash.replace('#', '').trim();
      const validTabs = ['overview', 'orders', 'menu', 'feedback', 'settings', 'integrations', 'whatsapp'];
      if (validTabs.includes(hashTab) && hashTab !== this.currentTab) {
        this.switchTab(hashTab, false);
      }
    });

    // Handle initial hash on page load
    const initialHash = window.location.hash.replace('#', '').trim();
    if (initialHash && ['overview', 'orders', 'menu', 'feedback', 'settings', 'integrations', 'whatsapp'].includes(initialHash)) {
      this.currentTab = initialHash;
    }
  },

  toggleSidebar(open) {
    const sidebar = document.querySelector('.admin-sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) {
      if (open) {
        sidebar.classList.add('open');
      } else {
        sidebar.classList.remove('open');
      }
    }
    if (overlay) {
      if (open) {
        overlay.classList.add('active');
      } else {
        overlay.classList.remove('active');
      }
    }
  },

  updateCloseBtnVisibility() {
    const closeBtn = document.getElementById('btnCloseSidebar');
    if (closeBtn) {
      closeBtn.style.display = window.innerWidth < 768 ? 'flex' : 'none';
    }
  },

  async handleLogin(e) {
    e.preventDefault();
    const passInput = document.getElementById('adminPassword');
    const password = passInput.value;
    const errorEl = document.getElementById('loginError');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await res.json();
      if (!res.ok) {
        if (errorEl) {
          errorEl.textContent = data.error || 'Login failed';
          errorEl.style.display = 'block';
        }
        return;
      }

      this.token = data.token;
      sessionStorage.setItem('varahi_admin_token', this.token);
      this.showDashboard();
      showToast('Welcome to Varahi Tiffins Admin Workspace', 'success');
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = 'Server connection error';
        errorEl.style.display = 'block';
      }
    }
  },

  handleLogout() {
    this.token = null;
    sessionStorage.removeItem('varahi_admin_token');
    this.showLogin();
  },

  showLogin() {
    document.getElementById('adminLoginView').style.display = 'flex';
    document.getElementById('adminDashboardView').style.display = 'none';
  },

  showDashboard() {
    document.getElementById('adminLoginView').style.display = 'none';
    document.getElementById('adminDashboardView').style.display = 'flex';
    this.switchTab(this.currentTab);
  },

  switchTab(tab, updateHash = true) {
    if (!tab) tab = 'overview';
    this.currentTab = tab;

    // Synchronize browser URL hash for full browser Back/Forward button support
    if (updateHash && window.location.hash !== '#' + tab) {
      window.location.hash = '#' + tab;
    }

    // Update sidebar nav active states
    document.querySelectorAll('.js-admin-tab-btn').forEach(b => {
      if (b.dataset.tab === tab) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    // Hide all tab views
    document.querySelectorAll('.admin-tab-content').forEach(view => {
      view.style.display = 'none';
    });

    // Show target tab view
    const targetView = document.getElementById(`tab-${tab}`);
    if (targetView) targetView.style.display = 'block';

    // Update topbar breadcrumbs & title
    const sep = document.getElementById('adminBreadcrumbSep');
    const currentCrumb = document.getElementById('adminBreadcrumbCurrent');
    const tabTitles = {
      'overview': 'Dashboard / Home',
      'orders': 'Order Management',
      'menu': 'Menu & Inventory',
      'feedback': 'Feedback & Reviews',
      'settings': 'Restaurant Settings',
      'integrations': 'Billing & Integrations',
      'whatsapp': 'WhatsApp Ordering'
    };

    if (sep && currentCrumb) {
      if (tab === 'overview') {
        sep.style.display = 'none';
        currentCrumb.style.display = 'none';
      } else {
        sep.style.display = 'inline';
        currentCrumb.style.display = 'inline';
        currentCrumb.textContent = tabTitles[tab] || tab;
      }
    }

    // Close mobile sidebar if open
    if (window.innerWidth < 768) {
      this.toggleSidebar(false);
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Load data for the tab
    if (tab === 'overview') this.loadOverview();
    if (tab === 'orders') this.loadOrders();
    if (tab === 'menu') this.loadMenu();
    if (tab === 'feedback') this.loadFeedback();
    if (tab === 'settings') this.loadSettings();
    if (tab === 'integrations') this.loadIntegrations();
    if (tab === 'whatsapp') this.loadWhatsAppSettings();
  },

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`
    };
  },

  // 1. Overview Tab
  async loadOverview() {
    try {
      const [ordersRes, feedbackRes, menuRes] = await Promise.all([
        fetch('/api/admin/orders', { headers: this.getHeaders() }),
        fetch('/api/admin/feedback', { headers: this.getHeaders() }),
        fetch('/api/menu')
      ]);

      if (ordersRes.status === 401 || ordersRes.status === 403) {
        this.handleLogout();
        return;
      }

      const orders = await ordersRes.json();
      const fbData = await feedbackRes.json();
      const menu = await menuRes.json();

      const totalOrdersEl = document.getElementById('statTotalOrders');
      const waOrdersEl = document.getElementById('statWhatsAppOrders');
      const avgRatingEl = document.getElementById('statAvgRating');
      const pendingReviewsEl = document.getElementById('statPendingReviews');
      const outOfStockEl = document.getElementById('statOutOfStock');

      if (totalOrdersEl) totalOrdersEl.textContent = Array.isArray(orders) ? orders.length : 0;
      if (waOrdersEl) waOrdersEl.textContent = Array.isArray(orders) ? orders.filter(o => o.channel === 'whatsapp').length : 0;
      if (avgRatingEl) avgRatingEl.textContent = fbData.stats ? `${fbData.stats.averageRating} ★` : '0.0 ★';
      if (pendingReviewsEl) pendingReviewsEl.textContent = fbData.pendingCount || 0;
      
      const outOfStockCount = Array.isArray(menu) ? menu.filter(m => !m.inStock || m.stockQuantity === 0).length : 0;
      if (outOfStockEl) outOfStockEl.textContent = outOfStockCount;

      // Update sidebar badges
      const fbBadge = document.getElementById('badgePendingFeedback');
      if (fbBadge) {
        fbBadge.textContent = fbData.pendingCount || 0;
        fbBadge.style.display = (fbData.pendingCount > 0) ? 'inline-block' : 'none';
      }

      // Render recent activity preview
      const recentOrdersEl = document.getElementById('overviewRecentOrders');
      if (recentOrdersEl) {
        if (!Array.isArray(orders) || orders.length === 0) {
          recentOrdersEl.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #64748B; padding: 24px;">No customer orders recorded yet.</td></tr>`;
        } else {
          const top5 = orders.slice(0, 5);
          recentOrdersEl.innerHTML = top5.map(o => `
            <tr>
              <td><strong>#${escapeHtml(o.id)}</strong></td>
              <td>${escapeHtml(o.customerName)}</td>
              <td>₹${o.grandTotal}</td>
              <td><span class="badge-status ${o.channel === 'whatsapp' ? 'approved' : 'pending'}">${escapeHtml((o.channel || 'web').toUpperCase())}</span></td>
              <td><span class="badge-status ${o.status && o.status.includes('Confirmed') ? 'approved' : 'pending'}">${escapeHtml(o.status || 'Received')}</span></td>
            </tr>
          `).join('');
        }
      }
    } catch (err) {
      console.error('Overview load error:', err);
    }
  },

  // 2. Orders Tab
  async loadOrders() {
    try {
      const res = await fetch('/api/admin/orders', { headers: this.getHeaders() });
      if (res.status === 401 || res.status === 403) {
        this.handleLogout();
        return;
      }
      this.orders = await res.json();
      this.renderOrdersTable(this.orders);
    } catch (err) {
      console.error('Orders load error:', err);
    }
  },

  renderOrdersTable(orders) {
    const tableBody = document.getElementById('adminOrdersTableBody');
    if (!tableBody) return;

    if (!Array.isArray(orders) || orders.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: #64748B;">No orders recorded in database.</td></tr>`;
      return;
    }

    tableBody.innerHTML = orders.map(o => {
      const dateStr = new Date(o.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
      const itemsSummary = o.items ? o.items.map(i => `${i.name} (x${i.quantity})`).join(', ') : 'None';
      
      return `
        <tr>
          <td><strong>#${escapeHtml(o.id)}</strong>${o.isTestOrder ? ' <span class="badge-status test-order" title="Saved via Place Test Order">TEST</span>' : ''}<br><small style="color: #64748B;">${dateStr}</small></td>
          <td>
            <strong>${escapeHtml(o.customerName)}</strong><br>
            <small style="color: #64748B;">${escapeHtml(o.customerPhone || 'No phone')}</small>
          </td>
          <td style="max-width: 200px;">
            <div style="font-size: 0.82rem; color: #334155;">${escapeHtml(itemsSummary)}</div>
            ${o.specialInstructions ? `<small style="color: #B45309;">Note: ${escapeHtml(o.specialInstructions)}</small>` : ''}
          </td>
          <td>
            <span class="badge-status ${o.orderType === 'delivery' ? 'pending' : 'approved'}">
              ${o.orderType === 'delivery' ? '🛵 Delivery' : '🛍️ Pickup'}
            </span>
            ${o.deliveryAddress ? `<br><small style="color: #64748B;">${escapeHtml(o.deliveryAddress)}</small>` : ''}
          </td>
          <td><strong>₹${o.grandTotal}</strong></td>
          <td>
            <select class="admin-status-select" onchange="Admin.updateOrderStatus('${escapeHtml(o.id)}', this.value)" style="padding: 6px; border-radius: 6px; border: 1px solid #CBD5E1; font-size: 0.82rem;">
              <option value="Awaiting WhatsApp Confirmation" ${o.status === 'Awaiting WhatsApp Confirmation' ? 'selected' : ''}>Awaiting WhatsApp Confirmation</option>
              <option value="Confirmed" ${o.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
              <option value="Preparing" ${o.status === 'Preparing' ? 'selected' : ''}>Preparing</option>
              <option value="Ready" ${o.status === 'Ready' ? 'selected' : ''}>Ready for Pickup / Out</option>
              <option value="Delivered" ${o.status === 'Delivered' ? 'selected' : ''}>Completed / Delivered</option>
              <option value="Cancelled" ${o.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </td>
          <td>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <a href="tel:${(o.customerPhone || '').replace(/[^0-9+]/g, '')}" class="btn-action respond" title="Call customer">
                📞 Call
              </a>
              ${o.isTestOrder ? `<button class="btn-action reject" onclick="Admin.deleteTestOrder('${escapeHtml(o.id)}')" title="Delete this test order">🗑 Delete Test</button>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  filterOrders() {
    const filter = document.getElementById('orderTestFilter');
    const mode = filter ? filter.value : 'all';
    let list = Array.isArray(this.orders) ? this.orders : [];
    if (mode === 'test') list = list.filter(o => o.isTestOrder);
    if (mode === 'live') list = list.filter(o => !o.isTestOrder);
    this.renderOrdersTable(list);
  },

  async deleteTestOrder(id) {
    if (!confirm(`Delete test order #${id}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast(data.message || `Test order #${id} deleted.`, 'success');
        this.loadOrders();
      } else {
        showToast(data.error || 'Failed to delete test order', 'error');
      }
    } catch (e) {
      showToast('Failed to delete test order', 'error');
    }
  },

  async updateOrderStatus(id, newStatus) {
    try {
      const res = await fetch(`/api/admin/orders/${id}/status`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        showToast(`Order #${id} status updated to ${newStatus}`, 'success');
      }
    } catch (err) {
      showToast('Failed to update order status', 'error');
    }
  },

  // 3. Menu & Inventory Tab
  async loadMenu() {
    try {
      const res = await fetch('/api/menu');
      this.menu = await res.json();
      this.renderMenuTable(this.menu);
    } catch (err) {
      console.error('Menu load error:', err);
    }
  },

  renderMenuTable(menu) {
    const tableBody = document.getElementById('adminMenuTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = menu.map(item => `
      <tr>
        <td>
          <strong>${escapeHtml(item.name)}</strong>
          ${item.isSpecial ? '<span style="color: #D97706; font-size: 0.75rem;"> ★ Special</span>' : ''}
          <br><small style="color: #64748B;">${escapeHtml(item.category)}</small>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 4px;">
            <span>₹</span>
            <input type="number" value="${item.price}" style="width: 70px; padding: 4px 6px; border: 1px solid #CBD5E1; border-radius: 4px;" 
              onchange="Admin.updateItemPrice('${item.id}', this.value)">
          </div>
        </td>
        <td>
          <input type="number" value="${item.stockQuantity !== undefined ? item.stockQuantity : 50}" style="width: 70px; padding: 4px 6px; border: 1px solid #CBD5E1; border-radius: 4px;" 
            onchange="Admin.updateItemStock('${item.id}', this.value)">
        </td>
        <td>
          <button class="btn-action ${item.inStock ? 'approve' : 'reject'}" onclick="Admin.toggleItemStock('${item.id}', ${!item.inStock})">
            ${item.inStock ? '✓ In Stock' : '✕ Out of Stock'}
          </button>
        </td>
        <td>
          <button class="btn-action reject" onclick="Admin.deleteItem('${item.id}')">
            Delete
          </button>
        </td>
      </tr>
    `).join('');
  },

  async updateItemPrice(id, newPrice) {
    try {
      const res = await fetch(`/api/admin/menu/${id}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ price: parseFloat(newPrice) })
      });
      if (res.ok) showToast('Price updated successfully!', 'success');
    } catch (e) {
      showToast('Failed to update price', 'error');
    }
  },

  async updateItemStock(id, newQty) {
    try {
      const qty = parseInt(newQty, 10);
      const res = await fetch(`/api/admin/menu/${id}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ stockQuantity: qty, inStock: qty > 0 })
      });
      if (res.ok) {
        showToast('Stock quantity updated!', 'success');
        this.loadMenu();
      }
    } catch (e) {
      showToast('Failed to update stock', 'error');
    }
  },

  async toggleItemStock(id, inStock) {
    try {
      const res = await fetch(`/api/admin/menu/${id}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ inStock })
      });
      if (res.ok) {
        showToast(`Item availability updated to ${inStock ? 'In Stock' : 'Out of Stock'}`, 'success');
        this.loadMenu();
      }
    } catch (e) {
      showToast('Failed to update stock', 'error');
    }
  },

  async deleteItem(id) {
    if (!confirm('Are you sure you want to delete this menu dish?')) return;
    try {
      const res = await fetch(`/api/admin/menu/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      if (res.ok) {
        showToast('Item deleted successfully', 'success');
        this.loadMenu();
      }
    } catch (e) {
      showToast('Failed to delete item', 'error');
    }
  },

  async handleAddDish(e) {
    e.preventDefault();
    const name = document.getElementById('newDishName').value;
    const category = document.getElementById('newDishCategory').value;
    const price = document.getElementById('newDishPrice').value;
    const description = document.getElementById('newDishDesc').value;
    const stockQuantity = document.getElementById('newDishStock').value;
    const isSpecial = document.getElementById('newDishSpecial').checked;

    try {
      const res = await fetch('/api/admin/menu', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ name, category, price, description, stockQuantity, isSpecial, isVeg: true })
      });
      if (res.ok) {
        showToast('Dish added to menu!', 'success');
        document.getElementById('addDishForm').reset();
        this.loadMenu();
      }
    } catch (e) {
      showToast('Failed to add dish', 'error');
    }
  },

  // 4. Feedback & Reviews Moderation Tab
  async loadFeedback() {
    try {
      const res = await fetch('/api/admin/feedback', { headers: this.getHeaders() });
      if (res.status === 401 || res.status === 403) {
        this.handleLogout();
        return;
      }
      const data = await res.json();
      this.feedbackList = data.feedback || [];
      this.renderFeedbackTable(this.feedbackList);
      this.renderFeedbackAnalytics(data);

      const fbBadge = document.getElementById('badgePendingFeedback');
      if (fbBadge) {
        fbBadge.textContent = data.pendingCount || 0;
        fbBadge.style.display = (data.pendingCount > 0) ? 'inline-block' : 'none';
      }
    } catch (err) {
      console.error('Feedback load error:', err);
    }
  },

  filterFeedback() {
    const statusFilter = document.getElementById('feedbackStatusFilter').value;
    const ratingFilter = document.getElementById('feedbackRatingFilter').value;
    const categoryFilter = document.getElementById('feedbackCategoryFilter').value;

    let filtered = this.feedbackList;
    if (statusFilter !== 'all') {
      filtered = filtered.filter(f => f.status === statusFilter);
    }
    if (ratingFilter !== 'all') {
      filtered = filtered.filter(f => f.rating === parseInt(ratingFilter, 10));
    }
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(f => f.category === categoryFilter);
    }

    this.renderFeedbackTable(filtered);
  },

  renderFeedbackAnalytics(data) {
    const statsContainer = document.getElementById('feedbackAnalyticsBox');
    if (!statsContainer) return;

    const stats = data.stats || { averageRating: 0, totalReviews: 0 };
    statsContainer.innerHTML = `
      <div style="display: flex; flex-wrap: wrap; gap: 24px; align-items: center; justify-content: space-between;">
        <div>
          <div style="font-size: 0.85rem; color: #64748B; font-weight: 700;">APPROVED PUBLIC SCORE</div>
          <div style="font-size: 2.2rem; font-weight: 800; color: #D97706;">${stats.averageRating} ★ <span style="font-size: 1rem; color: #64748B;">(${stats.totalReviews} approved)</span></div>
        </div>
        <div style="display: flex; gap: 16px;">
          <div style="background: #FEF3C7; padding: 10px 16px; border-radius: 8px;">
            <div style="font-size: 0.75rem; color: #92400E; font-weight: 700;">PENDING MODERATION</div>
            <div style="font-size: 1.4rem; font-weight: 800; color: #B45309;">${data.pendingCount || 0}</div>
          </div>
          <div style="background: #DCFCE7; padding: 10px 16px; border-radius: 8px;">
            <div style="font-size: 0.75rem; color: #166534; font-weight: 700;">APPROVED REVIEWS</div>
            <div style="font-size: 1.4rem; font-weight: 800; color: #15803D;">${data.approvedCount || 0}</div>
          </div>
          <div style="background: #FEE2E2; padding: 10px 16px; border-radius: 8px;">
            <div style="font-size: 0.75rem; color: #991B1B; font-weight: 700;">REJECTED / SPAM</div>
            <div style="font-size: 1.4rem; font-weight: 800; color: #B91C1C;">${data.rejectedCount || 0}</div>
          </div>
        </div>
      </div>
    `;
  },

  renderFeedbackTable(feedback) {
    const tableBody = document.getElementById('adminFeedbackTableBody');
    if (!tableBody) return;

    if (!Array.isArray(feedback) || feedback.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 30px; color: #64748B;">No feedback submissions match filters.</td></tr>`;
      return;
    }

    tableBody.innerHTML = feedback.map(item => {
      const stars = '★'.repeat(item.rating) + '☆'.repeat(5 - item.rating);
      const dateStr = new Date(item.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });

      return `
        <tr>
          <td>
            <strong>${escapeHtml(item.customerName)}</strong>
            ${item.customerEmail ? `<br><small style="color: #64748B;">${escapeHtml(item.customerEmail)}</small>` : ''}
            ${item.orderRef ? `<br><small style="color: #059669;">Ref: ${escapeHtml(item.orderRef)} ${item.isOrderVerified ? '✓ Verified' : ''}</small>` : ''}
          </td>
          <td>
            <div style="color: #F59E0B; font-weight: 700;">${stars}</div>
            <small style="color: #64748B;">${escapeHtml(item.category)}</small>
          </td>
          <td style="max-width: 320px;">
            <div style="font-size: 0.88rem; line-height: 1.4; color: #1E293B;">
              ${escapeHtml(item.reviewText)}
            </div>
            ${item.suggestions ? `
              <div style="margin-top: 6px; font-size: 0.8rem; color: #B45309; background: #FFFBEB; padding: 4px 8px; border-radius: 4px;">
                Suggestion: ${escapeHtml(item.suggestions)}
              </div>
            ` : ''}
            ${item.adminResponse ? `
              <div style="margin-top: 6px; font-size: 0.8rem; color: #1D4ED8; background: #EFF6FF; padding: 4px 8px; border-radius: 4px;">
                Admin Response: ${escapeHtml(item.adminResponse)}
              </div>
            ` : ''}
          </td>
          <td>
            <span class="badge-status ${escapeHtml(item.status)}">
              ${escapeHtml(item.status.toUpperCase())}
            </span>
          </td>
          <td><small style="color: #64748B;">${dateStr}</small></td>
          <td>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              ${item.status !== 'approved' ? `
                <button class="btn-action approve" onclick="Admin.moderateFeedback('${escapeHtml(item.id)}', 'approved')">
                  ✓ Approve
                </button>
              ` : ''}
              ${item.status !== 'rejected' ? `
                <button class="btn-action reject" onclick="Admin.moderateFeedback('${escapeHtml(item.id)}', 'rejected')">
                  ✕ Reject
                </button>
              ` : ''}
              <button class="btn-action respond" onclick="Admin.openResponseModal('${escapeHtml(item.id)}', '${escapeHtml(item.customerName).replace(/'/g, "\\'")}')">
                💬 Respond
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  async moderateFeedback(id, status) {
    try {
      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        showToast(`Review status updated to ${status}!`, 'success');
        this.loadFeedback();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Failed to moderate review', 'error');
      }
    } catch (e) {
      showToast('Failed to moderate review. Please check connection.', 'error');
    }
  },

  openResponseModal(id, customerName) {
    const existing = this.feedbackList.find(f => f.id === id);
    const existingReply = existing && existing.adminResponse ? existing.adminResponse : '';

    const modalHtml = `
      <div class="modal-overlay active" id="adminReplyModal">
        <div class="modal-dialog" style="max-width: 500px;">
          <div class="modal-header">
            <h3>Respond to ${customerName}</h3>
            <button class="btn-close-drawer" onclick="document.getElementById('adminReplyModal').remove()">&times;</button>
          </div>
          <div class="modal-body">
            <p style="font-size: 0.85rem; color: #64748B; margin-bottom: 12px;">
              Your response will appear publicly below the review once approved. (You cannot alter customer's text).
            </p>
            <div class="admin-input-group">
              <label>Official Response from Varahi Tiffins Team</label>
              <textarea id="adminReplyText" rows="4" placeholder="e.g. Thank you for your feedback! We will ensure your next dosa is made to perfection." style="width: 100%;">${escapeHtml(existingReply)}</textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" onclick="document.getElementById('adminReplyModal').remove()">Cancel</button>
            <button class="btn-primary" onclick="Admin.saveFeedbackResponse('${id}')">Save & Publish Response</button>
          </div>
        </div>
      </div>
    `;

    const old = document.getElementById('adminReplyModal');
    if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  async saveFeedbackResponse(id) {
    const text = document.getElementById('adminReplyText').value.trim();
    try {
      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ adminResponse: text })
      });
      if (res.ok) {
        showToast('Admin response published!', 'success');
        document.getElementById('adminReplyModal').remove();
        this.loadFeedback();
      }
    } catch (e) {
      showToast('Failed to save response', 'error');
    }
  },

  async handleExportFeedback() {
    try {
      const res = await fetch('/api/admin/export-feedback', { headers: this.getHeaders() });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `varahi_tiffins_feedback_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('Feedback CSV exported successfully!', 'success');
    } catch (err) {
      showToast('Export failed', 'error');
    }
  },

  // 5. Billing & Integrations Tab
  async loadIntegrations() {
    try {
      const res = await fetch('/api/admin/integrations', { headers: this.getHeaders() });
      if (res.status === 401 || res.status === 403) {
        this.handleLogout();
        return;
      }
      const data = await res.json();
      this.renderIntegrationStatus(data);
      this.renderBillingConfig(data.billing);
      this.renderOrderTotals(data.totals);
      this.renderTestOrders(data.testOrders || []);
    } catch (err) {
      console.error('Integrations load error:', err);
      showToast('Failed to load integration status', 'error');
    }
  },

  renderIntegrationStatus(data) {
    const payment = data.payment || {};
    const delivery = data.delivery || {};
    const isConfigured = (s) => s === 'configured';

    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    set('adminPaymentStatus', isConfigured(payment.status) ? 'Configured' : 'Not configured');
    set('adminPaymentNote', payment.label || 'Razorpay keys are read from server environment variables only.');
    set('adminDeliveryStatus', isConfigured(delivery.status) ? 'Configured' : 'Not configured');
    set('adminDeliveryNote', delivery.label || 'Shiprocket credentials are read from server environment variables only.');

    const renderEnv = (id, cfg) => {
      const el = document.getElementById(id);
      if (!el) return;
      const required = cfg.requiredEnvVars || [];
      const configured = cfg.configuredEnvVars || [];
      if (required.length === 0) {
        el.innerHTML = '';
        return;
      }
      el.innerHTML = `
        <div class="env-row"><span>Required environment variables</span></div>
        ${required.map(v => `<div class="env-var ${configured.includes(v) ? 'set' : ''}">${configured.includes(v) ? '✓' : '○'} ${v}</div>`).join('')}
        <div class="env-row muted">${configured.length ? `${configured.length} of ${required.length} present on the server.` : 'None present on the server yet.'} Secret values are never displayed here.</div>
      `;
    };

    renderEnv('adminPaymentEnv', payment);
    renderEnv('adminDeliveryEnv', delivery);
  },

  renderBillingConfig(billing) {
    const el = document.getElementById('adminBillingConfig');
    if (!el || !billing) return;
    const deliveryRow = billing.enableDevelopmentDeliveryFee
      ? `₹${Number(billing.developmentDeliveryFee).toFixed(2)} <span class="pill-warning">dev estimate</span>`
      : '<span class="pill-muted">Calculated when delivery integration is enabled</span>';

    el.innerHTML = `
      <div class="billing-row"><span>Service charge (per order)</span><strong>₹${Number(billing.serviceCharge).toFixed(2)}</strong></div>
      <div class="billing-row"><span>Packaging fee</span><strong>₹${Number(billing.packagingFee).toFixed(2)}</strong></div>
      <div class="billing-row"><span>Delivery charge</span><strong>${deliveryRow}</strong></div>
      <div class="billing-row"><span>Minimum chef tip</span><strong>₹${Number(billing.minimumTip)}</strong></div>
      <div class="billing-row"><span>Chef tip presets</span><strong>${(billing.tipPresets || []).map(p => '₹' + p).join(', ') || '—'}</strong></div>
      <div class="billing-row"><span>Business GST rate (internal, not on customer bill)</span><strong>${Number(billing.taxPercentage)}%</strong></div>
    `;
  },

  renderOrderTotals(totals) {
    const el = document.getElementById('adminOrderTotals');
    if (!el || !totals) return;
    el.innerHTML = `
      <div class="billing-row"><span>Total orders recorded</span><strong>${totals.orderCount}</strong></div>
      <div class="billing-row"><span>Test orders</span><strong>${totals.testOrderCount} (₹${Number(totals.testOrderValue).toFixed(2)})</strong></div>
      <div class="billing-row"><span>Live orders</span><strong>${totals.liveOrderCount}</strong></div>
      <div class="billing-row"><span>Item subtotal</span><strong>₹${Number(totals.subtotal).toFixed(2)}</strong></div>
      <div class="billing-row"><span>Service charge collected</span><strong>₹${Number(totals.serviceCharge).toFixed(2)}</strong></div>
      <div class="billing-row"><span>Packaging fee collected</span><strong>₹${Number(totals.packagingFee).toFixed(2)}</strong></div>
      <div class="billing-row"><span>Delivery charge recorded</span><strong>₹${Number(totals.deliveryCharge).toFixed(2)}</strong></div>
      <div class="billing-row highlight"><span> Chef tips</span><strong>₹${Number(totals.tips).toFixed(2)}</strong></div>
      <div class="billing-row highlight"><span>Order totals (grand)</span><strong>₹${Number(totals.grandTotal).toFixed(2)}</strong></div>
    `;
  },

  renderTestOrders(testOrders) {
    const tbody = document.getElementById('adminTestOrdersTableBody');
    if (!tbody) return;
    if (!Array.isArray(testOrders) || testOrders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 26px; color: #64748B;">No test orders saved yet.</td></tr>';
      return;
    }
    tbody.innerHTML = testOrders.map(o => {
      const dateStr = new Date(o.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
      return `
        <tr>
          <td><strong>#${escapeHtml(o.id)}</strong> <span class="badge-status test-order">TEST</span></td>
          <td>${escapeHtml(o.customerName)}<br><small style="color: #64748B;">${escapeHtml(o.customerPhone || 'No phone')}</small></td>
          <td><strong>₹${Number(o.grandTotal).toFixed(2)}</strong></td>
          <td>₹${Number(o.tip || 0).toFixed(2)}</td>
          <td><span class="badge-status pending">${escapeHtml(o.paymentStatus)}</span></td>
          <td><span class="badge-status pending">${escapeHtml(o.deliveryStatus)}</span></td>
          <td><small style="color: #64748B;">${dateStr}</small></td>
          <td>
            <button class="btn-action reject" onclick="Admin.deleteTestOrder('${escapeHtml(o.id)}')">🗑 Delete</button>
          </td>
        </tr>
      `;
    }).join('');
  },

  // 6. Settings Tab
  async loadSettings() {
    try {
      const res = await fetch('/api/settings');
      this.settings = await res.json();

      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = (val !== undefined && val !== null) ? val : '';
      };

      setVal('setRestaurantName', this.settings.restaurantName);
      setVal('setCategory', this.settings.category);
      setVal('setPhone', this.settings.phone);
      setVal('setWhatsApp', this.settings.whatsapp);
      setVal('setAddress', this.settings.address);
      setVal('setGoogleMapsUrl', this.settings.googleMapsUrl);
      setVal('setOpeningHours', this.settings.openingHours);
      setVal('setStatusNote', this.settings.statusNote);
      setVal('setServiceCharge', this.settings.serviceCharge);
      setVal('setPackagingFee', this.settings.packagingFee);
      setVal('setDevelopmentDeliveryFee', this.settings.developmentDeliveryFee);
      setVal('setMinimumTip', this.settings.minimumTip);
      setVal('setTaxPercentage', this.settings.taxPercentage);

      const devDeliveryEl = document.getElementById('setEnableDevelopmentDeliveryFee');
      if (devDeliveryEl) {
        devDeliveryEl.checked = !!this.settings.enableDevelopmentDeliveryFee;
      }

      const autoApproveEl = document.getElementById('setAutoApproveReviews');
      if (autoApproveEl) {
        autoApproveEl.checked = !!this.settings.autoApproveReviews;
      }
    } catch (err) {
      console.error('Settings load error:', err);
    }
  },

  async handleSaveSettings(e) {
    e.preventDefault();

    const getVal = (id, fallback = '') => {
      const el = document.getElementById(id);
      return el ? el.value : fallback;
    };

    const updates = {
      restaurantName: getVal('setRestaurantName', 'Varahi Tiffins'),
      category: getVal('setCategory', 'South Indian vegetarian restaurant'),
      phone: getVal('setPhone', '+91 94945 00646'),
      whatsapp: getVal('setWhatsApp', '919494500646'),
      address: getVal('setAddress', ''),
      googleMapsUrl: getVal('setGoogleMapsUrl', ''),
      openingHours: getVal('setOpeningHours', ''),
      statusNote: getVal('setStatusNote', ''),
      serviceCharge: Number(getVal('setServiceCharge', 14.99)),
      packagingFee: Number(getVal('setPackagingFee', 0)),
      enableDevelopmentDeliveryFee: document.getElementById('setEnableDevelopmentDeliveryFee') ? document.getElementById('setEnableDevelopmentDeliveryFee').checked : false,
      developmentDeliveryFee: Number(getVal('setDevelopmentDeliveryFee', 30)),
      minimumTip: Number(getVal('setMinimumTip', 5)),
      taxPercentage: Number(getVal('setTaxPercentage', 5)),
      autoApproveReviews: document.getElementById('setAutoApproveReviews') ? document.getElementById('setAutoApproveReviews').checked : false
    };

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(updates)
      });

      const data = await res.json();
      if (res.ok) {
        this.settings = data.settings;
        showToast('Restaurant settings updated successfully! Live website refreshed.', 'success');
        this.loadSettings();
      } else {
        showToast(data.error || 'Failed to save settings', 'error');
      }
    } catch (err) {
      console.error('Settings save error:', err);
      showToast('Network error saving settings', 'error');
    }
  },

  // 6. WhatsApp Settings Tab
  loadWhatsAppSettings() {
    const btnTest = document.getElementById('btnTestWhatsApp');
    if (btnTest) {
      btnTest.onclick = () => {
        showToast('WhatsApp Click-to-chat active on +91 94945 00646 with prefilled orders.', 'success');
      };
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  Admin.init();
});
