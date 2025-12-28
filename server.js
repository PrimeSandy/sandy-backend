// server.js - COMPLETE FIXED VERSION
require("dotenv").config();
const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const path = require("path");
const cors = require("cors");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// MongoDB Connection
const client = new MongoClient(process.env.MONGODB_URI);
let db, expenses, budgets;

async function connectDB() {
  if (!db) {
    await client.connect();
    db = client.db("E_TRAX_DB");
    expenses = db.collection("expenses");
    budgets = db.collection("budgets");
    console.log("✅ MongoDB connected to E_TRAX_DB");
  }
}

// Secure Firebase Config Endpoint
app.get("/firebase-config", (req, res) => {
  const requiredVars = [
    "FIREBASE_API_KEY",
    "FIREBASE_AUTH_DOMAIN",
    "FIREBASE_PROJECT_ID",
    "FIREBASE_STORAGE_BUCKET",
    "FIREBASE_MESSAGING_SENDER_ID",
    "FIREBASE_APP_ID"
  ];
  
  const missingVars = requiredVars.filter(key => !process.env[key]);
  if (missingVars.length > 0) {
    console.error("❌ Missing Firebase config:", missingVars);
    return res.status(500).json({ 
      error: "Firebase configuration incomplete",
      missing: missingVars 
    });
  }
  
  const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID
  };
  
  res.json(firebaseConfig);
});

// Health Check
app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "E-TRAX API",
    version: "2.1.0"
  });
});

// Create Expense
app.post("/submit", async (req, res) => {
  try {
    await connectDB();
    const { uid, name, amount, type, description, date, category } = req.body;
    
    if (!uid || !name || !amount || !category) {
      return res.status(400).json({ 
        status: "error", 
        message: "Missing required fields" 
      });
    }
    
    const now = new Date();
    const doc = {
      uid,
      name: name.trim(),
      amount: parseFloat(amount),
      type: type || "Other",
      description: description || "",
      date: date || now.toISOString().split('T')[0],
      category: category || "Uncategorized",
      createdAt: now,
      updatedAt: now,
      editCount: 0,
      editHistory: []
    };
    
    const result = await expenses.insertOne(doc);
    
    res.json({ 
      status: "success", 
      message: "✅ Expense saved successfully!", 
      id: result.insertedId,
      expense: doc
    });
    
  } catch (err) {
    console.error("❌ Submit error:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Failed to save expense",
      error: err.message 
    });
  }
});

// Get User Expenses - FIXED FOR OLD DATA
app.get("/users", async (req, res) => {
  try {
    await connectDB();
    const { uid } = req.query;
    
    if (!uid) {
      return res.status(400).json({ 
        status: "error", 
        message: "User ID required" 
      });
    }
    
    console.log(`🔍 Fetching expenses for user: ${uid}`);
    
    // Get ALL expenses for this user
    const allExpenses = await expenses
      .find({ uid })
      .sort({ createdAt: -1 })
      .toArray();
    
    console.log(`📊 Total documents found: ${allExpenses.length}`);
    
    if (allExpenses.length > 0) {
      console.log("📝 First expense sample:", {
        id: allExpenses[0]._id,
        name: allExpenses[0].name,
        amount: allExpenses[0].amount,
        ALL_FIELDS: Object.keys(allExpenses[0])
      });
    }
    
    // NORMALIZE ALL EXPENSES TO COMMON FORMAT
    const normalizedExpenses = allExpenses.map(exp => {
      // Check what fields exist
      const hasName = exp.name || exp.itemName || exp.title;
      const hasAmount = exp.amount !== undefined || exp.price !== undefined || exp.cost !== undefined;
      
      // Create normalized object
      const normalized = {
        _id: exp._id,
        uid: exp.uid,
        // Handle name field
        name: exp.name || exp.itemName || exp.title || 
              (exp.description && exp.description.length > 30 ? 
               exp.description.substring(0, 30) + "..." : 
               "Expense") || "Expense",
        
        // Handle amount field
        amount: exp.amount || exp.price || exp.cost || exp.value || 0,
        
        // Handle category field
        category: exp.category || exp.type || "Other",
        
        // Handle type/payment field
        type: exp.type || exp.paymentType || exp.paymentMethod || "Cash",
        
        // Handle description
        description: exp.description || exp.note || "",
        
        // Handle date
        date: exp.date || exp.createdDate || 
              (exp.createdAt ? exp.createdAt.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
        
        // Preserve timestamps
        createdAt: exp.createdAt || new Date(),
        updatedAt: exp.updatedAt || new Date(),
        editCount: exp.editCount || 0,
        editHistory: exp.editHistory || [],
        
        // Flag for debugging
        _wasNormalized: !exp.name || !exp.amount
      };
      
      return normalized;
    });
    
    console.log(`✅ Returning ${normalizedExpenses.length} normalized expenses`);
    
    res.json(normalizedExpenses);
    
  } catch (err) {
    console.error("❌ Fetch error:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Failed to load expenses",
      error: err.message 
    });
  }
});

