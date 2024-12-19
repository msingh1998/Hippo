const functions = require('firebase-functions');
const admin = require('firebase-admin');
const walletHandler = require('./wallet-handler');

const db = admin.firestore();

exports.processCashback = async (orderData, shop) => {
  try {
    // Get store settings
    const storeDoc = await db.collection('stores').doc(shop).get();
    const storeSettings = storeDoc.data()?.settings;

    // Check if store is approved for cashback
    if (!storeSettings?.isActive || storeSettings?.approvalStatus !== 'approved') {
      console.log('Store not approved for cashback:', shop);
      return null;
    }

    // Calculate cashback amount (excluding tax and shipping)
    const subtotal = parseFloat(orderData.subtotal_price || 0);
    const cashbackAmount = (subtotal * (storeSettings.cashbackPercentage / 100)).toFixed(2);

    // Create cashback transaction
    const transactionRef = await db.collection('stores').doc(shop)
      .collection('transactions').add({
        orderId: orderData.id,
        userId: orderData.customer?.id,
        amount: subtotal,
        cashbackAmount: parseFloat(cashbackAmount),
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        orderDetails: {
          number: orderData.number,
          currency: orderData.currency
        }
      });

    // Update user wallet
    if (orderData.customer?.id) {
      await walletHandler.updateUserWallet(orderData.customer.id, {
        cashbackAmount: parseFloat(cashbackAmount),
        orderId: orderData.id,
        shop
      });
    }

    // Update store analytics
    await db.collection('stores').doc(shop).update({
      'analytics.totalOrders': admin.firestore.FieldValue.increment(1),
      'analytics.totalCashbackGiven': admin.firestore.FieldValue.increment(parseFloat(cashbackAmount)),
      'analytics.lastUpdated': admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      transactionId: transactionRef.id,
      cashbackAmount: parseFloat(cashbackAmount),
      userId: orderData.customer?.id
    };
  } catch (error) {
    console.error('Error processing cashback:', error);
    throw error;
  }
}; 