// ✅ Vercel deploymentக்கு automatic BASE_URL
const BASE_URL = window.location.origin;

// ... (மேலே உள்ள மற்ற code அப்படியே இருக்கும்) ...

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
        const url = editId.value ? `${BASE_URL}/api/update/${editId.value}` : `${BASE_URL}/api/submit`;
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
        const res = await fetch(`${BASE_URL}/api/setBudget`, {
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
        const res = await fetch(`${BASE_URL}/api/getBudget?uid=${currentUserUid}`);
        if(!res.ok) return clearBudgetUI();
        const r = await res.json();
        if(!r || typeof r.amount === "undefined" || r.amount === 0){
            currentBudgetAmount = 0;
            clearBudgetUI();
            return;
        }
        currentBudgetAmount = parseFloat(r.amount) || 0;
        const expensesRes = await fetch(`${BASE_URL}/api/users?uid=${currentUserUid}`);
        const arr = await expensesRes.json();
        let totalAmount = 0;
        if(Array.isArray(arr)) arr.forEach(x=> totalAmount += parseFloat(x.amount)||0);
        updateBudgetUI(currentBudgetAmount, totalAmount);
        budgetInput && (budgetInput.value = currentBudgetAmount);
    } catch(err){ console.error(err); clearBudgetUI(); }
}

// ... (மற்ற functions API endpoints மாற்ற வேண்டும்) ...

// Edit and Delete handlers
window.editExpense = async function(id){
    try{
        const res = await fetch(`${BASE_URL}/api/user/${id}`);
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
        const res = await fetch(`${BASE_URL}/api/delete/${id}`, { method: "DELETE" });
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

// History functions - API endpoint மாற்ற வேண்டும்
window.viewHistory = async function(expenseId) {
    try {
        const res = await fetch(`${BASE_URL}/api/user/${expenseId}`);
        if(!res.ok) throw new Error("Failed to fetch expense");
        const expense = await res.json();
        // ... rest of the function
    } catch(err) {
        console.error(err);
        historyContent.innerHTML = "<p class='text-danger'>Failed to load history.</p>";
    }
}

async function showHistory() {
    try {
        const res = await fetch(`${BASE_URL}/api/users?uid=${currentUserUid}`);
        if(!res.ok) throw new Error("Failed to fetch expenses");
        const expenses = await res.json();
        // ... rest of the function
    } catch(err) {
        console.error(err);
        historyContent.innerHTML = "<p class='text-danger'>Failed to load history.</p>";
    }
}

// Load data function - API endpoint மாற்ற வேண்டும்
async function loadData(){
    if(!currentUserUid) return;
    try{
        const res = await fetch(`${BASE_URL}/api/users?uid=${currentUserUid}`);
        if(!res.ok) throw new Error("Failed to fetch users");
        const users = await res.json();
        // ... rest of the function
        
        const bRes = await fetch(`${BASE_URL}/api/getBudget?uid=${currentUserUid}`);
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
