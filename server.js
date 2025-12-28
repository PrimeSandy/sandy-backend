// server.js - ULTIMATE FIX FOR OLD MONGODB DATA
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
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const client = new MongoClient(MONGODB_URI);
let db, expensesCollection;

async function connectDB() {
  try {
    await client.connect();
    db = client.db("E_TRAX_DB");
    expensesCollection = db.collection("expenses");
    console.log("✅ MongoDB Connected to E_TRAX_DB");
    
    // Check collections
    const collections = await db.listCollections().toArray();
    console.log("📁 Available collections:", collections.map(c => c.name));
    
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err.message);
  }
}

// Connect to DB on startup
connectDB();

// ================= FIXED API ENDPOINTS =================

// 1. GET ALL EXPENSES FOR USER - ULTIMATE FIX
app.get("/api/get-expenses", async (req, res) => {
  try {
    const { uid } = req.query;
    
    if (!uid) {
      return res.status(400).json({ 
        success: false, 
        message: "User ID is required" 
      });
    }
    
    console.log(`🔍 Searching expenses for user: ${uid}`);
    
    // Try to find expenses by UID in ANY format
    const query = { 
      $or: [
        { uid: uid },
        { userId: uid },
        { user: uid }
      ]
    };
    
    console.log("🔎 Query:", JSON.stringify(query));
    
    const allDocuments = await expensesCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
    
    console.log(`📊 Found ${allDocuments.length} documents total`);
    
    if (allDocuments.length > 0) {
      console.log("📄 First document structure:");
      console.log("ID:", allDocuments[0]._id);
      console.log("All Keys:", Object.keys(allDocuments[0]));
      console.log("Full Document:", JSON.stringify(allDocuments[0], null, 2));
    }
    
    // ================= TRANSFORM ALL DOCUMENTS =================
    const transformedExpenses = allDocuments.map((doc, index) => {
      // Extract ALL fields from document
      const allFields = Object.keys(doc);
      
      // DEBUG: Log first 3 documents
      if (index < 3) {
        console.log(`📋 Document ${index + 1}:`, {
          id: doc._id,
          fields: allFields,
          hasName: !!doc.name,
          hasAmount: doc.amount !== undefined,
          sampleData: {
            name: doc.name,
            amount: doc.amount,
            itemName: doc.itemName,
            price: doc.price,
            description: doc.description,
            date: doc.date
          }
        });
      }
      
      // ================= EXTRACT NAME =================
      let extractedName = "";
      
      // Try different possible name fields
      if (doc.name && typeof doc.name === 'string') {
        extractedName = doc.name;
      } else if (doc.itemName && typeof doc.itemName === 'string') {
        extractedName = doc.itemName;
      } else if (doc.title && typeof doc.title === 'string') {
        extractedName = doc.title;
      } else if (doc.description && typeof doc.description === 'string') {
        // Use first 30 chars of description as name
        extractedName = doc.description.substring(0, 30) + (doc.description.length > 30 ? "..." : "");
      } else if (doc.item && typeof doc.item === 'string') {
        extractedName = doc.item;
      } else {
        extractedName = "Expense #" + (index + 1);
      }
      
      // ================= EXTRACT AMOUNT =================
      let extractedAmount = 0;
      
      // Try different possible amount fields
      if (doc.amount !== undefined && doc.amount !== null) {
        extractedAmount = parseFloat(doc.amount) || 0;
      } else if (doc.price !== undefined && doc.price !== null) {
        extractedAmount = parseFloat(doc.price) || 0;
      } else if (doc.cost !== undefined && doc.cost !== null) {
        extractedAmount = parseFloat(doc.cost) || 0;
      } else if (doc.value !== undefined && doc.value !== null) {
        extractedAmount = parseFloat(doc.value) || 0;
      }
      
      // ================= EXTRACT DATE =================
      let extractedDate = "";
      
      // Try different possible date fields
      if (doc.date) {
        if (doc.date instanceof Date) {
          extractedDate = doc.date.toISOString().split('T')[0];
        } else if (typeof doc.date === 'string') {
          extractedDate = doc.date.split('T')[0];
        }
      } else if (doc.createdAt) {
        if (doc.createdAt instanceof Date) {
          extractedDate = doc.createdAt.toISOString().split('T')[0];
        } else if (typeof doc.createdAt === 'string') {
          extractedDate = doc.createdAt.split('T')[0];
        }
      } else {
        extractedDate = new Date().toISOString().split('T')[0];
      }
      
      // ================= EXTRACT CATEGORY =================
      let extractedCategory = "Other";
      
      if (doc.category && typeof doc.category === 'string') {
        extractedCategory = doc.category;
      } else if (doc.type && typeof doc.type === 'string') {
        extractedCategory = doc.type;
      } else if (doc.categoryType && typeof doc.categoryType === 'string') {
        extractedCategory = doc.categoryType;
      }
      
      // ================= CREATE TRANSFORMED OBJECT =================
      const transformed = {
        _id: doc._id,
        uid: doc.uid || doc.userId || doc.user || uid,
        name: extractedName,
        amount: extractedAmount,
        category: extractedCategory,
        type: doc.type || doc.paymentType || "Cash",
        description: doc.description || doc.note || "",
        date: extractedDate,
        createdAt: doc.createdAt || new Date(),
        updatedAt: doc.updatedAt || new Date(),
        editCount: doc.editCount || 0,
        editHistory: doc.editHistory || [],
        
        // Debug info
        _originalFields: allFields,
        _hasOriginalName: !!doc.name,
        _hasOriginalAmount: doc.amount !== undefined,
        _wasTransformed: !doc.name || doc.amount === undefined
      };
      
      return transformed;
    });
    
    console.log(`✅ Returning ${transformedExpenses.length} transformed expenses`);
    
    res.json({
      success: true,
      count: transformedExpenses.length,
      expenses: transformedExpenses,
      debug: {
        totalDocuments: allDocuments.length,
        transformedCount: transformedExpenses.length,
        sampleOldDocument: allDocuments[0] ? {
          id: allDocuments[0]._id,
          fields: Object.keys(allDocuments[0])
        } : null
      }
    });
    
  } catch (err) {
    console.error("❌ Get expenses error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to load expenses",
      error: err.message 
    });
  }
});

