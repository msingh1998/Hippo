// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, setPersistence, browserLocalPersistence, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCZux3uvB-8kgWuacXF2cO0rYbdU9s4BmI",
    authDomain: "payment-m.firebaseapp.com",
    projectId: "payment-m",
    storageBucket: "payment-m.firebasestorage.app",
    messagingSenderId: "277856660272",
    appId: "1:277856660272:web:6a3f7be8e88996dc5836f5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Log initialization
console.log('Auth handler initializing...');

// Set persistence to LOCAL instead of NONE
try {
    await setPersistence(auth, browserLocalPersistence);
    console.log('Firebase persistence set to LOCAL');
} catch (error) {
    console.error('Error setting persistence:', error);
}

function cleanCartToken(token) {
  // First split by 'key=' if it exists
  const withoutKey = token.split('key=')[0].trim();
  // Then remove anything after and including '?' if it exists
  return withoutKey.split('?')[0].trim();
}

// Handle cart connection
async function handleCartConnection(user, params) {
    const shop = params.get('shop');
    const cartToken = params.get('cartToken');
    const returnUrl = params.get('returnUrl');

    if (!shop || !cartToken || !returnUrl) {
        console.error('Missing required parameters');
        return;
    }

    try {
        const cleanedToken = cleanCartToken(cartToken);
        
        await addDoc(collection(db, 'cart_sessions'), {
            shop,
            cartToken: cleanedToken,  // Store clean version
            userId: user.uid,
            createdAt: serverTimestamp(),
            status: 'active'
        });

        console.log('Cart session created successfully');
        window.location.href = `${returnUrl}?success=true`;
    } catch (error) {
        console.error('Failed to create cart session:', error);
        window.location.href = `${returnUrl}?error=true`;
    }
}

// Export the handleLogin function
export async function handleLogin() {
    console.log('Login attempt started...');
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');

    try {
        console.log('Attempting login...');
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        console.log('Login successful:', user.email);
        errorMessage.style.color = '#16a34a';
        errorMessage.textContent = 'Login successful!';

        // Handle cart connection with user object
        const params = new URLSearchParams(window.location.search);
        await handleCartConnection(user, params);

    } catch (error) {
        console.error('Login error:', error);
        errorMessage.style.color = '#dc2626';
        errorMessage.textContent = error.message;
    }
}

// Listen for auth state changes
onAuthStateChanged(auth, (user) => {
    console.log('Auth state changed:', user ? 'User signed in' : 'No user');
    if (user) {
        const params = new URLSearchParams(window.location.search);
        handleCartConnection(user, params).catch(console.error);
    }
});

// Make handleLogin available globally
window.handleLogin = handleLogin;
console.log('Auth handler initialized successfully');