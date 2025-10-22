
const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const path = require("path");

const app = express();
app.use(express.json());
app.use("/public", express.static(path.join(__dirname, "public")));

const uri = "mongodb+srv://Sandydb456:Sandydb456@cluster0.o4lr4zd.mongodb.net/myDB?retryWrites=true&w=majority";
const client = new MongoClient(uri);

async function start() {
    try {
        await client.connect();
        const db = client.db("PTS_PRO");
        const expenses = db.collection("expenses");

        // Serve main page
        app.get("/", (req, res) => {
            res.sendFile(path.join(__dirname, "index.html"));
        });

        // Add new expense
        app.post("/submit", async (req, res) => {
            const { name, amount, type, description, date } = req.body;
            await expenses.insertOne({ name, amount, type, description, date });
            res.send("✅ Expense saved successfully!");
        });

        // Get all expenses
        app.get("/users", async (req, res) => {
            const all = await expenses.find().toArray();
            res.json(all);
        });

        // 🔹 Get single expense by ID
        app.get("/user/:id", async (req, res) => {
            try {
                const user = await expenses.findOne({ _id: new ObjectId(req.params.id) });
                res.json(user);
            } catch (err) {
                res.status(500).send("Error fetching user");
            }
        });

        // 🔹 Update existing expense
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

        app.listen(3000, () => console.log("🚀 Server running on http://localhost:3000"));
    } catch (err) {
        console.error("❌ Error:", err);
    }
}

start();
