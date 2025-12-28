// server.js - ULTIMATE FIX FOR OLD DATA
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
let db, expenses;

async function connectDB() {
  if (!db) {
    await client.connect();
    db = client.db("E_TRAX_DB");
    expenses = db.collection("expenses");
    console.log("✅ MongoDB connected to E_TRAX_DB");
  }
}

// Firebase Config
app.get("/firebase-config", (req, res) => {
  const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
  };
  res.json(firebaseConfig);
});

// ================= CRITICAL FIX: Get ALL Expenses =================
app.get("/api/expenses", async (req, res) => {
  try {
    await connectDB();
    const { uid } = req.query;
    
    if (!uid) {
      return res.status(400).json({ 
        success: false, 
        message: "User ID required" 
      });
    }
    
    console.log(`🔍 Fetching expenses for user: ${uid}`);
    
    // Get ALL documents for this user
    const allDocuments = await expenses
      .find({ uid: uid })
      .sort({ createdAt: -1 })
      .toArray();
    
    console.log(`📊 Found ${allDocuments.length} total documents`);
    
    if (allDocuments.length > 0) {
      console.log("🔎 First document sample:", {
        id: allDocuments[0]._id,
        ALL_KEYS: Object.keys(allDocuments[0]),
        FULL_DOC: JSON.stringify(allDocuments[0], null, 2)
      });
    }
    
    // ================= TRANSFORM ALL DOCUMENTS =================
    const transformedExpenses = allDocuments.map(doc => {
      // Extract ALL possible fields
      const allFields = Object.keys(doc);
      
      // Debug log for first few documents
      if (allDocuments.indexOf(doc) < 3) {
        console.log(`📄 Document ${allDocuments.indexOf(doc) + 1} fields:`, allFields);
      }
      
      // Find name from ANY field that might contain a name
      let foundName = "";
      for (const field of allFields) {
        const value = doc[field];
        if (typeof value === 'string' && value.length > 0 && value.length < 100) {
          if (field.toLowerCase().includes('name') || 
              field.toLowerCase().includes('item') || 
              field.toLowerCase().includes('title') ||
              field.toLowerCase().includes('desc')) {
            foundName = value;
            break;
          }
        }
      }
      
      // Find amount from ANY numeric field
      let foundAmount = 0;
      for (const field of allFields) {
        const value = doc[field];
        if (typeof value === 'number') {
          foundAmount = value;
          break;
        } else if (typeof value === 'string' && !isNaN(parseFloat(value))) {
          foundAmount = parseFloat(value);
          break;
        }
      }
      
      // Find date from ANY date field
      let foundDate = "";
      for (const field of allFields) {
        const value = doc[field];
        if (field.toLowerCase().includes('date') || field.toLowerCase().includes('created')) {
          if (value instanceof Date) {
            foundDate = value.toISOString().split('T')[0];
            break;
          } else if (typeof value === 'string' && value.includes('-')) {
            foundDate = value.split('T')[0];
            break;
          }
        }
      }
      
      // Create transformed expense
      return {
        _id: doc._id,
        uid: doc.uid,
        name: foundName || "Expense",  // Default if no name found
        amount: foundAmount || 0,       // Default if no amount found
        category: doc.category || doc.type || "Other",
        type: doc.type || doc.paymentType || "Cash",
        description: doc.description || "",
        date: foundDate || new Date().toISOString().split('T')[0],
        createdAt: doc.createdAt || new Date(),
        updatedAt: doc.updatedAt || new Date(),
        editCount: doc.editCount || 0,
        editHistory: doc.editHistory || [],
        // Debug info
        _originalFields: allFields,
        _wasTransformed: !doc.name || !doc.amount
      };
    });
    
    console.log(`✅ Returning ${transformedExpenses.length} transformed expenses`);
    
    res.json({
      success: true,
      count: transformedExpenses.length,
      expenses: transformedExpenses
    });
    
  } catch (err) {
    console.error("❌ API Error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Server error",
      error: err.message 
    });
  }
});

// ================= DIRECT DEBUG ENDPOINT =================
app.get("/api/debug-all", async (req, res) => {
  try {
    await connectDB();
    const { uid } = req.query;
    
    if (!uid) {
      return res.status(400).json({ 
        success: false, 
        message: "User ID required" 
      });
    }
    
    // Get raw data
    const rawData = await expenses
      .find({ uid: uid })
      .toArray();
    
    // Analyze field structure
    const analysis = {
      totalDocuments: rawData.length,
      fieldFrequency: {},
      sampleDocuments: []
    };
    
    rawData.forEach((doc, index) => {
      // Count field frequency
      Object.keys(doc).forEach(field => {
        analysis.fieldFrequency[field] = (analysis.fieldFrequency[field] || 0) + 1;
      });
      
      // Store first 3 documents as samples
      if (index < 3) {
        analysis.sampleDocuments.push({
          id: doc._id,
          fields: Object.keys(doc),
          data: doc
        });
      }
    });
    
    res.json({
      success: true,
      analysis: analysis,
      allDocuments: rawData.map(doc => ({
        id: doc._id,
        ...doc
      }))
    });
    
  } catch (err) {
    console.error("❌ Debug error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Debug failed",
      error: err.message 
    });
  }
});

// Create Expense
app.post("/api/expenses", async (req, res) => {
  try {
    await connectDB();
    const { uid, name, amount, category, type, description, date } = req.body;
    
    if (!uid || !name || !amount || !category) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields" 
      });
    }
    
    const newExpense = {
      uid,
      name: name.trim(),
      amount: parseFloat(amount),
      category: category || "Other",
      type: type || "Cash",
      description: description || "",
      date: date || new Date().toISOString().split('T')[0],
      createdAt: new Date(),
      updatedAt: new Date(),
      editCount: 0,
      editHistory: []
    };
    
    const result = await expenses.insertOne(newExpense);
    
    res.json({
      success: true,
      message: "Expense saved successfully",
      id: result.insertedId,
      expense: newExpense
    });
    
  } catch (err) {
    console.error("❌ Create error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to save expense",
      error: err.message 
    });
  }
});

// Update Expense
app.put("/api/expenses/:id", async (req, res) => {
  try {
    await connectDB();
    const { id } = req.params;
    const updateData = req.body;
    
    const result = await expenses.updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: {
          ...updateData,
          updatedAt: new Date()
        }
      }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Expense not found" 
      });
    }
    
    res.json({
      success: true,
      message: "Expense updated successfully"
    });
    
  } catch (err) {
    console.error("❌ Update error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to update expense",
      error: err.message 
    });
  }
});

// Delete Expense
app.delete("/api/expenses/:id", async (req, res) => {
  try {
    await connectDB();
    const { id } = req.params;
    
    const result = await expenses.deleteOne({ 
      _id: new ObjectId(id) 
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Expense not found" 
      });
    }
    
    res.json({
      success: true,
      message: "Expense deleted successfully"
    });
    
  } catch (err) {
    console.error("❌ Delete error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to delete expense",
      error: err.message 
    });
  }
});

// Health Check
app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy",
    service: "E-TRAX API",
    timestamp: new Date().toISOString()
  });
});

// Serve Frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;
