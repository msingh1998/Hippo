const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Create or update store settings
exports.updateStoreSettings = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      const { shop, cashbackPercentage } = req.body;
      
      // Validate inputs
      if (!shop || typeof cashbackPercentage !== 'number' || cashbackPercentage < 0 || cashbackPercentage > 100) {
        throw new Error('Invalid input parameters');
      }

      // Get current settings first
      const storeDoc = await db.collection('stores').doc(shop).get();
      const currentData = storeDoc.exists ? storeDoc.data() : {};
      
      // Prepare the update data
      const updateData = {
        settings: {
          cashbackPercentage: cashbackPercentage,
          approvalStatus: 'pending',
          isActive: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: currentData.settings?.createdAt || admin.firestore.FieldValue.serverTimestamp()
        },
        analytics: currentData.analytics || {
          totalOrders: 0,
          totalCashbackGiven: 0,
          totalRevertedCashback: 0,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }
      };

      // Update the document
      await db.collection('stores').doc(shop).set(updateData, { merge: true });

      res.json({ 
        success: true, 
        message: 'Store settings updated, pending approval',
        settings: updateData.settings
      });
    } catch (error) {
      console.error('Failed to update store settings:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

// Approve store settings
exports.approveStore = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      const { shop, approved } = req.body;
      
      // Update approval status
      await db.collection('stores').doc(shop).update({
        'settings.isActive': approved,
        'settings.approvalStatus': approved ? 'approved' : 'rejected',
        'settings.approvedAt': approved ? admin.firestore.FieldValue.serverTimestamp() : null
      });

      // Create audit log
      await db.collection('stores').doc(shop)
        .collection('audit_logs').add({
          action: approved ? 'store_approved' : 'store_rejected',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          previousStatus: 'pending'
        });

      res.json({ 
        success: true, 
        message: `Store ${approved ? 'approved' : 'rejected'} successfully` 
      });
    } catch (error) {
      console.error('Failed to approve store:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

exports.getStoreSettings = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      const shop = req.query.shop || req.body.shop;
      
      if (!shop) {
        throw new Error('Shop parameter is required');
      }

      const storeDoc = await db.collection('stores').doc(shop).get();
      const data = storeDoc.exists ? storeDoc.data() : {
        settings: {
          cashbackPercentage: 0,
          approvalStatus: 'pending',
          isActive: false
        }
      };

      console.log('Retrieved store settings:', data.settings);
      res.json({ settings: data.settings });
    } catch (error) {
      console.error('Failed to get store settings:', error);
      res.status(500).json({ error: error.message });
    }
  });
}); 