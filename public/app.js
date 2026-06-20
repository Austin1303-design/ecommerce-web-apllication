// ========== STATE MANAGEMENT ==========
let state = {
  currentUser: null,
  token: null,
  cart: [],
  wishlist: [],
  currentFilter: 'All',
  currentSort: 'default',
  couponApplied: null,
  couponDiscount: 0,
  editingProductId: null,
  paymentMethod: 'card'
};

const COUPONS = { SAVE10: 0.1, FLAT50: 50, NEWUSER: 0.15 };

// ========== API HELPER ==========
async function apiFetch(url, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  try {
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401 || response.status === 403) {
      if (localStorage.getItem('token')) {
        logout();
        toast('Session expired. Please login again.', 'error');
      }
    }
    return response;
  } catch (err) {
    console.error('API Fetch error:', err);
    toast('Network connection error', 'error');
    throw err;
  }
}

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', async () => {
  // Load caches
  state.cart = JSON.parse(localStorage.getItem('cart') || '[]');
  state.wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
  state.token = localStorage.getItem('token');
  const storedUser = localStorage.getItem('currentUser');

  if (state.token && storedUser) {
    const userObj = JSON.parse(storedUser);
    try {
      // Validate session and retrieve fresh profile
      const res = await apiFetch(`/api/users/${userObj.id}`);
      if (res && res.ok) {
        const freshUser = await res.json();
        setCurrentUser(freshUser, state.token);
      } else {
        logout();
      }
    } catch (e) {
      console.warn('Failed to revalidate session on start', e);
      setCurrentUser(userObj, state.token);
    }
  }

  updateCartCount();
  renderFeatured();
});

// ========== NAVIGATION ==========
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  window.scrollTo(0, 0);

  if (page === 'shop') renderShop();
  if (page === 'home') renderFeatured();
  if (page === 'cart') renderCart();
  if (page === 'checkout') renderCheckout();
  if (page === 'orders') renderOrders();
  if (page === 'wishlist') renderWishlist();
  if (page === 'admin') {
    if (!state.currentUser || state.currentUser.role !== 'admin') {
      toast('Admin access required', 'error');
      navigate('auth');
      return;
    }
    renderAdmin();
  }
  if (page === 'profile') renderProfile();
}

// ========== AUTHENTICATION ==========
async function login() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) {
    toast('Email and password required', 'error');
    return;
  }

  try {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('currentUser', JSON.stringify(data.user));
      setCurrentUser(data.user, data.token);
      toast('Welcome back, ' + data.user.name.split(' ')[0] + '! 👋', 'success');
      navigate('home');
    } else {
      toast(data.message || 'Invalid credentials', 'error');
    }
  } catch (err) {
    console.error('Login error:', err);
  }
}

async function register() {
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm = document.getElementById('reg-confirm').value;

  if (!name || !email || !password) {
    toast('Please fill all fields', 'error');
    return;
  }
  if (password !== confirm) {
    toast('Passwords do not match', 'error');
    return;
  }

  try {
    const res = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('currentUser', JSON.stringify(data.user));
      setCurrentUser(data.user, data.token);
      toast('Account created! Welcome, ' + name.split(' ')[0] + '!', 'success');
      navigate('home');
    } else {
      toast(data.message || 'Registration failed', 'error');
    }
  } catch (err) {
    console.error('Registration error:', err);
  }
}

function quickLogin(type) {
  if (type === 'user') {
    document.getElementById('login-email').value = 'user@shop.com';
    document.getElementById('login-password').value = 'password123';
  } else {
    document.getElementById('login-email').value = 'admin@shop.com';
    document.getElementById('login-password').value = 'admin123';
  }
  login();
}

async function socialLogin(provider) {
  const email = `${provider.toLowerCase()}@social.com`;
  const name = `${provider} User`;
  const password = `social-pass-${provider}`;
  try {
    // Attempt login
    let res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      // Register new user
      res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
    }
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('currentUser', JSON.stringify(data.user));
      setCurrentUser(data.user, data.token);
      toast('Signed in with ' + provider, 'success');
      navigate('home');
    } else {
      toast(data.message || 'Social login failed', 'error');
    }
  } catch (err) {
    toast('Network error during social login', 'error');
  }
}

function setCurrentUser(user, token) {
  state.currentUser = user;
  state.token = token;

  document.getElementById('nav-login-btn').style.display = 'none';
  document.getElementById('nav-logout-btn').style.display = 'flex';
  document.getElementById('nav-profile').style.display = 'flex';
  document.getElementById('nav-cart').style.display = 'flex';
  document.getElementById('nav-orders').style.display = 'flex';
  document.getElementById('nav-wishlist').style.display = 'flex';
  document.getElementById('nav-username').textContent = user.name.split(' ')[0];
  document.getElementById('nav-role').textContent = user.role.toUpperCase();

  if (user.role === 'admin') {
    document.getElementById('nav-admin').style.display = 'flex';
  } else {
    document.getElementById('nav-admin').style.display = 'none';
  }
}

function logout() {
  state.currentUser = null;
  state.token = null;
  state.cart = [];
  state.wishlist = [];
  localStorage.removeItem('token');
  localStorage.removeItem('currentUser');
  localStorage.removeItem('cart');
  localStorage.removeItem('wishlist');

  document.getElementById('nav-login-btn').style.display = 'flex';
  document.getElementById('nav-logout-btn').style.display = 'none';
  document.getElementById('nav-profile').style.display = 'none';
  document.getElementById('nav-cart').style.display = 'none';
  document.getElementById('nav-orders').style.display = 'none';
  document.getElementById('nav-wishlist').style.display = 'none';
  document.getElementById('nav-admin').style.display = 'none';

  updateCartCount();
  toast('Signed out successfully');
  navigate('home');
}

