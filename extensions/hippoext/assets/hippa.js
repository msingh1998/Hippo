console.log('[Hippa Debug] Loading hippa.js');

class HippaReceipt {
  constructor() {
    console.log('[Hippa Debug] Constructor called');
    this.toggle = document.getElementById('hippaToggle');
    console.log('[Hippa Debug] Toggle element:', this.toggle);
    this.shop = window.Shopify?.shop;
    console.log('[Hippa Debug] Shop:', this.shop);
    this.AUTH_URL = 'https://emailweb.vercel.app';
    this.initialize();

    // Check for return status
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      console.log('[Hippa Debug] Cart successfully linked');
      this.toggle.checked = true;
    } else if (urlParams.get('error') === 'true') {
      console.log('[Hippa Debug] Failed to link cart');
      this.toggle.checked = false;
    }
  }

  async initialize() {
    try {
      console.log('[Hippa Debug] Initializing...');
      this.setupEventListeners();
    } catch (error) {
      console.error('[Hippa Debug] Init error:', error);
      this.toggle.checked = false;
    }
  }

  setupEventListeners() {
    console.log('[Hippa Debug] Setting up event listeners');
    if (!this.toggle) {
      console.error('[Hippa Debug] Toggle element not found!');
      return;
    }
    this.toggle.addEventListener('change', (e) => {
      console.log('[Hippa Debug] Toggle changed:', e.target.checked);
      this.handleToggle(e);
    });
  }

  async handleToggle(event) {
    console.log('[Hippa Debug] Handle toggle called');
    if (!event.target.checked) return;

    try {
      this.toggle.checked = true;

      console.log('[Hippa Debug] Getting cart details...');
      const cartResponse = await fetch('/cart.js');
      const cartDetails = await cartResponse.json();
      console.log('[Hippa Debug] Cart details:', cartDetails);

      const params = new URLSearchParams({
        shop: this.shop,
        cartToken: cartDetails.token,
        returnUrl: window.location.href
      });

      window.location.href = `${this.AUTH_URL}/auth.html?${params}`;
    } catch (error) {
      console.error('[Hippa Debug] Toggle error:', error);
      this.toggle.checked = false;
    }
  }
}

// Initialize globally
window.HippaReceipt = HippaReceipt;
console.log('[Hippa Debug] HippaReceipt class loaded'); 