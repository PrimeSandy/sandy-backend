
const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/public", express.static(path.join(__dirname, "public")));

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

async function start() {
    try {
        await client.connect();
        const db = client.db("PTS_PRO");
        const expenses = db.collection("expenses");

        app.get("/", (req, res) => {
            res.sendFile(path.join(__dirname, "index.html"));
        });

        app.post("/submit", async (req, res) => {
            const { name, amount, type, description, date } = req.body;
            await expenses.insertOne({ name, amount, type, description, date });
            res.send("✅ Expense saved successfully!");
        });

        app.get("/users", async (req, res) => {
            const all = await expenses.find().toArray();
            res.json(all);
        });

        app.get("/user/:id", async (req, res) => {
            try {
                const user = await expenses.findOne({ _id: new ObjectId(req.params.id) });
                res.json(user);
            } catch (err) {
                res.status(500).send("Error fetching user");
            }
        });

        app.put("/update/:id", async (req, res) => {
            try {
                const { name, amount, type, description, date } = req.body;
                await expenses.updateOne(
                    { _id: new ObjectId(req.params.id) },
                    { $set: { name, amount, type, description, date } }
                );
                res.send("✅ Expense updated successfully!");
            } catch (err) {
                console.error(err);
                res.status(500).send("Error updating data");
            }
        });

        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
    } catch (err) {
        console.error("❌ Error:", err);
    }
}

start();
