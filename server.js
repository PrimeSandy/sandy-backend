require("dotenv").config(); 
const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const path = require("path");
const cors = require("cors");
const http = require("http");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Create HTTP server
const server = http.createServer(app);

// MongoDB Connection
const client = new MongoClient(process.env.MONGODB_URI);
let db, expenses, budgets;

async function connectDB() {
    if (!db) {
        await client.connect();
        db = client.db("PTS_PRO");
        expenses = db.collection("expenses");
        budgets = db.collection("budgets");
        console.log("✅ MongoDB connected");
    }
}
connectDB();

// ✅ Serve Frontend
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// ✅ SECURE: Serve Firebase Config from Environment Variables
app.get("/firebase-config", (req, res) => {
    const firebaseConfig = {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
        measurementId: process.env.FIREBASE_MEASUREMENT_ID
    };
    
    // Validate that all required config values are present
    const missingKeys = Object.keys(firebaseConfig).filter(key => !firebaseConfig[key]);
    if (missingKeys.length > 0) {
        console.error('Missing Firebase config keys:', missingKeys);
        return res.status(500).json({ error: 'Firebase configuration incomplete' });
    }
    
    res.json(firebaseConfig);
});

// ✅ Health Check
app.get("/health", (req, res) => {
    res.json({ 
        status: "OK", 
        message: "Server is running!",
        firebase: {
            configured: !!process.env.FIREBASE_API_KEY,
            project: process.env.FIREBASE_PROJECT_ID
        }
    });
});

// ✅ Create Expense
app.post("/submit", async (req, res) => {
    try {
        await connectDB();
        const { uid, name, amount, type, description, date } = req.body;
        const now = new Date();
        const doc = {
            uid,
            name,
            amount: parseFloat(amount),
            type,
            description,
            date,
            createdAt: now,
            updatedAt: now,
            editCount: 0,
            editHistory: [],
        };
        const result = await expenses.insertOne(doc);
        res.json({ status: "success", message: "✅ Expense saved successfully!", id: result.insertedId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: "error", message: "❌ Failed to save expense" });
    }
});

// ✅ Get All Expenses
app.get("/users", async (req, res) => {
    try {
        await connectDB();
        const { uid } = req.query;
        if (!uid) return res.status(400).json({ status: "error", message: "Missing user ID" });
        const all = await expenses.find({ uid }).sort({ createdAt: -1 }).toArray();
        res.json(all);
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: "error", message: "❌ Failed to load expenses" });
    }
});

// ✅ Get Single Expense
app.get("/user/:id", async (req, res) => {
    try {
        await connectDB();
        const user = await expenses.findOne({ _id: new ObjectId(req.params.id) });
        if (!user) return res.status(404).json({ status: "error", message: "Expense not found" });
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: "error", message: "❌ Invalid expense ID" });
    }
});

// ✅ Update Expense
app.put("/update/:id", async (req, res) => {
    try {
        await connectDB();
        const { uid, editorName, name, amount, type, description, date } = req.body;
        const id = req.params.id;
        
        const exp = await expenses.findOne({ _id: new ObjectId(id) });
        if (!exp) return res.status(404).json({ status: "error", message: "Expense not found" });
        if (exp.uid !== uid) return res.status(403).json({ status: "error", message: "Not authorized to edit this expense" });

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

        const updateResult = await expenses.updateOne(
            { _id: new ObjectId(id) },
            {
                $set: { 
                    name, 
                    amount: parseFloat(amount), 
                    type, 
                    description, 
                    date, 
                    updatedAt: new Date() 
                },
                $inc: { editCount: 1 },
                $push: {
                    editHistory: {
                        editorUid: uid,
                        editorName: editorName || "Unknown User",
                        date: new Date(),
                        before,
                        after,
                        changes: changes.length > 0 ? changes : ["No significant changes detected"]
                    },
                },
            }
        );

        if (updateResult.modifiedCount === 0) {
            return res.status(400).json({ status: "error", message: "No changes made" });
        }

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

// ✅ Delete Expense
app.delete("/delete/:id", async (req, res) => {
    try {
        await connectDB();
        const id = req.params.id;
        const exp = await expenses.findOne({ _id: new ObjectId(id) });
        if (!exp) return res.status(404).json({ status: "error", message: "Expense not found" });
        
        await expenses.deleteOne({ _id: new ObjectId(id) });
        res.json({ status: "success", message: "✅ Expense deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: "error", message: "❌ Failed to delete expense" });
    }
});

// ✅ Budget Routes
app.post("/setBudget", async (req, res) => {
    try {
        await connectDB();
        const { uid, amount, reset } = req.body;
        if (!uid) return res.status(400).json({ status: "error", message: "Missing user ID" });

        if (reset) {
            await budgets.deleteOne({ uid });
            return res.json({ status: "success", message: "✅ Budget reset successfully" });
        }

        const amt = parseFloat(amount) || 0;
        await budgets.updateOne(
            { uid }, 
            { $set: { uid, amount: amt, updatedAt: new Date() } }, 
            { upsert: true }
        );
        res.json({ status: "success", message: "✅ Budget saved successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: "error", message: "❌ Budget operation failed" });
    }
});

app.get("/getBudget", async (req, res) => {
    try {
        await connectDB();
        const { uid } = req.query;
        if (!uid) return res.status(400).json({ status: "error", message: "Missing user ID" });
        const b = await budgets.findOne({ uid });
        res.json({ amount: b?.amount || 0, updatedAt: b?.updatedAt || null });
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

// ✅ Always start server (both local and production)
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📊 MongoDB: Connected to PTS_PRO database`);
    console.log(`🔐 Firebase: ${process.env.FIREBASE_PROJECT_ID ? 'Configured' : 'Not configured'}`);
});
