const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'shopvault-super-secure-jwt-secret-key-98765';
const DB_PATH = path.join(__dirname, 'database.json');

// ========== CRYPTO SECURITY HELPERS ==========
function signToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  try {
    const [header, body, signature] = token.split('.');
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (signature !== expectedSig) return null;
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch (e) {
    return null;
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  try {
    const [salt, hash] = storedHash.split(':');
    const checkHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === checkHash;
  } catch (e) {
    return false;
  }
}

// ========== DATABASE SEED & MANAGEMENT ==========
const defaultDB = {
  products: [
    { id: 1, name: 'iPhone 15 Pro', category: 'Electronics', price: 134900, originalPrice: 149900, emoji: '📱', desc: 'A17 Pro chip, titanium design, 48MP camera system. The most advanced iPhone ever.', rating: 4.8, reviews: 1240, stock: 45, badge: 'New' },
    { id: 2, name: 'Sony WH-1000XM5', category: 'Electronics', price: 24990, originalPrice: 34990, emoji: '🎧', desc: 'Industry-leading noise cancellation, 30hr battery, multipoint connection.', rating: 4.9, reviews: 876, stock: 23, badge: 'Sale' },
    { id: 3, name: 'MacBook Air M3', category: 'Electronics', price: 114900, originalPrice: null, emoji: '💻', desc: 'Supercharged by M3, up to 18-hour battery, all-day portable power.', rating: 4.9, reviews: 543, stock: 12, badge: 'New' },
    { id: 4, name: 'Nike Air Max 270', category: 'Fashion', price: 9995, originalPrice: 12995, emoji: '👟', desc: 'Lifestyle shoe with Max Air unit in the heel for all-day comfort.', rating: 4.5, reviews: 2301, stock: 67, badge: 'Sale' },
    { id: 5, name: 'Levi\'s 501 Jeans', category: 'Fashion', price: 3999, originalPrice: 5999, emoji: '👖', desc: 'The original straight fit jeans. 100% cotton denim, button fly.', rating: 4.3, reviews: 4521, stock: 134, badge: null },
    { id: 6, name: 'Bosch Induction Cooktop', category: 'Home', price: 8999, originalPrice: 12999, emoji: '🍳', desc: '4 induction zones, 7 power levels, safety auto switch-off.', rating: 4.6, reviews: 678, stock: 28, badge: 'Sale' },
    { id: 7, name: 'Dyson V12 Vacuum', category: 'Home', price: 49900, originalPrice: 59900, emoji: '🌀', desc: 'Laser Detect technology, HEPA filtration, 60-min battery life.', rating: 4.7, reviews: 432, stock: 9, badge: 'Low Stock' },
    { id: 8, name: 'Yoga Mat Pro', category: 'Sports', price: 1999, originalPrice: 2999, emoji: '🧘', desc: '6mm thick, non-slip surface, extra-wide 72\" length, carry strap.', rating: 4.4, reviews: 1876, stock: 89, badge: null },
    { id: 9, name: 'Atomic Habits', category: 'Books', price: 499, originalPrice: 799, emoji: '📚', desc: 'James Clear\'s #1 NYT bestseller on building good habits and breaking bad ones.', rating: 4.9, reviews: 12450, stock: 200, badge: 'Bestseller' },
    { id: 10, name: 'Maybelline Foundation', category: 'Beauty', price: 699, originalPrice: 899, emoji: '💄', desc: 'Fit Me Matte + Poreless, 40 shades, oil-free formula for a natural look.', rating: 4.2, reviews: 5632, stock: 156, badge: null },
    { id: 11, name: 'Samsung 65\" QLED', category: 'Electronics', price: 89990, originalPrice: 109990, emoji: '📺', desc: '4K QLED display, 120Hz refresh, Quantum HDR 1500, Tizen OS.', rating: 4.7, reviews: 234, stock: 7, badge: 'Sale' },
    { id: 12, name: 'Adidas Ultraboost', category: 'Fashion', price: 14995, originalPrice: 17995, emoji: '👟', desc: 'Boost midsole, Primeknit+ upper, Continental rubber outsole.', rating: 4.6, reviews: 892, stock: 44, badge: null },
    { id: 13, name: 'The Alchemist', category: 'Books', price: 349, originalPrice: 499, emoji: '📖', desc: 'Paulo Coelho\'s magical story of Santiago, an Andalusian shepherd.', rating: 4.7, reviews: 8921, stock: 300, badge: null },
    { id: 14, name: 'Protein Shaker', category: 'Sports', price: 599, originalPrice: 799, emoji: '🧴', desc: '600ml BPA-free, leak-proof lid, mixing ball included.', rating: 4.1, reviews: 3421, stock: 210, badge: null },
    { id: 15, name: 'Nykaa Face Serum', category: 'Beauty', price: 849, originalPrice: 999, emoji: '✨', desc: 'Vitamin C + Niacinamide brightening serum, 30ml, dermatologist tested.', rating: 4.5, reviews: 2341, stock: 92, badge: 'New' },
    { id: 16, name: 'Mi Smart Band 8', category: 'Electronics', price: 2999, originalPrice: 3499, emoji: '⌚', desc: '1.62\" AMOLED, 190+ sports modes, 16-day battery, SpO2 monitor.', rating: 4.4, reviews: 6723, stock: 88, badge: null },
  ],
  users: [
    { id: 1, name: 'Arjun Kumar', email: 'user@shop.com', password: 'password123', role: 'user', orders: 3, joined: 'Jan 2025', status: 'Active' },
    { id: 2, name: 'Admin Sharma', email: 'admin@shop.com', password: 'admin123', role: 'admin', orders: 0, joined: 'Dec 2024', status: 'Active' },
    { id: 3, name: 'Priya Nair', email: 'priya@example.com', password: 'priya123', role: 'user', orders: 7, joined: 'Mar 2025', status: 'Active' },
    { id: 4, name: 'Rahul Verma', email: 'rahul@example.com', password: 'rahul123', role: 'user', orders: 2, joined: 'Apr 2025', status: 'Inactive' },
  ],
  orders: [
    { id: 'ORD-001', userId: 1, customer: 'Arjun Kumar', items: [{ productId: 1, qty: 1 }, { productId: 9, qty: 2 }], total: 135898, status: 'Delivered', date: '15 May 2025', address: '123, MG Road, Chennai', paymentMethod: 'Card' },
    { id: 'ORD-002', userId: 3, customer: 'Priya Nair', items: [{ productId: 4, qty: 1 }, { productId: 10, qty: 1 }], total: 10694, status: 'Shipped', date: '18 Jun 2026', address: '45, Anna Nagar, Chennai', paymentMethod: 'UPI' },
    { id: 'ORD-003', userId: 1, customer: 'Arjun Kumar', items: [{ productId: 8, qty: 2 }], total: 3998, status: 'Processing', date: '19 Jun 2026', address: '123, MG Road, Chennai', paymentMethod: 'COD' },
    { id: 'ORD-004', userId: 4, customer: 'Rahul Verma', items: [{ productId: 2, qty: 1 }], total: 24990, status: 'Pending', date: '20 Jun 2026', address: '78, Bandra, Mumbai', paymentMethod: 'Card' },
    { id: 'ORD-005', userId: 3, customer: 'Priya Nair', items: [{ productId: 6, qty: 1 }, { productId: 16, qty: 1 }], total: 11998, status: 'Cancelled', date: '10 Jun 2026', address: '45, Anna Nagar, Chennai', paymentMethod: 'UPI' },
  ]
};

function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      const db = JSON.parse(JSON.stringify(defaultDB));
      db.users.forEach(u => {
        if (!u.password.includes(':')) {
          u.password = hashPassword(u.password);
        }
      });
      fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
      return db;
    }
    const data = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(data);
    // Ensure all passwords in DB are hashed securely
    let mutated = false;
    parsed.users.forEach(u => {
      if (!u.password.includes(':')) {
        u.password = hashPassword(u.password);
        mutated = true;
      }
    });
    if (mutated) {
      fs.writeFileSync(DB_PATH, JSON.stringify(parsed, null, 2), 'utf8');
    }
    return parsed;
  } catch (err) {
    console.error('Error reading database file:', err);
    return defaultDB;
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing database file:', err);
  }
}

