require("dotenv").config();
const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const path = require("path");
const cors = require("cors");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use("/public", express.static(path.join(__dirname, "public")));

// MongoDB
const uri = process.env.MONGODB_URI || "mongodb+srv://Sandydb456:Sandydb456@cluster0.o4lr4zd.mongodb.net/PTS_PRO?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function start() {
  try {
    await client.connect();
    console.log("✅ Connected to MongoDB!");

    const db = client.db();
    const expenses = db.collection("expenses");
    const budgets = db.collection("budgets"); // For budget management

    // Serve frontend
    app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

    // Submit expense
    app.post("/submit", async (req, res) => {
      try {
        const { uid, name, amount, type, description, date } = req.body;
        const result = await expenses.insertOne({ uid, name, amount, type, description, date });
        res.json({ status: "success", message: "✅ Expense saved successfully!", id: result.insertedId });
      } catch (err) {
        console.error(err);
        res.status(500).json({ status: "error", message: "❌ Failed to save expense" });
      }
    });

    // Get all expenses for a user
    app.get("/users", async (req, res) => {
      try {
        const { uid } = req.query;
        const all = await expenses.find({ uid }).toArray();
        res.json(all);
      } catch (err) {
        console.error(err);
        res.status(500).json({ status: "error", message: "❌ Failed to fetch expenses" });
      }
    });

    // Get single expense
    app.get("/user/:id", async (req, res) => {
      try {
        const user = await expenses.findOne({ _id: new ObjectId(req.params.id) });
        res.json(user);
      } catch (err) {
        console.error(err);
        res.status(500).json({ status: "error", message: "❌ Failed to fetch expense" });
      }
    });

    // ✅ Update expense (fixed missing code)
    app.put("/update/:id", async (req, res) => {
      try {
        const { uid, name, amount, type, description, date } = req.body;
        const exp = await expenses.findOne({ _id: new ObjectId(req.params.id) });
        if (!exp) return res.status(404).json({ status: "error", message: "Expense not found" });
        if (exp.uid !== uid) return res.status(403).json({ status: "error", message: "Unauthorized" });

        await expenses.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: { name, amount, type, description, date } }
        );
        res.json({ status: "success", message: "✅ Expense updated successfully!" });
      } catch (err) {
        console.error(err);
        res.status(500).json({ status: "error", message: "❌ Failed to update expense" });
      }
    });

    // ✅ Save or Reset Budget
    app.post("/setBudget", async (req, res) => {
      try {
        const { uid, amount, reset } = req.body;
        if (!uid) return res.status(400).json({ message: "Missing UID" });

        if (reset) {
          await budgets.deleteOne({ uid });
          return res.json({ message: "✅ Budget reset successfully" });
        }

        await budgets.updateOne(
          { uid },
          { $set: { amount: parseFloat(amount) } },
          { upsert: true }
        );
        res.json({ message: "✅ Budget saved successfully!" });
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "❌ Failed to save/reset budget" });
      }
    });

    // ✅ Fetch Budget
    app.get("/getBudget", async (req, res) => {
      try {
        const { uid } = req.query;
        if (!uid) return res.status(400).json({ message: "Missing UID" });
        const b = await budgets.findOne({ uid });
        res.json({ amount: b ? b.amount : 0 });
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "❌ Failed to fetch budget" });
      }
    });

    // ✅ Start server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  } catch (err) {
    console.error("❌ MongoDB Connection Failed:", err);
  }
}

start();
