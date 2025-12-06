import React, { useState, useEffect } from 'react';

const API = process.env.API_URL || 'http://localhost:4000';

function saveToken(t) { localStorage.setItem('sb_token', t); }
function getToken() { return localStorage.getItem('sb_token'); }
function clearToken() { localStorage.removeItem('sb_token'); }

function Login({ onLogin }) {
    const [email, setEmail] = useState('hire-me@anshumat.org');
    const [password, setPassword] = useState('HireMe@2025!');
    const [err, setErr] = useState(null);

    async function submit(e) {
        e.preventDefault();
        setErr(null);
        try {
            const res = await fetch(API + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Login failed');
            saveToken(data.token);
            onLogin(data.user);
        } catch (e) { setErr(e.message); }
    }

    return (
        <div className="container">
            <h2>Employee Shift Board — Login</h2>
            <form onSubmit={submit}>
                <div style={{ marginBottom: 8 }}>
                    <label className="small">Email</label><br />
                    <input value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div style={{ marginBottom: 8 }}>
                    <label className="small">Password</label><br />
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button>Login</button>
                    <button type="button" className="secondary" onClick={() => { setEmail('admin@company.local'); setPassword('Admin@2025!') }}>Fill Admin</button>
                </div>
                {err && <div className="error">{err}</div>}
            </form>
        </div>
    );
}

function ShiftForm({ onCreated, employees }) {
    const [employee_code, setEmployeeCode] = useState(employees[0]?.employee_code || '');
    const [date, setDate] = useState('');
    const [start_time, setStart] = useState('09:00');
    const [end_time, setEnd] = useState('17:00');
    const [err, setErr] = useState(null);

    useEffect(() => { if (employees[0]) setEmployeeCode(employees[0].employee_code); }, [employees]);

    async function submit(e) {
        e.preventDefault(); setErr(null);
        try {
            const token = getToken();
            const res = await fetch(API + '/shifts', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ employee_code, date, start_time, end_time }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            onCreated();
            setDate(''); setStart('09:00'); setEnd('13:00');
        } catch (e) { setErr(e.message); }
    }

    return (
        <div style={{ marginTop: 12 }}>
            <h3>Create Shift (Admin)</h3>
            <form onSubmit={submit}>
                <div className="form-row">
                    <select value={employee_code} onChange={e => setEmployeeCode(e.target.value)}>
                        {employees.map(emp => <option key={emp.employee_code} value={emp.employee_code}>{emp.name} ({emp.employee_code})</option>)}
                    </select>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div className="form-row">
                    <input type="time" value={start_time} onChange={e => setStart(e.target.value)} />
                    <input type="time" value={end_time} onChange={e => setEnd(e.target.value)} />
                    <button>Create</button>
                </div>
                {err && <div className="error">{err}</div>}
            </form>
        </div>
    );
}

function ShiftsTable({ shifts, onDelete, isAdmin }) {
    return (
        <div>
            <h3>Shifts</h3>
            <table className="table">
                <thead><tr><th>Employee</th><th>Code</th><th>Date</th><th>Start</th><th>End</th>{isAdmin && <th>Actions</th>}</tr></thead>
                <tbody>
                    {shifts.map(s => (
                        <tr key={s.id}>
                            <td>{s.employee_name}</td>
                            <td>{s.employee_code}</td>
                            <td>{s.date}</td>
                            <td>{s.start_time}</td>
                            <td>{s.end_time}</td>
                            {isAdmin && <td><button className="secondary" onClick={() => onDelete(s.id)}>Delete</button></td>}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function App() {
    const [user, setUser] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [err, setErr] = useState(null);

    useEffect(() => {
        const token = getToken();
        if (!token) return;
        // try to fetch user-specific data
        // token payload not decoded on client; but we persisted user from login
    }, []);

    useEffect(() => {
        if (!user) return;
        fetchEmployees();
        fetchShifts();
    }, [user]);

    async function fetchEmployees() {
        try {
            const token = getToken();
            const res = await fetch(API + '/employees', { headers: { 'Authorization': 'Bearer ' + token } });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch employees');
            setEmployees(data);
        } catch (e) { setErr(e.message); }
    }

    async function fetchShifts() {
        try {
            const token = getToken();
            const res = await fetch(API + '/shifts', { headers: { 'Authorization': 'Bearer ' + token } });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch shifts');
            setShifts(data);
        } catch (e) { setErr(e.message); }
    }

    async function handleDelete(id) {
        try {
            const token = getToken();
            const res = await fetch(API + '/shift/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Delete failed');
            fetchShifts();
        } catch (e) { setErr(e.message); }
    }

    function logout() { clearToken(); setUser(null); setShifts([]); setEmployees([]); }

    if (!getToken() || !user) return <Login onLogin={u => setUser(u)} />;

    return (
        <div className="container">
            <div className="header">
                <h2>Employee Shift Board</h2>
                <div>
                    <span className="small">{user.email} ({user.role})</span>
                    <button className="secondary" style={{ marginLeft: 8 }} onClick={logout}>Logout</button>
                </div>
            </div>

            {user.role === 'admin' && employees.length > 0 && <ShiftForm employees={employees} onCreated={fetchShifts} />}

            <div style={{ marginTop: 12 }}>
                <ShiftsTable shifts={shifts} onDelete={handleDelete} isAdmin={user.role === 'admin'} />
            </div>

            {err && <div className="error">{err}</div>}
        </div>
    );
}
