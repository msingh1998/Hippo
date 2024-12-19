const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({
  origin: [
    'https://zipytest.myshopify.com',
    'https://emailweb.vercel.app'
  ],
  credentials: true
});

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Import all handlers
const storeManagement = require('./store-management');
const cashbackHandler = require('./cashback-handler');
const walletApi = require('./wallet-api');
const walletHandler = require('./wallet-handler');

// Export store management functions
exports.updateStoreSettings = storeManagement.updateStoreSettings;
exports.approveStore = storeManagement.approveStore;
exports.getStoreSettings = storeManagement.getStoreSettings;

// Export wallet API functions
exports.getWalletDetails = walletApi.getWalletDetails;
exports.getStoreRewards = walletApi.getStoreRewards;
exports.checkAvailableRewards = walletApi.checkAvailableRewards;

// Export cashback handler
exports.processCashback = cashbackHandler.processCashback;

// Export wallet handler functions
exports.updateUserWallet = walletHandler.updateUserWallet;
exports.completePendingCashback = walletHandler.completePendingCashback;

// Keep existing test endpoints
exports.testHttp = functions.https.onRequest((req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  cors(req, res, () => {
    console.log('TestHttp function called');
    res.json({ message: 'Test successful!' });
  });
});

exports.createSession = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    try {
      const { shop, deviceFingerprint } = req.body;
      
      const sessionRef = await db.collection('sessions').doc();
      await sessionRef.set({
        shop,
        deviceFingerprint,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        isActive: false
      });

      const qrData = JSON.stringify({
        sessionId: sessionRef.id,
        deviceInfo: 'web-browser',
        userId: 'guest',
        timestamp: Date.now(),
        deviceFingerprint: deviceFingerprint,
        browserInfo: {
          userAgent: req.headers['user-agent'] || '',
          platform: 'web',
          vendor: 'unknown'
        }
      });

      res.json({
        success: true,
        sessionId: sessionRef.id,
        qrData: qrData
      });
    } catch (error) {
      console.error('Error creating session:', error);
      res.status(500).json({ error: 'Failed to create session' });
    }
  });
});

exports.checkSession = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const sessionDoc = await db.collection('sessions').doc(sessionId).get();
    
    if (!sessionDoc.exists) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const sessionData = sessionDoc.data();
    res.json({ status: sessionData.status });
    
  } catch (error) {
    console.error('Error checking session:', error);
    res.status(500).json({ error: 'Failed to check session' });
  }
});

