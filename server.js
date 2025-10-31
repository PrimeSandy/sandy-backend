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
  cors: { origin: "*", methods: ["GET","POST","PUT"] }
});

const uri = process.env.MONGODB_URI || "mongodb+srv://Sandydb456:Sandydb456@cluster0.o4lr4zd.mongodb.net/PTS_PRO?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function start(){
  try {
    await client.connect();
    console.log("✅ Connected to MongoDB!");
    const db = client.db();
    const expenses = db.collection("expenses");
    const budgets = db.collection("budgets");

    // Serve front-end index if needed (optional)
    app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

    // SOCKET.IO rooms
    io.on("connection", (socket) => {
      console.log("Socket connected:", socket.id);
      socket.on("join", (uid) => {
        if(uid) {
          socket.join(`uid_${uid}`);
          console.log(`Socket ${socket.id} joined uid_${uid}`);
        }
      });
      socket.on("disconnect", () => {});
    });

    // Create expense
    app.post("/submit", async (req, res) => {
      try {
        const { uid, name, amount, type, description, date } = req.body;
        if(!uid) return res.status(400).json({ status:"error", message:"Missing uid" });
        const now = new Date();
        const doc = { uid, name, amount, type, description, date, createdAt: now, updatedAt: now, editCount: 0, editHistory: [] };
        const result = await expenses.insertOne(doc);
        io.to(`uid_${uid}`).emit("expenses-changed", { action:"created", id: result.insertedId, uid });
        res.json({ status:"success", message:"✅ Expense saved successfully!", id: result.insertedId });
      } catch(err){ console.error(err); res.status(500).json({ status:"error", message:"❌ Failed to save expense" }); }
    });

    // Get all expenses for a user
    app.get("/users", async (req,res) => {
      try {
        const { uid } = req.query;
        if(!uid) return res.status(400).json({ status:"error", message:"Missing uid" });
        const all = await expenses.find({ uid }).sort({ createdAt: -1 }).toArray();
        res.json(all);
      } catch(err){ console.error(err); res.status(500).json({ status:"error", message:"❌ Failed to fetch expenses" }); }
    });

    // Get single expense
    app.get("/user/:id", async (req,res) => {
      try {
        const id = req.params.id;
        if(!ObjectId.isValid(id)) return res.status(400).json({ status:"error", message:"Invalid id" });
        const user = await expenses.findOne({ _id: new ObjectId(id) });
        if(!user) return res.status(404).json({ status:"error", message:"Not found" });
        res.json(user);
      } catch(err){ console.error(err); res.status(500).json({ status:"error", message:"❌ Failed to fetch expense" }); }
    });

    // Update expense (record history)
    app.put("/update/:id", async (req,res) => {
      try {
        const { uid, editorName, name, amount, type, description, date } = req.body;
        const id = req.params.id;
        if(!ObjectId.isValid(id)) return res.status(400).json({ status:"error", message:"Invalid id" });

        const exp = await expenses.findOne({ _id: new ObjectId(id) });
        if(!exp) return res.status(404).json({ status:"error", message:"Expense not found" });
        if(exp.uid !== uid) return res.status(403).json({ status:"error", message:"❌ Cannot edit others' expense" });

        const before = { name: exp.name, amount: exp.amount, type: exp.type, description: exp.description, date: exp.date };
        const after = { name, amount, type, description, date };

        await expenses.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: { name, amount, type, description, date, updatedAt: new Date() },
            $inc: { editCount: 1 },
            $push: { editHistory: { editorUid: uid, editorName: editorName || null, date: new Date(), before, after } }
          }
        );

        io.to(`uid_${uid}`).emit("expenses-changed", { action:"updated", id, uid });
        res.json({ status:"success", message:"✅ Expense updated successfully!" });
      } catch(err){ console.error(err); res.status(500).json({ status:"error", message:"❌ Failed to update expense" }); }
    });

    // Budget endpoints
    app.post("/setBudget", async (req,res) => {
      try {
        const { uid, amount, reset } = req.body;
        if(!uid) return res.status(400).json({ status:"error", message:"Missing uid" });

        if(reset){
          await budgets.deleteOne({ uid });
          io.to(`uid_${uid}`).emit("budget-changed", { uid, amount: 0 });
          return res.json({ status:"success", message:"✅ Budget reset/deleted" });
        }

        const amt = parseFloat(amount) || 0;
        if(amt <= 0){
          await budgets.deleteOne({ uid });
          io.to(`uid_${uid}`).emit("budget-changed", { uid, amount: 0 });
          return res.json({ status:"success", message:"✅ Budget reset (invalid amount)" });
        }

        await budgets.updateOne({ uid }, { $set: { uid, amount: amt, updatedAt: new Date() } }, { upsert:true });
        io.to(`uid_${uid}`).emit("budget-changed", { uid, amount: amt });
        res.json({ status:"success", message:"✅ Budget saved" });
      } catch(err){ console.error(err); res.status(500).json({ status:"error", message:"❌ Failed to save budget" }); }
    });

    app.get("/getBudget", async (req,res) => {
      try {
        const { uid } = req.query;
        if(!uid) return res.status(400).json({ status:"error", message:"Missing uid" });
        const b = await budgets.findOne({ uid });
        if(!b) return res.json({ amount: 0 });
        res.json({ amount: b.amount, updatedAt: b.updatedAt });
      } catch(err){ console.error(err); res.status(500).json({ status:"error", message:"❌ Failed to fetch budget" }); }
    });

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
}

start();
