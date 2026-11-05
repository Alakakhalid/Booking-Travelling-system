// app.js (clean single-file version)
// Run: node app.js
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Pool } from "pg";
import bcrypt from "bcrypt";
import sanitize from "sanitize-html";

dotenv.config();

// ---- App setup ----
const app = express();
const port = process.env.PORT || 4000;

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---- DB (Postgres) ----
const pool = new Pool({
  user: process.env.PGUSER || "postgres",
  host: process.env.PGHOST || "localhost",
  database: process.env.PGDATABASE || "Reviews",
  password: process.env.PGPASSWORD || "postgres",
  port: Number(process.env.PGPORT) || 5432,
});

// ---- Session setup (only once) ----
const PgSession = connectPgSimple(session);
app.use(
  session({
    store: new PgSession({
      pool: pool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    }, // 1 day
  })
);

// ---- Middleware / view engine ----
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// expose current user to all views as `user`
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// ---- ENV variables ----
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || "";
const AMADEUS_CLIENT_ID = process.env.AMADEUS_CLIENT_ID || "";
const AMADEUS_CLIENT_SECRET = process.env.AMADEUS_CLIENT_SECRET || "";

// Small formatting helper used by package titles.
function capitalize(value = "") {
  const text = String(value);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Helper: require login
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

// Helper: fetch Unsplash image for a query (returns one image URL or empty string)
async function fetchUnsplashImage(query) {
  if (!UNSPLASH_ACCESS_KEY) return "";
  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&client_id=${UNSPLASH_ACCESS_KEY}`;
    const r = await fetch(url);
    if (!r.ok) return "";
    const data = await r.json();
    return data.results?.[0]?.urls?.regular || "";
  } catch (err) {
    console.error("Unsplash fetch error:", err);
    return "";
  }
}

// ---- Static sample destinations (fallback/catalog) ----
const staticDestinations = {
  paris: {
    name: "Paris",
    description: "The city of love, lights, museums and charming streets.",
    price: 499,
  },
  dubai: {
    name: "Dubai",
    description: "Skyscrapers, luxury malls, deserts and thrilling experiences.",
    price: 699,
  },
  canada: {
    name: "Canada",
    description: "Mountains, lakes and wide open nature ideal for adventure.",
    price: 799,
  },
  tokyo: {
    name: "Tokyo",
    description: "A modern metropolis rich with culture, food and neon nights.",
    price: 649,
  },
};

// ---- Amadeus token helper (keeps cached) ----
let cachedToken = null;
let tokenExpiresAt = 0;
async function getAmadeusAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 6000) return cachedToken;
  if (!AMADEUS_CLIENT_ID || !AMADEUS_CLIENT_SECRET) {
    throw new Error("Amadeus credentials not set");
  }

  const resp = await fetch("https://test.api.amadeus.com/v1/security/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: AMADEUS_CLIENT_ID,
      client_secret: AMADEUS_CLIENT_SECRET,
    }),
  });
  if (!resp.ok) throw new Error("Failed to get Amadeus token");
  const data = await resp.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + data.expires_in * 1000;
  return cachedToken;
}

// ---- ROUTES ----

// Home / landing
app.get("/", async (req, res) => {
  try {
    // get latest 3 reviews for landing (non-blocking fallback)
    const { rows: reviews } = await pool.query(
      `SELECT r.id, r.review_text, r.rating, r.created_at, u.username
       FROM reviews r LEFT JOIN users u ON u.id = r.user_id
       ORDER BY r.created_at DESC LIMIT 3`
    );
    res.render("index", { title: "Home", reviews });
  } catch (err) {
    console.error("Landing error:", err);
    res.render("index", { title: "Home", reviews: [] });
  }
});

// Signup / register
app.get("/signup", (req, res) => res.render("signup", { title: "Signup" }));
app.post("/signup", async (req, res) => {
  const { username, email, password, confirmPassword } = req.body || {};
  if (!username || !email || !password) return res.status(400).send("All fields required");
  if (confirmPassword && password !== confirmPassword) {
    return res.status(400).send("Passwords do not match");
  }
  if (password.length < 8) return res.status(400).send("Password must be at least 8 characters long");
  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username",
      [username, email, hashed]
    );
    req.session.user = { id: result.rows[0].id, username: result.rows[0].username };
    res.redirect("/dashboard");
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).send("Error creating user");
  }
});
app.get("/about", (req, res) => res.render("about", { title: "About" }));
app.get("/packages", (req, res) => res.redirect("/view-packages"));
app.get("/flights", (req, res) => res.redirect("/destinations"));
app.get("/bookings", requireLogin, (req, res) => res.redirect("/my-bookings"));

// Login
app.get("/login", (req, res) => res.render("login", { title: "Login" }));
app.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).send("Missing fields");
  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0) return res.status(400).send("User not found");
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(400).send("Invalid password");
    req.session.user = { id: user.id, username: user.username, email: user.email };
    res.redirect("/dashboard");
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send("Login failed");
  }
});

// Logout
app.post("/logout", (req, res) => {
  req.session.destroy(() => res.clearCookie("connect.sid") && res.redirect("/"));
});

// ---- REVIEWS ----
// API: get latest reviews (JSON)
app.get("/api/reviews", async (req, res) => {
  try {
    const limit = Math.min(100, Number(req.query.limit) || 5);
    const { rows } = await pool.query(
      `SELECT r.id, r.review_text, r.rating, r.created_at, u.username
       FROM reviews r LEFT JOIN users u ON u.id = r.user_id 
       ORDER BY r.created_at DESC LIMIT $1`,
      [limit]
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching reviews:", err);
    res.status(500).json({ error: "Failed to load reviews" });
  }
});

// POST a review (requires login)
app.post("/api/reviews", requireLogin, async (req, res) => {
  try {
    let { rating, review_text } = req.body || {};
    rating = Number(rating);
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: "Invalid rating" });
    if (!review_text || review_text.trim().length < 4) return res.status(400).json({ error: "Review too short" });
    const safeText = sanitize(review_text, { allowedTags: [], allowedAttributes: [] }).trim();
    const { rows } = await pool.query(
      "INSERT INTO reviews (user_id, rating, review_text) VALUES ($1, $2, $3) RETURNING id, rating, review_text, created_at",
      [req.session.user.id, rating, safeText]
    );
    rows[0].username = req.session.user.username;
    res.json(rows[0]);
  } catch (err) {
    console.error("Error inserting review:", err);
    res.status(500).json({ error: "Failed to save review" });
  }
});

// Full reviews page (render EJS) - optional: require login or public
app.get("/review", async (req, res) => {
  try {
    const { rows: reviews } = await pool.query(
      `SELECT r.id, r.review_text, r.rating, r.created_at, u.username
       FROM reviews r LEFT JOIN users u ON u.id = r.user_id
       ORDER BY r.created_at DESC LIMIT 50`
    );
    res.render("review", { title: "Customer Reviews", reviews });
  } catch (err) {
    console.error("Error loading reviews page:", err);
    res.render("review", { title: "Customer Reviews", reviews: [] });
  }
});

// API: search destination images from Unsplash
app.get("/api/images", async (req, res) => {
  const query = String(req.query.query || "").trim();
  if (!query) return res.status(400).json({ error: "A search query is required." });
  if (!UNSPLASH_ACCESS_KEY) return res.status(503).json({ error: "Image search is not configured. Add UNSPLASH_ACCESS_KEY to your .env file." });
  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=8&client_id=${UNSPLASH_ACCESS_KEY}`;
    const response = await fetch(url);
    if (!response.ok) return res.status(response.status).json({ error: "Image provider request failed." });
    res.json(await response.json());
  } catch (error) {
    console.error("Image search error:", error);
    res.status(500).json({ error: "Unable to search images right now." });
  }
});

