import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes.js';
import checkinRoutes from './routes/checkin.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import ratingRoutes from './routes/rating.routes.js';
import userRoutes from './routes/user.routes.js';
import workoutRoutes from './routes/workout.routes.js';

dotenv.config();

const app = express();
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((origin) => origin.trim()).filter(Boolean)
  : [];

app.use(cors({
  origin(origin, callback) {
    // permite ferramentas locais sem origin, como Postman e requests server-to-server
    if (!origin) {
      return callback(null, true);
    }

    // sem FRONTEND_URL configurado, libera CORS para facilitar desenvolvimento local
    if (!allowedOrigins.length || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origem nao permitida pelo CORS'));
  }
}));
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/checkins', checkinRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/ratings', ratingRoutes);
app.use('/users', userRoutes);
app.use('/workouts', workoutRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server rodando na porta ${PORT}`);
});