function switchAuthTab(tab) {
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  document.getElementById('auth-form-login').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('auth-form-register').style.display = tab === 'register' ? 'block' : 'none';
}

// ========== PRODUCTS GRID & DISPLAY ==========
function filterCat(cat) {
  state.currentFilter = cat;
  navigate('shop');
  // Update UI chip state
  const chips = document.querySelectorAll('.filter-chip');
  chips.forEach(c => {
    const text = c.textContent.replace(/[^\w]/g, '').trim();
    if (text === cat || (cat === 'Home' && text === 'HomeLiving')) {
      c.classList.add('active');
    } else {
      c.classList.remove('active');
    }
  });
}

function setFilter(cat, btn) {
  state.currentFilter = cat;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  renderShop();
}

function sortProducts(val) {
  state.currentSort = val;
  renderShop();
}

async function fetchFilteredProducts() {
  let url = `/api/products?sort=${state.currentSort}`;
  if (state.currentFilter !== 'All') {
    url += `&category=${encodeURIComponent(state.currentFilter)}`;
  }
  const q = (document.getElementById('search-input')?.value || '').trim();
  if (q) {
    url += `&q=${encodeURIComponent(q)}`;
  }
  try {
    const res = await apiFetch(url);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('Error fetching products:', err);
  }
  return [];
}

async function renderShop() {
  const grid = document.getElementById('shop-grid');
  const countEl = document.getElementById('shop-count');
  grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text2)">Loading products...</div>';

  const products = await fetchFilteredProducts();
  if (countEl) {
    countEl.textContent = products.length + ' products found';
  }

  grid.innerHTML = products.length
    ? products.map(p => productCard(p)).join('')
    : '<div class="empty-state"><div class="empty-icon"><i class="ti ti-search"></i></div><div class="empty-title">No products found</div><div class="empty-text">Try different filters or search terms</div></div>';
}

async function renderFeatured() {
  try {
    const res = await apiFetch('/api/products?limit=4&sort=rating');
    if (res.ok) {
      const featured = await res.json();
      document.getElementById('home-featured').innerHTML = featured.map(p => productCard(p)).join('');
    }
  } catch (err) {
    console.error('Error loading featured products:', err);
  }
}

function productCard(p) {
  const inWish = state.wishlist.includes(p.id);
  return `<div class="product-card">
    <div class="product-img" onclick="openProductDetail(${p.id})" style="cursor:pointer">
      ${p.badge ? `<div class="product-badge ${p.badge === 'Sale' || p.badge === 'Bestseller' ? 'sale' : ''}">${p.badge}</div>` : ''}
      <div class="wishlist-btn ${inWish ? 'active' : ''}" onclick="event.stopPropagation();toggleWishlist(${p.id},this)">
        <i class="ti ti-heart${inWish ? '-filled' : ''}"></i>
      </div>
      ${p.emoji}
    </div>
    <div class="product-info">
      <div class="product-category">${p.category}</div>
      <div class="product-name">${p.name}</div>
      <div class="stars">${'★'.repeat(Math.floor(p.rating))}${'☆'.repeat(5 - Math.floor(p.rating))} <span style="color:var(--text3);font-size:11px">(${p.reviews.toLocaleString()})</span></div>
      <div class="product-desc">${p.desc}</div>
      <div class="product-footer">
        <div class="product-price">
          ₹${p.price.toLocaleString()}
          ${p.originalPrice ? `<span class="original">₹${p.originalPrice.toLocaleString()}</span>` : ''}
        </div>
        <button class="btn btn-primary btn-xs" onclick="addToCart(${p.id})"><i class="ti ti-shopping-cart"></i> Add</button>
      </div>
      ${p.stock < 15 ? `<div class="stock-low" style="margin-top:6px"><i class="ti ti-alert-circle"></i> Only ${p.stock} left</div>` : ''}
    </div>
  </div>`;
}

async function openProductDetail(id) {
  try {
    const res = await apiFetch(`/api/products/${id}`);
    if (!res.ok) return;
    const p = await res.json();

    document.getElementById('dm-emoji').textContent = p.emoji;
    document.getElementById('dm-category').textContent = p.category;
    document.getElementById('dm-name').textContent = p.name;
    document.getElementById('dm-stars').innerHTML = '★'.repeat(Math.floor(p.rating)) + '☆'.repeat(5 - Math.floor(p.rating)) + ` <span style="color:var(--text2);font-size:13px">${p.rating} (${p.reviews.toLocaleString()} reviews)</span>`;
    document.getElementById('dm-desc').textContent = p.desc;
    document.getElementById('dm-price').innerHTML = `₹${p.price.toLocaleString()}${p.originalPrice ? ` <span style="font-size:14px;color:var(--text3);text-decoration:line-through;font-weight:400">₹${p.originalPrice.toLocaleString()}</span>` : ''}`;
    document.getElementById('dm-stock-badge').innerHTML = p.stock > 20 ? `<span class="status-badge badge-success">In Stock (${p.stock})</span>` : p.stock > 0 ? `<span class="status-badge badge-warning">Low Stock (${p.stock})</span>` : `<span class="status-badge badge-danger">Out of Stock</span>`;

    const cartBtn = document.getElementById('dm-cart-btn');
    if (p.stock > 0) {
      cartBtn.innerHTML = '<i class="ti ti-shopping-cart"></i> Add to Cart';
      cartBtn.disabled = false;
      cartBtn.onclick = () => { addToCart(id); closeModal('detail-modal'); };
    } else {
      cartBtn.textContent = 'Out of Stock';
      cartBtn.disabled = true;
    }

    const inWish = state.wishlist.includes(id);
    const wishBtn = document.getElementById('dm-wish-btn');
    wishBtn.innerHTML = `<i class="ti ti-heart${inWish ? '-filled' : ''}"></i>`;
    wishBtn.onclick = () => { toggleWishlist(id, wishBtn); };

    openModal('detail-modal');
  } catch (err) {
    console.error('Error opening product detail:', err);
  }
}

