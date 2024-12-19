const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

const db = admin.firestore();

// Get user's wallet balance and recent transactions
exports.getWalletDetails = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        throw new Error('User ID is required');
      }

      // Get wallet balance
      const walletDoc = await db.collection('users').doc(userId)
        .collection('wallet').doc('balance').get();

      // Get recent transactions
      const recentTxns = await db.collection('users').doc(userId)
        .collection('transactions')
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();

      // Get store details for transactions
      const storePromises = recentTxns.docs.map(async (doc) => {
        const txnData = doc.data();
        const storeDoc = await db.collection('stores').doc(txnData.shop).get();
        return {
          ...txnData,
          storeName: storeDoc.data()?.settings?.storeName || txnData.shop
        };
      });

      const transactions = await Promise.all(storePromises);

      res.json({
        balance: walletDoc.data() || { totalBalance: 0, pendingBalance: 0, availableBalance: 0 },
        recentTransactions: transactions
      });
    } catch (error) {
      console.error('Failed to get wallet details:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

// Get store-specific rewards for user
exports.getStoreRewards = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      const { userId, shop } = req.body;

      // Get user's transactions for this store
      const txns = await db.collection('users').doc(userId)
        .collection('transactions')
        .where('shop', '==', shop)
        .orderBy('createdAt', 'desc')
        .get();

      // Get store details
      const storeDoc = await db.collection('stores').doc(shop).get();
      const storeData = storeDoc.data();

      const totalEarned = txns.docs.reduce((sum, doc) => {
        const txn = doc.data();
        return sum + (txn.status !== 'reverted' ? txn.amount : 0);
      }, 0);

      res.json({
        storeName: storeData?.settings?.storeName || shop,
        currentCashback: storeData?.settings?.cashbackPercentage || 0,
        totalEarned,
        transactions: txns.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      });
    } catch (error) {
      console.error('Failed to get store rewards:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

// Check balance before purchase
exports.checkAvailableRewards = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      const { userId, shop } = req.body;

      // Get wallet balance
      const walletDoc = await db.collection('users').doc(userId)
        .collection('wallet').doc('balance').get();
      
      // Get store settings
      const storeDoc = await db.collection('stores').doc(shop).get();
      
      res.json({
        availableBalance: walletDoc.data()?.availableBalance || 0,
        storeSettings: {
          cashbackPercentage: storeDoc.data()?.settings?.cashbackPercentage || 0,
          isActive: storeDoc.data()?.settings?.isActive || false
        }
      });
    } catch (error) {
      console.error('Failed to check rewards:', error);
      res.status(500).json({ error: error.message });
    }
  });
}); 