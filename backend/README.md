# Wastewarden Backend API

A comprehensive food waste management system backend built with Node.js, Express, and MongoDB.

## Features

- **Multi-role Authentication**: Donors, Requesters, NGOs, and Admins
- **Real-time Notifications**: Socket.io for live updates
- **Geospatial Queries**: Find nearby donations, requests, and users
- **Request Expiry System**: Auto-expire requests after 5 minutes
- **Points & Rewards**: Gamification for NGOs and users
- **Comprehensive Delivery Tracking**: Full lifecycle management

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT (JSON Web Tokens)
- **Real-time**: Socket.io
- **Validation**: Express-validator
- **Security**: Helmet, CORS, Rate limiting

## Installation

1. **Clone and navigate to backend**:
   ```bash
   cd C:\Users\syeda\CascadeProjects\wastewarden\backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Setup**:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   - MongoDB connection string
   - JWT secret key
   - Email credentials (Nodemailer)
   - SMS API key (Fast2SMS)
   - Google Maps API key

4. **Start the server**:
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/change-password` - Change password

### Donations
- `POST /api/donations` - Create donation
- `GET /api/donations` - Get donations (with filters)
- `GET /api/donations/:id` - Get single donation
- `PUT /api/donations/:id` - Update donation
- `PUT /api/donations/:id/assign-ngo` - Assign to NGO
- `PUT /api/donations/:id/cancel` - Cancel donation

### Requests
- `POST /api/requests` - Create food request
- `GET /api/requests` - Get requests (with filters)
- `GET /api/requests/:id` - Get single request
- `PUT /api/requests/:id/accept` - Accept request
- `PUT /api/requests/:id/extend` - Extend expiry time
- `PUT /api/requests/:id/cancel` - Cancel request

### Deliveries
- `POST /api/deliveries` - Create delivery
- `GET /api/deliveries` - Get deliveries
- `GET /api/deliveries/active` - Get active deliveries (NGO)
- `PUT /api/deliveries/:id/start-pickup` - Start pickup
- `PUT /api/deliveries/:id/complete-pickup` - Complete pickup
- `PUT /api/deliveries/:id/complete-delivery` - Complete delivery
- `PUT /api/deliveries/:id/update-location` - Update location

### Users
- `GET /api/users/nearby` - Find nearby users
- `GET /api/users/profile/:id` - Get user profile

### Admin
- `GET /api/admin/stats` - Platform statistics
- `GET /api/admin/users` - Manage users
- `PUT /api/admin/users/:id/approve` - Approve NGO
- `PUT /api/admin/users/:id/deactivate` - Deactivate user

## Database Models

### User
- Multi-role support (donor, requester, ngo, admin)
- Location with coordinates for geospatial queries
- Points system for gamification
- NGO approval workflow

### Donation
- Food details with categories and allergens
- Pickup location with coordinates
- Expiry time management
- Status tracking (active → assigned → picked up → delivered)

### Request
- 5-minute auto-expiry system
- Urgency levels and requirements
- Location-based matching
- Status progression tracking

### Delivery
- Complete pickup and delivery workflow
- Real-time location tracking
- Issue reporting system
- Points calculation and rewards

## Real-time Events

The system emits various Socket.io events:
- `new_donation` - New donation available
- `new_request` - New food request
- `donation_assigned` - NGO assigned to donation
- `request_accepted` - Request accepted
- `pickup_started` - NGO started pickup
- `delivery_completed` - Food delivered
- `location_update` - Real-time location updates

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting for sensitive operations
- Input validation and sanitization
- CORS protection
- Helmet security headers

## Development

```bash
# Run in development mode with auto-reload
npm run dev

# Run tests
npm test
```

## Deployment

The backend is ready for deployment on platforms like:
- Heroku
- Railway
- Render
- DigitalOcean App Platform

Make sure to set all environment variables in your deployment platform.
