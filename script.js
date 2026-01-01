// BASE URL
const BASE_URL = window.location.hostname.includes("localhost")
    ? "http://localhost:3000"
    : "https://sandy-backend2-0.onrender.com";

// Firebase will be initialized after fetching config from backend
let auth = null;
let currentUserUid = null;
let currentUserName = null;
let currentUserPhoto = null;

// Theme Management
const themes = ['dark', 'light', 'professional'];
let currentThemeIndex = 0;

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    currentThemeIndex = themes.indexOf(savedTheme);
    applyTheme(savedTheme);
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

function cycleTheme() {
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    applyTheme(themes[currentThemeIndex]);
}

// Initialize Firebase securely
async function initializeFirebase() {
    try { 
        const response = await fetch(`${BASE_URL}/firebase-config`);
        const firebaseConfig = await response.json();
        
        if (!firebaseConfig.apiKey) {
            throw new Error('Firebase config not available');
        }
        
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        console.log('Firebase initialized securely');
        
        // Now initialize auth state listener
        setupAuthListener();
        
    } catch (error) {
        console.error('Failed to initialize Firebase:', error);
        showMessage('❌ Failed to initialize app. Please refresh.', 5000);
    }
}

// Setup auth state listener after Firebase is initialized
function setupAuthListener() {
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUserUid = user.uid;
            currentUserName = user.displayName || "User";
            currentUserPhoto = user.photoURL || null;
            
            toggleLoginState(true);
            loadData();
            
            // Update user display with profile
            updateUserDisplay(user);
            
            fetchBudget();
        } else {
            currentUserUid = null;
            currentUserName = null;
            currentUserPhoto = null;
            
            toggleLoginState(false);
            tableContainer.innerHTML = "<p class='text-muted'>Login to view your expenses</p>";
            analyticsContainer.style.display = "none";
            
            // Clear user display
            clearUserDisplay();
            
            clearBudgetUI();
        }
    });
}

// Update user display with profile picture and name
function updateUserDisplay(user) {
    const userNameDisplay = document.getElementById("userNameDisplay");
    const userProfilePic = document.getElementById("userProfilePic");
    const userInitials = document.getElementById("userInitials");
    
    if (user.displayName) {
        // Set display name
        userNameDisplay.textContent = user.displayName;
        
        // Get initials for fallback
        const initials = getInitials(user.displayName);
        userInitials.textContent = initials;
        
        // Set profile picture if available
        if (user.photoURL) {
            userProfilePic.src = user.photoURL;
            userProfilePic.style.display = "block";
            userInitials.style.display = "none";
        } else {
            userProfilePic.style.display = "none";
            userInitials.style.display = "flex";
        }
    } else {
        userNameDisplay.textContent = "User";
        userInitials.textContent = "U";
        userInitials.style.display = "flex";
        userProfilePic.style.display = "none";
    }
}

