import { admin } from '../../firebase-admin';

function cleanCartToken(token) {
  // First split by 'key=' if it exists
  const withoutKey = token.split('key=')[0].trim();
  // Then remove anything after and including '?' if it exists
  return withoutKey.split('?')[0].trim();
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).end();
    }

    try {
        const sessionCookie = req.cookies.session;
        if (!sessionCookie) {
            return res.status(401).json({ error: 'No session cookie' });
        }

        // Verify session
        const decodedClaim = await admin.auth().verifySessionCookie(sessionCookie);
        const { shop, cartToken } = req.body;

        // Clean the token before storing
        const cleanedToken = cleanCartToken(cartToken);

        // Create cart session
        const cartSession = await admin.firestore().collection('cart_sessions').add({
            shop,
            cartToken: cleanedToken,  // Store clean version
            userId: decodedClaim.uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'active'
        });

        res.json({ success: true, sessionId: cartSession.id });
    } catch (error) {
        console.error('Failed to connect cart:', error);
        res.status(500).json({ error: error.message });
    }
} 