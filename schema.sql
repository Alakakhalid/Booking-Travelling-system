-- Database schema inferred from app.js queries.
-- The "session" table is created automatically by connect-pg-simple.
-- Review column types and constraints and adjust to match your real database.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  destination VARCHAR(150),
  check_in DATE,
  check_out DATE,
  price NUMERIC(12, 2),
  method VARCHAR(50),
  guests INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
