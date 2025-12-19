# Local PostgreSQL Setup Guide

Your Django project is now configured to use local PostgreSQL for development.

## Prerequisites

1. **PostgreSQL must be installed** on your local machine
2. **PostgreSQL service must be running**

### Check if PostgreSQL is installed and running:

**Windows:**
```powershell
# Check if PostgreSQL service is running
Get-Service -Name postgresql*

# Or check if psql is available
psql --version
```

**macOS/Linux:**
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql
# or
brew services list | grep postgresql
```

## Database Setup

### 1. Create the Database (if it doesn't exist)

Connect to PostgreSQL and create the database:

```bash
# Windows (using psql)
psql -U postgres

# Or if you have a specific PostgreSQL user
psql -U room_admin -d postgres
```

Then in the PostgreSQL prompt:
```sql
CREATE DATABASE room_booking;
\q
```

### 2. Verify Your .env Configuration

Your `.env` file should have:
```env
USE_SQLITE_FOR_DEV=False
DB_NAME=room_booking
DB_USER=room_admin
DB_PASSWORD=fegwasd20061
DB_HOST=localhost
DB_PORT=5432
```

### 3. Create the PostgreSQL User (if needed)

If the user `room_admin` doesn't exist, create it:

```sql
CREATE USER room_admin WITH PASSWORD 'fegwasd20061';
ALTER ROLE room_admin SET client_encoding TO 'utf8';
ALTER ROLE room_admin SET default_transaction_isolation TO 'read committed';
ALTER ROLE room_admin SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE room_booking TO room_admin;
\q
```

## Running Migrations

Once PostgreSQL is set up, run migrations:

```bash
cd room_booking
python manage.py migrate
```

## Troubleshooting

### Error: "could not connect to server"

- **PostgreSQL service not running**: Start the PostgreSQL service
  - Windows: `net start postgresql-x64-XX` (replace XX with version)
  - Or use Services app to start PostgreSQL service

### Error: "database does not exist"

- Create the database using the SQL commands above

### Error: "password authentication failed"

- Verify the password in your `.env` file matches your PostgreSQL user password
- You may need to update the password or create the user

### Error: "role does not exist"

- Create the PostgreSQL user using the SQL commands above

## Switching Back to SQLite

If you want to use SQLite instead (no setup required), just change in `.env`:
```env
USE_SQLITE_FOR_DEV=True
```

## Current Configuration

- **Database Engine**: PostgreSQL
- **Database Name**: `room_booking`
- **Database User**: `room_admin`
- **Database Host**: `localhost`
- **Database Port**: `5432`