exports.updateSession = functions.https.onRequest(async (req, res) => {
  try {
    const { sessionId, action } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    const sessionRef = db.collection('sessions').doc(sessionId);
    const session = await sessionRef.get();

    if (!session.exists) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Keep existing fields but add status based on action
    const updates = {};
    
    if (action === 'scan') {
      updates.status = 'scanned';
    } else if (action === 'connect') {
      updates.status = 'connected';
    }

    // Merge with existing data (keeps isActive, userId, etc.)
    await sessionRef.update(updates);

    res.json({ success: true });

  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

exports.handleOrderPaid = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      const { shop, orderId, cartToken, orderDetails } = req.body;

      // First create the main receipt (existing functionality)
      const receiptRef = await db.collection('receipts').add({
        shop,
        orderId,
        cartToken,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'completed',
        orderDetails
      });

      // Look up the cart session to get userId
      const cartSessionSnapshot = await db.collection('cart_sessions')
        .where('cartToken', '==', cartToken)
        .where('shop', '==', shop)
        .limit(1)
        .get();

      if (!cartSessionSnapshot.empty) {
        const cartSession = cartSessionSnapshot.docs[0].data();
        if (cartSession.userId) {
          // Create mirror entry in user_receipts
          await db.collection('user_receipts')
            .doc(cartSession.userId)
            .collection('receipts')
            .doc(receiptRef.id)  // Use same ID as main receipt
            .set({
              receiptId: receiptRef.id,
              orderId,
              cartToken,
              shop,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              orderDetails
            });

          // Create order index entry
          await db.collection('order_index')
            .doc(orderId)
            .set({
              uid: cartSession.userId,
              cartToken,
              receiptId: receiptRef.id,
              shop
            });
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to handle order:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

exports.getShopSession = functions.https.onRequest(async (req, res) => {
  try {
    const shop = req.query.shop;
    const orderId = req.query.orderId;
    const cartToken = req.query.cartToken;
    
    if (!shop) {
      throw new Error('Shop parameter is required');
    }

    console.log('🔍 Looking up sessions for:', { shop, orderId, cartToken });

    // First try to find by cart token
    let sessionsSnapshot = await admin.firestore()
      .collection('cart_sessions')
      .where('shop', '==', shop)
      .where('cartToken', '==', cartToken)
      .limit(1)
      .get();

    // If not found, try to find by deviceId from active sessions
    if (sessionsSnapshot.empty) {
      sessionsSnapshot = await admin.firestore()
        .collection('sessions')
        .where('shop', '==', shop)
        .where('isActive', '==', true)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
    }

    if (sessionsSnapshot.empty) {
      console.log('❌ No session found for shop:', shop);
      return res.json({ userId: null });
    }

    const sessionData = sessionsSnapshot.docs[0].data();
    console.log('✅ Found session:', sessionData);
    
    return res.json({ 
      userId: sessionData.userId || null,
      deviceId: sessionData.deviceId || null,
      cartToken: sessionData.cartToken || null
    });

  } catch (error) {
    console.error('❌ Session lookup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add new function to connect user to session
exports.connectUserToSession = functions.https.onRequest(async (req, res) => {
  try {
    const { sessionId, userId } = req.body;
    
    if (!sessionId || !userId) {
      throw new Error('Session ID and User ID are required');
    }

    console.log('🔗 Connecting user:', userId, 'to session:', sessionId);

    // Update the existing session with userId
    await admin.firestore()
      .collection('sessions')
      .doc(sessionId)
      .update({
        userId: userId,
        isActive: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

    console.log('✅ Session updated with userId');
    res.json({ success: true });

  } catch (error) {
    console.error('❌ Connection error:', error);
    res.status(500).json({ error: error.message });
  }
});

exports.checkDevice = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    try {
      const { deviceFingerprint } = req.body;
      
      // Check for existing sessions with this fingerprint
      const sessions = await db.collection('sessions')
        .where('deviceFingerprint', '==', deviceFingerprint)
        .where('isActive', '==', true)
        .get();

      return res.json({
        exists: !sessions.empty,
        isActive: !sessions.empty
      });
    } catch (error) {
      console.error('Device check error:', error);
      return res.status(500).json({ error: 'Failed to check device' });
    }
  });
});

exports.storeCartData = functions.https.onRequest(async (req, res) => {
  try {
    const { shop, cartToken, deviceId, authDeviceId } = req.body;

    await db.collection('cart_sessions').add({
      shop,
      cartToken,
      deviceId,
      authDeviceId,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to store cart data:', error);
    res.status(500).json({ error: error.message });
  }
});

exports.createPendingReceipt = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    try {
      console.log('📝 Creating pending receipt, payload:', req.body);
      const { shop, cartToken, deviceFingerprint, cartDetails } = req.body;

      if (!shop || !cartToken || !deviceFingerprint) {
        console.error('❌ Missing required fields:', { shop, cartToken, deviceFingerprint });
        return res.status(400).json({ 
          error: 'Missing required fields'
        });
      }

      // Verify device is active first
      const deviceSession = await db.collection('sessions')
        .where('deviceFingerprint', '==', deviceFingerprint)
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (deviceSession.empty) {
        console.error('❌ Device not active:', deviceFingerprint);
        return res.status(403).json({ error: 'Device not active' });
      }

      console.log('✅ Device verified, creating receipt...');
      
      // Create receipt document
      const receiptRef = await db.collection('receipts').add({
        shop,
        cartToken,
        deviceFingerprint,
        status: 'pending',
        cartDetails,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        sessionId: deviceSession.docs[0].id
      });

      console.log('✅ Receipt created successfully:', receiptRef.id);

      return res.json({
        success: true,
        receiptId: receiptRef.id
      });

    } catch (error) {
      console.error('❌ Error creating receipt:', error);
      return res.status(500).json({
        error: 'Failed to create receipt',
        details: error.message
      });
    }
  });
});

exports.storeCartSession = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    // Add CORS headers
    res.set('Access-Control-Allow-Origin', req.headers.origin);
    res.set('Access-Control-Allow-Credentials', 'true');
    
    try {
      const { shop, cartToken } = req.body;
      console.log('[Debug] Received request:', { shop, cartToken });

      const sessionRef = await db.collection('cart_sessions').add({
        shop,
        cartToken,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'pending'
      });

      res.json({ 
        success: true,
        sessionId: sessionRef.id
      });
    } catch (error) {
      console.error('Failed to store cart:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

exports.linkCartToUser = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      const { shop, cartToken } = req.body;
      const sessionCookie = req.cookies.session;

      if (!sessionCookie) {
        throw new Error('No session cookie found');
      }

      // Verify session
      const decodedClaim = await admin.auth().verifySessionCookie(sessionCookie);
      
      // Update cart session with user ID
      await db.collection('cart_sessions')
        .where('cartToken', '==', cartToken)
        .where('shop', '==', shop)
        .get()
        .then(snapshot => {
          if (!snapshot.empty) {
            snapshot.docs[0].ref.update({
              userId: decodedClaim.uid,
              status: 'active'
            });
          }
        });

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to link cart:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

exports.handleCheckoutCreate = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    console.log('📥 Complete Request:', {
      method: req.method,
      headers: req.headers,
      body: req.body,
      query: req.query
    });
    
    try {
      const { shop, cartToken, checkoutToken, raw } = req.body;

      console.log('🔑 Extracted Fields:', {
        shop,
        cartToken,
        checkoutToken,
        rawData: raw
      });

      if (!shop || !cartToken || !checkoutToken) {
        console.error('Missing required fields:', { shop, cartToken, checkoutToken });
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // First find the cart session to get userId
      const cartSessionSnapshot = await db.collection('cart_sessions')
        .where('cartToken', '==', cartToken)
        .where('shop', '==', shop)
        .where('status', '==', 'active')
        .limit(1)
        .get();

      if (cartSessionSnapshot.empty) {
        console.error('No matching cart session found');
        return res.status(404).json({ error: 'No matching cart session found' });
      }

      const cartSession = cartSessionSnapshot.docs[0].data();
      const userId = cartSession.userId;

      // Create checkout record
      const checkoutRef = await db.collection('checkouts').add({
        shop,
        cartToken,
        checkoutToken,
        userId,  // Include userId from cart session
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'pending'
      });

      console.log('✅ Checkout record created:', checkoutRef.id);
      res.json({ 
        success: true, 
        checkoutId: checkoutRef.id 
      });
    } catch (error) {
      console.error('❌ Failed to handle checkout:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

// Add to existing exports
exports.getWalletDetails = walletApi.getWalletDetails;
exports.getStoreRewards = walletApi.getStoreRewards;
exports.checkAvailableRewards = walletApi.checkAvailableRewards;

// Add these exports
exports.walletApi = {
  getWalletDetails: walletApi.getWalletDetails,
  getStoreRewards: walletApi.getStoreRewards,
  checkAvailableRewards: walletApi.checkAvailableRewards
};

exports.cashbackHandler = {
  processCashback: cashbackHandler.processCashback
};

exports.walletHandler = {
  updateUserWallet: walletHandler.updateUserWallet,
  completePendingCashback: walletHandler.completePendingCashback
};
