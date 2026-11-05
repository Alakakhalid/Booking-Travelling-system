# Travelling Website

A full-stack travel booking web app where users can browse destinations, search hotels and flights, book trips, manage bookings and leave reviews.

Built with **Node.js, Express, EJS and PostgreSQL**.

## Features

- User signup and login (bcrypt password hashing, PostgreSQL-backed sessions)
- Browse destinations with images from the Unsplash API
- Hotel offer search powered by the Amadeus test API (requires valid Amadeus credentials)
- Booking flow: choose a destination, enter dates and guests, and save a booking record
- Dashboard and "My Bookings" page with cancel option
- Customer reviews with ratings
- Input sanitising with `sanitize-html`

> **Important:** The current payment form only records a selected payment method and booking in PostgreSQL. It does not process real card, PayPal, or bank payments. The `/flights` link currently redirects to the destinations page; live flight booking is not implemented.

## Tech Stack

| Layer | Tools |
| --- | --- |
| Frontend | EJS templates, HTML, CSS, JavaScript |
| Backend | Node.js, Express 5 |
| Database | PostgreSQL (`pg`, `connect-pg-simple`) |
| Auth | `express-session`, `bcrypt` |
| APIs | Unsplash, Amadeus, Nodemailer |

## Getting Started

**Requirements:** Node.js 18+ and PostgreSQL.

```bash
git clone https://github.com/Alakakhalid/Booking-Travelling-system.git
cd Booking-Travelling-system
npm install
```

1. Create a PostgreSQL database (default name is `Reviews`) and run the tables:
   ```bash
   psql -U postgres -d Reviews -f schema.sql
   ```
2. Copy `.env.example` to `.env` and fill in your values.
3. Start the app:
   ```bash
   npm run dev    # with nodemon
   npm start      # plain node
   ```
4. Open http://localhost:4000

## Environment Variables

See [`.env.example`](.env.example) for the full list. Never commit your real `.env`.

## Project Structure

```
├── app.js            # Express server and routes
├── views/            # EJS templates (pages and partials)
├── public/           # CSS, JS, images, videos
├── schema.sql        # Database tables
└── .env.example
```

## Screenshots

_Add screenshots of the home page, booking flow and dashboard here._

## Author

**Khalid Alaka** — [GitHub](https://github.com/Alakakhalid)


## Current implementation notes

- Create the PostgreSQL database and run `schema.sql` before starting the server.
- The home page's featured destination and image-search endpoints use Unsplash.
- Hotel offers use the Amadeus test environment and require a valid city code and dates.
- The project currently saves booking records but does not charge payments or issue tickets.
