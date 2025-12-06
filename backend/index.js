const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.resolve(__dirname, 'data.json');

function loadData() {
    if (!fs.existsSync(DB_FILE)) {
        const initial = { users: [], employees: [], shifts: [], _seq: { users: 1, employees: 1, shifts: 1 } };
        fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveData(d) { fs.writeFileSync(DB_FILE, JSON.stringify(d, null, 2)); }

let db = loadData();

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_for_testing_only';
const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors());
app.use(express.json());

// --- DB setup ---
function initDb() {
    // seed users and employees if empty
    if (db.users.length === 0) {
        db.users.push({ id: db._seq.users++, email: 'admin@company.local', password: bcrypt.hashSync('Admin@2025!', 8), role: 'admin' });
        db.users.push({ id: db._seq.users++, email: 'hire-me@anshumat.org', password: bcrypt.hashSync('HireMe@2025!', 8), role: 'user' });
        console.log('Seeded users');
    }
    if (db.employees.length === 0) {
        db.employees.push({ id: db._seq.employees++, name: 'Alice Admin', employee_code: 'E001', department: 'HR' });
        db.employees.push({ id: db._seq.employees++, name: 'Bob Worker', employee_code: 'E002', department: 'Engineering' });
        console.log('Seeded employees');
    }
    saveData(db);
}

initDb();

// --- helpers ---
function generateToken(user) {
    const payload = { id: user.id, email: user.email, role: user.role };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

function authMiddleware(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'Missing Authorization header' });
    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Invalid Authorization header' });
    const token = parts[1];
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

function requireRole(role) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Missing user' });
        if (req.user.role !== role) return res.status(403).json({ error: 'Forbidden: insufficient role' });
        next();
    };
}

// --- routes ---
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const row = db.users.find(u => u.email === email);
    if (!row) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = bcrypt.compareSync(password, row.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = generateToken(row);
    res.json({ token, user: { id: row.id, email: row.email, role: row.role } });
});

app.get('/employees', authMiddleware, (req, res) => {
    const rows = db.employees.map(({ id, name, employee_code, department }) => ({ id, name, employee_code, department }));
    res.json(rows);
});

// GET /shifts?employee=xx&date=yyyy-mm-dd
app.get('/shifts', authMiddleware, (req, res) => {
    const { employee, date } = req.query;
    // Build result set from JSON store
    const mapEmpById = Object.fromEntries(db.employees.map(e => [e.id, e]));

    let filtered = db.shifts.slice();
    if (req.user.role === 'user') {
        const email = req.user.email;
        let empCode;
        if (email === 'hire-me@anshumat.org') empCode = 'E002';
        else if (email === 'admin@company.local') empCode = 'E001';
        const emp = db.employees.find(x => x.employee_code === empCode);
        if (!emp) return res.json([]);
        filtered = filtered.filter(s => s.employee_id === emp.id);
        if (date) filtered = filtered.filter(s => s.date === date);
    } else {
        if (employee) {
            const emp = db.employees.find(x => x.employee_code === employee);
            if (emp) filtered = filtered.filter(s => s.employee_id === emp.id);
            else filtered = [];
        }
        if (date) filtered = filtered.filter(s => s.date === date);
    }

    const rows = filtered.map(s => ({ id: s.id, employee_id: s.employee_id, employee_name: mapEmpById[s.employee_id]?.name || '', employee_code: mapEmpById[s.employee_id]?.employee_code || '', date: s.date, start_time: s.start_time, end_time: s.end_time }));
    res.json(rows);
});

// POST /shifts (admin only)
app.post('/shifts', authMiddleware, requireRole('admin'), (req, res) => {
    const { employee_code, date, start_time, end_time } = req.body;
    if (!employee_code || !date || !start_time || !end_time) return res.status(400).json({ error: 'employee_code, date, start_time, end_time required' });

    // parse times as HH:MM
    function toMinutes(t) {
        const m = /^([0-2]?\d):([0-5]\d)$/.exec(t);
        if (!m) return null;
        return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    }
    const sMin = toMinutes(start_time);
    const eMin = toMinutes(end_time);
    if (sMin === null || eMin === null) return res.status(400).json({ error: 'Invalid time format. Use HH:MM' });
    if (eMin - sMin < 4 * 60) return res.status(400).json({ error: 'Shift must be at least 4 hours' });

    // find employee
    const emp = db.employees.find(e => e.employee_code === employee_code);
    if (!emp) return res.status(400).json({ error: 'Employee not found' });

    // Check overlapping shifts for same employee on same date
    const overlaps = db.shifts.filter(s => s.employee_id === emp.id && s.date === date);
    for (const o of overlaps) {
        const os = toMinutes(o.start_time);
        const oe = toMinutes(o.end_time);
        if (Math.max(os, sMin) < Math.min(oe, eMin)) {
            return res.status(400).json({ error: 'Overlapping shift for employee on that date' });
        }
    }

    const newShift = { id: db._seq.shifts++, employee_id: emp.id, date, start_time, end_time };
    db.shifts.push(newShift);
    saveData(db);
    res.json({ id: newShift.id });
});

app.delete('/shift/:id', authMiddleware, requireRole('admin'), (req, res) => {
    const id = req.params.id;
    const idx = db.shifts.findIndex(s => String(s.id) === String(id));
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    db.shifts.splice(idx, 1);
    saveData(db);
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Shift Board backend running on http://localhost:${PORT}`);
});
