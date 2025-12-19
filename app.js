// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDgeOmsWD36spVcXw9QVSbUs4nmx-iXGak",
    authDomain: "ptspro-31997.firebaseapp.com",
    projectId: "ptspro-31997",
    storageBucket: "ptspro-31997.firebasestorage.app",
    messagingSenderId: "191965542623",
    appId: "1:191965542623:web:b461ceedfc3a773267516a",
    measurementId: "G-6LNC29KRQF"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// DOM Elements
const loginView = document.getElementById('loginView');
const appView = document.getElementById('appView');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userNameDisplay = document.getElementById('userNameDisplay');
const expenseForm = document.getElementById('expenseForm');
const expensesList = document.getElementById('expensesList');
const totalAmountDisplay = document.getElementById('totalAmount');
const expenseCountDisplay = document.getElementById('expenseCount');
const refreshBtn = document.getElementById('refreshBtn');
const toast = document.getElementById('toast');
const typingText = document.getElementById('typingText');

// Global Variables
let currentUser = null;
let expenses = [];

// Typing Animation Text
const typingMessages = [
    "Track your expenses...",
    "Stay within budget...",
    "Save money...",
    "Plan your finances..."
];

let typingIndex = 0;
let charIndex = 0;

// Toast Notification Function
function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = 'toast';
    
    // Add type-based styling
    if (type === 'error') {
        toast.style.borderLeftColor = '#ef4444';
    } else if (type === 'warning') {
        toast.style.borderLeftColor = '#f59e0b';
    } else if (type === 'info') {
        toast.style.borderLeftColor = '#3b82f6';
    } else {
        toast.style.borderLeftColor = '#10b981';
    }
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Typing Animation
function typeWriter() {
    if (charIndex < typingMessages[typingIndex].length) {
        typingText.textContent += typingMessages[typingIndex].charAt(charIndex);
        charIndex++;
        setTimeout(typeWriter, 50);
    } else {
        setTimeout(() => {
            typingText.textContent = '';
            charIndex = 0;
            typingIndex = (typingIndex + 1) % typingMessages.length;
            typeWriter();
        }, 2000);
    }
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Show loading indicator
function showLoading() {
    expensesList.style.display = 'none';
    document.getElementById('loadingIndicator').style.display = 'block';
}

// Hide loading indicator
function hideLoading() {
    document.getElementById('loadingIndicator').style.display = 'none';
    expensesList.style.display = 'block';
}

// Load expenses from Firestore
async function loadExpenses() {
    if (!currentUser) return;
    
    showLoading();
    
    try {
        const expensesRef = db.collection('expenses')
            .where('userId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc');
        
        const snapshot = await expensesRef.get();
        expenses = [];
        let total = 0;
        
        expensesList.innerHTML = '';
        
        if (snapshot.empty) {
            expensesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-receipt"></i>
                    <h3>No expenses yet</h3>
                    <p>Add your first expense above to get started!</p>
                </div>
            `;
            totalAmountDisplay.textContent = '₹0.00';
            expenseCountDisplay.textContent = '0 items';
            hideLoading();
            return;
        }
        
        snapshot.forEach(doc => {
            const expense = {
                id: doc.id,
                ...doc.data()
            };
            expenses.push(expense);
            total += parseFloat(expense.amount) || 0;
            
            // Create expense card
            const expenseCard = document.createElement('div');
            expenseCard.className = 'expense-card';
            expenseCard.innerHTML = `
                <div class="expense-info">
                    <div class="expense-name">${expense.name}</div>
                    <div class="expense-details">
                        <span class="expense-detail">
                            <i class="fas fa-credit-card"></i>
                            <span class="expense-type">${expense.type}</span>
                        </span>
                        <span class="expense-detail">
                            <i class="fas fa-calendar"></i>
                            <span class="expense-date">${formatDate(expense.date)}</span>
                        </span>
                        ${expense.description ? `
                        <span class="expense-detail">
                            <i class="fas fa-file-alt"></i>
                            <span>${expense.description}</span>
                        </span>
                        ` : ''}
                    </div>
                </div>
                <div class="expense-amount">${formatCurrency(expense.amount)}</div>
            `;
            
            expensesList.appendChild(expenseCard);
        });
        
        totalAmountDisplay.textContent = formatCurrency(total);
        expenseCountDisplay.textContent = `${expenses.length} ${expenses.length === 1 ? 'item' : 'items'}`;
        hideLoading();
        
    } catch (error) {
        console.error('Error loading expenses:', error);
        showToast('Error loading expenses. Please try again.', 'error');
        hideLoading();
    }
}

// Save expense to Firestore
async function saveExpense(expenseData) {
    try {
        const expenseRef = db.collection('expenses').doc();
        await expenseRef.set({
            ...expenseData,
            userId: currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return expenseRef.id;
    } catch (error) {
        console.error('Error saving expense:', error);
        throw error;
    }
}

// Update UI based on auth state
function updateUI(user) {
    if (user) {
        // User is signed in
        currentUser = user;
        userNameDisplay.textContent = user.displayName || user.email;
        loginView.style.display = 'none';
        appView.style.display = 'flex';
        
        // Load user's expenses
        loadExpenses();
        
        // Start typing animation
        typeWriter();
        
        showToast(`Welcome back, ${user.displayName || 'User'}!`, 'success');
    } else {
        // User is signed out
        currentUser = null;
        userNameDisplay.textContent = '';
        loginView.style.display = 'flex';
        appView.style.display = 'none';
        expenses = [];
        expensesList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-receipt"></i>
                <h3>No expenses yet</h3>
                <p>Add your first expense above to get started!</p>
            </div>
        `;
        totalAmountDisplay.textContent = '₹0.00';
        expenseCountDisplay.textContent = '0 items';
    }
}

// Event Listeners
googleLoginBtn.addEventListener('click', async () => {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        showToast('Successfully logged in!', 'success');
    } catch (error) {
        console.error('Login error:', error);
        showToast('Login failed. Please try again.', 'error');
    }
});

logoutBtn.addEventListener('click', async () => {
    try {
        await auth.signOut();
        showToast('Successfully logged out!', 'success');
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Logout failed. Please try again.', 'error');
    }
});

expenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
        showToast('Please login first!', 'warning');
        return;
    }
    
    const name = document.getElementById('expenseName').value.trim();
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const type = document.getElementById('expenseType').value;
    const date = document.getElementById('expenseDate').value;
    const description = document.getElementById('expenseDescription').value.trim();
    
    if (!name || !amount || !type || !date) {
        showToast('Please fill in all required fields!', 'warning');
        return;
    }
    
    if (amount <= 0) {
        showToast('Amount must be greater than zero!', 'warning');
        return;
    }
    
    try {
        const expenseData = {
            name,
            amount,
            type,
            date,
            description: description || ''
        };
        
        const expenseId = await saveExpense(expenseData);
        
        // Reset form
        expenseForm.reset();
        document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
        
        // Reload expenses
        await loadExpenses();
        
        showToast('Expense saved successfully!', 'success');
        
    } catch (error) {
        console.error('Error saving expense:', error);
        showToast('Error saving expense. Please try again.', 'error');
    }
});

refreshBtn.addEventListener('click', () => {
    if (currentUser) {
        loadExpenses();
        showToast('Expenses refreshed!', 'info');
    }
});

// Set today's date as default
window.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('expenseDate').value = today;
    
    // Initialize Firebase Auth state listener
    auth.onAuthStateChanged((user) => {
        updateUI(user);
    });
});

// Handle online/offline status
window.addEventListener('online', () => {
    showToast('You are back online!', 'success');
    if (currentUser) {
        loadExpenses();
    }
});

window.addEventListener('offline', () => {
    showToast('You are offline. Some features may not work.', 'warning');
});

// Service Worker Registration for PWA (Optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(error => {
            console.log('Service Worker registration failed:', error);
        });
    });
}