// Get initials from name
function getInitials(name) {
    return name
        .split(' ')
        .map(part => part.charAt(0))
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

// Clear user display on logout
function clearUserDisplay() {
    const userNameDisplay = document.getElementById("userNameDisplay");
    const userProfilePic = document.getElementById("userProfilePic");
    const userInitials = document.getElementById("userInitials");
    
    userNameDisplay.textContent = "";
    userProfilePic.src = "";
    userProfilePic.style.display = "none";
    userInitials.textContent = "";
    userInitials.style.display = "none";
}

// Elements
const loginBtn = document.getElementById("googleLoginBtn");
const logoutBtn = document.getElementById("googleLogoutBtn");
const loginView = document.getElementById("loginView");
const mainHeader = document.getElementById("mainHeader");
const expenseFormContainer = document.getElementById("expenseFormContainer");
const tableContainer = document.getElementById("tableContainer");
const msgBox = document.getElementById("msgBox");
const userNameDisplay = document.getElementById("userNameDisplay");
const userProfilePic = document.getElementById("userProfilePic");
const userInitials = document.getElementById("userInitials");
const analyticsContainer = document.getElementById("analyticsContainer");
const themeToggle = document.getElementById("themeToggle");
const historyLink = document.getElementById("historyLink");
const historyModal = document.getElementById("historyModal");
const closeHistory = document.getElementById("closeHistory");
const historyContent = document.getElementById("historyContent");

// Budget elements
const budgetCard = document.getElementById("budgetCard");
const budgetInput = document.getElementById("budgetInput");
const saveBudgetBtn = document.getElementById("saveBudgetBtn");
const resetBudgetBtn = document.getElementById("resetBudgetBtn");
const budgetProgressBar = document.getElementById("budgetProgressBar");
const budgetStatusText = document.getElementById("budgetStatusText");
const budgetAlerts = document.getElementById("budgetAlerts");
const analyticsBadge = document.getElementById("analyticsBadge");

let currentBudgetAmount = 0;

// About modal
const aboutLink = document.getElementById("aboutLink");
const aboutModal = document.getElementById("aboutModal");
const closeAbout = document.getElementById("closeAbout");

// Event Listeners
aboutLink && aboutLink.addEventListener("click", e => { e.preventDefault(); aboutModal.style.display = "block"; });
closeAbout && closeAbout.addEventListener("click", () => { aboutModal.style.display = "none"; });
historyLink && historyLink.addEventListener("click", e => { e.preventDefault(); showHistory(); });
closeHistory && closeHistory.addEventListener("click", () => { historyModal.style.display = "none"; });
themeToggle && themeToggle.addEventListener("click", cycleTheme);

window.addEventListener("click", e => { 
    if(e.target == aboutModal) aboutModal.style.display="none";
    if(e.target == historyModal) historyModal.style.display="none";
});

// Initialize theme and Firebase
initTheme();
initializeFirebase();

// Message function
function showMessage(msg, duration=2000) {
    msgBox.innerText = msg;
    msgBox.style.display = "block";
    setTimeout(()=> msgBox.style.display="none", duration);
}

// Toggle login state - FIXED FUNCTION
function toggleLoginState(isLoggedIn) {
    loginView.style.display = isLoggedIn ? "none" : "flex";
    mainHeader.classList.toggle('visible', isLoggedIn);
    expenseFormContainer.style.display = isLoggedIn ? "block" : "none";
    
    // FIX 1: Budget card should be visible only after login
    budgetCard.style.display = isLoggedIn ? "block" : "none";
    
    // FIX 2: Hide budget input and save button before login
    if (budgetInput) budgetInput.style.display = isLoggedIn ? "block" : "none";
    if (saveBudgetBtn) saveBudgetBtn.style.display = isLoggedIn ? "inline-block" : "none";
}

// Login button
loginBtn.addEventListener("click", async () => {
    if (!auth) {
        showMessage(" Please wait...", 2000);
        return;
    }
    
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        const result = await auth.signInWithPopup(provider);
        currentUserUid = result.user.uid;
        currentUserName = result.user.displayName || "User";
        currentUserPhoto = result.user.photoURL || null;
        
        toggleLoginState(true);
        loadData();
        
        // Update user display with profile
        updateUserDisplay(result.user);
        
        showMessage("✅ Logged in successfully",2000);
        fetchBudget();
    } catch(err){ 
        console.error(err); 
        showMessage("❌ Login failed",2000); 
    }
});

// Logout button
logoutBtn && logoutBtn.addEventListener("click", async () => {
    if (!auth) return;
    
    try {
        await auth.signOut();
        currentUserUid = null;
        currentUserName = null;
        currentUserPhoto = null;
        
        toggleLoginState(false);
        tableContainer.innerHTML = "<p class='text-muted'>Login to view your expenses</p>";
        analyticsContainer.style.display="none";
        
        // Clear user display
        clearUserDisplay();
        
        clearBudgetUI();
        showMessage("✅ Logged out successfully",2000);
    } catch(err){ 
        console.error(err); 
        showMessage("❌ Logout failed",2000); 
    }
});

