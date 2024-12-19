import cors from 'cors';
import cookieParser from 'cookie-parser';

// Initialize middleware
const corsMiddleware = cors({
    origin: [
        'https://zipytest.myshopify.com',
        'https://emailweb.vercel.app'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
});

// Wrap handler with CORS
const handler = async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST method
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { shop, cartToken } = req.body;
        
        if (!shop || !cartToken) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        // Call Firebase function
        const response = await fetch('https://us-central1-payment-m.cloudfunctions.net/storeCartSession', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shop, cartToken })
        });

        const data = await response.json();
        
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Credentials', true);
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
        
        // Log the response for debugging
        console.log('Firebase function response:', data);

        return res.status(200).json(data);

    } catch (error) {
        console.error('Failed to create session:', error);
        return res.status(500).json({ error: error.message });
    }
};

// Export the wrapped handler
export default async function(req, res) {
    await new Promise((resolve, reject) => {
        corsMiddleware(req, res, (result) => {
            if (result instanceof Error) {
                return reject(result);
            }
            return resolve(result);
        });
    });
    
    return handler(req, res);
} 