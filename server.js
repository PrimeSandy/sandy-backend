// server.js
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
  // Validate required environment variables
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
  
  console.log("🔐 Serving Firebase config for project:", firebaseConfig.projectId);
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
      date: date || new Date().toISOString().split('T')[0],
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

// Get User Expenses
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
    
    const allExpenses = await expenses
      .find({ uid })
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json(allExpenses);
    
  } catch (err) {
    console.error("❌ Fetch error:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Failed to load expenses" 
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
      name: expense.name,
      amount: expense.amount,
      type: expense.type,
      description: expense.description,
      date: expense.date,
      category: expense.category
    };
    
    const after = {
      name: name || expense.name,
      amount: parseFloat(amount) || expense.amount,
      type: type || expense.type,
      description: description || expense.description,
      date: date || expense.date,
      category: category || expense.category
    };
    
    // Track changes
    const changes = [];
    if (before.name !== after.name) changes.push(`Name: "${before.name}" → "${after.name}"`);
    if (before.amount !== after.amount) changes.push(`Amount: ₹${before.amount} → ₹${after.amount}`);
    if (before.type !== after.type) changes.push(`Type: ${before.type} → ${after.type}`);
    if (before.description !== after.description) changes.push(`Description: "${before.description}" → "${after.description}"`);
    if (before.date !== after.date) changes.push(`Date: ${before.date} → ${after.date}`);
    if (before.category !== after.category) changes.push(`Category: ${before.category} → ${after.category}`);
    
    // Update expense
    const updateResult = await expenses.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
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
      const month = expense.date.substring(0, 7); // YYYY-MM
      const category = expense.category || "Uncategorized";
      
      // Monthly totals
      monthlyData[month] = (monthlyData[month] || 0) + expense.amount;
      
      // Category totals
      categoryData[category] = (categoryData[category] || 0) + expense.amount;
      
      // Total spent
      totalSpent += expense.amount;
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

// Global error handlers
process.on("unhandledRejection", (reason, promise) => {
  console.error("🚨 Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("🚨 Uncaught Exception:", err);
  process.exit(1);
});

// Start server
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`🚀 E-TRAX Server running`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔐 Firebase Project: ${process.env.FIREBASE_PROJECT_ID || "Not configured"}`);
  console.log(`🗄️ MongoDB: ${process.env.MONGODB_URI ? "Connected" : "Not configured"}`);
});

// Export for Vercel
module.exports = app;
