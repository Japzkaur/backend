# Client Inquiry Backend API (Port 5000)

Independent REST API service for processing client inquiries and powering the internal admin management system.

## Features
- **Inquiry Intake**: Generates random ticket IDs (`TKT-YYYY-XXXX`) and stages.
- **Tracker Endpoint**: Fetches milestone progress by ticket ID.
- **Admin Management**: Status changes, milestone notes, message dispatch, and inquiry deletion.
- **Authentication**: Admin login validation with token response.
- **CORS Enabled**: Cross-origin requests permitted for Client Portal (Port 80) and Admin Portal (Port 8080).

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Configure environment (optional, defaults to Port 5000):
```bash
cp .env.example .env
```

3. Start development server on port 5000:
```bash
npm run dev
```

4. Or start production server:
```bash
npm start
```

## API Endpoints

- `GET /api/health` - Server health check
- `POST /api/auth/login` - Admin login verification (authenticates against MongoDB users collection)
- `POST /api/auth/logout` - Admin logout session termination

### Inquiry Endpoints
- `POST /api/inquiries` - Submit new client inquiry
- `GET /api/inquiries` - List all inquiries (Admin filters)
- `GET /api/inquiries/:ticketId` - Get status of a ticket
- `PATCH /api/inquiries/:ticketId/status` - Advance milestone / change status
- `POST /api/inquiries/:ticketId/messages` - Post client or support message
- `DELETE /api/inquiries/:ticketId` - Delete inquiry

### User & Password IAM Endpoints
- `GET /api/users` - List all administrator accounts
- `POST /api/users` - Create a new user with password, role, and status
- `PUT /api/users/:id` - Update user details or change password
- `DELETE /api/users/:id` - Remove user account

### Role & Permissions IAM Endpoints
- `GET /api/roles` - List all security roles and permissions
- `POST /api/roles` - Create a new custom role with granular permissions
- `PUT /api/roles/:id` - Update role details and permissions
- `DELETE /api/roles/:id` - Remove custom role