// Typing animation
const headerText = "Track Your Expenses Smartly!";
const typingHeader = document.getElementById("typingHeader");
let headerIndex = 0;
function typeWriterHeader() {
    if(headerIndex < headerText.length){
        typingHeader.innerHTML += headerText.charAt(headerIndex);
        headerIndex++;
        setTimeout(typeWriterHeader,100);
    } else {
        setTimeout(()=>{ typingHeader.innerHTML=""; headerIndex=0; typeWriterHeader(); },2000);
    }
}
typeWriterHeader();

// Expense form handling
const form = document.getElementById("expenseForm");
const editId = document.getElementById("editId");
form && form.addEventListener("submit", async e=>{
    e.preventDefault();
    if(!currentUserUid) return;
    const data = {
        uid: currentUserUid,
        name: document.getElementById("name").value.trim(),
        amount: document.getElementById("amount").value.trim(),
        type: document.getElementById("type").value,
        description: document.getElementById("description").value.trim(),
        date: document.getElementById("date").value
    };
    try {
        const url = editId.value ? `${BASE_URL}/update/${editId.value}` : `${BASE_URL}/submit`;
        const method = editId.value ? "PUT" : "POST";
        // Add editor name when updating
        if (editId.value) {
            data.editorName = currentUserName;
        }
        const res = await fetch(url,{ method, headers:{ "Content-Type":"application/json" }, body:JSON.stringify(data)});
        const result = await res.json();
        showMessage(result.message);
        editId.value="";
        form.reset();
        await loadData();
        await fetchBudget();
    } catch(err){ console.error(err); showMessage("❌ Failed to submit/edit expense",2500);}
});

// Budget functions
async function saveBudgetToServer(amount){
    if(!currentUserUid) return;
    try {
        const res = await fetch(`${BASE_URL}/setBudget`, {
            method: "POST",
            headers: { "Content-Type":"application/json" },
            body: JSON.stringify({ uid: currentUserUid, amount: parseFloat(amount) || 0 })
        });
        const r = await res.json();
        if(res.ok) showMessage(r.message || "Budget saved");
        else showMessage(r.message || "Failed to save budget");
        await fetchBudget();
    } catch(err){ console.error(err); showMessage("❌ Failed to save budget",2000); }
}

async function fetchBudget(){
    if(!currentUserUid) return clearBudgetUI();
    try {
        const res = await fetch(`${BASE_URL}/getBudget?uid=${currentUserUid}`);
        if(!res.ok) return clearBudgetUI();
        const r = await res.json();
        if(!r || typeof r.amount === "undefined" || r.amount === 0){
            currentBudgetAmount = 0;
            clearBudgetUI();
            return;
        }
        currentBudgetAmount = parseFloat(r.amount) || 0;
        const expensesRes = await fetch(`${BASE_URL}/users?uid=${currentUserUid}`);
        const arr = await expensesRes.json();
        let totalAmount = 0;
        if(Array.isArray(arr)) arr.forEach(x=> totalAmount += parseFloat(x.amount)||0);
        updateBudgetUI(currentBudgetAmount, totalAmount);
        budgetInput && (budgetInput.value = currentBudgetAmount);
    } catch(err){ console.error(err); clearBudgetUI(); }
}

// FIXED: clearBudgetUI function
function clearBudgetUI(){
    if(budgetInput) {
        budgetInput.value = "";
        budgetInput.style.display = currentUserUid ? "block" : "none";
    }
    if(saveBudgetBtn) saveBudgetBtn.style.display = currentUserUid ? "inline-block" : "none";
    if(budgetProgressBar) budgetProgressBar.style.width = "0%";
    if(budgetProgressBar) budgetProgressBar.className = "progress-bar";
    if(budgetStatusText) budgetStatusText.innerText = "No budget set";
    if(budgetAlerts) budgetAlerts.innerHTML = "";
    currentBudgetAmount = 0;
    if(analyticsBadge) analyticsBadge.innerText = "";
}

