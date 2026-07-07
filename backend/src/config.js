import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
export const APP_ENV = process.env.APP_ENV || 'development';

export const REDIRECT_URI =
  APP_ENV === 'production'
    ? 'https://inboxiq-backend-10oo.onrender.com/auth/callback'
    : 'http://localhost:8000/auth/callback';

export const FRONTEND_URL =
  APP_ENV === 'production'
    ? 'https://inboxiq-frontend.onrender.com'
    : 'http://localhost:5176';
