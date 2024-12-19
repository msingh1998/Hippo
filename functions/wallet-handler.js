const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')();

const db = admin.firestore();

exports.updateUserWallet = async (userId, transactionData) => {
  const { cashbackAmount, orderId, shop } = transactionData;
  
  try {
    // Start a transaction to ensure atomic updates
    await db.runTransaction(async (transaction) => {
      // Get user wallet doc
      const walletRef = db.collection('users').doc(userId).collection('wallet').doc('balance');
      const walletDoc = await transaction.get(walletRef);

      // Create wallet if doesn't exist
      if (!walletDoc.exists) {
        transaction.set(walletRef, {
          totalBalance: cashbackAmount,
          pendingBalance: cashbackAmount,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        transaction.update(walletRef, {
          totalBalance: admin.firestore.FieldValue.increment(cashbackAmount),
          pendingBalance: admin.firestore.FieldValue.increment(cashbackAmount),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // Record transaction in user's history
      const historyRef = db.collection('users').doc(userId)
        .collection('transactions').doc();
      
      transaction.set(historyRef, {
        type: 'cashback',
        amount: cashbackAmount,
        orderId,
        shop,
        status: 'pending', // Will be updated to 'completed' after holding period
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        completesAt: admin.firestore.FieldValue.serverTimestamp(), // Add your holding period here
      });
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating user wallet:', error);
    throw error;
  }
};

// Function to complete pending cashback after holding period
exports.completePendingCashback = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      const now = admin.firestore.Timestamp.now();
      
      // Get all pending transactions that have passed holding period
      const pendingTxns = await db.collectionGroup('transactions')
        .where('status', '==', 'pending')
        .where('completesAt', '<=', now)
        .get();

    const batch = db.batch();

      for (const doc of pendingTxns.docs) {
        const data = doc.data();
        const userId = doc.ref.parent.parent.id;
        const walletRef = db.collection('users').doc(userId)
          .collection('wallet').doc('balance');

      // Update transaction status
      batch.update(doc.ref, {
        status: 'completed',
        completedAt: now
      });

      // Move amount from pending to available
      batch.update(walletRef, {
        pendingBalance: admin.firestore.FieldValue.increment(-data.amount),
        availableBalance: admin.firestore.FieldValue.increment(data.amount),
        lastUpdated: now
      });
    }

      await batch.commit();
      res.json({ success: true, processed: pendingTxns.size });
    } catch (error) {
      console.error('Error completing pending cashback:', error);
      res.status(500).json({ error: error.message });
    }
  });
}); 