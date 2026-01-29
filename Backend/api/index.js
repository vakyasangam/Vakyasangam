import app from '../app.js';
import connectdb from '../src/config/db.js';

// Cache the database connection
let isConnected = false;

export default async function handler(req, res) {
    try {
        if (!isConnected) {
            console.log("Connecting to DB...");
            await connectdb();
            isConnected = true;
            console.log("DB Connected");
        }

        // Debug Vercel Path (optional, helps trace issues)
        if (req.url === '/debug-vercel') {
            return res.json({
                message: 'Vercel Debug',
                cwd: process.cwd(),
                dirname: __dirname,
                env: {
                    MONGO_URI_SET: !!process.env.MONGO_URI,
                    MAIL_USER_SET: !!process.env.MAIL_USER
                }
            });
        }

        // Forward to Express
        return app(req, res);
    } catch (error) {
        console.error("Vercel Function Error:", error);
        res.status(500).json({
            error: "Serverless Function Crash",
            details: error.message,
            stack: error.stack
        });
    }
}
