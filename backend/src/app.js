import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import emailRoutes from './routes/email.routes.js';
import searchRoutes from './routes/search.routes.js';
import tasksRoutes from './routes/tasks.routes.js';

const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.json());
app.use(cors({
  origin: [
    'http://localhost:5176',
    'http://localhost:3000',
    'https://inboxiq-frontend.onrender.com',
  ],
  credentials: true,
}));

app.use(authRoutes);
app.use(emailRoutes);
app.use(searchRoutes);
app.use(tasksRoutes);

app.get('/', (req, res) => res.json({ message: 'InboxIQ running' }));

app.listen(PORT, () => console.log(`InboxIQ Node.js backend running on port ${PORT}`));