// API: featured destinations for the home page
app.get("/api/featured-destinations", async (req, res) => {
  try {
    const destinations = await buildDestinationsWithImages();
    res.json(destinations.map((destination) => ({
      city: destination.name,
      image: destination.images[0],
      description: destination.description,
      price: destination.price
    })));
  } catch (error) {
    console.error("Featured destinations error:", error);
    res.status(500).json({ error: "Unable to load featured destinations." });
  }
});

// ---- DESTINATIONS & SEARCH (uses Unsplash for images) ----

// returns array of destination objects (name, description, price, images[])
async function buildDestinationsWithImages() {
  const entries = Object.entries(staticDestinations);
  const results = [];
  for (const [key, d] of entries) {
    // fetch one Unsplash image per destination
    const img = await fetchUnsplashImage(d.name);
    results.push({
      key,
      name: d.name,
      description: d.description,
      price: d.price,
      images: img ? [img] : [`https://source.unsplash.com/600x400/?${encodeURIComponent(d.name)}`],
    });
  }
  return results;
}

// All destinations page
app.get("/destinations", async (req, res) => {
  try {
    const destinations = await buildDestinationsWithImages();
    res.render("destinations", { title: "Destinations", destinations, searchQuery: "" });
  } catch (err) {
    console.error("Destinations error:", err);
    res.render("destinations", { title: "Destinations", destinations: [], searchQuery: "" });
  }
});

