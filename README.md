# GMR Glass Machinery Auctions

A complete online auction platform for industrial glass machinery.

## Features

### Backend (Flask + SQLAlchemy)
- **Database**: SQLite (dev) / PostgreSQL (prod) with SQLAlchemy ORM
- **Models**: User, Category, Auction, Bid
- **Authentication**: JWT tokens + bcrypt password hashing
- **Auction APIs**: Full CRUD with filtering, sorting, pagination
- **Bidding System**: Bid validation, winner determination
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

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
python app.py
```
Backend runs on http://localhost:5000

### Frontend
```bash
cd frontend
npm install
npm start
```
Frontend runs on http://localhost:3000

### Docker
```bash
docker-compose up --build
```

## Test Accounts
| Role  | Email                 | Password  |
|-------|-----------------------|-----------|
| Admin | admin@gmr.be          | admin123  |
| Buyer | buyer1@example.com    | buyer123  |
| Buyer | buyer2@example.com    | buyer123  |

## API Endpoints

### Authentication
- `POST /api/auth/register` – Register new user
- `POST /api/auth/login` – Login, returns JWT
- `GET /api/auth/me` – Get current user

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
- `GET /api/auctions/{id}/bids` – Get bids for auction
- `POST /api/auctions/{id}/bids` – Place bid (authenticated)

### Users
- `GET /api/users/profile` – Get my profile
- `PUT /api/users/profile` – Update my profile
- `GET /api/users/{id}/bids` – Get user's bid history
- `GET /api/users/{id}/won` – Get user's won auctions

### Admin
- `GET /api/admin/stats` – Platform statistics
- `GET /api/admin/users` – List all users
- `PUT /api/admin/users/{id}` – Update user (toggle admin)