// FIXED: updateBudgetUI function
function updateBudgetUI(budgetAmount, totalSpent){
    if(!budgetAmount || budgetAmount <= 0){
        clearBudgetUI();
        return;
    }
    
    // Ensure input and button are visible when logged in
    if (budgetInput) budgetInput.style.display = "block";
    if (saveBudgetBtn) saveBudgetBtn.style.display = "inline-block";
    
    const pct = (totalSpent / budgetAmount) * 100;
    const pctClamped = Math.min(Math.round(pct), 999);
    const widthPct = Math.min(pctClamped, 100);
    budgetProgressBar.style.width = widthPct + "%";
    budgetProgressBar.innerText = `${pctClamped}%`;
    budgetProgressBar.className = "progress-bar";
    if(pct >= 100){
        budgetProgressBar.classList.add("bg-danger");
    } else if(pct >= 80){
        budgetProgressBar.classList.add("bg-warning");
    } else {
        budgetProgressBar.classList.add("bg-success");
    }
    budgetStatusText.innerText = `Budget: ₹${budgetAmount.toFixed(2)}  —  Spent: ₹${totalSpent.toFixed(2)}`;
    budgetAlerts.innerHTML = "";
    analyticsBadge.innerText = "";
    if(pct >= 100){
        const over = (totalSpent - budgetAmount);
        budgetAlerts.innerHTML = `<div class="text-danger" style="font-weight:700;">🚨 Budget exceeded! You spent ₹${over.toFixed(2)} over the limit.</div>`;
        analyticsBadge.innerHTML = `<span class="badge badge-danger">🚨 Over budget: ₹${over.toFixed(2)}</span>`;
    } else if(pct >= 80){
        budgetAlerts.innerHTML = `<div class="text-warning" style="font-weight:700;">⚠️ You're at ${Math.round(pct)}% of your budget. Be careful!</div>`;
        analyticsBadge.innerHTML = `<span class="badge badge-warning">⚠️ Usage: ${Math.round(pct)}% of budget</span>`;
    } else {
        analyticsBadge.innerHTML = `<span class="badge badge-success">✅ Usage: ${Math.round(pct)}% of budget</span>`;
    }
}

// Save/Reset event listeners
saveBudgetBtn && saveBudgetBtn.addEventListener("click", async () => {
    const val = parseFloat(budgetInput.value);
    if(!val || val <= 0){ showMessage("Enter valid budget amount"); return; }
    await saveBudgetToServer(val);
});
resetBudgetBtn && resetBudgetBtn.addEventListener("click", async () => {
    if(!currentUserUid) return;
    if(!confirm("Reset/delete your budget?")) return;
    try {
        const res = await fetch(`${BASE_URL}/setBudget`, {
            method: "POST",
            headers: { "Content-Type":"application/json" },
            body: JSON.stringify({ uid: currentUserUid, amount: 0, reset: true })
        });
        const r = await res.json();
        if(res.ok) showMessage(r.message || "Budget reset");
        else showMessage(r.message || "Reset failed");
        clearBudgetUI();
    } catch(err){ console.error(err); showMessage("❌ Reset failed",2000); }
});

