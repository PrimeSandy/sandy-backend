// server.js
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

// ✅ Health Check
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running!" });
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
      amount,
      type,
      description,
      date,
      createdAt: now,
      updatedAt: now,
      editCount: 0,
      editHistory: [],
    };
    const result = await expenses.insertOne(doc);
    res.json({ status: "success", message: "✅ Expense saved!", id: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "❌ Failed to save" });
  }
});

// ✅ Get All Expenses
app.get("/users", async (req, res) => {
  try {
    await connectDB();
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ status: "error", message: "Missing uid" });
    const all = await expenses.find({ uid }).sort({ createdAt: -1 }).toArray();
    res.json(all);
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "❌ Failed to load" });
  }
});

// ✅ Get Single Expense
app.get("/user/:id", async (req, res) => {
  try {
    await connectDB();
    const user = await expenses.findOne({ _id: new ObjectId(req.params.id) });
    if (!user) return res.status(404).json({ status: "error", message: "Not found" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "❌ Invalid ID" });
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
    if (exp.uid !== uid) return res.status(403).json({ status: "error", message: "Not your expense" });

    const before = { name: exp.name, amount: exp.amount, type: exp.type, description: exp.description, date: exp.date };
    const after = { name, amount, type, description, date };

    await expenses.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: { name, amount, type, description, date, updatedAt: new Date() },
        $inc: { editCount: 1 },
        $push: {
          editHistory: {
            editorUid: uid,
            editorName: editorName || "Unknown",
            date: new Date(),
            before,
            after,
          },
        },
      }
    );

    res.json({ status: "success", message: "✅ Expense updated successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "❌ Failed to update" });
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
    res.json({ status: "success", message: "✅ Expense deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "❌ Failed to delete" });
  }
});

// ✅ Budget Routes
app.post("/setBudget", async (req, res) => {
  try {
    await connectDB();
    const { uid, amount, reset } = req.body;
    if (!uid) return res.status(400).json({ status: "error", message: "Missing uid" });

    if (reset) {
      await budgets.deleteOne({ uid });
      return res.json({ status: "success", message: "✅ Budget reset" });
    }

    const amt = parseFloat(amount) || 0;
    await budgets.updateOne({ uid }, { $set: { uid, amount: amt, updatedAt: new Date() } }, { upsert: true });
    res.json({ status: "success", message: "✅ Budget saved" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "❌ Budget operation failed" });
  }
});

app.get("/getBudget", async (req, res) => {
  try {
    await connectDB();
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ status: "error", message: "Missing uid" });
    const b = await budgets.findOne({ uid });
    res.json({ amount: b?.amount || 0, updatedAt: b?.updatedAt || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "❌ Failed to get budget" });
  }
});

// ✅ Always start server (both local and production)
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});
