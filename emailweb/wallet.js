// Initialize Firebase (use your config)
const firebaseConfig = {
    apiKey: "AIzaSyCZux3uvB-8kgWuacXF2cO0rYbdU9s4BmI",
    authDomain: "payment-m.firebaseapp.com",
    projectId: "payment-m",
    storageBucket: "payment-m.firebasestorage.app",
    messagingSenderId: "277856660272",
    appId: "1:277856660272:web:6a3f7be8e88996dc5836f5"
};

firebase.initializeApp(firebaseConfig);

class HippoWallet {
    constructor() {
        this.userId = new URLSearchParams(window.location.search).get('userId');
        this.initialize();
    }

    async initialize() {
        if (!this.userId) {
            console.error('No user ID provided');
            return;
        }

        await this.loadWalletDetails();
        await this.loadStoreRewards();
    }

    async loadWalletDetails() {
        try {
            const response = await fetch('https://us-central1-payment-m.cloudfunctions.net/getWalletDetails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: this.userId })
            });

            const data = await response.json();
            this.updateBalanceDisplay(data.balance);
            this.updateTransactionsList(data.recentTransactions);
        } catch (error) {
            console.error('Error loading wallet:', error);
        }
    }

    async loadStoreRewards() {
        try {
            const response = await fetch('https://us-central1-payment-m.cloudfunctions.net/getStoreRewards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: this.userId })
            });

            const data = await response.json();
            this.updateStoresList(data);
        } catch (error) {
            console.error('Error loading store rewards:', error);
        }
    }

    updateBalanceDisplay(balance) {
        document.getElementById('availableBalance').textContent = 
            `$${(balance.availableBalance || 0).toFixed(2)}`;
        document.getElementById('pendingBalance').textContent = 
            `$${(balance.pendingBalance || 0).toFixed(2)}`;
    }

    updateTransactionsList(transactions) {
        const list = document.getElementById('transactionsList');
        list.innerHTML = transactions.map(txn => `
            <div class="transaction-item ${txn.status}">
                <div>
                    <strong>${txn.storeName}</strong>
                    <div>${new Date(txn.createdAt).toLocaleDateString()}</div>
                </div>
                <div class="amount">$${txn.amount.toFixed(2)}</div>
            </div>
        `).join('');
    }

    updateStoresList(stores) {
        const list = document.getElementById('storesList');
        list.innerHTML = stores.map(store => `
            <div class="store-item">
                <div>
                    <strong>${store.storeName}</strong>
                    <div>${store.currentCashback}% cashback</div>
                </div>
                <div>Total earned: $${store.totalEarned.toFixed(2)}</div>
            </div>
        `).join('');
    }
}

// Initialize wallet when page loads
document.addEventListener('DOMContentLoaded', () => {
    new HippoWallet();
}); 