// 2. CREATE NEW EXPENSE
app.post("/api/create-expense", async (req, res) => {
  try {
    const { uid, name, amount, category, type, description, date } = req.body;
    
    if (!uid || !name || !amount) {
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
    
    const result = await expensesCollection.insertOne(newExpense);
    
    console.log("✅ New expense created:", result.insertedId);
    
    res.json({
      success: true,
      message: "Expense saved successfully",
      id: result.insertedId,
      expense: newExpense
    });
    
  } catch (err) {
    console.error("❌ Create expense error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to save expense",
      error: err.message 
    });
  }
});

// 3. UPDATE EXPENSE
app.put("/api/update-expense/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const result = await expensesCollection.updateOne(
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
    console.error("❌ Update expense error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to update expense",
      error: err.message 
    });
  }
});

// 4. DELETE EXPENSE
app.delete("/api/delete-expense/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await expensesCollection.deleteOne({ 
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
    console.error("❌ Delete expense error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to delete expense",
      error: err.message 
    });
  }
});

// 5. GET SINGLE EXPENSE
app.get("/api/get-expense/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const expense = await expensesCollection.findOne({ 
      _id: new ObjectId(id) 
    });
    
    if (!expense) {
      return res.status(404).json({ 
        success: false, 
        message: "Expense not found" 
      });
    }
    
    res.json({
      success: true,
      expense: expense
    });
    
  } catch (err) {
    console.error("❌ Get single expense error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to get expense",
      error: err.message 
    });
  }
});