// ========== WISHLIST OPERATIONS ==========
function toggleWishlist(id, btn) {
  if (!state.currentUser) {
    toast('Please login first', 'error');
    navigate('auth');
    return;
  }
  const idx = state.wishlist.indexOf(id);
  if (idx === -1) {
    state.wishlist.push(id);
    if (btn) {
      btn.classList.add('active');
      btn.innerHTML = '<i class="ti ti-heart-filled"></i>';
    }
    toast('Added to wishlist ❤️', 'success');
  } else {
    state.wishlist.splice(idx, 1);
    if (btn) {
      btn.classList.remove('active');
      btn.innerHTML = '<i class="ti ti-heart"></i>';
    }
    toast('Removed from wishlist');
  }
  localStorage.setItem('wishlist', JSON.stringify(state.wishlist));
}

async function renderWishlist() {
  const grid = document.getElementById('wishlist-grid');
  if (state.wishlist.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon"><i class="ti ti-heart"></i></div><div class="empty-title">Your wishlist is empty</div><div class="empty-text">Save items you love for later</div><button class="btn btn-primary" style="margin-top:1rem" onclick="navigate(\'shop\')">Browse Products</button></div>';
    return;
  }

  grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text2)">Loading wishlist items...</div>';
  try {
    const res = await apiFetch('/api/products');
    if (res.ok) {
      const allProds = await res.json();
      const wishlisted = allProds.filter(p => state.wishlist.includes(p.id));
      grid.innerHTML = wishlisted.length
        ? wishlisted.map(p => productCard(p)).join('')
        : '<div class="empty-state"><div class="empty-title">No products found</div></div>';
    }
  } catch (err) {
    console.error('Error rendering wishlist:', err);
  }
}

// ========== CART ACTIONS ==========
function addToCart(id) {
  if (!state.currentUser) {
    toast('Please login to add to cart', 'error');
    navigate('auth');
    return;
  }
  const existing = state.cart.find(c => c.productId === id);
  if (existing) {
    existing.qty++;
  } else {
    state.cart.push({ productId: id, qty: 1 });
  }
  localStorage.setItem('cart', JSON.stringify(state.cart));
  updateCartCount();
  toast('Added to cart! 🛒', 'success');
}

function updateCartCount() {
  const total = state.cart.reduce((s, c) => s + c.qty, 0);
  document.getElementById('cart-count').textContent = total;
}

async function renderCart() {
  const listEl = document.getElementById('cart-items-list');
  if (state.cart.length === 0) {
    listEl.innerHTML = '<div class="empty-state"><div class="empty-icon"><i class="ti ti-shopping-cart"></i></div><div class="empty-title">Your cart is empty</div><div class="empty-text">Add some products to get started</div><button class="btn btn-primary" style="margin-top:1rem" onclick="navigate(\'shop\')">Browse Products</button></div>';
    updateCartTotals([]);
    return;
  }

  listEl.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text2)">Syncing cart items...</div>';
  try {
    const res = await apiFetch('/api/products');
    if (res.ok) {
      const allProds = await res.json();
      listEl.innerHTML = state.cart.map(c => {
        const p = allProds.find(x => x.id === c.productId);
        if (!p) return '';
        return `<div class="cart-item">
          <div class="cart-item-img">${p.emoji}</div>
          <div class="cart-item-info">
            <div class="cart-item-name">${p.name}</div>
            <div class="cart-item-meta">${p.category}</div>
            <div class="qty-ctrl">
              <button class="qty-btn" onclick="updateQty(${p.id},-1)">−</button>
              <span class="qty-val">${c.qty}</span>
              <button class="qty-btn" onclick="updateQty(${p.id},1)">+</button>
              <button class="btn btn-xs" style="margin-left:8px;color:var(--danger);border-color:var(--danger)" onclick="removeFromCart(${p.id})"><i class="ti ti-trash"></i></button>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:700;font-size:15px">₹${(p.price * c.qty).toLocaleString()}</div>
            <div style="font-size:12px;color:var(--text3)">₹${p.price.toLocaleString()} each</div>
          </div>
        </div>`;
      }).join('');
      updateCartTotals(allProds);
    }
  } catch (err) {
    console.error('Error rendering cart:', err);
  }
}

function updateQty(id, delta) {
  const item = state.cart.find(c => c.productId === id);
  if (!item) return;
  item.qty = Math.max(0, item.qty + delta);
  if (item.qty === 0) {
    state.cart = state.cart.filter(c => c.productId !== id);
  }
  localStorage.setItem('cart', JSON.stringify(state.cart));
  updateCartCount();
  renderCart();
}

function removeFromCart(id) {
  state.cart = state.cart.filter(c => c.productId !== id);
  localStorage.setItem('cart', JSON.stringify(state.cart));
  updateCartCount();
  renderCart();
  toast('Item removed from cart');
}

function updateCartTotals(products) {
  const subtotal = state.cart.reduce((s, c) => {
    const p = products.find(x => x.id === c.productId);
    return s + (p ? p.price * c.qty : 0);
  }, 0);

  const shipping = subtotal > 499 || subtotal === 0 ? 0 : 49;
  const tax = Math.round(subtotal * 0.18);
  const discount = state.couponDiscount;
  const total = Math.max(0, subtotal + shipping + tax - discount);

  const fmt = n => '₹' + n.toLocaleString();
  const setT = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  setT('cart-subtotal', fmt(subtotal));
  setT('cart-discount', discount > 0 ? '-' + fmt(discount) : '₹0');
  setT('cart-shipping', shipping === 0 ? (subtotal === 0 ? '₹0' : 'FREE') : fmt(shipping));
  setT('cart-tax', fmt(tax));
  setT('cart-total', fmt(total));
}

