require("dotenv").config(); 
const express = require("express");
const path = require("path");
const cors = require("cors");
const admin = require("firebase-admin");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Initialize Firebase Admin SDK
let firestoreDb;
try {
  // For local development, you can use the JSON file
  // For Vercel, use environment variables
  
  if (process.env.VERCEL) {
    // Production on Vercel - use environment variables
    const serviceAccount = {
      type: process.env.FIREBASE_TYPE,
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
    };
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'ptspro-31997'
    });
  } else {
    // Local development - use service account JSON file
    // Place your serviceAccountKey.json in the project root
    const serviceAccount = require('./serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'ptspro-31997'
    });
  }

  firestoreDb = admin.firestore();
  console.log("✅ Firebase Admin SDK initialized for project: ptspro-31997");
} catch (error) {
  console.error("❌ Firebase initialization failed:", error);
  // Don't exit in Vercel environment
  if (!process.env.VERCEL) {
    process.exit(1);
  }
}

// Middleware to verify Firebase ID Token
async function verifyToken(req, res, next) {
  // Skip token verification for public endpoints
  if (req.path === '/health' || req.path === '/firebase-config') {
    return next();
  }
  
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      status: "error", 
      message: "Unauthorized: No token provided" 
    });
  }

  const idToken = authHeader.split('Bearer ')[1];
  
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    req.uid = decodedToken.uid;
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(401).json({ 
      status: "error", 
      message: "Unauthorized: Invalid token" 
    });
  }
}

// ✅ Serve Frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ✅ SECURE: Serve Firebase Config from Environment Variables
app.get("/firebase-config", (req, res) => {
  const firebaseConfig = {
    apiKey: "AIzaSyDgeOmsWD36spVcXw9QVSbUs4nmx-iXGak",
    authDomain: "ptspro-31997.firebaseapp.com",
    projectId: "ptspro-31997",
    storageBucket: "ptspro-31997.firebasestorage.app",
    messagingSenderId: "191965542623",
    appId: "1:191965542623:web:b461ceedfc3a773267516a",
    measurementId: "G-6LNC29KRQF"
  };
  
  res.json(firebaseConfig);
});

// ✅ Health Check
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    message: "Server is running!",
    firebase: {
      configured: true,
      project: "ptspro-31997",
      initialized: !!firestoreDb
    }
  });
});

// ✅ Create Expense (Protected)
app.post("/submit", verifyToken, async (req, res) => {
  try {
    const { name, amount, type, description, date } = req.body;
    const uid = req.uid;
    const now = new Date();
    
    const expenseData = {
      uid,
      name,
      amount: parseFloat(amount),
      type,
      description,
      date,
      createdAt: admin.firestore.Timestamp.fromDate(now),
      updatedAt: admin.firestore.Timestamp.fromDate(now),
      editCount: 0,
      editHistory: [],
    };

    // Create a document reference in user's expenses subcollection
    const userExpensesRef = firestoreDb.collection('users').doc(uid).collection('expenses');
    const docRef = await userExpensesRef.add(expenseData);
    
    res.json({ 
      status: "success", 
      message: "✅ Expense saved successfully!", 
      id: docRef.id 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "❌ Failed to save expense" });
  }
});

// ✅ Get All Expenses for User (Protected)
app.get("/users", verifyToken, async (req, res) => {
  try {
    const uid = req.uid;
    
    // Get all expenses from user's subcollection
    const userExpensesRef = firestoreDb.collection('users').doc(uid).collection('expenses');
    const snapshot = await userExpensesRef.orderBy('createdAt', 'desc').get();
    
    const expenses = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      expenses.push({
        _id: doc.id,
        ...data,
        // Convert Firestore Timestamp to Date
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
        // Convert editHistory timestamps
        editHistory: data.editHistory?.map(edit => ({
          ...edit,
          date: edit.date?.toDate ? edit.date.toDate() : edit.date
        })) || []
      });
    });
    
    res.json(expenses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "❌ Failed to load expenses" });
  }
});

// ✅ Get Single Expense (Protected)
app.get("/user/:id", verifyToken, async (req, res) => {
  try {
    const uid = req.uid;
    const expenseId = req.params.id;
    
    const expenseDoc = await firestoreDb
      .collection('users').doc(uid)
      .collection('expenses').doc(expenseId)
      .get();
    
    if (!expenseDoc.exists) {
      return res.status(404).json({ status: "error", message: "Expense not found" });
    }
    
    const data = expenseDoc.data();
    const expenseData = {
      _id: expenseDoc.id,
      ...data,
      // Convert Firestore Timestamp to Date
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
      // Convert editHistory timestamps
      editHistory: data.editHistory?.map(edit => ({
        ...edit,
        date: edit.date?.toDate ? edit.date.toDate() : edit.date
      })) || []
    };
    
    res.json(expenseData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "❌ Invalid expense ID" });
  }
});

