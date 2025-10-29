import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import mysql from "mysql2";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use(cors());

// ✅ Database Connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  // optional: enable TLS in production depending on provider:
  // ssl: { rejectUnauthorized: true }
});



db.connect((err) => {
  if (err) console.log("❌ DB Connection Failed:", err);
  else console.log("✅ MySQL Connected");
});


// ✅ User Registration Route
app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.query(
      "INSERT INTO users (username, password) VALUES (?, ?)",
      [username, hashedPassword],
      (err, result) => {
        if (err) {
          if (err.code === "ER_DUP_ENTRY") {
            return res
              .status(409)
              .json({ success: false, message: "Username already exists" });
          }
          return res.status(500).json({ success: false, error: err });
        }
        res.json({ success: true, userId: result.insertId });
      }
    );
  } catch (error) {
    res.status(500).json({ success: false, error });
  }
});


// ✅ User Login Route
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  db.query("SELECT * FROM users WHERE username = ?", [username], async (err, result) => {
    if (err) {
        console.error("DB Error:", err);
      return res.status(500).json({ success: false, error: err });
    }

    if (result.length === 0) {
      return res.status(401).json({ success: false, message: "Username not found" });
    }

    const user = result[0];
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res.json({ success: false, message: "Invalid Password" });
    }

    res.json({ success: true, userId: user.id });
  });
});


// ✅ Get all tasks for a user
app.get("/tasks/:userId", (req, res) => {
  const { userId } = req.params;

  db.query("SELECT * FROM tasks WHERE user_id = ?", [userId], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    res.json(result);
  });
});


// ✅ Add a new task
app.post("/tasks", (req, res) => {
  const { userId, text } = req.body;

  db.query(
    "INSERT INTO tasks (user_id, text, completed) VALUES (?, ?, false)",
    [userId, text],
    (err, result) => {
      if (err) return res.status(500).json({ error: err });
      res.json({ id: result.insertId, text, completed: false });
    }
  );
});


// ✅ Toggle task completion
app.put("/tasks/:id", (req, res) => {
  const { id } = req.params;
  const { completed } = req.body;

  db.query("UPDATE tasks SET completed = ? WHERE id = ?", [completed, id], (err) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ success: true });
  });
});


// ✅ Delete task
app.delete("/tasks/:id", (req, res) => {
  const { id } = req.params;

  db.query("DELETE FROM tasks WHERE id = ?", [id], (err) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ success: true });
  });
});


// ✅ Start server
app.listen(5000, () => {
  console.log("🚀 Server is running on port 5000");
});