// ========== HTTP RESPONSE HELPERS ==========
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function getJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

// ========== STATIC FILES SERVER ==========
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function serveStatic(filePath, res) {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // SPA Routing fallback
        fs.readFile(path.join(__dirname, 'public', 'index.html'), (err2, indexContent) => {
          if (err2) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(indexContent);
          }
        });
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server Error');
      }
    } else {
      const ext = path.extname(filePath);
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
}

// ========== HTTP SERVER REQUEST LISTENER ==========
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // Global CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Authentication Context Loader
  let currentUser = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    currentUser = verifyToken(token);
  }

  // --- API ROUTER ---
  if (pathname.startsWith('/api/')) {
    try {
      const db = readDB();

      // POST /api/auth/register
      if (pathname === '/api/auth/register' && req.method === 'POST') {
        const body = await getJsonBody(req);
        const { name, email, password } = body;
        if (!name || !email || !password) {
          return sendJson(res, 400, { message: 'All fields are required' });
        }
        const existing = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (existing) {
          return sendJson(res, 400, { message: 'Email already registered' });
        }
        const hashedPassword = hashPassword(password);
        const newUser = {
          id: db.users.length > 0 ? Math.max(...db.users.map(u => u.id)) + 1 : 1,
          name,
          email,
          password: hashedPassword,
          role: 'user',
          orders: 0,
          joined: new Date().toLocaleString('en-GB', { month: 'short', year: 'numeric' }),
          status: 'Active'
        };
        db.users.push(newUser);
        writeDB(db);

        const token = signToken({ id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role });
        return sendJson(res, 201, {
          token,
          user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role }
        });
      }

      // POST /api/auth/login
      if (pathname === '/api/auth/login' && req.method === 'POST') {
        const body = await getJsonBody(req);
        const { email, password } = body;
        if (!email || !password) {
          return sendJson(res, 400, { message: 'Email and password are required' });
        }
        const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (!user || user.status !== 'Active') {
          return sendJson(res, 401, { message: 'Invalid credentials or inactive account' });
        }
        const isPasswordValid = verifyPassword(password, user.password);
        if (!isPasswordValid) {
          return sendJson(res, 401, { message: 'Invalid credentials' });
        }
        const token = signToken({ id: user.id, name: user.name, email: user.email, role: user.role });
        return sendJson(res, 200, {
          token,
          user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });
      }

      // GET /api/products
      if (pathname === '/api/products' && req.method === 'GET') {
        let productsList = [...db.products];

        // Filters
        const category = url.searchParams.get('category');
        if (category && category !== 'All') {
          productsList = productsList.filter(p => p.category.toLowerCase() === category.toLowerCase());
        }

        const q = url.searchParams.get('q');
        if (q) {
          const query = q.toLowerCase();
          productsList = productsList.filter(p =>
            p.name.toLowerCase().includes(query) ||
            p.category.toLowerCase().includes(query) ||
            p.desc.toLowerCase().includes(query)
          );
        }

        // Sorting
        const sort = url.searchParams.get('sort');
        if (sort) {
          if (sort === 'price-asc') productsList.sort((a, b) => a.price - b.price);
          else if (sort === 'price-desc') productsList.sort((a, b) => b.price - a.price);
          else if (sort === 'rating') productsList.sort((a, b) => b.rating - a.rating);
          else if (sort === 'name') productsList.sort((a, b) => a.name.localeCompare(b.name));
        }

        // Limits
        const limit = parseInt(url.searchParams.get('limit'));
        if (!isNaN(limit)) {
          productsList = productsList.slice(0, limit);
        }
        return sendJson(res, 200, productsList);
      }

      // GET /api/products/:id
      const productMatch = pathname.match(/^\/api\/products\/(\d+)$/);
      if (productMatch && req.method === 'GET') {
        const id = parseInt(productMatch[1]);
        const product = db.products.find(p => p.id === id);
        if (!product) return sendJson(res, 404, { message: 'Product not found' });
        return sendJson(res, 200, product);
      }

      // Protected routes gatekeeper
      if (!currentUser) {
        return sendJson(res, 401, { message: 'Access token missing or expired' });
      }

      // GET /api/orders
      if (pathname === '/api/orders' && req.method === 'GET') {
        if (currentUser.role === 'admin') {
          return sendJson(res, 200, db.orders);
        } else {
          const userOrders = db.orders.filter(o => o.userId === currentUser.id);
          return sendJson(res, 200, userOrders);
        }
      }

      // POST /api/orders
      if (pathname === '/api/orders' && req.method === 'POST') {
        const body = await getJsonBody(req);
        const { items, address, paymentMethod, total } = body;
        if (!items || !items.length || !address || !paymentMethod) {
          return sendJson(res, 400, { message: 'Missing order details' });
        }

        for (const item of items) {
          const product = db.products.find(p => p.id === item.productId);
          if (!product) {
            return sendJson(res, 400, { message: `Product ID ${item.productId} not found` });
          }
          if (product.stock < item.qty) {
            return sendJson(res, 400, { message: `Insufficient stock for ${product.name}` });
          }
          product.stock -= item.qty;
        }

        const orderNum = db.orders.length > 0
          ? parseInt(db.orders[db.orders.length - 1].id.split('-')[1]) + 1
          : 1;
        const orderId = `ORD-${String(orderNum).padStart(3, '0')}`;

        const newOrder = {
          id: orderId,
          userId: currentUser.id,
          customer: currentUser.name,
          items,
          total: parseInt(total),
          status: 'Processing',
          date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
          address,
          paymentMethod
        };
        db.orders.push(newOrder);

        const user = db.users.find(u => u.id === currentUser.id);
        if (user) {
          user.orders = (user.orders || 0) + 1;
        }

        writeDB(db);
        return sendJson(res, 201, newOrder);
      }

      // GET /api/users/:id
      const userMatch = pathname.match(/^\/api\/users\/(\d+)$/);
      if (userMatch && req.method === 'GET') {
        const id = parseInt(userMatch[1]);
        if (currentUser.role !== 'admin' && currentUser.id !== id) {
          return sendJson(res, 403, { message: 'Unauthorized profile access' });
        }
        const user = db.users.find(u => u.id === id);
        if (!user) return sendJson(res, 404, { message: 'User not found' });
        const { password, ...safeUser } = user;
        return sendJson(res, 200, safeUser);
      }

      // PUT /api/users/:id
      if (userMatch && req.method === 'PUT') {
        const id = parseInt(userMatch[1]);
        if (currentUser.role !== 'admin' && currentUser.id !== id) {
          return sendJson(res, 403, { message: 'Unauthorized profile access' });
        }
        const body = await getJsonBody(req);
        const { name, email } = body;
        const index = db.users.findIndex(u => u.id === id);
        if (index === -1) return sendJson(res, 404, { message: 'User not found' });

        if (email && email.toLowerCase() !== db.users[index].email.toLowerCase()) {
          const conflict = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
          if (conflict) {
            return sendJson(res, 400, { message: 'Email address already in use' });
          }
        }
        db.users[index].name = name || db.users[index].name;
        db.users[index].email = email || db.users[index].email;
        writeDB(db);

        const { password, ...safeUser } = db.users[index];
        return sendJson(res, 200, safeUser);
      }

      // --- ADMIN ONLY APIs ---
      if (currentUser.role !== 'admin') {
        return sendJson(res, 403, { message: 'Admin access required' });
      }

      // POST /api/products
      if (pathname === '/api/products' && req.method === 'POST') {
        const body = await getJsonBody(req);
        const { name, category, price, stock, emoji, desc } = body;
        if (!name || isNaN(parseInt(price))) {
          return sendJson(res, 400, { message: 'Name and price are required' });
        }
        const newProduct = {
          id: db.products.length > 0 ? Math.max(...db.products.map(p => p.id)) + 1 : 1,
          name,
          category: category || 'General',
          price: parseInt(price),
          originalPrice: null,
          emoji: emoji || '📦',
          desc: desc || '',
          rating: 5.0,
          reviews: 0,
          stock: parseInt(stock) || 0,
          badge: 'New'
        };
        db.products.push(newProduct);
        writeDB(db);
        return sendJson(res, 201, newProduct);
      }

      // PUT /api/products/:id
      if (productMatch && req.method === 'PUT') {
        const id = parseInt(productMatch[1]);
        const index = db.products.findIndex(p => p.id === id);
        if (index === -1) return sendJson(res, 404, { message: 'Product not found' });

        const body = await getJsonBody(req);
        const { name, category, price, stock, emoji, desc } = body;
        const product = db.products[index];

        db.products[index] = {
          ...product,
          name: name !== undefined ? name : product.name,
          category: category !== undefined ? category : product.category,
          price: price !== undefined ? parseInt(price) : product.price,
          stock: stock !== undefined ? parseInt(stock) : product.stock,
          emoji: emoji !== undefined ? emoji : product.emoji,
          desc: desc !== undefined ? desc : product.desc
        };
        writeDB(db);
        return sendJson(res, 200, db.products[index]);
      }

      // DELETE /api/products/:id
      if (productMatch && req.method === 'DELETE') {
        const id = parseInt(productMatch[1]);
        const initialLength = db.products.length;
        db.products = db.products.filter(p => p.id !== id);
        if (db.products.length === initialLength) {
          return sendJson(res, 404, { message: 'Product not found' });
        }
        writeDB(db);
        return sendJson(res, 200, { message: 'Product deleted successfully' });
      }

      // PUT /api/orders/:id/status
      const orderStatusMatch = pathname.match(/^\/api\/orders\/([^\/]+)\/status$/);
      if (orderStatusMatch && req.method === 'PUT') {
        const id = orderStatusMatch[1];
        const body = await getJsonBody(req);
        const { status } = body;
        if (!status) return sendJson(res, 400, { message: 'Status is required' });

        const order = db.orders.find(o => o.id === id);
        if (!order) return sendJson(res, 404, { message: 'Order not found' });
        order.status = status;
        writeDB(db);
        return sendJson(res, 200, order);
      }

      // GET /api/users
      if (pathname === '/api/users' && req.method === 'GET') {
        const safeUsers = db.users.map(({ password, ...u }) => u);
        return sendJson(res, 200, safeUsers);
      }

      // PUT /api/users/:id/toggle-role
      const userToggleRole = pathname.match(/^\/api\/users\/(\d+)\/toggle-role$/);
      if (userToggleRole && req.method === 'PUT') {
        const id = parseInt(userToggleRole[1]);
        const user = db.users.find(u => u.id === id);
        if (!user) return sendJson(res, 404, { message: 'User not found' });
        user.role = user.role === 'admin' ? 'user' : 'admin';
        writeDB(db);
        return sendJson(res, 200, { message: `User role toggled to ${user.role}`, role: user.role });
      }

      // PUT /api/users/:id/toggle-status
      const userToggleStatus = pathname.match(/^\/api\/users\/(\d+)\/toggle-status$/);
      if (userToggleStatus && req.method === 'PUT') {
        const id = parseInt(userToggleStatus[1]);
        const user = db.users.find(u => u.id === id);
        if (!user) return sendJson(res, 404, { message: 'User not found' });
        user.status = user.status === 'Active' ? 'Inactive' : 'Active';
        writeDB(db);
        return sendJson(res, 200, { message: `User status toggled to ${user.status}`, status: user.status });
      }

      // No matching API route
      return sendJson(res, 404, { message: 'API Route not found' });

    } catch (e) {
      console.error('API Router Error:', e);
      return sendJson(res, 500, { message: 'Internal Server Error' });
    }
  }

  // --- STATIC FILE SERVER ROUTER (SPA FALLBACK) ---
  let safePath = pathname;
  if (safePath === '/') {
    safePath = '/index.html';
  }
  if (safePath.startsWith('/')) {
    safePath = safePath.substring(1);
  }
  safePath = safePath.replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, 'public', safePath);
  serveStatic(filePath, res);
});

// Start listening
server.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(` ShopVault E-Commerce Server (Pure Node) running!`);
  console.log(` Local URL: http://localhost:${PORT}`);
  console.log(`==================================================`);
});