async function applyCoupon() {
  const code = document.getElementById('coupon-input').value.trim().toUpperCase();
  if (!COUPONS[code]) {
    toast('Invalid coupon code', 'error');
    return;
  }

  try {
    const res = await apiFetch('/api/products');
    if (res.ok) {
      const allProds = await res.json();
      const subtotal = state.cart.reduce((s, c) => {
        const p = allProds.find(x => x.id === c.productId);
        return s + (p ? p.price * c.qty : 0);
      }, 0);

      const disc = COUPONS[code];
      state.couponDiscount = disc < 1 ? Math.round(subtotal * disc) : disc;
      state.couponApplied = code;

      toast('Coupon applied! You save ₹' + state.couponDiscount, 'success');
      updateCartTotals(allProds);
    }
  } catch (err) {
    console.error('Coupon fetch error:', err);
  }
}

function goCheckout() {
  if (!state.currentUser) {
    toast('Please login to checkout', 'error');
    navigate('auth');
    return;
  }
  if (state.cart.length === 0) {
    toast('Your cart is empty', 'error');
    return;
  }
  navigate('checkout');
}

// ========== CHECKOUT & ORDERS ==========
function selectPayment(method) {
  state.paymentMethod = method;
  ['card', 'upi', 'cod'].forEach(m => {
    document.getElementById('pay-' + m).classList.toggle('selected', m === method);
    document.getElementById('pay-' + m + '-fields').style.display = m === method ? 'block' : 'none';
  });
}

async function renderCheckout() {
  const items = document.getElementById('co-items');
  items.innerHTML = '<div style="padding: 1rem; color: var(--text2)">Loading items...</div>';

  try {
    const res = await apiFetch('/api/products');
    if (res.ok) {
      const allProds = await res.json();
      items.innerHTML = state.cart.map(c => {
        const p = allProds.find(x => x.id === c.productId);
        return p ? `<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px"><span>${p.emoji} ${p.name} ×${c.qty}</span><span style="font-weight:600">₹${(p.price * c.qty).toLocaleString()}</span></div>` : '';
      }).join('');

      const subtotal = state.cart.reduce((s, c) => {
        const p = allProds.find(x => x.id === c.productId);
        return s + (p ? p.price * c.qty : 0);
      }, 0);

      const shipping = subtotal > 499 || subtotal === 0 ? 0 : 49;
      const tax = Math.round(subtotal * 0.18);
      const discount = state.couponDiscount;
      const total = Math.max(0, subtotal + shipping + tax - discount);

      document.getElementById('co-subtotal').textContent = '₹' + subtotal.toLocaleString();
      document.getElementById('co-tax').textContent = '₹' + tax.toLocaleString();
      document.getElementById('co-total').textContent = '₹' + total.toLocaleString();
    }
  } catch (err) {
    console.error('Error loading checkout:', err);
  }
}

async function placeOrder() {
  const addr = document.getElementById('co-addr').value.trim();
  const city = document.getElementById('co-city').value.trim();
  if (!addr || !city) {
    toast('Delivery Address is required', 'error');
    return;
  }

  try {
    const resProducts = await apiFetch('/api/products');
    if (!resProducts.ok) return;
    const allProds = await resProducts.json();

    const subtotal = state.cart.reduce((s, c) => {
      const p = allProds.find(x => x.id === c.productId);
      return s + (p ? p.price * c.qty : 0);
    }, 0);

    const shipping = subtotal > 499 || subtotal === 0 ? 0 : 49;
    const tax = Math.round(subtotal * 0.18);
    const discount = state.couponDiscount;
    const total = Math.max(0, subtotal + shipping + tax - discount);

    const orderPayload = {
      items: state.cart.map(c => ({ productId: c.productId, qty: c.qty })),
      address: addr + ', ' + city + ', ' + document.getElementById('co-state').value,
      paymentMethod: state.paymentMethod === 'card' ? 'Card' : state.paymentMethod === 'upi' ? 'UPI' : 'COD',
      total
    };

    const res = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify(orderPayload)
    });
    const order = await res.json();

    if (res.ok) {
      state.cart = [];
      state.couponDiscount = 0;
      state.couponApplied = null;
      localStorage.setItem('cart', '[]');
      updateCartCount();

      document.getElementById('success-order-id').textContent = order.id;
      navigate('success');
    } else {
      toast(order.message || 'Failed to place order', 'error');
    }
  } catch (err) {
    console.error('Place order error:', err);
  }
}

