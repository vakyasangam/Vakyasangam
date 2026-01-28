// ------------------- 🌍 Core Imports -------------------
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import dotenv from 'dotenv';

import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ------------------- 🔐 Security Middleware -------------------
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import rateLimit from 'express-rate-limit';

// ------------------- 🧠 Custom Imports -------------------
import { errorHandler } from './src/middleware/errorMiddleware.js';
import logger from './src/utils/logger.js';
import authroute from './src/Routes/authroute.js';               // 🔐 Manual login/signup
// import googleAuthRoute from './src/Routes/googleAuthRoute.js';   // 🌐 Google OAuth
import userroute from './src/Routes/userroute.js';               // 👤 User profile/info
import adminRoutes from './src/Routes/adminroutes.js';
import teacherRoutes from './src/Routes/Teacherroute.js';

import courseController from './src/Routes/courseRoute.js';
import userRoutes from './src/Routes/usercourseRoutes.js';
import CourseEnrollment from './src/Routes/CourseEnrollment.js';
import progressRoutes from './src/Routes/progressRoutes.js';
import preferencesRoutes from './src/Routes/AIroute.js';
// User's courses and learning progress
// ------------------- ⚙️ Initial Setup -------------------
dotenv.config();
import './src/config/passport.js'; // ⬅️ Passport config must be loaded before usage

const app = express();

// ------------------- ☁️ Trust Proxy for Render -------------------
app.set('trust proxy', 1); // Required for rate-limit on Render/Heroku

// ------------------- ⚒️ Middleware Setup -------------------


app.use(cookieParser());


app.use(mongoSanitize());


app.use(xss());


app.use(express.json());


app.use(cors({
  origin: '*', // or use specific IP for production
  credentials: true,
}));


app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// ------------------- 📂 Static Files -------------------
app.use(express.static(path.join(__dirname, 'public')));

// ------------------- 📄 Serve Reset Password Page -------------------
app.get('/user/auth/reset-password/:token', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
});
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // set true if using HTTPS
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

// ------------------- 🚫 Rate Limiting -------------------


const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    message: 'Too many login attempts. Try again later.',
  }
});


app.use('/user/auth/login', loginLimiter);
app.get('/', (req, res) => {
  res.status(200).json({ status: "ok", message: "Vakya Sangham server is up and running!" });
});
// ------------------- 🔐 Passport Setup -------------------
app.use(passport.initialize());
app.use(passport.session());

// ------------------- 🧩 Route Mounting -------------------
// app.use('/user/auth/google', googleAuthRoute);
//   // 🌐 Google OAuth

app.use('/user/auth', authroute);               // 🔐 Manual auth (login/signup)
app.use('/user/info', userroute);               // 👤 Profile, user data, etc.
app.use('/api/admin', adminRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/progress', progressRoutes);
// ------------------- 🛑 Error Handling Middleware -------------------
//----------------courseController

app.use('/api', courseController); // Course related routes
// app.use('/api/reviews', reviewController); // Review related routess
app.use('/api/users', userRoutes);
app.use('/api/enrollment', CourseEnrollment); // User's courses and learning progress
app.use("/ai", preferencesRoutes);
app.use(errorHandler);

export default app;