// Get Single Expense
app.get("/user/:id", async (req, res) => {
  try {
    await connectDB();
    const expense = await expenses.findOne({ 
      _id: new ObjectId(req.params.id) 
    });
    
    if (!expense) {
      return res.status(404).json({ 
        status: "error", 
        message: "Expense not found" 
      });
    }
    
    res.json(expense);
    
  } catch (err) {
    console.error("❌ Get expense error:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Invalid expense ID" 
    });
  }
});

// Update Expense
app.put("/update/:id", async (req, res) => {
  try {
    await connectDB();
    const { 
      uid, 
      editorName, 
      name, 
      amount, 
      type, 
      description, 
      date, 
      category 
    } = req.body;
    
    const id = req.params.id;
    
    // Verify expense exists
    const expense = await expenses.findOne({ 
      _id: new ObjectId(id) 
    });
    
    if (!expense) {
      return res.status(404).json({ 
        status: "error", 
        message: "Expense not found" 
      });
    }
    
    // Verify ownership
    if (expense.uid !== uid) {
      return res.status(403).json({ 
        status: "error", 
        message: "Not authorized to edit this expense" 
      });
    }
    
    const before = {
      name: expense.name || expense.itemName || expense.title,
      amount: expense.amount || expense.price || expense.cost,
      type: expense.type || expense.paymentType,
      description: expense.description || expense.note,
      date: expense.date || expense.createdDate,
      category: expense.category || expense.type
    };
    
    const after = {
      name: name || before.name,
      amount: parseFloat(amount) || before.amount,
      type: type || before.type,
      description: description || before.description,
      date: date || before.date,
      category: category || before.category
    };
    
    // Track changes
    const changes = [];
    if (before.name !== after.name) changes.push(`Name: "${before.name}" → "${after.name}"`);
    if (before.amount !== after.amount) changes.push(`Amount: ₹${before.amount} → ₹${after.amount}`);
    if (before.type !== after.type) changes.push(`Type: ${before.type} → ${after.type}`);
    if (before.description !== after.description) changes.push(`Description: "${before.description}" → "${after.description}"`);
    if (before.date !== after.date) changes.push(`Date: ${before.date} → ${after.date}`);
    if (before.category !== after.category) changes.push(`Category: ${before.category} → ${after.category}`);
    
    // Update expense with normalized fields
    const updateResult = await expenses.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          // Standardize to new format
          name: after.name,
          amount: after.amount,
          type: after.type,
          description: after.description,
          date: after.date,
          category: after.category,
          updatedAt: new Date()
        },
        $inc: { editCount: 1 },
        $push: {
          editHistory: {
            editorUid: uid,
            editorName: editorName || "You",
            date: new Date(),
            before,
            after,
            changes: changes.length > 0 ? changes : ["Minor updates"]
          }
        }
      }
    );
    
    if (updateResult.modifiedCount === 0) {
      return res.status(400).json({ 
        status: "error", 
        message: "No changes made" 
      });
    }
    
    res.json({
      status: "success",
      message: "✅ Expense updated successfully!",
      changes: changes
    });
    
  } catch (err) {
    console.error("❌ Update error:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Failed to update expense" 
    });
  }
});

// Delete Expense
app.delete("/delete/:id", async (req, res) => {
  try {
    await connectDB();
    const id = req.params.id;
    
    const expense = await expenses.findOne({ 
      _id: new ObjectId(id) 
    });
    
    if (!expense) {
      return res.status(404).json({ 
        status: "error", 
        message: "Expense not found" 
      });
    }
    
    await expenses.deleteOne({ 
      _id: new ObjectId(id) 
    });
    
    res.json({ 
      status: "success", 
      message: "✅ Expense deleted successfully" 
    });
    
  } catch (err) {
    console.error("❌ Delete error:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Failed to delete expense" 
    });
  }
});

// Budget Management
app.post("/setBudget", async (req, res) => {
  try {
    await connectDB();
    const { uid, amount, reset } = req.body;
    
    if (!uid) {
      return res.status(400).json({ 
        status: "error", 
        message: "User ID required" 
      });
    }
    
    if (reset) {
      await budgets.deleteOne({ uid });
      return res.json({ 
        status: "success", 
        message: "✅ Budget reset successfully" 
      });
    }
    
    const budgetAmount = parseFloat(amount) || 0;
    
    await budgets.updateOne(
      { uid },
      { 
        $set: { 
          uid, 
          amount: budgetAmount, 
          updatedAt: new Date() 
        } 
      },
      { upsert: true }
    );
    
    res.json({ 
      status: "success", 
      message: "✅ Budget saved successfully",
      amount: budgetAmount
    });
    
  } catch (err) {
    console.error("❌ Budget error:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Budget operation failed" 
    });
  }
});

