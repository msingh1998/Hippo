import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Email submission handler
async function handleEmailSubmission(email) {
    try {
        // Check rate limiting
        const timeWindow = Timestamp.fromMillis(Date.now() - 3600000); // 1 hour window
        const emailQuery = query(
            collection(db, 'submissions'),
            where('email', '==', email),
            where('timestamp', '>', timeWindow)
        );
        
        const querySnapshot = await getDocs(emailQuery);
        if (!querySnapshot.empty) {
            throw new Error('Please try again later');
        }

        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('Please enter a valid email');
        }

        // Add to Firestore
        await addDoc(collection(db, 'submissions'), {
            email: email,
            timestamp: Timestamp.now()
        });

        return { success: true, message: 'Thank you for joining the waitlist!' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// Form submission listener
document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('.signup-form');
    const emailInput = document.querySelector('.email-input');
    const submitBtn = document.querySelector('.submit-btn');
    const messageElement = document.createElement('div');
    messageElement.className = 'submission-message';
    form.appendChild(messageElement);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
        
        const email = emailInput.value.trim();
        const result = await handleEmailSubmission(email);
        
        // Show message
        messageElement.textContent = result.message;
        messageElement.className = `submission-message ${result.success ? 'success' : 'error'}`;
        
        // Reset form if successful
        if (result.success) {
            emailInput.value = '';
        }
        
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.textContent = 'Join Waitlist';
    });
});

document.addEventListener('DOMContentLoaded', function() {
    const slides = document.querySelectorAll('.showcase-slide');
    let currentSlide = 0;
    
    function nextSlide() {
        slides[currentSlide].classList.remove('active');
        currentSlide = (currentSlide + 1) % slides.length;
        slides[currentSlide].classList.add('active');
    }
    
    // Show first slide
    slides[0].classList.add('active');
    
    // Change slide every 5 seconds
    setInterval(nextSlide, 5000);
});

function scrollToSignup() {
    const signupSection = document.getElementById('signup');
    if (signupSection) {
        signupSection.scrollIntoView({ 
            behavior: 'smooth',
            block: 'center'
        });
    }
}
