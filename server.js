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
app.use("/public", express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] },
});

// MongoDB
const uri =
  process.env.MONGODB_URI ||
  "mongodb+srv://Sandydb456:Sandydb456@cluster0.o4lr4zd.mongodb.net/PTS_PRO?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function start() {
  try {
    await client.connect();
    console.log("✅ Connected to MongoDB!");
    const db = client.db();
    const expenses = db.collection("expenses");
    const budgets = db.collection("budgets");

    app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

    io.on("connection", (socket) => {
      socket.on("join", (uid) => {
        if (uid) socket.join(`uid_${uid}`);
      });
    });

    // Create Expense
    app.post("/submit", async (req, res) => {
      try {
        const { uid, name, amount, type, description, date } = req.body;
        const now = new Date();
        const doc = { uid, name, amount, type, description, date, createdAt: now, updatedAt: now, editCount: 0, editHistory: [] };
        const result = await expenses.insertOne(doc);
        io.to(`uid_${uid}`).emit("expenses-changed", { action: "created", id: result.insertedId, uid });
        res.json({ status: "success", message: "✅ Expense saved!", id: result.insertedId });
      } catch (err) {
        console.error(err);
        res.status(500).json({ status: "error", message: "❌ Failed to save" });
      }
    });

    // Get all expenses
    app.get("/users", async (req, res) => {
      const { uid } = req.query;
      if (!uid) return res.status(400).json({ status: "error", message: "Missing uid" });
      const all = await expenses.find({ uid }).sort({ createdAt: -1 }).toArray();
      res.json(all);
    });

    // Get single expense
    app.get("/user/:id", async (req, res) => {
      try {
        const user = await expenses.findOne({ _id: new ObjectId(req.params.id) });
        if(!user) return res.status(404).json({ status: "error", message: "Not found" });
        res.json(user);
      } catch(err){
        console.error(err);
        res.status(500).json({ status: "error", message: "Invalid id or server error" });
      }
    });

    // Update expense (track edit history)
    app.put("/update/:id", async (req, res) => {
      try {
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
            $push: { editHistory: { editorUid: uid, editorName: editorName || "Unknown", date: new Date(), before, after } },
          }
        );

        io.to(`uid_${uid}`).emit("expenses-changed", { action: "updated", id, uid });
        res.json({ status: "success", message: "✅ Expense updated successfully!" });
      } catch (err) {
        console.error(err);
        res.status(500).json({ status: "error", message: "❌ Failed to update" });
      }
    });

    // DELETE expense
    app.delete("/delete/:id", async (req, res) => {
      try {
        const id = req.params.id;
        if(!id) return res.status(400).json({ status:"error", message:"Missing id" });
        const exp = await expenses.findOne({ _id: new ObjectId(id) });
        if(!exp) return res.status(404).json({ status:"error", message:"Expense not found" });

        await expenses.deleteOne({ _id: new ObjectId(id) });
        io.to(`uid_${exp.uid}`).emit("expenses-changed", { action: "deleted", id, uid: exp.uid });
        res.json({ status: "success", message: "✅ Expense deleted" });
      } catch(err){
        console.error(err);
        res.status(500).json({ status: "error", message: "❌ Failed to delete" });
      }
    });

    // Budget routes
    app.post("/setBudget", async (req, res) => {
      try {
        const { uid, amount, reset } = req.body;
        if (!uid) return res.status(400).json({ status: "error", message: "Missing uid" });

        if (reset) {
          await budgets.deleteOne({ uid });
          io.to(`uid_${uid}`).emit("budget-changed", { uid, amount: 0 });
          return res.json({ status: "success", message: "✅ Budget reset" });
        }

        const amt = parseFloat(amount) || 0;
        await budgets.updateOne({ uid }, { $set: { uid, amount: amt, updatedAt: new Date() } }, { upsert: true });
        io.to(`uid_${uid}`).emit("budget-changed", { uid, amount: amt });
        res.json({ status: "success", message: "✅ Budget saved" });
      } catch(err){
        console.error(err);
        res.status(500).json({ status:"error", message:"❌ Budget operation failed" });
      }
    });

    app.get("/getBudget", async (req, res) => {
      try {
        const { uid } = req.query;
        if(!uid) return res.status(400).json({ status:"error", message:"Missing uid" });
        const b = await budgets.findOne({ uid });
        res.json({ amount: b?.amount || 0, updatedAt: b?.updatedAt || null });
      } catch(err){
        console.error(err);
        res.status(500).json({ status:"error", message:"❌ Failed to get budget" });
      }
    });

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
}

start();

