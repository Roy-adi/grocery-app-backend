# 🛒 Grocery List Backend

Production-ready REST API built with Node.js, Express, MongoDB Atlas, and JWT authentication.

---

## 📁 Folder Structure

```
src/
├── app.js                    # Express app (middleware + routes)
├── server.js                 # Entry point (DB connect + HTTP listen)
│
├── config/
│   └── env.js                # Centralized env var loading & validation
│
├── db/
│   └── connect.js            # MongoDB connection with retry & events
│
├── models/
│   ├── User.model.js         # User schema (bcrypt, account lock)
│   ├── Category.model.js     # Dynamic categories (global + user-owned)
│   └── GroceryItem.model.js  # Grocery item schema (soft delete)
│
├── validators/
│   ├── auth.validator.js     # Zod schemas for signup / login
│   └── grocery.validator.js  # Zod schema for createGroceryItem
│
├── middlewares/
│   ├── auth.js               # JWT authenticate + RBAC authorize
│   ├── validate.js           # Generic Zod validation middleware
│   ├── rateLimiter.js        # General + login-specific rate limiters
│   └── errorHandler.js       # Global error handler (4-param Express)
│
├── controllers/
│   ├── auth.controller.js    # signup, login, logout, refresh
│   └── grocery.controller.js # createGroceryItem, getGroceryItems, delete
│
├── services/
│   ├── auth.service.js       # registerUser, loginUser, refreshTokens, logoutUser
│   └── grocery.service.js    # createGroceryItem, getUserGroceryItems, softDelete
│
├── routes/
│   ├── auth.routes.js        # POST /api/v1/auth/*
│   └── grocery.routes.js     # /api/v1/grocery (all protected)
│
└── utils/
    ├── ApiResponse.js        # Unified success response shape
    ├── ApiError.js           # Custom error class with statusCode
    ├── asyncHandler.js       # Wraps async controllers → forwards errors
    ├── token.js              # JWT sign/verify + cookie options
    └── logger.js             # Winston logger (dev: colored, prod: JSON)
```

---

## 🔄 Data Flow

```
Request
  └─► Route
        └─► Middleware (auth / rate limit)
              └─► validate() [Zod schema]
                    └─► Controller  [extracts req.body / req.user]
                          └─► Service  [business logic + DB]
                                └─► Controller  [builds response]
                                      └─► ApiResponse.send(res)

Error at any layer → next(ApiError) → errorHandler middleware
```

---

## 🚀 Setup

### 1. Clone & install
```bash
git clone <your-repo>
cd grocery-backend
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Fill in MONGODB_URI, ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET
```

### 3. Run
```bash
npm run dev    # Development (nodemon)
npm start      # Production
```

---

## 📡 API Reference

### Auth

| Method | Endpoint              | Auth? | Description          |
|--------|-----------------------|-------|----------------------|
| POST   | /api/v1/auth/signup   | ❌    | Register new user    |
| POST   | /api/v1/auth/login    | ❌    | Login (rate limited) |
| POST   | /api/v1/auth/logout   | ✅    | Invalidate tokens    |
| POST   | /api/v1/auth/refresh  | ❌    | Rotate token pair    |

#### POST /api/v1/auth/signup
```json
// Request
{
  "name": "Alice",
  "email": "alice@example.com",
  "password": "Secret123"
}

// Response 201
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "user": { "_id": "...", "name": "Alice", "email": "alice@example.com", "role": "user" },
    "accessToken": "<jwt>"
  }
}
```

#### POST /api/v1/auth/login
```json
// Request
{
  "email": "alice@example.com",
  "password": "Secret123"
}

// Response 200
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { ... },
    "accessToken": "<jwt>"
  }
}
```

> Tokens are also set as HTTP-only cookies (`accessToken`, `refreshToken`).
> Mobile clients (Expo) should use the `accessToken` from the response body
> and send it as `Authorization: Bearer <token>`.

---

### Grocery

| Method | Endpoint              | Auth? | Description            |
|--------|-----------------------|-------|------------------------|
| POST   | /api/v1/grocery       | ✅    | Create grocery item    |
| GET    | /api/v1/grocery       | ✅    | List my grocery items  |
| DELETE | /api/v1/grocery/:id   | ✅    | Soft-delete item       |

#### POST /api/v1/grocery
```json
// Request (Authorization: Bearer <token>)
{
  "name": "Whole Milk",
  "category_id": "664a1f2e8b2c3d4e5f6a7b8c",
  "quantity": 2,
  "unit": "litre",
  "priority": "high",
  "due_date": "2024-07-01",
  "notes": "Full-fat preferred"
}

// Response 201
{
  "success": true,
  "message": "Grocery item created",
  "data": {
    "item": {
      "_id": "...",
      "name": "Whole Milk",
      "category_id": { "_id": "...", "name": "Dairy" },
      "quantity": 2,
      "unit": "litre",
      "priority": "high",
      "purchased": false,
      "deleted_at": null,
      ...
    }
  }
}
```

---

## 🔐 Security Features

| Feature                | Implementation                                    |
|------------------------|---------------------------------------------------|
| Password hashing       | bcryptjs (12 rounds)                              |
| JWT access token       | Short-lived (15m), HTTP-only cookie               |
| JWT refresh token      | Long-lived (7d), HTTP-only cookie, DB-stored      |
| Token rotation         | New pair issued on every refresh                  |
| Account lock           | 5 failed logins → 15 min lockout                  |
| NoSQL injection        | express-mongo-sanitize                            |
| HTTP security headers  | helmet                                            |
| CORS                   | Whitelist for web + mobile origins                |
| Rate limiting          | Global (100/15min) + login (10/10min)             |
| Payload size cap       | 10kb limit on JSON body                           |

---

## 🗃️ Database Schema

### Users
```
_id, name, email (unique, indexed), password (hashed, hidden),
avatar, role (user|admin), refreshToken (hidden), loginAttempts (hidden),
lockUntil (hidden), createdAt, updatedAt
```

### Categories
```
_id, name, user_id (null=global | ObjectId=user-defined),
createdAt, updatedAt
Unique index: (name, user_id)
```

### GroceryItems
```
_id, user_id (ref:User, indexed), name, category_id (ref:Category),
quantity, unit (enum), purchased, due_date, purchased_date,
notes, priority (enum), deleted_at (soft delete), createdAt, updatedAt
Compound index: (user_id, deleted_at, priority)
```

---

## 🧩 Extending the API

Follow this pattern for any new route:

1. **Validator** — add Zod schema in `src/validators/`
2. **Service** — add business logic in `src/services/`
3. **Controller** — thin handler in `src/controllers/`
4. **Route** — wire it up in `src/routes/`

The architecture ensures each new feature stays clean and testable.

---

## ☁️ Deploying to Render

1. Push to GitHub
2. Create a new **Web Service** on Render, connect the repo
3. Set **Build Command**: `npm install`
4. Set **Start Command**: `npm start`
5. Add all `.env` variables in Render's Environment tab
6. Set `COOKIE_SECURE=true` and `NODE_ENV=production`