// 6. MIGRATE OLD DATA TO NEW FORMAT
app.post("/api/migrate-old-data", async (req, res) => {
  try {
    const { uid } = req.body;
    
    if (!uid) {
      return res.status(400).json({ 
        success: false, 
        message: "User ID is required" 
      });
    }
    
    console.log(`🔄 Starting migration for user: ${uid}`);
    
    // Find all old documents without proper name/amount fields
    const oldDocuments = await expensesCollection.find({
      uid: uid,
      $or: [
        { name: { $exists: false } },
        { amount: { $exists: false } },
        { name: null },
        { amount: null }
      ]
    }).toArray();
    
    console.log(`📦 Found ${oldDocuments.length} documents to migrate`);
    
    let migratedCount = 0;
    let errors = [];
    
    for (const doc of oldDocuments) {
      try {
        // Extract data from old format
        const oldName = doc.itemName || doc.title || doc.description || "Migrated Expense";
        const oldAmount = doc.price || doc.cost || doc.value || 0;
        const oldCategory = doc.category || doc.type || "Other";
        const oldDate = doc.date || doc.createdAt || new Date();
        
        // Update to new format
        await expensesCollection.updateOne(
          { _id: doc._id },
          {
            $set: {
              name: oldName,
              amount: parseFloat(oldAmount),
              category: oldCategory,
              date: oldDate instanceof Date ? oldDate.toISOString().split('T')[0] : 
                    typeof oldDate === 'string' ? oldDate.split('T')[0] : 
                    new Date().toISOString().split('T')[0],
              updatedAt: new Date()
            }
          }
        );
        
        migratedCount++;
        console.log(`✅ Migrated document: ${doc._id}`);
        
      } catch (err) {
        errors.push({ id: doc._id, error: err.message });
        console.error(`❌ Error migrating ${doc._id}:`, err.message);
      }
    }
    
    res.json({
      success: true,
      message: `Migration completed: ${migratedCount} documents migrated`,
      migrated: migratedCount,
      errors: errors
    });
    
  } catch (err) {
    console.error("❌ Migration error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Migration failed",
      error: err.message 
    });
  }
});

// 7. DEBUG ENDPOINT - SEE RAW DATA
app.get("/api/debug-raw-data", async (req, res) => {
  try {
    const { uid } = req.query;
    
    if (!uid) {
      return res.status(400).json({ 
        success: false, 
        message: "User ID is required" 
      });
    }
    
    console.log(`🔍 Debug request for user: ${uid}`);
    
    // Find ALL documents for this user
    const allDocuments = await expensesCollection
      .find({ 
        $or: [
          { uid: uid },
          { userId: uid },
          { user: uid }
        ]
      })
      .toArray();
    
    // Analyze field structure
    const fieldAnalysis = {};
    allDocuments.forEach(doc => {
      Object.keys(doc).forEach(field => {
        if (!fieldAnalysis[field]) {
          fieldAnalysis[field] = {
            count: 0,
            sampleValues: [],
            types: new Set()
          };
        }
        fieldAnalysis[field].count++;
        
        // Store sample values (max 3)
        if (fieldAnalysis[field].sampleValues.length < 3) {
          fieldAnalysis[field].sampleValues.push(doc[field]);
        }
        
        // Track data type
        fieldAnalysis[field].types.add(typeof doc[field]);
      });
    });
    
    res.json({
      success: true,
      totalDocuments: allDocuments.length,
      fieldAnalysis: fieldAnalysis,
      allDocuments: allDocuments.map(doc => ({
        _id: doc._id,
        ...doc
      })),
      sampleDocument: allDocuments[0] || null
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

// 8. TEST CONNECTION
app.get("/api/test-connection", async (req, res) => {
  try {
    const collections = await db.listCollections().toArray();
    const expenseCount = await expensesCollection.countDocuments();
    
    res.json({
      success: true,
      message: "Database connection successful",
      database: db.databaseName,
      collections: collections.map(c => c.name),
      totalExpenses: expenseCount,
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    console.error("❌ Test connection error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Database connection failed",
      error: err.message 
    });
  }
});

// 9. Firebase Config
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

// 10. Health Check
app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy",
    service: "E-TRAX API",
    version: "2.1.0",
    timestamp: new Date().toISOString(),
    endpoints: [
      "/api/get-expenses",
      "/api/create-expense",
      "/api/update-expense",
      "/api/delete-expense",
      "/api/debug-raw-data",
      "/api/test-connection",
      "/api/migrate-old-data"
    ]
  });
});

// Serve Frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Error Handler
app.use((err, req, res, next) => {
  console.error("🚨 Server Error:", err);
  res.status(500).json({ 
    success: false, 
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined
  });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`📡 MongoDB: ${MONGODB_URI}`);
});

module.exports = app;