// Search route (uses same view but filtered)
app.get("/search", async (req, res) => {
  try {
    const q = (req.query.query || "").toLowerCase();
    const all = await buildDestinationsWithImages();
    const filtered = q ? all.filter(d => d.name.toLowerCase().includes(q)) : all;
    res.render("destinations", { title: "Search Results", destinations: filtered, searchQuery: q });
  } catch (err) {
    console.error("Search error:", err);
    res.render("destinations", { title: "Search Results", destinations: [], searchQuery: req.query.query || "" });
  }
});

// Book main page: show catalog (same as /destinations)
app.get("/book", (req, res) => {
  // you can reuse destinations page or render a simplified book selection
  res.redirect("/destinations");
});

// Book specific destination (shows book.ejs with destination object)
app.get("/book/:country", async (req, res) => {
  const country = String(req.params.country || "").trim();
  const match = Object.values(staticDestinations).find(
    (destination) => destination.name.toLowerCase() === country.toLowerCase()
  );
  const destination = match || {
    name: country,
    description: `Explore the highlights and experiences of ${country}.`,
    price: 499,
    images: []
  };

  const image = await fetchUnsplashImage(`${country} travel`);
  destination.images = image
    ? [image]
    : [`https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1000`];

  res.render("book", { title: `Book ${country}`, destination });
});


// Payment page (for a destination) - requires login
app.get("/payment/:country", requireLogin, async (req, res) => {
  const country = req.params.country;
  res.render("payment", { country, title: `Payment - ${country}` });
});

// Confirm payment/booking (store booking in DB)
app.post("/confirm-book", requireLogin, async (req, res) => {
  try {
    const { destination, price, check_in, check_out, method, guests } = req.body;
    const userId = req.session.user.id;

    // Easily avoid SQL column mismatch by inserting only fields we provide (assumes bookings table exists)
    await pool.query(
      `INSERT INTO bookings (user_id, destination, check_in, check_out, price, method, guests)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [userId, destination, check_in || null, check_out || null, price || null, method || null, guests || null]
    );

    // TODO: send booking email (user email required) - left as future improvement
    res.redirect("/dashboard");
  } catch (err) {
    console.error("Error confirming booking:", err);
    res.status(500).send("Error confirming booking");
  }
});

// Payment form confirmation. This records the booking; it does not charge a card.
app.post("/payment/confirm", requireLogin, async (req, res) => {
  const { country, method } = req.body || {};
  if (!country || !method) return res.status(400).send("Destination and payment method are required.");
  try {
    await pool.query(
      `INSERT INTO bookings (user_id, destination, method, guests)
       VALUES ($1, $2, $3, $4)`,
      [req.session.user.id, country, method, 1]
    );
    res.redirect("/dashboard");
  } catch (error) {
    console.error("Payment confirmation error:", error);
    res.status(500).send("Unable to save this booking.");
  }
});

// ---- VIEW PACKAGES ----
app.get("/view-packages", async (req, res) => {
  const country = req.query.country || "world travel";

  const img1 = await fetchUnsplashImage(country + " travel");
  const img2 = await fetchUnsplashImage(country + " vacation");
  const img3 = await fetchUnsplashImage(country + " tourism");

  const packages = [
    {
      name: `${capitalize(country)} Budget Package`,
      description: `Affordable travel experience in ${capitalize(country)}.`,
      price: Math.floor(Math.random() * 400) + 200,
      image: img1 || `https://source.unsplash.com/400x300/?${country}`
    },
    {
      name: `${capitalize(country)} Luxury Package`,
      description: `Premium hotel, full tour guide, and VIP activities.`,
      price: Math.floor(Math.random() * 1000) + 800,
      image: img2 || `https://source.unsplash.com/401x301/?${country}`
    },
    {
      name: `${capitalize(country)} Adventure Package`,
      description: `Explore nature, landmarks, and culture of ${capitalize(country)}.`,
      price: Math.floor(Math.random() * 700) + 300,
      image: img3 || `https://source.unsplash.com/402x302/?${country}`
    }
  ];

  res.render("view-packages", {
    title: `${capitalize(country)} Packages`,
    packages
  });
});