// ========== ORDERS TRACKING ==========
async function renderOrders() {
  const list = document.getElementById('orders-list');
  if (!state.currentUser) {
    list.innerHTML = '<div class="empty-state"><div class="empty-title">Please login to view orders</div></div>';
    return;
  }

  list.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text2)">Loading orders...</div>';
  try {
    const [resOrders, resProducts] = await Promise.all([
      apiFetch('/api/orders'),
      apiFetch('/api/products')
    ]);

    if (resOrders.ok && resProducts.ok) {
      const userOrders = await resOrders.json();
      const allProds = await resProducts.json();

      if (userOrders.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="empty-icon"><i class="ti ti-package"></i></div><div class="empty-title">No orders yet</div><div class="empty-text">Start shopping to see your orders here</div></div>';
        return;
      }

      list.innerHTML = userOrders.map(o => {
        const statusClass = { Delivered: 'badge-success', Shipped: 'badge-info', Processing: 'badge-warning', Pending: 'badge-gray', Cancelled: 'badge-danger' }[o.status] || 'badge-gray';
        const items = o.items.map(i => allProds.find(p => p.id === i.productId)).filter(Boolean);

        return `<div class="order-card">
          <div class="order-header">
            <div>
              <div style="font-weight:700;font-size:14px">${o.id}</div>
              <div style="font-size:12px;color:var(--text2)">${o.date} · ${o.items.length} item(s) · ${o.paymentMethod}</div>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              <span class="status-badge ${statusClass}">${o.status}</span>
              <button class="btn btn-secondary btn-xs" onclick="openOrderDetail('${o.id}')">View</button>
            </div>
          </div>
          <div class="order-body">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div class="order-items-mini">${items.slice(0, 3).map(p => `<div class="order-item-mini" title="${p.name}">${p.emoji}</div>`).join('')}${items.length > 3 ? `<div class="order-item-mini" style="font-size:12px;font-weight:600;color:var(--text2)">+${items.length - 3}</div>` : ''}</div>
              <div style="font-weight:700;font-size:15px">₹${o.total.toLocaleString()}</div>
            </div>
            <div class="track-steps" style="margin:1.5rem 0 0.5rem">
              ${['Placed', 'Processing', 'Shipped', 'Delivered'].map((s, i) => {
          const statusOrder = { Placed: 0, Processing: 1, Shipped: 2, Delivered: 3, Cancelled: -1, Pending: 0 };
          const cur = statusOrder[o.status];
          const done = cur > i; const active = cur === i;
          return `<div class="track-step"><div class="track-dot ${done ? 'done' : active ? 'current' : ''}">${done ? '<i class="ti ti-check"></i>' : (i + 1)}</div><div class="track-label" style="font-size:11px">${s}</div></div>`;
        }).join('')}
            </div>
          </div>
        </div>`;
      }).join('');
    }
  } catch (err) {
    console.error('Error rendering orders:', err);
  }
}

async function openOrderDetail(id) {
  try {
    const [resOrders, resProducts] = await Promise.all([
      apiFetch('/api/orders'),
      apiFetch('/api/products')
    ]);

    if (resOrders.ok && resProducts.ok) {
      const orders = await resOrders.json();
      const products = await resProducts.json();
      const o = orders.find(x => x.id === id);
      if (!o) return;

      document.getElementById('om-id').textContent = 'Order ' + o.id;
      const statusClass = { Delivered: 'badge-success', Shipped: 'badge-info', Processing: 'badge-warning', Pending: 'badge-gray', Cancelled: 'badge-danger' }[o.status] || 'badge-gray';

      document.getElementById('om-content').innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
          <span class="status-badge ${statusClass}">${o.status}</span>
          <span style="font-size:13px;color:var(--text2)">${o.date}</span>
        </div>
        <div style="background:var(--surface3);border-radius:var(--radius);padding:1rem;margin-bottom:1rem">
          <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:8px">DELIVERY ADDRESS</div>
          <div style="font-size:14px">${o.address}</div>
        </div>
        <div style="margin-bottom:1rem">
          <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:8px">ORDER ITEMS</div>
          ${o.items.map(i => {
        const p = products.find(x => x.id === i.productId);
        return p ? `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:14px"><span>${p.emoji} ${p.name} ×${i.qty}</span><span style="font-weight:600">₹${(p.price * i.qty).toLocaleString()}</span></div>` : '';
      }).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;font-weight:700;font-size:15px;padding-top:8px">
          <span>Total</span><span style="color:var(--accent)">₹${o.total.toLocaleString()}</span>
        </div>
        <div style="margin-top:12px;font-size:13px;color:var(--text2)">Payment: ${o.paymentMethod}</div>
      `;
      openModal('order-modal');
    }
  } catch (err) {
    console.error('Error showing order detail:', err);
  }
}

// ========== PROFILE MANAGEMENT ==========
function renderProfile() {
  if (!state.currentUser) return;
  const u = state.currentUser;
  document.getElementById('profile-avatar').textContent = u.name[0];
  document.getElementById('profile-name').textContent = u.name;
  document.getElementById('profile-email').textContent = u.email;
  document.getElementById('profile-role-badge').textContent = u.role.toUpperCase();
  document.getElementById('profile-name-input').value = u.name;
  document.getElementById('profile-email-input').value = u.email;

  document.getElementById('stat-wishlist').textContent = state.wishlist.length;

  apiFetch('/api/orders')
    .then(res => res.json())
    .then(orders => {
      document.getElementById('stat-orders').textContent = orders.length;
    })
    .catch(console.error);
}

async function saveProfileChanges() {
  const name = document.getElementById('profile-name-input').value.trim();
  const email = document.getElementById('profile-email-input').value.trim();
  if (!name || !email) {
    toast('Name and email are required', 'error');
    return;
  }

  try {
    const res = await apiFetch(`/api/users/${state.currentUser.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, email })
    });
    const updated = await res.json();
    if (res.ok) {
      localStorage.setItem('currentUser', JSON.stringify(updated));
      setCurrentUser(updated, state.token);
      renderProfile();
      toast('Profile updated!', 'success');
    } else {
      toast(updated.message || 'Profile update failed', 'error');
    }
  } catch (err) {
    console.error('Error updating profile:', err);
  }
}

