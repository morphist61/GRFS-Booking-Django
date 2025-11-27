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

### Initial Setup (First Time)

1. **Clone the repository** (if you don't have it locally)
   ```bash
   git clone <repository-url>
   cd GRFS-Booking-Django
   ```

   Or if you already have the repository locally and want to connect it to GitHub:
   ```bash
   # Navigate to your project directory
   cd GRFS-Booking-Django
   
   # Add GitHub remote (replace with your repository URL)
   git remote add origin https://github.com/yourusername/GRFS-Booking-Django.git
   
   # Push to GitHub
   git branch -M main
   git push -u origin main
   ```

### Working from Multiple Computers

To work on this project from another computer:

1. **Clone the repository on the new computer**
   ```bash
   git clone https://github.com/yourusername/GRFS-Booking-Django.git
   cd GRFS-Booking-Django
   ```

2. **Set up the backend** (follow Backend Setup steps below)

3. **Set up the frontend** (follow Frontend Setup steps below)

4. **Create your `.env` file** (copy from `env.example` or create new)
   ```bash
   # In room_booking directory
   cp env.example .env
   # Then edit .env with your configuration
   ```

5. **Pull latest changes** before starting work
   ```bash
   git pull origin main
   ```

6. **Push your changes** when done
   ```bash
   git add .
   git commit -m "Your commit message"
   git push origin main
   ```

### Backend Setup

1. **Navigate to the backend directory**
   ```bash
   cd room_booking
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
   
   Generate a SECRET_KEY and create a `.env` file:
   ```bash
   cd room_booking
   python generate_secret_key.py
   ```
   
   Copy `env.example` to `.env` and update with your values:
   ```bash
   # Windows PowerShell
   Copy-Item env.example .env
   
   # macOS/Linux
   cp env.example .env
   ```
   
   Edit `.env` and replace:
   - `SECRET_KEY` - Use the key from `generate_secret_key.py`
   - `DB_PASSWORD` - Your PostgreSQL password
   - Other values as needed

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

**Base URL:** `http://localhost:8000/api/`

### Authentication
- `POST /auth/register/` - Register a new user
- `POST /auth/login/` - Login and get JWT tokens
- `POST /auth/refresh/` - Refresh JWT token
- `GET /auth/user/` - Get current user details

### Floors & Rooms
- `GET /floors/` - List all floors
- `GET /rooms/` - List all rooms (optional: `?floor=<floor_id>`)

### Bookings
- `GET /bookings/` - List bookings (all for admin, own for users)
- `POST /create_booking/` - Create booking with room/floor selection
- `GET /bookings/my` - Get current user's bookings
- `GET /check_availability/` - Check room availability for a date

## Quick Start

After completing the installation steps above:

1. **Start the backend server** (in `room_booking` directory):
   ```bash
   python manage.py runserver
   ```
   Backend runs at `http://localhost:8000`

2. **Start the frontend** (in `frontend` directory, new terminal):
   ```bash
   npm start
   ```
   Frontend runs at `http://localhost:3000`

3. **Test the application**:
   - Open `http://localhost:3000` in your browser
   - Register a new user
   - Login and start booking rooms!

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
