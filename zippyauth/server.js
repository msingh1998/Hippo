const express = require('express');
const admin = require('firebase-admin');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');

const app = express();

// Enable CORS
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

// Initialize Firebase Admin with environment variables
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Auth check endpoint
app.get('/auth/check', async (req, res) => {
    try {
        const sessionCookie = req.cookies.session;
        if (!sessionCookie) {
            return res.status(401).json({ error: 'No session cookie' });
        }

        const decodedClaim = await admin.auth().verifySessionCookie(sessionCookie);
        res.json({ uid: decodedClaim.uid });
    } catch (error) {
        res.status(401).json({ error: 'Invalid session' });
    }
});

// Create session endpoint
app.post('/auth/session', async (req, res) => {
  try {
    const { token } = req.body;
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    const sessionCookie = await admin.auth().createSessionCookie(token, {
      expiresIn: 60 * 60 * 24 * 5 * 1000 // 5 days
    });

    res.cookie('session', sessionCookie, {
      maxAge: 60 * 60 * 24 * 5 * 1000,
      httpOnly: true,
      secure: true,
      sameSite: 'none'
    });

    res.json({ success: true });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 