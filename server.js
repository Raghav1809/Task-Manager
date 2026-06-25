const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'taskapp_secret_key';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database(path.join(__dirname, 'tasks.db'));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      dueDate TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
}

app.post('/api/auth/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const query = 'INSERT INTO users (email, password) VALUES (?, ?)';
  db.run(query, [email.toLowerCase(), hashedPassword], function (err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(409).json({ message: 'A user with that email already exists.' });
      }
      return res.status(500).json({ message: 'Could not create user.' });
    }

    const token = jwt.sign({ id: this.lastID, email }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, email });
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const query = 'SELECT * FROM users WHERE email = ?';
  db.get(query, [email.toLowerCase()], (err, user) => {
    if (err) return res.status(500).json({ message: 'Could not log in.' });
    if (!user) return res.status(401).json({ message: 'Invalid email or password.' });

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Invalid email or password.' });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, email: user.email });
  });
});

app.get('/api/tasks', authenticateToken, (req, res) => {
  const query = 'SELECT * FROM tasks WHERE userId = ? ORDER BY createdAt DESC';
  db.all(query, [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Could not load tasks.' });
    res.json(rows);
  });
});

app.post('/api/tasks', authenticateToken, (req, res) => {
  const { title, description, dueDate, status } = req.body;
  if (!title) {
    return res.status(400).json({ message: 'Task title is required.' });
  }

  const query = `INSERT INTO tasks (userId, title, description, dueDate, status, createdAt)
                 VALUES (?, ?, ?, ?, ?, ?)`;
  const createdAt = new Date().toISOString();
  db.run(query, [req.user.id, title, description || '', dueDate || '', status || 'pending', createdAt], function (err) {
    if (err) return res.status(500).json({ message: 'Could not create task.' });
    db.get('SELECT * FROM tasks WHERE id = ?', [this.lastID], (err, task) => {
      if (err) return res.status(500).json({ message: 'Could not retrieve task.' });
      res.json(task);
    });
  });
});

app.put('/api/tasks/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { title, description, dueDate, status } = req.body;
  const query = 'SELECT * FROM tasks WHERE id = ? AND userId = ?';

  db.get(query, [id, req.user.id], (err, task) => {
    if (err) return res.status(500).json({ message: 'Could not update task.' });
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    const updateQuery = `UPDATE tasks SET title = ?, description = ?, dueDate = ?, status = ? WHERE id = ?`;
    db.run(updateQuery, [title || task.title, description || task.description, dueDate || task.dueDate, status || task.status, id], function (err) {
      if (err) return res.status(500).json({ message: 'Could not save changes.' });
      db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, updatedTask) => {
        if (err) return res.status(500).json({ message: 'Could not retrieve updated task.' });
        res.json(updatedTask);
      });
    });
  });
});

app.delete('/api/tasks/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const query = 'DELETE FROM tasks WHERE id = ? AND userId = ?';

  db.run(query, [id, req.user.id], function (err) {
    if (err) return res.status(500).json({ message: 'Could not delete task.' });
    if (this.changes === 0) return res.status(404).json({ message: 'Task not found.' });
    res.json({ success: true });
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
