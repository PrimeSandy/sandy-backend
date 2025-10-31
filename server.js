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
        const budgets = db.collection("budgets"); // new collection for budgets

        // Serve front-end
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

        // Update expense
        app.put("/update/:id", async (req, res) => {
            try {
                const { uid, name, amount, type, description, date } = req.body;
                const exp = await expenses.findOne({ _id: new ObjectId(req.params.id) });
                if(!exp || exp.uid !== uid) return res.status(403).json({ status: "error", message: "❌ Cannot edit others' expense" });

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

        // ---------- Budget endpoints ----------
        // Set or reset budget for a user
        // POST body: { uid, amount, reset?: true }
        app.post("/setBudget", async (req, res) => {
            try {
                const { uid, amount, reset } = req.body;
                if(!uid) return res.status(400).json({ status: "error", message: "Missing uid" });

                if(reset){
                    // delete budget doc
                    await budgets.deleteOne({ uid });
                    return res.json({ status: "success", message: "✅ Budget reset/deleted" });
                }

                const amt = parseFloat(amount) || 0;
                if(amt <= 0) {
                    // If amount invalid treat as reset
                    await budgets.deleteOne({ uid });
                    return res.json({ status: "success", message: "✅ Budget reset (invalid amount)" });
                }

                // upsert budget doc
                await budgets.updateOne(
                    { uid },
                    { $set: { uid, amount: amt, updatedAt: new Date() } },
                    { upsert: true }
                );
                res.json({ status: "success", message: "✅ Budget saved" });
            } catch (err) {
                console.error(err);
                res.status(500).json({ status: "error", message: "❌ Failed to save budget" });
            }
        });

        // Get budget for a user
        // GET /getBudget?uid=...
        app.get("/getBudget", async (req, res) => {
            try {
                const { uid } = req.query;
                if(!uid) return res.status(400).json({ status: "error", message: "Missing uid" });
                const b = await budgets.findOne({ uid });
                if(!b) return res.json({ amount: 0 });
                res.json({ amount: b.amount, updatedAt: b.updatedAt });
            } catch (err) {
                console.error(err);
                res.status(500).json({ status: "error", message: "❌ Failed to fetch budget" });
            }
        });
        // ---------- End budget endpoints ----------

        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

    } catch (err) {
        console.error("❌ MongoDB connection error:", err);
        process.exit(1);
    }
}

start();