// ========== ADMIN MODULE ==========
async function renderAdmin() {
  try {
    const [resOrders, resUsers, resProducts] = await Promise.all([
      apiFetch('/api/orders'),
      apiFetch('/api/users'),
      apiFetch('/api/products')
    ]);

    if (resOrders.ok && resUsers.ok && resProducts.ok) {
      const orders = await resOrders.json();
      const users = await resUsers.json();
      const products = await resProducts.json();

      document.getElementById('admin-order-count').textContent = orders.length;
      document.getElementById('admin-user-count').textContent = users.length;
      document.getElementById('admin-prod-count').textContent = products.length;

      // Update KPIs
      const nonCancelledOrders = orders.filter(o => o.status !== 'Cancelled');
      const revenue = nonCancelledOrders.reduce((sum, o) => sum + o.total, 0);
      const kpiRev = document.querySelector('.kpi-val');
      if (kpiRev) {
        kpiRev.textContent = '₹' + revenue.toLocaleString();
      }

      renderAdminProductsList(products);
      renderDashboardChart(orders);
      renderDashOrdersList(orders);
    }
  } catch (err) {
    console.error('Error loading admin summary:', err);
  }
}

function renderDashboardChart(orders) {
  // Aggregate sales by day of the week based on placed orders dates
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const baseVals = [12400, 8900, 15600, 11200, 18900, 22400, 17800];

  // Distribute order totals into days (just using order index for simulated week spread if real dates aren't parsed)
  orders.forEach((o, index) => {
    if (o.status !== 'Cancelled') {
      const dayIdx = index % 7;
      baseVals[dayIdx] += o.total * 0.1; // Add weighted total for nice visuals
    }
  });

  const max = Math.max(...baseVals);
  const chart = document.getElementById('rev-chart');
  if (!chart) return;

  chart.innerHTML = baseVals.map((v, i) =>
    `<div class="bar" style="height:${Math.round(v / max * 100)}%;background:var(--accent);border-radius:4px 4px 0 0;opacity:0.8" title="${days[i]}: ₹${Math.round(v).toLocaleString()}"><span class="bar-label">${days[i]}</span></div>`
  ).join('');
}