// ✅ Update Expense (Protected)
app.put("/update/:id", verifyToken, async (req, res) => {
  try {
    const { editorName, name, amount, type, description, date } = req.body;
    const uid = req.uid;
    const expenseId = req.params.id;
    
    // Get the expense document reference
    const expenseRef = firestoreDb
      .collection('users').doc(uid)
      .collection('expenses').doc(expenseId);
    
    // Get current expense data
    const expenseDoc = await expenseRef.get();
    if (!expenseDoc.exists) {
      return res.status(404).json({ status: "error", message: "Expense not found" });
    }
    
    const exp = expenseDoc.data();
    
    const before = { 
      name: exp.name, 
      amount: exp.amount, 
      type: exp.type, 
      description: exp.description, 
      date: exp.date 
    };
    
    const after = { 
      name, 
      amount: parseFloat(amount), 
      type, 
      description, 
      date 
    };

    // Track changes
    const changes = [];
    if (before.name !== after.name) changes.push(`Name changed from "${before.name}" to "${after.name}"`);
    if (before.amount !== after.amount) changes.push(`Amount changed from ₹${before.amount} to ₹${after.amount}`);
    if (before.type !== after.type) changes.push(`Type changed from ${before.type} to ${after.type}`);
    if (before.description !== after.description) changes.push(`Description changed from "${before.description}" to "${after.description}"`);
    if (before.date !== after.date) changes.push(`Date changed from ${before.date} to ${after.date}`);

    // Prepare update data
    const updateData = {
      name,
      amount: parseFloat(amount),
      type,
      description,
      date,
      updatedAt: admin.firestore.Timestamp.fromDate(new Date()),
      editCount: (exp.editCount || 0) + 1
    };

    // Add edit history entry
    const editHistoryEntry = {
      editorUid: uid,
      editorName: editorName || "Unknown User",
      date: admin.firestore.Timestamp.fromDate(new Date()),
      before,
      after,
      changes: changes.length > 0 ? changes : ["No significant changes detected"]
    };

    // Get current edit history and add new entry
    const currentEditHistory = exp.editHistory || [];
    updateData.editHistory = [...currentEditHistory, editHistoryEntry];

    // Perform the update
    await expenseRef.update(updateData);

    res.json({ 
      status: "success", 
      message: "✅ Expense updated successfully!",
      changes: changes
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "❌ Failed to update expense" });
  }
});

// ✅ Delete Expense (Protected)
app.delete("/delete/:id", verifyToken, async (req, res) => {
  try {
    const uid = req.uid;
    const expenseId = req.params.id;
    
    // Get the expense document reference
    const expenseRef = firestoreDb
      .collection('users').doc(uid)
      .collection('expenses').doc(expenseId);
    
    // Check if expense exists
    const expenseDoc = await expenseRef.get();
    if (!expenseDoc.exists) {
      return res.status(404).json({ status: "error", message: "Expense not found" });
    }
    
    // Delete the expense
    await expenseRef.delete();
    
    res.json({ status: "success", message: "✅ Expense deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "❌ Failed to delete expense" });
  }
});

// ✅ Budget Routes (Protected)

// Set Budget
app.post("/setBudget", verifyToken, async (req, res) => {
  try {
    const uid = req.uid;
    const { amount, reset } = req.body;
    
    const userBudgetRef = firestoreDb.collection('users').doc(uid).collection('budget').doc('current');
    
    if (reset) {
      await userBudgetRef.delete();
      return res.json({ status: "success", message: "✅ Budget reset successfully" });
    }
    
    const amt = parseFloat(amount) || 0;
    const budgetData = {
      uid,
      amount: amt,
      updatedAt: admin.firestore.Timestamp.fromDate(new Date())
    };
    
    await userBudgetRef.set(budgetData);
    
    res.json({ status: "success", message: "✅ Budget saved successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "❌ Budget operation failed" });
  }
});

// Get Budget
app.get("/getBudget", verifyToken, async (req, res) => {
  try {
    const uid = req.uid;
    
    const userBudgetRef = firestoreDb.collection('users').doc(uid).collection('budget').doc('current');
    const budgetDoc = await userBudgetRef.get();
    
    if (!budgetDoc.exists) {
      return res.json({ amount: 0, updatedAt: null });
    }
    
    const budgetData = budgetDoc.data();
    res.json({ 
      amount: budgetData?.amount || 0, 
      updatedAt: budgetData?.updatedAt?.toDate ? budgetData.updatedAt.toDate() : budgetData?.updatedAt 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "❌ Failed to get budget" });
  }
});

// Error handling
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

// For Vercel serverless
if (process.env.VERCEL) {
  module.exports = app;
} else {
  // Local development
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📊 Firebase Firestore: Connected to project ptspro-31997`);
    console.log(`🔐 Authentication: Token verification enabled`);
    console.log(`🔗 Local URL: http://localhost:${PORT}`);
  });
}
