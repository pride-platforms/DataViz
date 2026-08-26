const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../')));

// Database initialization
const db = new sqlite3.Database('./dataviz.db', (err) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

// Initialize database tables
function initializeDatabase() {
    // Users table
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Spreadsheets table
    db.run(`
        CREATE TABLE IF NOT EXISTS spreadsheets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Spreadsheet data table (stores rows of data)
    db.run(`
        CREATE TABLE IF NOT EXISTS spreadsheet_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            spreadsheet_id INTEGER NOT NULL,
            row_index INTEGER NOT NULL,
            label TEXT,
            value REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (spreadsheet_id) REFERENCES spreadsheets(id) ON DELETE CASCADE
        )
    `);

    // Charts table (stores chart configurations)
    db.run(`
        CREATE TABLE IF NOT EXISTS charts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            spreadsheet_id INTEGER NOT NULL,
            chart_type TEXT NOT NULL,
            chart_title TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (spreadsheet_id) REFERENCES spreadsheets(id) ON DELETE CASCADE
        )
    `);
}

// Middleware to verify JWT token
function verifyToken(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        req.userId = decoded.id;
        next();
    });
}

// Routes

// User Registration
app.post('/api/auth/register', (req, res) => {
    const { username, email, password, confirmPassword } = req.body;

    if (!username || !email || !password || !confirmPassword) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    if (password !== confirmPassword) {
        return res.status(400).json({ error: 'Passwords do not match' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Hash password
    bcryptjs.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            return res.status(500).json({ error: 'Error hashing password' });
        }

        db.run(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [username, email, hashedPassword],
            function(err) {
                if (err) {
                    return res.status(400).json({ error: 'Username or email already exists' });
                }

                const token = jwt.sign({ id: this.lastID, username }, JWT_SECRET, { expiresIn: '7d' });
                res.status(201).json({ 
                    message: 'User registered successfully',
                    token,
                    user: { id: this.lastID, username, email }
                });
            }
        );
    });
});

// User Login
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        bcryptjs.compare(password, user.password, (err, isMatch) => {
            if (err) {
                return res.status(500).json({ error: 'Error comparing passwords' });
            }

            if (!isMatch) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
            res.json({ 
                message: 'Login successful',
                token,
                user: { id: user.id, username: user.username, email: user.email }
            });
        });
    });
});

// Create Spreadsheet
app.post('/api/spreadsheets', verifyToken, (req, res) => {
    const { title, description } = req.body;

    if (!title) {
        return res.status(400).json({ error: 'Title is required' });
    }

    db.run(
        'INSERT INTO spreadsheets (user_id, title, description) VALUES (?, ?, ?)',
        [req.userId, title, description || ''],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Error creating spreadsheet' });
            }
            res.status(201).json({ 
                message: 'Spreadsheet created successfully',
                spreadsheet: { id: this.lastID, title, description }
            });
        }
    );
});

// Get user's spreadsheets
app.get('/api/spreadsheets', verifyToken, (req, res) => {
    db.all(
        'SELECT * FROM spreadsheets WHERE user_id = ? ORDER BY updated_at DESC',
        [req.userId],
        (err, spreadsheets) => {
            if (err) {
                return res.status(500).json({ error: 'Error fetching spreadsheets' });
            }
            res.json(spreadsheets);
        }
    );
});

// Get single spreadsheet with data
app.get('/api/spreadsheets/:id', verifyToken, (req, res) => {
    const { id } = req.params;

    // First get the spreadsheet
    db.get(
        'SELECT * FROM spreadsheets WHERE id = ? AND user_id = ?',
        [id, req.userId],
        (err, spreadsheet) => {
            if (err) {
                return res.status(500).json({ error: 'Error fetching spreadsheet' });
            }

            if (!spreadsheet) {
                return res.status(404).json({ error: 'Spreadsheet not found' });
            }

            // Then get the data
            db.all(
                'SELECT * FROM spreadsheet_data WHERE spreadsheet_id = ? ORDER BY row_index',
                [id],
                (err, data) => {
                    if (err) {
                        return res.status(500).json({ error: 'Error fetching data' });
                    }

                    res.json({ spreadsheet, data });
                }
            );
        }
    );
});

// Add data to spreadsheet
app.post('/api/spreadsheets/:id/data', verifyToken, (req, res) => {
    const { id } = req.params;
    const { label, value } = req.body;

    if (!label || value === undefined) {
        return res.status(400).json({ error: 'Label and value are required' });
    }

    // Verify ownership
    db.get(
        'SELECT id FROM spreadsheets WHERE id = ? AND user_id = ?',
        [id, req.userId],
        (err, spreadsheet) => {
            if (err || !spreadsheet) {
                return res.status(404).json({ error: 'Spreadsheet not found' });
            }

            // Get the next row index
            db.get(
                'SELECT MAX(row_index) as max_index FROM spreadsheet_data WHERE spreadsheet_id = ?',
                [id],
                (err, result) => {
                    const nextIndex = (result?.max_index || 0) + 1;

                    db.run(
                        'INSERT INTO spreadsheet_data (spreadsheet_id, row_index, label, value) VALUES (?, ?, ?, ?)',
                        [id, nextIndex, label, value],
                        function(err) {
                            if (err) {
                                return res.status(500).json({ error: 'Error adding data' });
                            }

                            // Update spreadsheet timestamp
                            db.run('UPDATE spreadsheets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);

                            res.status(201).json({ 
                                message: 'Data added successfully',
                                dataRow: { id: this.lastID, label, value }
                            });
                        }
                    );
                }
            );
        }
    );
});

// Delete data row
app.delete('/api/spreadsheets/:spreadsheetId/data/:dataId', verifyToken, (req, res) => {
    const { spreadsheetId, dataId } = req.params;

    // Verify ownership
    db.get(
        'SELECT id FROM spreadsheets WHERE id = ? AND user_id = ?',
        [spreadsheetId, req.userId],
        (err, spreadsheet) => {
            if (err || !spreadsheet) {
                return res.status(404).json({ error: 'Spreadsheet not found' });
            }

            db.run(
                'DELETE FROM spreadsheet_data WHERE id = ? AND spreadsheet_id = ?',
                [dataId, spreadsheetId],
                (err) => {
                    if (err) {
                        return res.status(500).json({ error: 'Error deleting data' });
                    }

                    db.run('UPDATE spreadsheets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [spreadsheetId]);

                    res.json({ message: 'Data deleted successfully' });
                }
            );
        }
    );
});

// Update spreadsheet
app.put('/api/spreadsheets/:id', verifyToken, (req, res) => {
    const { id } = req.params;
    const { title, description } = req.body;

    db.run(
        'UPDATE spreadsheets SET title = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
        [title, description, id, req.userId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Error updating spreadsheet' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Spreadsheet not found' });
            }

            res.json({ message: 'Spreadsheet updated successfully' });
        }
    );
});

// Delete spreadsheet
app.delete('/api/spreadsheets/:id', verifyToken, (req, res) => {
    const { id } = req.params;

    db.run(
        'DELETE FROM spreadsheets WHERE id = ? AND user_id = ?',
        [id, req.userId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Error deleting spreadsheet' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Spreadsheet not found' });
            }

            res.json({ message: 'Spreadsheet deleted successfully' });
        }
    );
});

// Save chart
app.post('/api/spreadsheets/:id/charts', verifyToken, (req, res) => {
    const { id } = req.params;
    const { chartType, chartTitle } = req.body;

    if (!chartType) {
        return res.status(400).json({ error: 'Chart type is required' });
    }

    // Verify ownership
    db.get(
        'SELECT id FROM spreadsheets WHERE id = ? AND user_id = ?',
        [id, req.userId],
        (err, spreadsheet) => {
            if (err || !spreadsheet) {
                return res.status(404).json({ error: 'Spreadsheet not found' });
            }

            db.run(
                'INSERT INTO charts (spreadsheet_id, chart_type, chart_title) VALUES (?, ?, ?)',
                [id, chartType, chartTitle || ''],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Error saving chart' });
                    }

                    res.status(201).json({ 
                        message: 'Chart saved successfully',
                        chart: { id: this.lastID, chartType, chartTitle }
                    });
                }
            );
        }
    );
});

// Get charts for spreadsheet
app.get('/api/spreadsheets/:id/charts', verifyToken, (req, res) => {
    const { id } = req.params;

    // Verify ownership
    db.get(
        'SELECT id FROM spreadsheets WHERE id = ? AND user_id = ?',
        [id, req.userId],
        (err, spreadsheet) => {
            if (err || !spreadsheet) {
                return res.status(404).json({ error: 'Spreadsheet not found' });
            }

            db.all(
                'SELECT * FROM charts WHERE spreadsheet_id = ? ORDER BY created_at DESC',
                [id],
                (err, charts) => {
                    if (err) {
                        return res.status(500).json({ error: 'Error fetching charts' });
                    }

                    res.json(charts);
                }
            );
        }
    );
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'Server is running' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
