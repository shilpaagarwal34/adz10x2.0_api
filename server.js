require('module-alias/register');
require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const sequelize = require('@config/db');
const userRoutes = require('@routes/api');

const app = express();

const createDefaultAdminUser = require('@seeders/createAdminUser');


//  CORS Middleware (must come first)
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition'],
}));

//  Manual CORS headers for extra safety
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    next();
});

//  Handle preflight OPTIONS requests
app.options('*', (req, res) => {
    res.sendStatus(200);
});

//  Body parser
app.use(bodyParser.json());

//  Serve static files
app.use('/uploads', express.static('uploads')); // Uploaded files (images, docs, etc.)
app.use('/invoices', express.static(path.join(__dirname, 'invoices'))); // Invoices folder
app.use('/assets', express.static(path.join(__dirname, 'assets')));
//  API routes
app.use('/api', userRoutes);

//  File download from /invoices
app.get('/download-inv/:filename', (req, res) => {
    const fileName = req.params.filename;
    const filePath = path.join(__dirname, 'invoices', fileName);

    if (fs.existsSync(filePath)) {
        res.download(filePath); // Automatically sets Content-Disposition
    } else {
        res.status(404).send('Invoice not found');
    }
});

//  File download from /uploads
app.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'uploads', filename);

    if (fs.existsSync(filePath)) {
        res.download(filePath); // Automatically sets Content-Disposition
    } else {
        res.status(404).send('File not found');
    }
});

//  Host and Port
const HOST = process.env.HOST || '192.168.0.239';
const PORT = process.env.PORT || 3000;

//  Sync database and start server
sequelize.sync({ alter: true })
// sequelize.sync()
    .then(async () => {
        console.log(' Database connected and synced');

        //  Create Default Admin User
         await createDefaultAdminUser();

        app.listen(PORT, HOST, () => {
            console.log(` Server running at http://${HOST}:${PORT}/`);
        });
    })
    .catch((err) => {
        console.error(' Database connection failed:', err);
    });

//  Export for testing (optional)
module.exports = app;