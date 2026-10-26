// Varahi Tiffins - Main Application Controller
// The site is served by the same Express server that exposes /api/*, so the
// default is same-origin. The legacy hosted backend is kept as a fallback so
// an externally hosted copy of this page keeps working unchanged.
const API_BASE_URL = '';
const LEGACY_API_BASE_URL = 'https://varahi-ckbu.onrender.com';

async function fetchJson(path) {
  try {
    const res = await fetch(API_BASE_URL + path);
    if (!res.ok) throw new Error(`${path} -> ${res.status}`);
    return await res.json();
  } catch (err) {
    if (API_BASE_URL === LEGACY_API_BASE_URL) throw err;
    const res = await fetch(LEGACY_API_BASE_URL + path);
    if (!res.ok) throw new Error(`${path} -> ${res.status}`);
    return await res.json();
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const App = {
  settings: null,
  menu: [],
  activeCategory: 'all',

  async init() {
    await this.loadSettings();
    await this.loadIntegrations();
    await this.loadMenu();
    Cart.init();
    Feedback.init();
    this.bindEvents();
  },

  async loadIntegrations() {
    try {
      const data = await fetchJson('/api/integrations');
      Cart.setIntegrations(data);
    } catch (err) {
      console.error('Failed to load integration status:', err);
      Cart.setIntegrations(null);
    }
  },

  async loadSettings() {
    try {
      this.settings = await fetchJson('/api/settings');
      Cart.setSettings(this.settings);
      this.applySettingsToUI();
    } catch (err) {
      console.error('Failed to load restaurant settings:', err);
    }
  },

  applySettingsToUI() {
    if (!this.settings) return;

    const {
      restaurantName,
      category,
      address,
      googleMapsUrl,
      phone,
      whatsapp,
      openingHours,
      statusNote
    } = this.settings;

    // Restaurant names
    document.querySelectorAll('.js-restaurant-name').forEach(el => {
      el.textContent = restaurantName || 'Varahi Tiffins';
    });

    // Restaurant category
    document.querySelectorAll('.js-restaurant-category').forEach(el => {
      el.textContent = category || 'South Indian vegetarian restaurant';
    });

    // Clean phone number for tel: link
    const cleanPhone = (phone || '+91 94945 00646').replace(/[^0-9+]/g, '');

    // Phone buttons (Call to Order)
    document.querySelectorAll('.js-call-btn').forEach(btn => {
      btn.href = `tel:${cleanPhone}`;
      btn.title = `Call Varahi Tiffins: ${phone}`;
    });

    // Phone text labels
    document.querySelectorAll('.js-phone-text').forEach(el => {
      el.textContent = phone || '+91 94945 00646';
    });

    // WhatsApp buttons & links
    const cleanWhatsApp = (whatsapp || '919494500646').replace(/\D/g, '');
    document.querySelectorAll('.js-whatsapp-link').forEach(btn => {
      btn.href = `https://wa.me/${cleanWhatsApp}?text=${encodeURIComponent("Namaste! I would like to inquire about Varahi Tiffins menu and orders.")}`;
    });
    document.querySelectorAll('.js-whatsapp-text').forEach(el => {
      el.textContent = cleanWhatsApp;
    });

    // Google Maps Get Directions buttons & links
    const mapsLink = googleMapsUrl || 'https://maps.app.goo.gl/NxjV16Pa4WxCKj158?g_st=ac';
    document.querySelectorAll('.js-directions-link').forEach(btn => {
      btn.href = mapsLink;
      btn.target = '_blank';
      btn.rel = 'noopener noreferrer';
    });

    // Address text
    document.querySelectorAll('.js-address-text').forEach(el => {
      el.textContent = address || 'Plot No. 265, Vasavi Colony Road, beside TNR Apartment, Kothapet, Hyderabad, Telangana 500102, India.';
    });

    // Opening Hours text
    document.querySelectorAll('.js-opening-hours').forEach(el => {
      el.textContent = openingHours || '7:00 AM–12:00 PM and 6:00 PM–10:00 PM daily';
    });

    // Status / Owner confirmation notice
    const noticeEl = document.getElementById('ownerNoticeText');
    if (noticeEl && statusNote) {
      noticeEl.textContent = statusNote;
    }
  },

  async loadMenu() {
    try {
      this.menu = await fetchJson('/api/menu');
      this.renderMenu();
    } catch (err) {
      console.error('Failed to load menu items:', err);
    }
  },

  bindEvents() {
    // Menu Category filter buttons
    const filterButtons = document.querySelectorAll('.js-category-filter');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        filterButtons.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.activeCategory = e.currentTarget.dataset.category;
        this.renderMenu();
      });
    });

    // Mobile navigation drawer toggle
    const mobileNavToggle = document.getElementById('btnMobileNavToggle');
    const mobileNavDrawer = document.getElementById('mobileNavDrawer');
    const closeMobileNav = document.getElementById('btnCloseMobileNav');
    const mobileNavBackdrop = document.getElementById('mobileNavBackdrop');

    const openNav = () => {
      if (mobileNavDrawer) {
        mobileNavDrawer.classList.add('open');
        mobileNavDrawer.setAttribute('aria-hidden', 'false');
        if (mobileNavToggle) mobileNavToggle.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
      }
    };

    const closeNav = () => {
      if (mobileNavDrawer) {
        mobileNavDrawer.classList.remove('open');
        mobileNavDrawer.setAttribute('aria-hidden', 'true');
        if (mobileNavToggle) mobileNavToggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    };

    if (mobileNavToggle) mobileNavToggle.addEventListener('click', openNav);
    if (closeMobileNav) closeMobileNav.addEventListener('click', closeNav);
    if (mobileNavBackdrop) mobileNavBackdrop.addEventListener('click', closeNav);

    document.querySelectorAll('.mobile-nav-link').forEach(link => {
      link.addEventListener('click', () => {
        closeNav();
      });
    });

    // Active state and scrollspy for desktop & mobile navigation
    this.setupNavigationTracking();
  },

  setupNavigationTracking() {
    const desktopLinks = document.querySelectorAll('.desktop-nav .nav-links a');
    const mobileLinks = document.querySelectorAll('.mobile-nav-links .mobile-nav-link');
    const sections = ['hero', 'menu', 'reviews', 'contact'].map(id => document.getElementById(id)).filter(Boolean);

    const updateActiveNav = (targetId) => {
      desktopLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === '#' + targetId || (targetId === 'hero' && href === '#hero')) {
          link.classList.add('active');
        } else if (href && href.startsWith('#')) {
          link.classList.remove('active');
        }
      });

      mobileLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === '#' + targetId || (targetId === 'hero' && href === '#hero')) {
          link.classList.add('active');
        } else if (href && href.startsWith('#')) {
          link.classList.remove('active');
        }
      });
    };

    // Smooth scroll and immediate active state feedback on click
    document.querySelectorAll('.desktop-nav .nav-links a, .mobile-nav-links .mobile-nav-link, a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href && href.startsWith('#') && href.length > 1) {
          const targetId = href.substring(1);
          const targetEl = document.getElementById(targetId);
          if (targetEl) {
            e.preventDefault();
            updateActiveNav(targetId);
            const headerEl = document.querySelector('.header');
            const headerHeight = headerEl ? headerEl.offsetHeight : 70;
            const elementPosition = targetEl.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerHeight;
            window.scrollTo({
              top: Math.max(0, offsetPosition),
              behavior: 'smooth'
            });
          }
        }
      });
    });

    // Scrollspy using IntersectionObserver
    if ('IntersectionObserver' in window && sections.length > 0) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            updateActiveNav(entry.target.id);
          }
        });
      }, {
        root: null,
        rootMargin: '-20% 0px -55% 0px',
        threshold: 0
      });

      sections.forEach(sec => observer.observe(sec));
    } else {
      window.addEventListener('scroll', () => {
        const scrollPos = window.scrollY + 120;
        for (const sec of sections) {
          if (sec.offsetTop <= scrollPos && (sec.offsetTop + sec.offsetHeight) > scrollPos) {
            updateActiveNav(sec.id);
            break;
          }
        }
      }, { passive: true });
    }
  },

  renderMenu() {
    const grid = document.getElementById('menuGrid');
    if (!grid) return;

    let items = this.menu;
    if (this.activeCategory !== 'all') {
      items = items.filter(item => item.category === this.activeCategory);
    }

    if (items.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
          No menu items found in this category.
        </div>
      `;
      return;
    }

    grid.innerHTML = items.map(item => {
      const isOutOfStock = !item.inStock || (item.stockQuantity !== undefined && item.stockQuantity <= 0);
      const imgPath = item.image || '/assets/images/ghee-karam-dosa.jpg';
      return `
        <div class="dish-card" data-id="${item.id}">
          <div class="dish-image-wrapper">
            <img class="dish-image" src="${escapeHtml(imgPath)}" alt="${escapeHtml(item.name)}" loading="lazy" onerror="this.onerror=null; this.src='/assets/images/ghee-karam-dosa.jpg';">
            <div class="dish-image-overlay">
              <span class="veg-badge" title="100% Pure Vegetarian"></span>
              ${item.isSpecial ? '<span class="special-badge">★ Chef’s Special</span>' : ''}
              <span class="spice-tag">${escapeHtml(item.spiceLevel || 'Mild')}</span>
            </div>
          </div>
          <div class="dish-card-header">
            <h3 class="dish-title">${escapeHtml(item.name)}</h3>
            <div class="dish-price">₹${item.price}</div>
          </div>
          <div class="dish-card-body">
            <p class="dish-desc">${escapeHtml(item.description)}</p>
            <div class="dish-meta">
              <span>⏱ ${escapeHtml(item.prepTime || '5-10 mins')}</span>
              <span class="stock-status ${isOutOfStock ? 'out-of-stock' : 'in-stock'}">
                ● ${isOutOfStock ? 'Sold Out' : (item.stockQuantity < 10 ? `Only ${item.stockQuantity} left` : 'Fresh & Available')}
              </span>
            </div>
          </div>
          <div class="dish-card-footer">
            <button class="btn-add-cart" 
              ${isOutOfStock ? 'disabled' : ''} 
              onclick='Cart.addItem(${JSON.stringify({ id: item.id, name: item.name, price: item.price, category: item.category }).replace(/'/g, "&#39;")})'>
              ${isOutOfStock ? 'Sold Out' : '+ Add to Order'}
            </button>
            <a href="tel:${(this.settings ? this.settings.phone : '+919494500646').replace(/[^0-9+]/g, '')}" 
              class="js-call-btn" 
              style="font-size: 0.8rem; font-weight: 700; color: var(--phone); text-decoration: none;"
              title="Call to Order this item">
              📞 Quick Call
            </a>
          </div>
        </div>
      `;
    }).join('');
  }
};

// Start app on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
