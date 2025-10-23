require("dotenv").config();

const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/public", express.static(path.join(__dirname, "public")));

// ✅ MongoDB connection string (direct)
const uri = "mongodb+srv://Sandydb456:Sandydb456@cluster0.o4lr4zd.mongodb.net/PTS_PRO?retryWrites=true&w=majority";
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

async function start() {
    try {
        await client.connect();
        console.log("✅ Connected to MongoDB successfully!");

        const db = client.db("PTS_PRO");
        const expenses = db.collection("expenses");

        // Serve homepage
        app.get("/", (req, res) => {
            res.sendFile(path.join(__dirname, "index.html"));
        });

        // Add expense
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

        // Get single expense by ID
        app.get("/user/:id", async (req, res) => {
            try {
                const user = await expenses.findOne({ _id: new ObjectId(req.params.id) });
                res.json(user);
            } catch (err) {
                res.status(500).send("Error fetching user");
            }
        });

        // Update expense
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

        // Start server
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
    } catch (err) {
        console.error("❌ Error connecting to MongoDB:", err);
    }
}

start();
