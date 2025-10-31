require("dotenv").config();
const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const uri = process.env.MONGODB_URI || "mongodb+srv://Sandydb456:Sandydb456@cluster0.o4lr4zd.mongodb.net/PTS_PRO?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function start() {
  try {
    await client.connect();
    console.log("✅ Connected to MongoDB");
    const db = client.db();
    const expenses = db.collection("expenses");

    // Serve main page
    app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

    // Create
    app.post("/submit", async (req, res) => {
      try {
        const { uid, name, amount, type, description, date } = req.body;
        const r = await expenses.insertOne({ uid, name, amount, type, description, date });
        res.json({ status: "success", message: "✅ Expense saved!", id: r.insertedId });
      } catch (e) { res.status(500).json({ status: "error", message: "❌ Save failed" }); }
    });

    // Read all
    app.get("/users", async (req, res) => {
      try {
        const all = await expenses.find({ uid: req.query.uid }).toArray();
        res.json(all);
      } catch (e) { res.status(500).json({ status: "error", message: "❌ Fetch failed" }); }
    });

    // Read one
    app.get("/user/:id", async (req, res) => {
      try {
        const one = await expenses.findOne({ _id: new ObjectId(req.params.id) });
        res.json(one);
      } catch (e) { res.status(500).json({ status: "error", message: "❌ Not found" }); }
    });

    // Update
    app.put("/update/:id", async (req, res) => {
      try {
        const { uid, name, amount, type, description, date } = req.body;
        const ex = await expenses.findOne({ _id: new ObjectId(req.params.id) });
        if (!ex || ex.uid !== uid) return res.status(403).json({ status: "error", message: "❌ Unauthorized" });
        await expenses.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { name, amount, type, description, date } });
        res.json({ status: "success", message: "✅ Updated!" });
      } catch (e) { res.status(500).json({ status: "error", message: "❌ Update failed" }); }
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  } catch (err) {
    console.error("❌ MongoDB error:", err);
    process.exit(1);
  }
}

start();