app.get("/getBudget", async (req, res) => {
  try {
    await connectDB();
    const { uid } = req.query;
    
    if (!uid) {
      return res.status(400).json({ 
        status: "error", 
        message: "User ID required" 
      });
    }
    
    const budget = await budgets.findOne({ uid });
    
    res.json({ 
      amount: budget?.amount || 0, 
      updatedAt: budget?.updatedAt || null 
    });
    
  } catch (err) {
    console.error("❌ Get budget error:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Failed to get budget" 
    });
  }
});

// Analytics Summary
app.get("/analytics/:uid", async (req, res) => {
  try {
    await connectDB();
    const { uid } = req.params;
    
    const userExpenses = await expenses
      .find({ uid })
      .sort({ date: 1 })
      .toArray();
    
    // Calculate monthly totals
    const monthlyData = {};
    const categoryData = {};
    let totalSpent = 0;
    
    userExpenses.forEach(expense => {
      const amount = expense.amount || expense.price || expense.cost || 0;
      const month = (expense.date || expense.createdDate || "").substring(0, 7); // YYYY-MM
      const category = expense.category || expense.type || "Uncategorized";
      
      if (month) {
        monthlyData[month] = (monthlyData[month] || 0) + amount;
      }
      
      categoryData[category] = (categoryData[category] || 0) + amount;
      totalSpent += amount;
    });
    
    res.json({
      monthly: monthlyData,
      categories: categoryData,
      totalExpenses: userExpenses.length,
      totalSpent: totalSpent,
      averageExpense: userExpenses.length > 0 ? totalSpent / userExpenses.length : 0
    });
    
  } catch (err) {
    console.error("❌ Analytics error:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Failed to load analytics" 
    });
  }
});

// ================= DEBUG & MIGRATION ENDPOINTS =================
app.get("/debug/expenses", async (req, res) => {
  try {
    await connectDB();
    const { uid } = req.query;
    
    if (!uid) {
      return res.status(400).json({ 
        status: "error", 
        message: "User ID required" 
      });
    }
    
    const allExpenses = await expenses
      .find({ uid })
      .sort({ createdAt: -1 })
      .toArray();
    
    const fieldAnalysis = {
      total: allExpenses.length,
      sampleOld: null,
      sampleNew: null,
      fieldNames: new Set(),
      fieldComparison: {}
    };
    
    allExpenses.forEach((exp, index) => {
      Object.keys(exp).forEach(key => fieldAnalysis.fieldNames.add(key));
      
      if (index === 0) fieldAnalysis.sampleNew = exp;
      if (!exp.name && !fieldAnalysis.sampleOld) fieldAnalysis.sampleOld = exp;
    });
    
    fieldAnalysis.fieldNames.forEach(field => {
      fieldAnalysis.fieldComparison[field] = {
        inOld: fieldAnalysis.sampleOld?.[field] !== undefined,
        inNew: fieldAnalysis.sampleNew?.[field] !== undefined
      };
    });
    
    res.json({
      status: "success",
      analysis: fieldAnalysis,
      allExpenses: allExpenses.map(exp => ({
        id: exp._id,
        name: exp.name,
        amount: exp.amount,
        category: exp.category,
        type: exp.type,
        date: exp.date,
        description: exp.description,
        _allFields: exp
      }))
    });
    
  } catch (err) {
    console.error("❌ Debug error:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Debug failed",
      error: err.message 
    });
  }
});

app.post("/migrate/old-data", async (req, res) => {
  try {
    await connectDB();
    const { uid } = req.body;
    
    if (!uid) {
      return res.status(400).json({ 
        status: "error", 
        message: "User ID required" 
      });
    }
    
    console.log(`🔄 Starting migration for user: ${uid}`);
    
    const allExpenses = await expenses
      .find({ uid })
      .toArray();
    
    let migratedCount = 0;
    let skippedCount = 0;
    
    for (const exp of allExpenses) {
      if (!exp.name || !exp.amount) {
        console.log(`🔄 Migrating old expense: ${exp._id}`);
        
        const updateDoc = {
          $set: {
            name: exp.itemName || exp.title || "Migrated Expense",
            amount: exp.price || exp.cost || exp.value || 0,
            category: exp.category || exp.type || "Other",
            type: exp.paymentType || exp.paymentMethod || "Cash",
            description: exp.description || exp.note || "",
            date: exp.date || exp.createdDate || 
                  (exp.createdAt ? exp.createdAt.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
            updatedAt: new Date()
          }
        };
        
        await expenses.updateOne(
          { _id: exp._id },
          updateDoc
        );
        
        migratedCount++;
      } else {
        skippedCount++;
      }
    }
    
    console.log(`✅ Migration complete: ${migratedCount} migrated, ${skippedCount} skipped`);
    
    res.json({
      status: "success",
      message: `Migration complete`,
      migrated: migratedCount,
      skipped: skippedCount
    });
    
  } catch (err) {
    console.error("❌ Migration error:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Migration failed",
      error: err.message 
    });
  }
});

// Serve Frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("🚨 Server error:", err);
  res.status(500).json({ 
    status: "error", 
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined
  });
});

// Start server
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`🚀 E-TRAX Server running`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
});

module.exports = app;
