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

// Typing Animation
let typingIndex = 0;
let charIndex = 0;
const typingMessages = [
    "Track your expenses...",
    "Stay within budget...",
    "Save money...",
    "Plan your finances..."
];

function typeWriter() {
    if (charIndex < typingMessages[typingIndex].length) {
        typingText.textContent += typingMessages[typingIndex].charAt(charIndex);
        charIndex++;
        setTimeout(typeWriter, 100);
    } else {
        setTimeout(() => {
            typingText.textContent = '';
            charIndex = 0;
            typingIndex = (typingIndex + 1) % typingMessages.length;
            typeWriter();
        }, 2000);
    }
}

// Toast Notification
function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = 'toast';
    
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

// Format currency
function formatCurrency(amount) {
    return '₹' + parseFloat(amount).toFixed(2);
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

// Load expenses from Firestore
async function loadExpenses() {
    if (!currentUser) {
        console.log("No user logged in");
        return;
    }
    
    // Show loading
    expensesList.innerHTML = '';
    document.getElementById('loadingIndicator').style.display = 'block';
    
    try {
        // Try different collection names
        const collections = ['expenses', 'Expenses', 'expense', 'Expense', 'userExpenses'];
        let dataFound = false;
        
        for (const collection of collections) {
            try {
                console.log(`Trying collection: ${collection}`);
                
                const snapshot = await db.collection(collection)
                    .where('userId', '==', currentUser.uid)
                    .get();
                
                if (!snapshot.empty) {
                    console.log(`Found data in ${collection}`);
                    dataFound = true;
                    
                    let total = 0;
                    const expensesArray = [];
                    
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        data.id = doc.id;
                        expensesArray.push(data);
                        total += parseFloat(data.amount) || 0;
                    });
                    
                    // Sort by date (newest first)
                    expensesArray.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
                    
                    // Clear and display
                    expensesList.innerHTML = '';
                    
                    if (expensesArray.length === 0) {
                        expensesList.innerHTML = `
                            <div class="empty-state">
                                <i class="fas fa-receipt"></i>
                                <h3>No expenses yet</h3>
                                <p>Add your first expense above to get started!</p>
                            </div>
                        `;
                    } else {
                        expensesArray.forEach(expense => {
                            const expenseCard = document.createElement('div');
                            expenseCard.className = 'expense-card';
                            expenseCard.innerHTML = `
                                <div class="expense-info">
                                    <div class="expense-name">${expense.name || 'Unnamed Expense'}</div>
                                    <div class="expense-details">
                                        <span class="expense-detail">
                                            <i class="fas fa-credit-card"></i>
                                            <span class="expense-type">${expense.type || 'Cash'}</span>
                                        </span>
                                        <span class="expense-detail">
                                            <i class="fas fa-calendar"></i>
                                            <span class="expense-date">${expense.date ? formatDate(expense.date) : 'No date'}</span>
                                        </span>
                                        ${expense.description ? `
                                        <span class="expense-detail">
                                            <i class="fas fa-file-alt"></i>
                                            <span>${expense.description.substring(0, 30)}${expense.description.length > 30 ? '...' : ''}</span>
                                        </span>
                                        ` : ''}
                                    </div>
                                </div>
                                <div class="expense-amount">${formatCurrency(expense.amount || 0)}</div>
                            `;
                            expensesList.appendChild(expenseCard);
                        });
                    }
                    
                    totalAmountDisplay.textContent = formatCurrency(total);
                    expenseCountDisplay.textContent = `${expensesArray.length} ${expensesArray.length === 1 ? 'item' : 'items'}`;
                    
                    break; // Stop trying other collections
                }
            } catch (err) {
                console.log(`Error with collection ${collection}:`, err.message);
                continue; // Try next collection
            }
        }
        
        if (!dataFound) {
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
        
    } catch (error) {
        console.error('Error loading expenses:', error);
        expensesList.innerHTML = `
            <div class="empty-state error">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error loading expenses</h3>
                <p>${error.message}</p>
            </div>
        `;
        showToast('Error loading expenses', 'error');
    } finally {
        document.getElementById('loadingIndicator').style.display = 'none';
    }
}

// Save expense to Firestore
async function saveExpense(expenseData) {
    try {
        // Always use 'expenses' collection
        const expenseRef = await db.collection('expenses').add({
            ...expenseData,
            userId: currentUser.uid,
            createdAt: new Date().toISOString()
        });
        
        console.log('Expense saved with ID:', expenseRef.id);
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
        
        // Start typing animation
        typeWriter();
        
        // Load expenses
        setTimeout(() => {
            loadExpenses();
        }, 500);
        
        showToast(`Welcome back, ${user.displayName || 'User'}!`, 'success');
    } else {
        // User is signed out
        currentUser = null;
        userNameDisplay.textContent = '';
        loginView.style.display = 'flex';
        appView.style.display = 'none';
    }
}

// Event Listeners
googleLoginBtn.addEventListener('click', async () => {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        console.log('Login successful:', result.user.email);
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
        
        await saveExpense(expenseData);
        
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
        showToast('Refreshing expenses...', 'info');
    }
});

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('expenseDate').value = today;
    
    // Initialize Firebase Auth state listener
    auth.onAuthStateChanged((user) => {
        updateUI(user);
    });
    
    console.log('Expense Tracker App Initialized!');
});
