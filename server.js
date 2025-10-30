import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import pkg from "pg";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pkg;

const app = express();
app.use(bodyParser.json());
app.use(cors());

// ✅ Database Connection (PostgreSQL)
const db = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
  ssl: {
    rejectUnauthorized: false, // required for Render Postgres
  },
});

db.connect()
  .then(() => console.log("✅ PostgreSQL Connected"))
  .catch((err) => console.error("❌ DB Connection Failed:", err));

// ✅ User Registration Route
app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.query(
      "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id",
      [username, hashedPassword]
    );
    res.json({ success: true, userId: result.rows[0].id });
  } catch (err) {
    if (err.code === "23505") {
      // PostgreSQL duplicate entry code
      return res
        .status(409)
        .json({ success: false, message: "Username already exists" });
    }
    console.error("Registration Error:", err);
    res.status(500).json({ success: false, error: err });
  }
});

// ✅ User Login Route
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await db.query("SELECT * FROM users WHERE username = $1", [
      username,
    ]);

    if (result.rows.length === 0) {
      return res
        .status(401)
        .json({ success: false, message: "Username not found" });
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res.json({ success: false, message: "Invalid Password" });
    }

    res.json({ success: true, userId: user.id });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ success: false, error: err });
  }
});

// ✅ Get all tasks for a user
app.get("/tasks/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await db.query("SELECT * FROM tasks WHERE user_id = $1", [
      userId,
    ]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err });
  }
});

// ✅ Add a new task
app.post("/tasks", async (req, res) => {
  const { userId, text } = req.body;
  try {
    const result = await db.query(
      "INSERT INTO tasks (user_id, text, completed) VALUES ($1, $2, false) RETURNING id",
      [userId, text]
    );
    res.json({ id: result.rows[0].id, text, completed: false });
  } catch (err) {
    res.status(500).json({ error: err });
  }
});

// ✅ Toggle task completion
app.put("/tasks/:id", async (req, res) => {
  const { id } = req.params;
  const { completed } = req.body;
  try {
    await db.query("UPDATE tasks SET completed = $1 WHERE id = $2", [
      completed,
      id,
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err });
  }
});

// ✅ Delete task
app.delete("/tasks/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("DELETE FROM tasks WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err });
  }
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});