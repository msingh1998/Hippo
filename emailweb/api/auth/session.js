import { admin } from '../../firebase-admin';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).end();
    }

    const { token } = req.body;
    
    try {
        // Create session cookie
        const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
        const sessionCookie = await admin.auth().createSessionCookie(token, { expiresIn });
        
        // Set cookie options
        const options = {
            maxAge: expiresIn,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            path: '/'
        };

        // Set the cookie
        res.setHeader('Set-Cookie', `session=${sessionCookie}; ${Object.entries(options).map(([key, value]) => `${key}=${value}`).join('; ')}`);
        
        res.json({ status: 'success' });
    } catch (error) {
        res.status(401).json({ error: 'Unauthorized request' });
    }
} 