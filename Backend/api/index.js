import app from '../app.js';
import connectdb from '../src/config/db.js';

// Cache the database connection
let isConnected = false;

export default async function handler(req, res) {
    if (!isConnected) {
        await connectdb();
        isConnected = true;
    }

    // Debug Vercel Path (optional, helps trace issues)
    if (req.url === '/debug-vercel') {
        return res.json({
            message: 'Vercel Debug',
            cwd: process.cwd(),
            dirname: __dirname
        });
    }

    // Forward to Express
    app(req, res);
}
