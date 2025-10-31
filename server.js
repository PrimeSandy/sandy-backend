const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect("mongodb+srv://<YOUR_MONGO_URL>/etrax", {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(()=>console.log("✅ MongoDB connected"))
  .catch(err=>console.error("❌ MongoDB error", err));

// Schema
const expenseSchema = new mongoose.Schema({
  uid: String,
  name: String,
  amount: Number,
  type: String,
  description: String,
  date: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
  editCount: { type: Number, default: 0 },
  editHistory: [{
    editorUid: String,
    editorName: String,
    date: { type: Date, default: Date.now },
    before: Object,
    after: Object
  }]
});

const budgetSchema = new mongoose.Schema({
  uid: String,
  amount: Number
});

const Expense = mongoose.model("Expense", expenseSchema);
const Budget = mongoose.model("Budget", budgetSchema);

// -------------------- ROUTES -------------------- //

// Get all expenses for a user
app.get("/users", async (req, res) => {
  try {
    const { uid } = req.query;
    const data = await Expense.find({ uid }).sort({ createdAt: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Error fetching expenses" });
  }
});

// Get single expense (for edit/history)
app.get("/user/:id", async (req, res) => {
  try {
    const data = await Expense.findById(req.params.id);
    if (!data) return res.status(404).json({ message: "Not found" });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Error fetching expense" });
  }
});

// Add expense
app.post("/submit", async (req, res) => {
  try {
    const newExpense = new Expense(req.body);
    await newExpense.save();
    io.emit("expenses-changed", { uid: req.body.uid });
    res.json({ message: "Expense added successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error adding expense" });
  }
});

// Update expense (with history)
app.put("/update/:id", async (req, res) => {
  try {
    const { editorName, uid } = req.body;
    const existing = await Expense.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Expense not found" });

    const beforeData = {
      name: existing.name,
      amount: existing.amount,
      type: existing.type,
      description: existing.description,
      date: existing.date
    };

    const afterData = {
      name: req.body.name,
      amount: req.body.amount,
      type: req.body.type,
      description: req.body.description,
      date: req.body.date
    };

    existing.name = afterData.name;
    existing.amount = afterData.amount;
    existing.type = afterData.type;
    existing.description = afterData.description;
    existing.date = afterData.date;
    existing.updatedAt = new Date();
    existing.editCount = (existing.editCount || 0) + 1;

    existing.editHistory.push({
      editorUid: uid,
      editorName: editorName || "Unknown",
      before: beforeData,
      after: afterData,
      date: new Date()
    });

    await existing.save();
    io.emit("expenses-changed", { uid });
    res.json({ message: "Expense updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating expense" });
  }
});

// Set / Reset budget
app.post("/setBudget", async (req, res) => {
  try {
    const { uid, amount, reset } = req.body;
    if (reset) {
      await Budget.deleteOne({ uid });
      io.emit("budget-changed", { uid });
      return res.json({ message: "Budget reset" });
    }

    let budget = await Budget.findOne({ uid });
    if (budget) {
      budget.amount = amount;
      await budget.save();
    } else {
      await Budget.create({ uid, amount });
    }
    io.emit("budget-changed", { uid });
    res.json({ message: "Budget saved" });
  } catch (err) {
    res.status(500).json({ message: "Error saving budget" });
  }
});

// Get budget
app.get("/getBudget", async (req, res) => {
  try {
    const { uid } = req.query;
    const data = await Budget.findOne({ uid });
    res.json(data || { amount: 0 });
  } catch (err) {
    res.status(500).json({ message: "Error fetching budget" });
  }
});

// -------------------- SOCKET.IO -------------------- //
io.on("connection", socket => {
  console.log("Client connected:", socket.id);
  socket.on("join", uid => socket.join(uid));
  socket.on("disconnect", () => console.log("Client disconnected:", socket.id));
});

// -------------------- START SERVER -------------------- //
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

