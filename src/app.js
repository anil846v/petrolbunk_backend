const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');

require('dotenv').config();

const morgan   = require('morgan');
const logger   = require('./utils/logger');
const AppError = require('./utils/AppError');

const authRoutes            = require('./routes/authRoutes');
const userRoutes            = require('./routes/userRoutes');
const categoryRoutes        = require('./routes/categoryRoutes');
const vendorRoutes          = require('./routes/vendorRoutes');
const fuelTypeRoutes        = require('./routes/fuelTypeRoutes');
const fuelSaleRoutes        = require('./routes/fuelSaleRoutes');
const transactionRoutes     = require('./routes/transactionRoutes');
const loanRoutes            = require('./routes/loanRoutes');
const loanTransactionRoutes = require('./routes/loanTransactionRoutes');
const dashboardRoutes       = require('./routes/dashboardRoutes');
const reportRoutes          = require('./routes/reportRoutes');


const app = express();

/* =========================
   GLOBAL MIDDLEWARE
========================= */

// Request Logging (dev only)
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Security Headers
app.use(
    helmet({
        crossOriginResourcePolicy: {
            policy: 'cross-origin',
        },
    })
);

// CORS
const corsOptions = {
    origin:
        process.env.FRONTEND_URL ||
        'http://localhost:5173',
    credentials: true,
    methods: [
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'OPTIONS',
    ],
};

app.use(cors(corsOptions));

// Body Parser
app.use(
    express.json({
        limit: '10kb',
    })
);

// Cookie Parser
app.use(cookieParser());

app.use(
    express.urlencoded({
        extended: true,
        limit: '10kb',
    })
);

// Prevent HTTP Parameter Pollution
app.use(hpp());


/* =========================
   ROUTES
========================= */

app.use('/api/v1/auth',              authRoutes);
app.use('/api/v1/users',             userRoutes);
app.use('/api/v1/categories',        categoryRoutes);
app.use('/api/v1/vendors',           vendorRoutes);
app.use('/api/v1/fuel-types',        fuelTypeRoutes);
app.use('/api/v1/fuel-sales',        fuelSaleRoutes);
app.use('/api/v1/transactions',      transactionRoutes);
app.use('/api/v1/loans',             loanRoutes);
app.use('/api/v1/loan-transactions', loanTransactionRoutes);
app.use('/api/v1/dashboard',         dashboardRoutes);
app.use('/api/v1/reports',           reportRoutes);


/* =========================
   HEALTH CHECK
========================= */

app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message:
            'PetrolBunk API Running Successfully',
    });
});

/* =========================
   404 HANDLER
========================= */

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
    });
});

/* =========================
   GLOBAL ERROR HANDLER
========================= */

app.use((err, req, res, next) => {

    // Convert known Sequelize errors to clean, user-friendly messages
    if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ success: false, message: 'This record already exists (duplicate value)' });
    }
    if (err.name === 'SequelizeValidationError') {
        return res.status(400).json({ success: false, message: err.errors[0]?.message || 'Validation error' });
    }
    if (err.name === 'SequelizeForeignKeyConstraintError') {
        return res.status(400).json({ success: false, message: 'Referenced record does not exist' });
    }
    if (err.name === 'SequelizeConnectionError') {
        return res.status(503).json({ success: false, message: 'Database connection failed. Please try again.' });
    }

    const statusCode = err.statusCode || 500;

    // In development — send full error details for debugging
    if (process.env.NODE_ENV === 'development') {
        return res.status(statusCode).json({
            success: false,
            message: err.message,
            stack:   err.stack,
        });
    }

    // In production — only expose safe operational errors
    if (err.isOperational) {
        return res.status(statusCode).json({ success: false, message: err.message });
    }

    // Unknown/unexpected error — never leak internals
    logger.error('Unhandled error:', err);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
});

module.exports = app;