require("dotenv").config();
const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const path = require("path");
const cors = require("cors");

const app = express();

// Allow CORS from all origins
app.use(cors());
app.use(express.json());
app.use("/public", express.static(path.join(__dirname, "public")));

// MongoDB connection
const uri = process.env.MONGODB_URI || "mongodb+srv://Sandydb456:Sandydb456@cluster0.o4lr4zd.mongodb.net/PTS_PRO?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function start() {
    try {
        await client.connect();
        console.log("✅ Connected to MongoDB!");

        const db = client.db("PTS_PRO");
        const expenses = db.collection("expenses");

        app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

        app.post("/submit", async (req, res) => {
            try {
                const { name, amount, type, description, date } = req.body;
                const result = await expenses.insertOne({ name, amount, type, description, date });
                res.json({ status: "success", message: "✅ Expense saved successfully!", id: result.insertedId });
            } catch (err) {
                console.error(err);
                res.status(500).json({ status: "error", message: "❌ Failed to save expense" });
            }
        });

        app.get("/users", async (req, res) => {
            try {
                const all = await expenses.find().toArray();
                res.json(all);
            } catch (err) {
                console.error(err);
                res.status(500).json({ status: "error", message: "❌ Failed to fetch expenses" });
            }
        });

        app.get("/user/:id", async (req, res) => {
            try {
                const user = await expenses.findOne({ _id: new ObjectId(req.params.id) });
                res.json(user);
            } catch (err) {
                console.error(err);
                res.status(500).json({ status: "error", message: "❌ Failed to fetch expense" });
            }
        });

        app.put("/update/:id", async (req, res) => {
            try {
                const { name, amount, type, description, date } = req.body;
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

        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
    } catch (err) {
        console.error("❌ MongoDB connection error:", err);
    }
}

start();