function renderDashOrdersList(orders) {
  const el = document.getElementById('dash-orders');
  if (!el) return;

  el.innerHTML = orders.slice(-4).map(o => {
    const statusClass = { Delivered: 'badge-success', Shipped: 'badge-info', Processing: 'badge-warning', Pending: 'badge-gray', Cancelled: 'badge-danger' }[o.status] || 'badge-gray';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px">
      <div><div style="font-weight:600">${o.id}</div><div style="color:var(--text2)">${o.customer}</div></div>
      <div style="text-align:right"><div style="font-weight:600">₹${o.total.toLocaleString()}</div><span class="status-badge ${statusClass}" style="font-size:11px">${o.status}</span></div>
    </div>`;
  }).join('');
}

function renderAdminProductsList(products) {
  const tbody = document.getElementById('admin-products-table');
  if (!tbody) return;

  tbody.innerHTML = products.map(p => `<tr>
    <td><div style="display:flex;align-items:center;gap:8px">${p.emoji} <div><div style="font-weight:600;font-size:14px">${p.name}</div><div style="font-size:12px;color:var(--text3)">ID: ${p.id}</div></div></div></td>
    <td><span class="tag" style="background:var(--surface3);color:var(--text2)">${p.category}</span></td>
    <td>₹${p.price.toLocaleString()}</td>
    <td>${p.stock}</td>
    <td><span class="status-badge ${p.stock > 20 ? 'badge-success' : p.stock > 0 ? 'badge-warning' : 'badge-danger'}">${p.stock > 20 ? 'In Stock' : p.stock > 0 ? 'Low Stock' : 'Out of Stock'}</span></td>
    <td><div style="display:flex;gap:6px">
      <button class="btn btn-xs" onclick="openProductModal(${p.id})"><i class="ti ti-edit"></i></button>
      <button class="btn btn-xs" style="color:var(--danger);border-color:var(--danger)" onclick="deleteProduct(${p.id})"><i class="ti ti-trash"></i></button>
    </div></td>
  </tr>`).join('');
}

async function renderAdminOrders() {
  const tbody = document.getElementById('admin-orders-table');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center">Loading orders...</td></tr>';

  try {
    const res = await apiFetch('/api/orders');
    if (res.ok) {
      const orders = await res.json();
      tbody.innerHTML = orders.map(o => {
        return `<tr>
          <td><div style="font-weight:600">${o.id}</div></td>
          <td>${o.customer}</td>
          <td>${o.items.length} item(s)</td>
          <td>₹${o.total.toLocaleString()}</td>
          <td>
            <select class="form-input" style="padding:4px 8px;font-size:12px;width:auto;cursor:pointer" onchange="updateOrderStatus('${o.id}',this.value)">
              ${['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map(s => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </td>
          <td style="font-size:13px;color:var(--text2)">${o.date}</td>
          <td><button class="btn btn-xs" onclick="openOrderDetail('${o.id}')"><i class="ti ti-eye"></i></button></td>
        </tr>`;
      }).join('');
    }
  } catch (err) {
    console.error('Error rendering admin orders:', err);
  }
}

async function updateOrderStatus(id, status) {
  try {
    const res = await apiFetch(`/api/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      toast(`Order ${id} updated to ${status}`, 'success');
      renderAdmin();
    } else {
      toast('Failed to update status', 'error');
    }
  } catch (err) {
    console.error('Error updating order status:', err);
  }
}

function filterOrders(status) {
  const tbody = document.getElementById('admin-orders-table');
  if (!tbody) return;

  apiFetch('/api/orders')
    .then(res => res.json())
    .then(orders => {
      const filtered = status === 'All' ? orders : orders.filter(o => o.status === status);
      tbody.innerHTML = filtered.map(o => {
        return `<tr>
          <td><div style="font-weight:600">${o.id}</div></td>
          <td>${o.customer}</td>
          <td>${o.items.length} item(s)</td>
          <td>₹${o.total.toLocaleString()}</td>
          <td>
            <select class="form-input" style="padding:4px 8px;font-size:12px;width:auto;cursor:pointer" onchange="updateOrderStatus('${o.id}',this.value)">
              ${['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map(s => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </td>
          <td style="font-size:13px;color:var(--text2)">${o.date}</td>
          <td><button class="btn btn-xs" onclick="openOrderDetail('${o.id}')"><i class="ti ti-eye"></i></button></td>
        </tr>`;
      }).join('');
    });
}

async function renderAdminUsers() {
  const tbody = document.getElementById('admin-users-table');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center">Loading accounts...</td></tr>';

  try {
    const res = await apiFetch('/api/users');
    if (res.ok) {
      const users = await res.json();
      tbody.innerHTML = users.map(u => `<tr>
        <td><div style="display:flex;align-items:center;gap:8px"><div style="width:32px;height:32px;border-radius:50%;background:${u.role === 'admin' ? 'rgba(233,69,96,0.1)' : 'rgba(59,130,246,0.1)'};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;color:${u.role === 'admin' ? 'var(--accent)' : 'var(--info)'}">${u.name[0]}</div>${u.name}</div></td>
        <td style="font-size:13px">${u.email}</td>
        <td><span class="status-badge ${u.role === 'admin' ? 'badge-danger' : 'badge-info'}">${u.role}</span></td>
        <td>${u.orders}</td>
        <td style="font-size:13px;color:var(--text2)">${u.joined}</td>
        <td><span class="status-badge ${u.status === 'Active' ? 'badge-success' : 'badge-gray'}">${u.status}</span></td>
        <td><div style="display:flex;gap:6px">
          <button class="btn btn-xs" onclick="toggleUserRole(${u.id})">Toggle Role</button>
          <button class="btn btn-xs" style="color:var(--danger);border-color:var(--danger)" onclick="toggleUserStatus(${u.id})"><i class="ti ti-ban"></i></button>
        </div></td>
      </tr>`).join('');
    }
  } catch (err) {
    console.error('Error rendering user table:', err);
  }
}

async function toggleUserRole(id) {
  try {
    const res = await apiFetch(`/api/users/${id}/toggle-role`, { method: 'PUT' });
    const data = await res.json();
    if (res.ok) {
      toast(data.message, 'success');
      renderAdminUsers();
    }
  } catch (e) {
    console.error(e);
  }
}

async function toggleUserStatus(id) {
  try {
    const res = await apiFetch(`/api/users/${id}/toggle-status`, { method: 'PUT' });
    const data = await res.json();
    if (res.ok) {
      toast(data.message, 'warning');
      renderAdminUsers();
    }
  } catch (e) {
    console.error(e);
  }
}

async function renderInventory() {
  const tbody = document.getElementById('inventory-table');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Loading inventory...</td></tr>';

  try {
    const res = await apiFetch('/api/products');
    if (res.ok) {
      const products = await res.json();
      tbody.innerHTML = products.map(p => {
        const sku = 'SV-' + String(p.id).padStart(4, '0');
        const reserved = Math.floor(p.stock * 0.1);
        const available = p.stock - reserved;
        return `<tr>
          <td><div style="display:flex;align-items:center;gap:8px">${p.emoji} ${p.name}</div></td>
          <td><code style="font-size:12px;background:var(--surface3);padding:2px 6px;border-radius:4px">${sku}</code></td>
          <td>${p.stock}</td>
          <td>${reserved}</td>
          <td>${available}</td>
          <td><span class="status-badge ${p.stock > 20 ? 'badge-success' : p.stock > 5 ? 'badge-warning' : 'badge-danger'}">${p.stock > 20 ? 'Healthy' : p.stock > 5 ? 'Low' : 'Critical'}</span></td>
        </tr>`;
      }).join('');
    }
  } catch (err) {
    console.error('Error rendering inventory:', err);
  }
}

function renderAdminReviews() {
  const el = document.getElementById('admin-reviews');
  if (!el) return;
  const reviews = [
    { user: 'Priya N.', product: 'Sony WH-1000XM5', rating: 5, text: 'Absolute best noise cancelling headphones. Worth every rupee!', date: '18 Jun 2026' },
    { user: 'Rahul V.', product: 'Atomic Habits', rating: 5, text: 'Life-changing book. Changed how I think about building habits.', date: '15 Jun 2026' },
    { user: 'Sneha M.', product: 'iPhone 15 Pro', rating: 4, text: 'Great camera, premium build. Battery could be better.', date: '12 Jun 2026' },
    { user: 'Kiran T.', product: 'Nike Air Max 270', rating: 4, text: 'Very comfortable for all-day wear. True to size.', date: '10 Jun 2026' },
  ];
  el.innerHTML = reviews.map(r => `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:1.25rem;margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;margin-bottom:8px">
      <div style="font-weight:600;font-size:14px">${r.user} <span style="font-weight:400;color:var(--text2)">on</span> ${r.product}</div>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="color:#f59e0b;font-size:13px">${'★'.repeat(r.rating)}</span>
        <span style="font-size:12px;color:var(--text3)">${r.date}</span>
      </div>
    </div>
    <div style="font-size:14px;color:var(--text2)">${r.text}</div>
    <div style="margin-top:10px;display:flex;gap:8px">
      <button class="btn btn-xs" onclick="toast('Review approved','success')"><i class="ti ti-check"></i> Approve</button>
      <button class="btn btn-xs" style="color:var(--danger);border-color:var(--danger)" onclick="toast('Review removed','warning')"><i class="ti ti-trash"></i> Remove</button>
    </div>
  </div>`).join('');
}

function renderApiDocs() {
  const el = document.getElementById('api-endpoints');
  if (!el) return;
  const endpoints = [
    { method: 'GET', path: '/api/products', desc: 'List all products. Filter by ?category=Electronics&q=query&sort=price-asc', auth: false },
    { method: 'GET', path: '/api/products/:id', desc: 'Get single product details', auth: false },
    { method: 'POST', path: '/api/products', desc: 'Create new product (Admin only)', auth: true },
    { method: 'PUT', path: '/api/products/:id', desc: 'Update product parameters (Admin only)', auth: true },
    { method: 'DELETE', path: '/api/products/:id', desc: 'Remove product from catalog (Admin only)', auth: true },
    { method: 'GET', path: '/api/orders', desc: 'List orders (Admin sees all, Users see own)', auth: true },
    { method: 'POST', path: '/api/orders', desc: 'Create a new order, deduct stock inventory', auth: true },
    { method: 'PUT', path: '/api/orders/:id/status', desc: 'Update shipping status (Admin only)', auth: true },
    { method: 'POST', path: '/api/auth/login', desc: 'Authenticate user credentials. Returns JWT Token', auth: false },
    { method: 'POST', path: '/api/auth/register', desc: 'Sign up a new platform member', auth: false },
    { method: 'GET', path: '/api/users', desc: 'List user account listings (Admin only)', auth: true },
    { method: 'GET', path: '/api/users/:id', desc: 'Retrieve single user profile', auth: true },
    { method: 'PUT', path: '/api/users/:id', desc: 'Modify profile information', auth: true }
  ];
  const colors = { GET: 'badge-success', POST: 'badge-info', PUT: 'badge-warning', DELETE: 'badge-danger' };
  el.innerHTML = endpoints.map(e => `<div style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border);font-size:13px">
    <span class="status-badge ${colors[e.method]}" style="min-width:60px;justify-content:center">${e.method}</span>
    <code style="font-size:13px;font-weight:600;min-width:200px;color:var(--text)">${e.path}</code>
    <span style="color:var(--text2);flex:1">${e.desc}</span>
    ${e.auth ? '<span class="status-badge badge-warning" style="font-size:11px">Auth</span>' : '<span class="status-badge badge-gray" style="font-size:11px">Public</span>'}
  </div>`).join('');
}

function showAdminSection(name, btn) {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.getElementById('as-' + name).classList.add('active');
  document.querySelectorAll('.sidebar-item').forEach(s => s.classList.remove('active'));
  btn.classList.add('active');

  if (name === 'products') renderAdmin();
  if (name === 'orders-admin') renderAdminOrders();
  if (name === 'users') renderAdminUsers();
  if (name === 'inventory') renderInventory();
  if (name === 'reviews') renderAdminReviews();
  if (name === 'api-docs') renderApiDocs();
}

// ========== PRODUCT CATALOG MANAGEMENT ==========
async function openProductModal(id = null) {
  state.editingProductId = id;
  const modal = document.getElementById('product-modal');
  document.getElementById('modal-title').textContent = id ? 'Edit Product' : 'Add Product';

  if (id) {
    try {
      const res = await apiFetch(`/api/products/${id}`);
      if (res.ok) {
        const p = await res.json();
        document.getElementById('pm-name').value = p.name;
        document.getElementById('pm-category').value = p.category;
        document.getElementById('pm-price').value = p.price;
        document.getElementById('pm-stock').value = p.stock;
        document.getElementById('pm-emoji').value = p.emoji;
        document.getElementById('pm-desc').value = p.desc;
      }
    } catch (err) {
      console.error(err);
    }
  } else {
    ['pm-name', 'pm-price', 'pm-stock', 'pm-emoji', 'pm-desc'].forEach(id => document.getElementById(id).value = '');
  }
  openModal('product-modal');
}

async function saveProduct() {
  const name = document.getElementById('pm-name').value.trim();
  const category = document.getElementById('pm-category').value;
  const price = parseInt(document.getElementById('pm-price').value);
  const stock = parseInt(document.getElementById('pm-stock').value);
  const emoji = document.getElementById('pm-emoji').value || '📦';
  const desc = document.getElementById('pm-desc').value.trim();

  if (!name || isNaN(price)) {
    toast('Please fill required fields', 'error');
    return;
  }

  const payload = { name, category, price, stock, emoji, desc };
  try {
    let res;
    if (state.editingProductId) {
      res = await apiFetch(`/api/products/${state.editingProductId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } else {
      res = await apiFetch('/api/products', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }

    if (res.ok) {
      toast(state.editingProductId ? 'Product updated!' : 'Product added!', 'success');
      closeModal('product-modal');
      renderAdmin();
    } else {
      const data = await res.json();
      toast(data.message || 'Operation failed', 'error');
    }
  } catch (err) {
    console.error('Error saving product:', err);
  }
}

async function deleteProduct(id) {
  if (!confirm('Are you sure you want to delete this product?')) return;
  try {
    const res = await apiFetch(`/api/products/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      toast('Product deleted', 'warning');
      renderAdmin();
    } else {
      toast('Failed to delete product', 'error');
    }
  } catch (err) {
    console.error(err);
  }
}

// ========== WINDOW MODALS AND ALERTS ==========
function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => {
    if (e.target === o) o.classList.remove('open');
  });
});

function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  const icon = type === 'success' ? 'ti-check' : type === 'error' ? 'ti-x' : type === 'warning' ? 'ti-alert-triangle' : 'ti-info-circle';
  el.innerHTML = `<i class="ti ${icon}"></i><span>${msg}</span>`;
  const container = document.getElementById('toast-container');
  if (container) {
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }
}