// Load data and render table - MOBILE FRIENDLY VERSION
async function loadData(){
    if(!currentUserUid) return;
    try{
        const res = await fetch(`${BASE_URL}/users?uid=${currentUserUid}`);
        if(!res.ok) throw new Error("Failed to fetch users");
        const users = await res.json();
        if(!Array.isArray(users) || users.length===0){
            tableContainer.innerHTML = "<p class='text-muted'>No expenses yet. Add your first expense above!</p>";
            analyticsContainer.style.display="none";
            const bRes = await fetch(`${BASE_URL}/getBudget?uid=${currentUserUid}`);
            if(bRes.ok){
                const b = await bRes.json();
                if(b && b.amount) updateBudgetUI(parseFloat(b.amount), 0);
            }
            return;
        }

        let totalAmount = 0;
        
        // Mobile-friendly table design
        if (window.innerWidth < 768) {
            // MOBILE VIEW - Card layout
            let mobileHtml = `<div class="table-container">
                <h5 class="text-center mb-3" style="color:var(--primary);">Your Expenses</h5>
                <div class="row g-3">`;
            
            users.forEach((u,i)=>{
                totalAmount += parseFloat(u.amount) || 0;
                
                mobileHtml += `
                    <div class="col-12">
                        <div class="card expense-card" style="background:var(--card-bg); border:1px solid var(--border);">
                            <div class="card-body">
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <h6 class="card-title mb-0" style="color:var(--primary);">${u.name}</h6>
                                    <span class="badge badge-info">${u.type}</span>
                                </div>
                                
                                <div class="expense-details">
                                    <div class="row small text-muted mb-2">
                                        <div class="col-6">
                                            <i class="fas fa-rupee-sign"></i> <strong>${parseFloat(u.amount).toFixed(2)}</strong>
                                        </div>
                                        <div class="col-6 text-end">
                                            <i class="fas fa-calendar"></i> ${u.date}
                                        </div>
                                    </div>
                                    
                                    <p class="small mb-3" style="color:var(--text-light);">
                                        <i class="fas fa-file-alt"></i> ${u.description}
                                    </p>
                                    
                                    <div class="d-flex justify-content-between">
                                        <button class="btn btn-warning btn-sm" onclick="editExpense('${u._id}')">
                                            <i class="fas fa-edit"></i> Edit
                                        </button>
                                        <button class="btn btn-info btn-sm" onclick="viewHistory('${u._id}')">
                                            <i class="fas fa-history"></i> 
                                        </button>
                                        <button class="btn btn-danger btn-sm" onclick="deleteExpense('${u._id}','${u.name}')">
                                            <i class="fas fa-trash"></i> 
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });

            mobileHtml += `
                </div>
                
                <!-- Total Summary -->
                <div class="card mt-3" style="background:var(--primary); color:white;">
                    <div class="card-body text-center">
                        <h6 class="mb-0">Total Expenses: ₹${totalAmount.toFixed(2)}</h6>
                    </div>
                </div>
            </div>`;
            
            tableContainer.innerHTML = mobileHtml;
            
        } else {
            // DESKTOP VIEW - Table layout
            let desktopHtml = `<div class="table-container">
                <div class="table-responsive">
                    <table class="table table-striped table-bordered">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Name</th>
                                <th>Amount</th>
                                <th>Type</th>
                                <th>Description</th>
                                <th>Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>`;

            users.forEach((u,i)=>{
                totalAmount += parseFloat(u.amount) || 0;
                const actionBtn = `
                    <div class="btn-group">
                        <button class="btn btn-warning btn-sm me-1" onclick="editExpense('${u._id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-info btn-sm me-1" onclick="viewHistory('${u._id}')" title="History">
                            <i class="fas fa-history"></i>
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteExpense('${u._id}','${u.name}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
                desktopHtml += `
                    <tr>
                        <td>${i+1}</td>
                        <td>${u.name}</td>
                        <td>₹${parseFloat(u.amount).toFixed(2)}</td>
                        <td><span class="badge badge-info">${u.type}</span></td>
                        <td>${u.description}</td>
                        <td>${u.date}</td>
                        <td>${actionBtn}</td>
                    </tr>
                `;
            });

            desktopHtml += `
                        </tbody>
                    </table>
                </div>
                
                <!-- Total Row -->
                <div class="mt-3 p-3 rounded" style="background:var(--primary); color:white;">
                    <div class="row">
                        <div class="col-6 text-end">
                            <strong>Total Expenses:</strong>
                        </div>
                        <div class="col-6">
                            <strong>₹${totalAmount.toFixed(2)}</strong>
                        </div>
                    </div>
                </div>
            </div>`;
            
            tableContainer.innerHTML = desktopHtml;
        }

        analyticsContainer.style.display="block";
        renderCharts(users);

        const bRes = await fetch(`${BASE_URL}/getBudget?uid=${currentUserUid}`);
        if(bRes.ok){
            const b = await bRes.json();
            if(b && b.amount && parseFloat(b.amount) > 0){
                updateBudgetUI(parseFloat(b.amount), totalAmount);
            } else clearBudgetUI();
        }
    } catch(err){ 
        console.error(err); 
        tableContainer.innerHTML=`
            <div class="alert alert-danger text-center">
                <i class="fas fa-exclamation-triangle"></i> Failed to load expenses. Please try again.
            </div>
        `; 
    }
}

// Edit and Delete handlers
window.editExpense = async function(id){
    try{
        const res = await fetch(`${BASE_URL}/user/${id}`);
        if(!res.ok) throw new Error("Failed to fetch user");
        const user = await res.json();
        document.getElementById("name").value=user.name;
        document.getElementById("amount").value=user.amount;
        document.getElementById("type").value=user.type;
        document.getElementById("description").value=user.description;
        document.getElementById("date").value=user.date;
        editId.value=id;
        showMessage("✏ Edit mode enabled - Make your changes and click Confirm",2000);
    } catch(err){ console.error(err); showMessage("❌ Failed to fetch expense for editing.",2500);}
}

window.deleteExpense = async function(id, name){
    if(!confirm(`Are you sure you want to delete expense "${name}"? This action cannot be undone.`)) return;
    try{
        const res = await fetch(`${BASE_URL}/delete/${id}`, { method: "DELETE" });
        const r = await res.json();
        if(res.ok){
            showMessage("✅ Expense deleted successfully");
            await loadData();
            await fetchBudget();
        } else {
            showMessage(r.message || "Delete failed",2000);
        }
    } catch(err){ console.error(err); showMessage("❌ Failed to delete expense",2000); }
}

// History functions
window.viewHistory = async function(expenseId) {
    try {
        const res = await fetch(`${BASE_URL}/user/${expenseId}`);
        if(!res.ok) throw new Error("Failed to fetch expense");
        const expense = await res.json();
        
        let historyHtml = `
            <h4>Edit History for: <strong>${expense.name}</strong></h4>
            <p><strong>Created:</strong> ${new Date(expense.createdAt).toLocaleString()} by You</p>
        `;
        
        if (expense.editHistory && expense.editHistory.length > 0) {
            historyHtml += `
                <table class="history-table">
                    <thead>
                        <tr>
                            <th>Editor</th>
                            <th>Date & Time</th>
                            <th>Changes Made</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            expense.editHistory.forEach(edit => {
                const changes = [];
                if (edit.before.name !== edit.after.name) {
                    changes.push(`Name: "${edit.before.name}" → "${edit.after.name}"`);
                }
                if (edit.before.amount !== edit.after.amount) {
                    changes.push(`Amount: ₹${edit.before.amount} → ₹${edit.after.amount}`);
                }
                if (edit.before.type !== edit.after.type) {
                    changes.push(`Type: ${edit.before.type} → ${edit.after.type}`);
                }
                if (edit.before.description !== edit.after.description) {
                    changes.push(`Description: "${edit.before.description}" → "${edit.after.description}"`);
                }
                if (edit.before.date !== edit.after.date) {
                    changes.push(`Date: ${edit.before.date} → ${edit.after.date}`);
                }
                
                historyHtml += `
                    <tr>
                        <td><strong>${edit.editorName}</strong></td>
                        <td>${new Date(edit.date).toLocaleString()}</td>
                        <td class="changes-list">
                            ${changes.map(change => `<div>${change}</div>`).join('')}
                        </td>
                    </tr>
                `;
            });
            
            historyHtml += `</tbody></table>`;
        } else {
            historyHtml += `<p class="text-muted">No edit history available for this expense.</p>`;
        }
        
        historyContent.innerHTML = historyHtml;
        historyModal.style.display = "block";
    } catch(err) {
        console.error(err);
        historyContent.innerHTML = "<p class='text-danger'>Failed to load history.</p>";
    }
}

async function showHistory() {
    try {
        const res = await fetch(`${BASE_URL}/users?uid=${currentUserUid}`);
        if(!res.ok) throw new Error("Failed to fetch expenses");
        const expenses = await res.json();
        
        let historyHtml = `<h4>Complete Edit History</h4>`;
        
        const expensesWithHistory = expenses.filter(exp => exp.editHistory && exp.editHistory.length > 0);
        
        if (expensesWithHistory.length === 0) {
            historyHtml += `<p class="text-muted">No edit history available yet.</p>`;
        } else {
            expensesWithHistory.forEach(expense => {
                historyHtml += `
                    <div style="margin-bottom: 20px; padding: 15px; background: rgba(0,0,0,0.05); border-radius: 8px;">
                        <h5>${expense.name} - ₹${parseFloat(expense.amount).toFixed(2)}</h5>
                        <p><small>Total edits: ${expense.editCount || 0}</small></p>
                        <button class="btn btn-sm btn-info" onclick="viewHistory('${expense._id}')">
                            View Detailed History
                        </button>
                    </div>
                `;
            });
        }
        
        historyContent.innerHTML = historyHtml;
        historyModal.style.display = "block";
    } catch(err) {
        console.error(err);
        historyContent.innerHTML = "<p class='text-danger'>Failed to load history.</p>";
    }
}

// FIXED Charts renderer - Proper colors for each category
function renderCharts(users){
    const dates = {};
    const types = {};

    let totalAmount = 0;
    users.forEach(u=>{
        const date = u.date || "Unknown";
        const amount = parseFloat(u.amount) || 0;
        totalAmount += amount;
        dates[date] = (dates[date]||0)+amount;
        types[u.type] = (types[u.type]||0)+amount;
    });

    const overAmount = currentBudgetAmount && totalAmount > currentBudgetAmount ? (totalAmount - currentBudgetAmount) : 0;
    
    // Add over budget as separate category if exists
    if (overAmount > 0) {
        types['Over Budget'] = overAmount;
    }

    const lineCtx = document.getElementById('lineChart').getContext('2d');
    if(window.lineChartInstance) window.lineChartInstance.destroy();
    window.lineChartInstance = new Chart(lineCtx, {
        type: 'line',
        data: {
            labels: Object.keys(dates),
            datasets: [{
                label: 'Daily Expenses',
                data: Object.values(dates),
                borderColor: 'var(--primary)',
                backgroundColor: 'rgba(0,188,212,0.2)',
                fill: true,
                tension: 0.3
            }]
        },
        options: { 
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                y: { 
                    beginAtZero:true,
                    ticks: { color: 'var(--text-light)' },
                    grid: { color: 'var(--border)' }
                },
                x: {
                    ticks: { color: 'var(--text-light)' },
                    grid: { color: 'var(--border)' }
                }
            },
            plugins: {
                legend: {
                    labels: { color: 'var(--text-light)' }
                }
            }
        }
    });

    const pieCtx = document.getElementById('pieChart').getContext('2d');
    if(window.pieChartInstance) window.pieChartInstance.destroy();

    const labels = Object.keys(types);
    const values = Object.values(types);

    // FIXED: Proper color assignment for each category
    const categoryColors = {
        'Card': '#00bcd4',      // Cyan
        'Cash': '#ff9800',      // Orange
        'Gpay/Paytm': '#8bc34a', // Green
        'Other': '#e91e63',     // Pink
        'Over Budget': '#ff3b30' // Red
    };

    // Assign colors - use predefined or generate unique ones
    const bgColors = labels.map(label => {
        return categoryColors[label] || 
               `hsl(${Math.random() * 360}, 70%, 60%)`; // Random color for unknown categories
    });

    window.pieChartInstance = new Chart(pieCtx, {
        type: 'pie',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: bgColors,
                borderColor: 'var(--card-bg)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: 'var(--text-light)',
                        padding: 15,
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label}: ₹${value.toFixed(2)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });

    // Update analytics badge
    if(overAmount > 0){
        analyticsBadge.innerHTML = `<span class="badge badge-danger">🚨 Over budget: ₹${overAmount.toFixed(2)}</span>`;
    } else if(currentBudgetAmount > 0) {
        const usagePercent = Math.round((totalAmount / currentBudgetAmount) * 100);
        analyticsBadge.innerHTML = `<span class="badge badge-success">✅ Usage: ${usagePercent}% of budget</span>`;
    } else {
        analyticsBadge.innerHTML = `<span class="badge badge-info">📊 Total: ₹${totalAmount.toFixed(2)}</span>`;
    }
}

// Start the typing animation
typeWriterHeader();

// PWA Service Worker
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js")
            .then(() => console.log("Service Worker registered"))
            .catch(err => console.error("SW failed", err));
    });
}
