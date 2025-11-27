# GitHub Setup Guide

This guide will help you set up the project to work from multiple computers using GitHub.

## Current Status

Your repository is already initialized with git. You just need to connect it to GitHub and push your code.

## Step 1: Create a GitHub Repository

1. Go to [GitHub.com](https://github.com) and sign in
2. Click the "+" icon in the top right corner
3. Select "New repository"
4. Name it `GRFS-Booking-Django` (or your preferred name)
5. **Do NOT** initialize with README, .gitignore, or license (you already have these)
6. Click "Create repository"

## Step 2: Connect Your Local Repository to GitHub

Run these commands in your project directory:

```bash
# Add the GitHub remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/GRFS-Booking-Django.git

# Verify the remote was added
git remote -v

# Push your code to GitHub
git branch -M main
git push -u origin main
```

## Step 3: Set Up on Another Computer

### On the new computer:

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/GRFS-Booking-Django.git
   cd GRFS-Booking-Django
   ```

2. **Set up Python virtual environment**
   ```bash
   cd room_booking
   python -m venv venv
   
   # Windows
   venv\Scripts\activate
   
   # Mac/Linux
   source venv/bin/activate
   
   # Install dependencies
   pip install -r requirements.txt
   ```

3. **Set up environment variables**
   ```bash
   # Copy the example env file
   cp env.example .env
   
   # Edit .env with your configuration
   # You'll need to set:
   # - SECRET_KEY (generate a new one or use the same)
   # - DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT
   ```

4. **Set up the database**
   ```bash
   python manage.py migrate
   ```

5. **Set up the frontend**
   ```bash
   cd ../frontend
   npm install
   ```

6. **Start the servers**
   ```bash
   # Terminal 1 - Backend (from room_booking directory)
   python manage.py runserver
   
   # Terminal 2 - Frontend (from frontend directory)
   npm start
   ```

## Step 4: Daily Workflow

### Before starting work:
```bash
# Pull latest changes
git pull origin main
```

### After making changes:
```bash
# Check what changed
git status

# Add your changes
git add .

# Commit with a descriptive message
git commit -m "Description of your changes"

# Push to GitHub
git push origin main
```

## Important Notes

### Files NOT tracked by Git (in .gitignore):
- `.env` files (contains sensitive data)
- `node_modules/` (can be reinstalled)
- `venv/` or `env/` (virtual environments)
- `__pycache__/` (Python cache files)
- Database files (`*.sqlite3`, `*.db`)

### Files you need to recreate on each computer:
- `room_booking/.env` - Contains database credentials and SECRET_KEY
- Database - You'll need to run migrations and potentially seed data

### Best Practices:
1. **Always pull before starting work** to get the latest changes
2. **Commit frequently** with clear messages
3. **Never commit sensitive data** (passwords, API keys, etc.)
4. **Test your changes** before pushing
5. **Use branches** for major features (optional but recommended)

## Troubleshooting

### If you get "remote origin already exists":
```bash
# Remove the existing remote
git remote remove origin

# Add it again with the correct URL
git remote add origin https://github.com/YOUR_USERNAME/GRFS-Booking-Django.git
```

### If you have conflicts when pulling:
```bash
# Git will tell you which files have conflicts
# Edit those files to resolve conflicts
# Then:
git add .
git commit -m "Resolved merge conflicts"
git push origin main
```

### If you need to update your .env file:
The `.env` file is not tracked by git for security. You'll need to:
1. Manually copy it to the new computer, OR
2. Use a secure method to share it (password manager, encrypted file, etc.)

## Security Reminder

⚠️ **Never commit these files:**
- `.env`
- `*.env`
- Files containing passwords or API keys
- Database files

Your `.gitignore` file is already configured to exclude these files.

