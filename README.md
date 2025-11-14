# GRFS Booking Django

A full-stack room booking system built with Django REST Framework backend and React frontend. This application allows users to book rooms across different floors, with role-based access control for users, mentors, coordinators, and admins.

## Features

- 🔐 **JWT Authentication** - Secure token-based authentication
- 👥 **Role-Based Access Control** - User, Mentor, Coordinator, and Admin roles
- 🏢 **Multi-Floor Room Management** - Organize rooms by floors
- 📅 **Booking System** - Create and manage room bookings
- 🔍 **Admin Dashboard** - Admin users can view all bookings
- 🎨 **Modern React Frontend** - Responsive UI with React Router

## Tech Stack

### Backend
- Django 5.2.8
- Django REST Framework 3.16.1
- PostgreSQL
- JWT Authentication (djangorestframework-simplejwt)
- python-dotenv for environment variable management

### Frontend
- React 19.2.0
- React Router 7.9.5
- Axios for API calls

## Prerequisites

- Python 3.8+
- Node.js 14+
- PostgreSQL 12+
- pip (Python package manager)
- npm or yarn

## Installation

### Backend Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd GRFS-Booking-Django
   ```

2. **Create and activate a virtual environment**
   ```bash
   # Windows
   python -m venv venv
   venv\Scripts\activate

   # macOS/Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install Python dependencies**
   ```bash
   cd room_booking
   pip install -r ../requirements.txt
   ```

4. **Set up environment variables**
   
   Create a `.env` file in the `room_booking` directory:
   ```env
   # Django Settings
   SECRET_KEY=your-secret-key-here
   DEBUG=True
   ALLOWED_HOSTS=localhost,127.0.0.1

   # Database Configuration
   DB_NAME=room_booking
   DB_USER=room_admin
   DB_PASSWORD=your-database-password
   DB_HOST=localhost
   DB_PORT=5432

   # CORS Settings
   CORS_ALLOWED_ORIGINS=http://localhost:3000
   ```

   **Important:** Replace the placeholder values with your actual configuration. For production, use a strong SECRET_KEY and set DEBUG=False.

5. **Set up PostgreSQL database**
   
   Create a PostgreSQL database:
   ```sql
   CREATE DATABASE room_booking;
   CREATE USER room_admin WITH PASSWORD 'your-password';
   GRANT ALL PRIVILEGES ON DATABASE room_booking TO room_admin;
   ```

6. **Run migrations**
   ```bash
   python manage.py migrate
   ```

7. **Create a superuser (optional)**
   ```bash
   python manage.py createsuperuser
   ```

8. **Run the development server**
   ```bash
   python manage.py runserver
   ```

   The backend API will be available at `http://localhost:8000`

### Frontend Setup

1. **Navigate to the frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```

   The frontend will be available at `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/auth/register/` - Register a new user
- `POST /api/auth/login/` - Login and get JWT tokens
- `POST /api/auth/refresh/` - Refresh JWT token
- `GET /api/auth/user/` - Get current user details

### Floors & Rooms
- `GET /api/floors/` - List all floors
- `GET /api/rooms/` - List all rooms (optional query param: `?floor=<floor_id>`)

### Bookings
- `GET /api/bookings/` - List bookings (all for admin, own for regular users)
- `POST /api/bookings/` - Create a new booking
- `POST /api/create_booking/` - Create booking with floor/room selection
- `GET /api/bookings/my` - Get current user's bookings

## Using Postman

### Step 1: Get JWT Token

1. **Register a user** (if you haven't already):
   - Method: `POST`
   - URL: `http://localhost:8000/api/auth/register/`
   - Headers: `Content-Type: application/json`
   - Body (JSON):
     ```json
     {
       "username": "testuser",
       "email": "test@example.com",
       "password": "testpass123",
       "role": "user"
     }
     ```

2. **Login to get JWT token**:
   - Method: `POST`
   - URL: `http://localhost:8000/api/auth/login/`
   - Headers: `Content-Type: application/json`
   - Body (JSON):
     ```json
     {
       "email": "test@example.com",
       "password": "testpass123"
     }
     ```
   - Response will include `access` and `refresh` tokens. Copy the `access` token.

### Step 2: Create a Booking

1. **Set up the request**:
   - Method: `POST`
   - URL: `http://localhost:8000/api/create_booking/`
   - Headers:
     - `Content-Type: application/json`
     - `Authorization: Bearer <your-access-token>` (replace `<your-access-token>` with the token from Step 1)
   - Body (JSON):
     ```json
     {
       "room_ids": [1, 2, 3],
       "start_datetime": "2025-11-15T10:00:00",
       "end_datetime": "2025-11-15T12:00:00"
     }
     ```
   - **Note**: Use `start_datetime` and `end_datetime` (not `start_time`/`end_time`)

2. **Alternative: Book by floor**:
   ```json
   {
     "floor_id": 1,
     "start_datetime": "2025-11-15T10:00:00",
     "end_datetime": "2025-11-15T12:00:00"
   }
   ```

### Postman Tips

- **Save the token**: Create a Postman environment variable for the access token
- **Auto-refresh**: Use the refresh token endpoint to get new access tokens when they expire
- **Test other endpoints**: All booking endpoints require the `Authorization: Bearer <token>` header

## Project Structure

```
GRFS-Booking-Django/
├── room_booking/              # Django backend
│   ├── booking/               # Main app
│   │   ├── models.py         # Database models
│   │   ├── views.py          # API views
│   │   ├── serializers.py    # DRF serializers
│   │   └── urls.py           # URL routing
│   ├── room_booking/         # Project settings
│   │   ├── settings.py       # Django settings
│   │   └── urls.py           # Root URL config
│   └── manage.py
├── frontend/                  # React frontend
│   ├── src/
│   │   ├── components/       # Reusable components
│   │   ├── pages/            # Page components
│   │   ├── services/         # API service layer
│   │   └── App.jsx           # Main app component
│   └── package.json
├── requirements.txt           # Python dependencies
└── README.md
```

## User Roles

- **User**: Can view floors/rooms and create bookings
- **Mentor**: Same as User (can be extended)
- **Coordinator**: Same as User (can be extended)
- **Admin**: Can view all bookings and manage the system

## Development

### Running Tests
```bash
# Backend tests
cd room_booking
python manage.py test

# Frontend tests
cd frontend
npm test
```

### Database Migrations
```bash
# Create migrations
python manage.py makemigrations

# Apply migrations
python manage.py migrate
```

## Security Notes

⚠️ **Important Security Considerations:**

1. **Never commit `.env` files** - They contain sensitive information
2. **Change default SECRET_KEY** - Generate a new one for production
3. **Set DEBUG=False in production** - Prevents sensitive error information leakage
4. **Use strong database passwords** - Especially in production environments
5. **Configure ALLOWED_HOSTS** - Set to your domain in production
6. **Use HTTPS in production** - Encrypt data in transit

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running
- Verify database credentials in `.env` file
- Check that the database and user exist

### CORS Errors
- Verify `CORS_ALLOWED_ORIGINS` in settings matches your frontend URL
- Check that the frontend is running on the expected port

### Migration Issues
- Delete migration files (except `__init__.py`) and run `makemigrations` again
- Ensure database is accessible and user has proper permissions

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Support

For issues and questions, please open an issue on the GitHub repository.