// ---- MY BOOKINGS ----
app.get("/my-bookings", requireLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;
    // use SELECT * to avoid selecting columns that might not exist
    const { rows } = await pool.query("SELECT * FROM bookings WHERE user_id = $1 ORDER BY id DESC", [userId]);
    res.render("bookings", { title: "My Bookings", bookings: rows || [] });
  } catch (err) {
    console.error("my-bookings error:", err);
    res.render("bookings", { title: "My Bookings", bookings: [] });
  }
});

// Cancel booking
app.post("/cancel-booking/:id", requireLogin, async (req, res) => {
  try {
    const bookingId = Number(req.params.id);
    const userId = req.session.user.id;
    await pool.query("DELETE FROM bookings WHERE id = $1 AND user_id = $2", [bookingId, userId]);
    res.redirect("/my-bookings");
  } catch (err) {
    console.error("cancel booking error:", err);
    res.status(500).send("Error cancelling booking");
  }
});

// ---- DASHBOARD ----
app.get("/dashboard", requireLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;
    // SELECT * avoids "column does not exist" errors if your bookings table is different
    const { rows: bookings } = await pool.query("SELECT * FROM bookings WHERE user_id = $1 ORDER BY id DESC LIMIT 20", [userId]);
    res.render("dashboard", { title: "Dashboard", user: req.session.user, bookings: bookings || [] });
  } catch (err) {
    console.error("Error loading dashboard:", err);
    res.status(500).send("Error loading dashboard");
  }
});

// ---- Hotels via Amadeus (example) ----
app.get("/api/hotels", async (req, res) => {
  const { citycode, checkInDate, checkOutDate, adults = "1" } = req.query;
  if (!citycode || !checkInDate || !checkOutDate) return res.status(400).json({ error: "Missing location parameters" });
  try {
    const token = await getAmadeusAccessToken();
    const response = await fetch(`https://test.api.amadeus.com/v2/shopping/hotel-offers?cityCode=${citycode}&checkInDate=${checkInDate}&checkOutDate=${checkOutDate}&adults=${adults}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    const hotels = (data.data || []).map(h => ({
      name: h.hotel.name,
      city: h.hotel.address?.cityName || "Unknown",
      price: h.offers?.[0]?.price?.total || "N/A",
      currency: h.offers?.[0]?.price?.currency || "",
    }));
    res.json(hotels);
  } catch (err) {
    console.error("Amadeus error:", err);
    res.status(500).json({ error: "Failed to fetch hotels" });
  }
});


// ---- Simple health route ----
app.get("/health", (req, res) => res.json({ status: "ok" }));

// ---- 404 fallback ----
// app.use((req, res) => {
//   res.status(404).render("404", { title: "Not Found", url: req.originalUrl });
// });

// ---- Start server ----
app.listen(port, () => console.log(`✅ Server running at http://localhost:${port}`));
