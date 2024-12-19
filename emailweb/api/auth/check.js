import { admin } from '../../firebase-admin';

export default async function handler(req, res) {
    try {
        const sessionCookie = req.cookies.session;
        if (!sessionCookie) {
            return res.status(401).json({ error: 'No session cookie' });
        }

        // Verify session
        await admin.auth().verifySessionCookie(sessionCookie);
        res.json({ authenticated: true });
    } catch (error) {
        res.status(401).json({ error: 'Invalid session' });
    }
} 