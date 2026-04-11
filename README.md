# GMR Glass Machinery Auctions

A complete online auction platform for industrial glass machinery, built with a Flask (Python) backend and a React frontend.

---

## Prerequisites

Before you begin, make sure you have the following installed on your computer:

1. **Python 3.10+** — [Download Python](https://www.python.org/downloads/)
   - During installation on Windows, **check "Add Python to PATH"**
   - To verify: open a terminal and run `python --version`

2. **Node.js 18+** (includes npm) — [Download Node.js](https://nodejs.org/)
   - Choose the LTS version
   - To verify: open a terminal and run `node --version` and `npm --version`

3. **Git** — [Download Git](https://git-scm.com/downloads)
   - To verify: open a terminal and run `git --version`

---

## Getting Started (Step by Step)

### 1. Clone the repository

Open a terminal (Command Prompt, PowerShell, or Git Bash) and run:

```bash
git clone https://github.com/johancoenengmr-ops/GMR-glass-machinery-auctions.git
cd GMR-glass-machinery-auctions
```

### 2. Start the backend (Flask API server)

Open a terminal and run the following commands one by one:

```bash
cd backend
pip install -r requirements.txt
python app.py
```

You should see output like:

```
 * Running on http://127.0.0.1:5000
```

**Leave this terminal open** — the backend needs to keep running.

To verify it works, open http://localhost:5000/api/auctions in your browser. You should see JSON data.

### 3. Start the frontend (React app)

Open a **second terminal** (keep the backend running in the first one) and run:

```bash
cd frontend
npm install
npm start
```

The first time you run `npm install` it may take a few minutes to download dependencies.

You should see output like:

```
Compiled successfully!
You can now view the app in the browser: http://localhost:3000
```

Open **http://localhost:3000** in your browser to use the application.

### Summary

| What        | Terminal | Command                          | URL                                  |
|-------------|----------|----------------------------------|--------------------------------------|
| Backend API | 1st      | `cd backend && python app.py`    | http://localhost:5000/api/auctions   |
| Frontend UI | 2nd      | `cd frontend && npm start`       | http://localhost:3000                |

> **Important:** Both terminals must stay open. If you close either one, that part of the application will stop working.

---

## Alternative: Docker

If you have [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed, you can start everything with a single command:

```bash
docker-compose up --build
```

This starts both the backend and frontend automatically.

---

## Test Accounts

The database is automatically seeded with sample data when the backend starts for the first time.

| Role  | Email                 | Password  |
|-------|-----------------------|-----------|
| Admin | admin@gmr.be          | admin123  |
| Buyer | buyer1@example.com    | buyer123  |
| Buyer | buyer2@example.com    | buyer123  |

---

## Features

### Backend (Flask + SQLAlchemy)
- **Database**: SQLite (dev) / PostgreSQL (prod) with SQLAlchemy ORM
- **Models**: User, Category, Auction, Bid
- **Authentication**: JWT tokens + bcrypt password hashing
- **Auction APIs**: Full CRUD with filtering, sorting, pagination
- **Bidding System**: Bid validation with minimum increment of EUR 500
- **Admin APIs**: Stats, user management, auction management

### Frontend (React)
- **Auction Browsing**: Filter by category, price, status; search by keyword
- **Auction Detail**: Full info, bid history, countdown timer
- **Authentication**: Register / Login / Logout
- **User Dashboard**: My bids, won auctions, profile editor
- **Admin Dashboard**: Manage auctions (create/edit/delete), manage users, statistics

### Sample Data
- 15 realistic glass machinery auctions from major manufacturers
- 8 categories (Flat Glass, Hollow Glass, Cutting, Grinding, Tempering, Washing, Laminated, Insulating)
- 3 users: 1 admin + 2 test buyers
- 5 sample bids

---

## Troubleshooting

### "Failed to load auctions" in the browser
- Make sure the **backend is running** in a separate terminal (`python app.py`)
- Open http://localhost:5000/api/auctions directly — if it shows JSON, the backend is fine
- Make sure you access the frontend via **http://localhost:3000** (not `127.0.0.1:3000`)

### "Module not found" when starting the backend
- Make sure you ran `pip install -r requirements.txt` from inside the `backend/` folder

### "npm: command not found"
- Node.js is not installed or not in your PATH. Reinstall from https://nodejs.org/

### Port already in use
- Another process is using port 5000 or 3000. Close other servers or terminals and try again

---

## API Endpoints

### Authentication
- `POST /api/auth/register` – Register new user
- `POST /api/auth/login` – Login, returns JWT

### Categories
- `GET /api/categories` – List all categories

### Auctions
- `GET /api/auctions` – List active auctions (filters: search, category_id, status, min_price, max_price, sort)
- `GET /api/auctions/all` – List all auctions (admin)
- `GET /api/auctions/{id}` – Get auction with bid history
- `POST /api/auctions` – Create auction (admin)
- `PUT /api/auctions/{id}` – Update auction (admin)
- `DELETE /api/auctions/{id}` – Delete auction (admin)

### Bids
- `POST /api/auctions/{id}/bids` – Place bid (authenticated)

### Users
- `PUT /api/users/profile` – Update my profile
- `GET /api/users/{id}/bids` – Get user's bid history
- `GET /api/users/{id}/won` – Get user's won auctions

### Admin
- `GET /api/admin/stats` – Platform statistics
- `GET /api/admin/users` – List all users
- `PUT /api/admin/users/{id}` – Update user (toggle admin)

Hallo dit is een test van Arne