# Local Development Setup (Dev Branch)

This guide is for setting up the frontend for local development on the `dev` branch.

## Environment Variables

### `.env` File

The `.env` file is already configured for local development with:

```env
VITE_API_URL=http://localhost:8000/api/
```

This points to your local Django backend server running on port 8000.

### Important Notes

- **`.env` file is gitignored** - It won't be committed to version control
- **Vite requires `VITE_` prefix** - Only environment variables prefixed with `VITE_` are exposed to client-side code
- **Default fallback** - If `VITE_API_URL` is not set, it defaults to `http://localhost:8000/api/`

## Running the Development Server

1. **Start the Django backend** (in a separate terminal):
   ```bash
   cd room_booking
   python manage.py runserver
   ```
   Backend should be running at: `http://localhost:8000`

2. **Start the Vite dev server**:
   ```bash
   cd frontend
   npm run dev
   ```
   Frontend will be available at: `http://localhost:3000`

## Development Features

- **Hot Module Replacement (HMR)** - Changes reflect immediately without full page reload
- **API Proxy** - Vite is configured to proxy `/api` requests to `http://localhost:8000`
- **Console Logging** - In development mode, the API base URL is logged to the console for debugging

## Troubleshooting

### API calls failing?

1. Check that your Django backend is running on port 8000
2. Verify the `.env` file exists in the `frontend/` directory
3. Check the browser console for the logged API URL
4. Ensure CORS is configured in Django settings to allow `http://localhost:3000`

### Environment variable not working?

- Make sure the variable name starts with `VITE_`
- Restart the Vite dev server after changing `.env` file
- Check that `.env` file is in the `frontend/` directory (not `frontend/src/`)

## Production vs Development

- **Development (dev branch)**: Uses `.env` file with `http://localhost:8000/api/`
- **Production**: Uses environment variables set in deployment platform (e.g., Render) with production API URL
