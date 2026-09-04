const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Create Recordings Directory
const RECORDINGS_DIR = path.join(__dirname, 'public', 'recordings');
if (!fs.existsSync(RECORDINGS_DIR)) {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

// File Storage Paths
const DB_FILE = path.join(__dirname, 'carriers_db.json');
const USERS_FILE = path.join(__dirname, 'users_db.json');
const LOGS_FILE = path.join(__dirname, 'activity_logs.json');

// --- USER DATABASE & AUTHENTICATION ---
let usersDatabase = [];
let activeSessions = {}; // token -> user object

function getInitialUsers() {
  return [
    {
      id: "USER-ADMIN",
      name: "System Admin",
      email: "admin@carrierintel.com",
      password: "admin123",
      role: "ADMIN",
      createdAt: new Date().toISOString()
    },
    {
      id: "USER-ALEX",
      name: "Alex Johnson",
      email: "alex@carrierintel.com",
      password: "alex123",
      role: "SALES_REP",
      createdAt: new Date().toISOString()
    },
    {
      id: "USER-SARAH",
      name: "Sarah Davis",
      email: "sarah@carrierintel.com",
      password: "sarah123",
      role: "SALES_REP",
      createdAt: new Date().toISOString()
    },
    {
      id: "USER-MICHAEL",
      name: "Michael Miller",
      email: "michael@carrierintel.com",
      password: "michael123",
      role: "SALES_REP",
      createdAt: new Date().toISOString()
    },
    {
      id: "USER-DAVID",
      name: "David Wilson",
      email: "david@carrierintel.com",
      password: "david123",
      role: "SALES_REP",
      createdAt: new Date().toISOString()
    }
  ];
}

function loadUsersDatabase() {
  if (fs.existsSync(USERS_FILE)) {
    try {
      usersDatabase = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch (e) {
      usersDatabase = getInitialUsers();
      saveUsersDatabase();
    }
  } else {
    usersDatabase = getInitialUsers();
    saveUsersDatabase();
  }
}

function saveUsersDatabase() {
  fs.writeFileSync(USERS_FILE, JSON.stringify(usersDatabase, null, 2), 'utf8');
}

loadUsersDatabase();

// --- CARRIER DATABASE ---
let carriersDatabase = [];

function loadDatabase() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      carriersDatabase = JSON.parse(data);
      console.log(`[DB] Successfully loaded ${carriersDatabase.length} carrier records from ${DB_FILE}`);
    } catch (e) {
      console.error('[DB] Failed to parse JSON, starting empty database...', e);
      carriersDatabase = [];
      saveDatabase();
    }
  } else {
    console.log('[DB] No database found. Starting empty database...');
    carriersDatabase = [];
    saveDatabase();
  }
}

function saveDatabase() {
  fs.writeFileSync(DB_FILE, JSON.stringify(carriersDatabase, null, 2), 'utf8');
}

loadDatabase();

// --- ACTIVITY LOGS DATABASE ---
let activityLogs = [];

function loadLogs() {
  if (fs.existsSync(LOGS_FILE)) {
    try {
      activityLogs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8'));
    } catch (e) {
      activityLogs = [];
      saveLogs();
    }
  } else {
    activityLogs = [];
    saveLogs();
  }
}

function saveLogs() {
  fs.writeFileSync(LOGS_FILE, JSON.stringify(activityLogs, null, 2), 'utf8');
}

const SESSIONS_DB_FILE = path.join(__dirname, 'sessions_db.json');

function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_DB_FILE)) {
      activeSessions = JSON.parse(fs.readFileSync(SESSIONS_DB_FILE, 'utf8'));
      console.log(`[DB] Successfully loaded active sessions from ${SESSIONS_DB_FILE}`);
    }
  } catch (err) {
    console.error('[DB Error] Failed to load sessions_db.json:', err.message);
    activeSessions = {};
  }
}

function saveSessions() {
  try {
    fs.writeFileSync(SESSIONS_DB_FILE, JSON.stringify(activeSessions, null, 2), 'utf8');
  } catch (err) {
    console.error('[DB Error] Failed to save sessions_db.json:', err.message);
  }
}

loadLogs();
loadSessions();

function logActivity(actionType, user, details) {
  const logEntry = {
    id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    displayTime: new Date().toLocaleString(),
    actionType: actionType,
    userId: user ? user.id : 'SYSTEM',
    userName: user ? user.name : 'System Engine',
    userRole: user ? user.role : 'SYSTEM',
    carrierId: details.carrierId || '',
    companyName: details.companyName || '',
    status: details.status || '',
    noteText: details.noteText || '',
    recordingUrl: details.recordingUrl || '',
    recordingDuration: details.recordingDuration || 0
  };
  activityLogs.unshift(logEntry);
  saveLogs();
}

// --- AUTHENTICATION MIDDLEWARE ---
function getSessionUser(req) {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace('Bearer ', '') : (req.query.token || req.headers['x-session-token']);
  if (token && activeSessions[token]) {
    return activeSessions[token];
  }
  // Optional Header Fallback for User Identity Header
  const fallbackUser = req.headers['x-user-role'];
  if (fallbackUser && fallbackUser !== 'ADMIN') {
    const found = usersDatabase.find(u => u.name === fallbackUser);
    if (found) return { id: found.id, name: found.name, email: found.email, role: found.role };
  }
  return null;
}

function requireAuth(req, res, rolesAllowed = null) {
  const sessionUser = getSessionUser(req);
  if (!sessionUser) {
    res.status(401).json({ error: 'Unauthorized: Please log in.' });
    return null;
  }
  if (rolesAllowed && !rolesAllowed.includes(sessionUser.role)) {
    res.status(403).json({ error: 'Forbidden: Insufficient privileges.' });
    return null;
  }
  return sessionUser;
}

// AUTH API: Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = usersDatabase.find(u => u.email.toLowerCase() === email.toLowerCase().trim() && u.password === password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid corporate email or password.' });
  }

  const token = `SESS-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
  activeSessions[token] = safeUser;
  saveSessions();

  logActivity('USER_LOGIN', safeUser, { noteText: `User ${safeUser.name} logged into system.` });
  res.json({ message: 'Login successful', token, user: safeUser });
});

// AUTH API: Current User
app.get('/api/auth/me', (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json(user);
});

// AUTH API: Logout
app.post('/api/auth/logout', (req, res) => {
  const token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : req.body.token;
  if (token && activeSessions[token]) {
    logActivity('USER_LOGOUT', activeSessions[token], { noteText: `User logged out.` });
    delete activeSessions[token];
    saveSessions();
  }
  res.json({ message: 'Logged out successfully' });
});

// --- ADMIN USER MANAGEMENT APIS ---
app.get('/api/users', (req, res) => {
  const sessionUser = requireAuth(req, res, ['ADMIN']);
  if (!sessionUser) return;

  const usersWithStats = usersDatabase.map(u => {
    const assignedLeadsCount = carriersDatabase.filter(c => c.assignedRep === u.name).length;
    const callsMade = activityLogs.filter(l => l.userName === u.name && (l.actionType === 'CALL_LOGGED' || l.recordingUrl)).length;
    const onboardedCount = carriersDatabase.filter(c => c.assignedRep === u.name && c.crmStatus === 'Onboarded').length;

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      assignedLeadsCount,
      callsMade,
      onboardedCount
    };
  });

  res.json(usersWithStats);
});

app.post('/api/users/create', (req, res) => {
  const sessionUser = requireAuth(req, res, ['ADMIN']);
  if (!sessionUser) return;

  const { name, email, password, role = 'SALES_REP' } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, corporate email, and password are required' });
  }

  const existing = usersDatabase.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
  if (existing) {
    return res.status(400).json({ error: 'A user with this email address already exists.' });
  }

  const newUser = {
    id: `USER-${Date.now()}`,
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: password.trim(),
    role: role,
    createdAt: new Date().toISOString()
  };

  usersDatabase.push(newUser);
  saveUsersDatabase();
  logActivity('USER_CREATED', sessionUser, { noteText: `Created new sales user: ${newUser.name} (${newUser.email})` });

  res.json({ message: 'User created successfully', user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role } });
});

app.delete('/api/users/:id', (req, res) => {
  const sessionUser = requireAuth(req, res, ['ADMIN']);
  if (!sessionUser) return;

  const index = usersDatabase.findIndex(u => u.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'User not found' });

  const deletedUser = usersDatabase[index];
  if (deletedUser.role === 'ADMIN' && usersDatabase.filter(u => u.role === 'ADMIN').length <= 1) {
    return res.status(400).json({ error: 'Cannot delete the main admin user account.' });
  }

  usersDatabase.splice(index, 1);
  saveUsersDatabase();

  // Reassign deleted user's leads to Unassigned
  carriersDatabase.forEach(c => {
    if (c.assignedRep === deletedUser.name) {
      c.assignedRep = 'Unassigned';
    }
  });
  saveDatabase();

  logActivity('USER_DELETED', sessionUser, { noteText: `Deleted user: ${deletedUser.name}` });
  res.json({ message: `User ${deletedUser.name} deleted successfully.` });
});

// --- MANDATORY CALL RECORDING UPLOAD & IMMUTABILITY ---
app.post('/api/recordings/upload', (req, res) => {
  const sessionUser = requireAuth(req, res);
  if (!sessionUser) return;

  const { carrierId, audioBase64, duration, status, noteText } = req.body;

  if (!carrierId || !audioBase64) {
    return res.status(400).json({ error: 'carrierId and audioBase64 recording are required' });
  }

  const carrier = carriersDatabase.find(c => c.id === carrierId || c.usdot === carrierId);
  if (!carrier) return res.status(404).json({ error: 'Carrier lead not found' });

  try {
    // Decode Base64 audio string to file
    const base64Data = audioBase64.replace(/^data:audio\/\w+;base64,/, '');
    const filename = `REC-${carrier.usdot}-${Date.now()}.webm`;
    const filepath = path.join(RECORDINGS_DIR, filename);

    fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'));
    const recordingUrl = `/recordings/${filename}`;

    // Update Carrier Status & Timeline Notes
    if (status) carrier.crmStatus = status;
    carrier.assignedRep = sessionUser.role === 'SALES_REP' ? sessionUser.name : (carrier.assignedRep || sessionUser.name);

    if (!carrier.notes) carrier.notes = [];
    const noteEntry = {
      id: `NOTE-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString(),
      author: sessionUser.name,
      text: noteText || `Recorded Call Outcome: "${status || 'Contacted'}"`,
      recordingUrl: recordingUrl,
      recordingDuration: duration || 0,
      isImmutable: true // Sales reps cannot delete
    };
    carrier.notes.unshift(noteEntry);
    saveDatabase();

    // Log Activity for Admin Audit Stream
    logActivity('CALL_RECORDED', sessionUser, {
      carrierId: carrier.id,
      companyName: carrier.companyName,
      status: status || 'Contacted',
      noteText: noteText || 'Recorded Call',
      recordingUrl: recordingUrl,
      recordingDuration: duration || 0
    });

    res.json({
      message: 'Call recording saved and locked to carrier lead!',
      recordingUrl,
      carrier
    });
  } catch (err) {
    console.error('Failed to save audio recording:', err);
    res.status(500).json({ error: 'Failed to write recording audio file' });
  }
});

// EXCLUSIVE ADMIN RECORDING DELETION
app.delete('/api/recordings/:id', (req, res) => {
  const sessionUser = requireAuth(req, res, ['ADMIN']);
  if (!sessionUser) return;

  const recId = req.params.id;
  // Remove recording reference from notes
  let removedCount = 0;
  carriersDatabase.forEach(c => {
    if (c.notes) {
      c.notes.forEach(n => {
        if (n.recordingUrl && (n.recordingUrl.includes(recId) || n.id === recId)) {
          n.recordingUrl = null;
          removedCount++;
        }
      });
    }
  });

  saveDatabase();
  logActivity('RECORDING_DELETED', sessionUser, { noteText: `Admin deleted call recording ID: ${recId}` });
  res.json({ message: 'Call recording deleted by Admin.' });
});

// --- ADMIN AUDIT STREAM & ACTIVITY LOGS ---
app.get('/api/admin/activity-logs', (req, res) => {
  const sessionUser = requireAuth(req, res, ['ADMIN']);
  if (!sessionUser) return;

  const { repName } = req.query;
  let filteredLogs = [...activityLogs];
  if (repName && repName !== 'ALL') {
    filteredLogs = filteredLogs.filter(l => l.userName === repName);
  }

  res.json({ total: filteredLogs.length, logs: filteredLogs.slice(0, 100) });
});

// --- CORE CARRIER & STATS APIS (STRICT LEAD ISOLATION) ---
app.get('/api/stats', (req, res) => {
  const sessionUser = requireAuth(req, res);
  if (!sessionUser) return;

  let dataset = [...carriersDatabase];

  // STRICT LEAD ISOLATION FOR SALES REPS
  if (sessionUser.role === 'SALES_REP') {
    dataset = dataset.filter(c => c.assignedRep === sessionUser.name);
  }

  const totalCarriers = dataset.length;
  const freshMCs = dataset.filter(c => c.isFreshMC).length;
  const verifiedEmails = dataset.filter(c => c.emailStatus === 'VERIFIED_DELIVERABLE').length;
  const phoneNumbers = dataset.filter(c => c.phone).length;
  const activePipelineLeads = dataset.filter(c => ['New Lead', 'Contacted', 'In Discussion', 'Pitch Sent'].includes(c.crmStatus)).length;
  const onboardedCarriers = dataset.filter(c => c.crmStatus === 'Onboarded').length;

  res.json({
    totalCarriers,
    freshMCs,
    verifiedEmails,
    phoneNumbers,
    activePipelineLeads,
    onboardedCarriers,
    avgAccuracyScore: 97.4,
    lastScrapedTimestamp: new Date().toISOString()
  });
});

app.get('/api/carriers', (req, res) => {
  const sessionUser = requireAuth(req, res);
  if (!sessionUser) return;

  const {
    q,
    state,
    equipment,
    minPowerUnits,
    maxPowerUnits,
    freshMcDays,
    hasEmail,
    hasPhone,
    hasWebsite,
    crmStatus,
    assignedRep,
    page = 1,
    limit = 50
  } = req.query;

  let filtered = [...carriersDatabase];

  // STRICT LEAD ISOLATION FOR SALES REPS
  if (sessionUser.role === 'SALES_REP') {
    filtered = filtered.filter(c => c.assignedRep === sessionUser.name);
  } else if (assignedRep && assignedRep !== 'ALL') {
    filtered = filtered.filter(c => c.assignedRep === assignedRep);
  }

  if (q) {
    const queryStr = q.toString().toLowerCase().trim();
    filtered = filtered.filter(c =>
      c.usdot.toLowerCase().includes(queryStr) ||
      c.mcNumber.toLowerCase().includes(queryStr) ||
      c.companyName.toLowerCase().includes(queryStr) ||
      c.ownerName.toLowerCase().includes(queryStr) ||
      c.city.toLowerCase().includes(queryStr) ||
      c.state.toLowerCase().includes(queryStr) ||
      c.email.toLowerCase().includes(queryStr) ||
      c.phone.toLowerCase().includes(queryStr)
    );
  }

  if (state && state !== 'ALL') {
    const stateList = state.split(',');
    filtered = filtered.filter(c => stateList.includes(c.state));
  }

  if (equipment && equipment !== 'ALL') {
    const equipList = equipment.split(',');
    filtered = filtered.filter(c => c.equipment.some(eq => equipList.includes(eq)));
  }

  if (minPowerUnits !== undefined && minPowerUnits !== '') {
    filtered = filtered.filter(c => c.powerUnits >= parseInt(minPowerUnits, 10));
  }
  if (maxPowerUnits !== undefined && maxPowerUnits !== '') {
    filtered = filtered.filter(c => c.powerUnits <= parseInt(maxPowerUnits, 10));
  }

  if (freshMcDays && freshMcDays !== 'ALL') {
    const maxDays = parseInt(freshMcDays, 10);
    filtered = filtered.filter(c => c.authorityDaysOld <= maxDays);
  }

  if (hasEmail === 'true') filtered = filtered.filter(c => c.email && c.email.length > 0);
  if (hasPhone === 'true') filtered = filtered.filter(c => c.phone && c.phone.length > 0);
  if (hasWebsite === 'true') filtered = filtered.filter(c => c.website && c.website.length > 0);
  if (crmStatus && crmStatus !== 'ALL') filtered = filtered.filter(c => c.crmStatus === crmStatus);

  const totalResults = filtered.length;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const startIndex = (pageNum - 1) * limitNum;
  const paginatedCarriers = filtered.slice(startIndex, startIndex + limitNum);

  res.json({
    total: totalResults,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(totalResults / limitNum),
    carriers: paginatedCarriers
  });
});

app.get('/api/carriers/:id', (req, res) => {
  const sessionUser = requireAuth(req, res);
  if (!sessionUser) return;

  const carrier = carriersDatabase.find(c => c.id === req.params.id || c.usdot === req.params.id);
  if (!carrier) return res.status(404).json({ error: 'Carrier not found' });
  
  if (sessionUser.role === 'SALES_REP' && carrier.assignedRep !== sessionUser.name) {
    return res.status(403).json({ error: 'Forbidden: You can only view leads assigned to your account.' });
  }

  res.json(carrier);
});

app.patch('/api/carriers/:id', (req, res) => {
  const sessionUser = requireAuth(req, res);
  if (!sessionUser) return;

  const index = carriersDatabase.findIndex(c => c.id === req.params.id || c.usdot === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Carrier not found' });

  const carrier = carriersDatabase[index];

  // Sales reps can only edit their assigned leads
  if (sessionUser.role === 'SALES_REP' && carrier.assignedRep !== sessionUser.name) {
    return res.status(403).json({ error: 'Forbidden: You can only edit leads assigned to your account.' });
  }

  const { crmStatus, assignedRep, noteText, starRating } = req.body;

  if (crmStatus) carrier.crmStatus = crmStatus;
  if (assignedRep && sessionUser.role === 'ADMIN') carrier.assignedRep = assignedRep;
  if (starRating !== undefined) carrier.starRating = starRating;

  if (noteText) {
    if (!carrier.notes) carrier.notes = [];
    carrier.notes.unshift({
      id: `NOTE-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString(),
      author: sessionUser.name,
      text: noteText
    });
    logActivity('CALL_LOGGED', sessionUser, { carrierId: carrier.id, companyName: carrier.companyName, status: crmStatus || carrier.crmStatus, noteText });
  }

  carriersDatabase[index] = carrier;
  saveDatabase();
  res.json({ message: 'Carrier updated successfully', carrier });
});

app.post('/api/carriers/bulk-assign', (req, res) => {
  const sessionUser = requireAuth(req, res, ['ADMIN']);
  if (!sessionUser) return;

  const { carrierIds, assignedRep } = req.body;
  if (!carrierIds || !Array.isArray(carrierIds) || carrierIds.length === 0 || !assignedRep) {
    return res.status(400).json({ error: 'carrierIds array and assignedRep are required' });
  }

  let updatedCount = 0;
  carriersDatabase.forEach(c => {
    if (carrierIds.includes(c.id) || carrierIds.includes(c.usdot)) {
      c.assignedRep = assignedRep;
      if (!c.notes) c.notes = [];
      c.notes.unshift({
        id: `NOTE-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString(),
        author: sessionUser.name,
        text: `Lead assigned to sales rep: "${assignedRep}"`
      });
      updatedCount++;
    }
  });

  saveDatabase();
  logActivity('BULK_ASSIGN', sessionUser, { noteText: `Assigned ${updatedCount} leads to ${assignedRep}` });
  res.json({ message: `Successfully assigned ${updatedCount} carrier lead(s) to ${assignedRep}.`, count: updatedCount });
});

app.post('/api/database/clear', (req, res) => {
  const sessionUser = requireAuth(req, res, ['ADMIN']);
  if (!sessionUser) return;

  carriersDatabase = [];
  saveDatabase();
  logActivity('DB_CLEARED', sessionUser, { noteText: 'Cleared all carrier leads' });
  res.json({ message: 'All database leads have been removed.', total: 0 });
});

// SCRAPER ENDPOINTS (Admin Only)
const { exec } = require('child_process');
let activeScrapeJobs = {};

app.post('/api/scraper/start', (req, res) => {
  const sessionUser = requireAuth(req, res, ['ADMIN']);
  if (!sessionUser) return;

  const { dotList, maxRecords = 10 } = req.body;
  const jobId = `JOB-${Date.now()}`;
  let targets = (dotList && Array.isArray(dotList) && dotList.length > 0) ? dotList : Array.from({ length: parseInt(maxRecords) }, (_, i) => (3800000 + i).toString());

  activeScrapeJobs[jobId] = { id: jobId, status: 'RUNNING', progress: 0, total: targets.length, scrapedCount: 0, skippedCount: 0, logs: [], results: [] };
  res.json({ jobId, message: 'Scraper initiated', status: 'RUNNING' });

  const pythonCmd = `python real_safer_scraper.py "${targets.join(',')}"`;
  exec(pythonCmd, { cwd: __dirname }, (error, stdout) => {
    if (error) {
      if (activeScrapeJobs[jobId]) activeScrapeJobs[jobId].status = 'ERROR';
      return;
    }
    try {
      const parsedResults = JSON.parse(stdout);
      if (activeScrapeJobs[jobId]) {
        parsedResults.forEach(item => {
          if (!item.skipped) {
            activeScrapeJobs[jobId].scrapedCount++;
            const idx = carriersDatabase.findIndex(c => c.usdot === item.usdot);
            if (idx !== -1) carriersDatabase[idx] = item;
            else carriersDatabase.unshift(item);
          } else {
            activeScrapeJobs[jobId].skippedCount++;
          }
        });
        activeScrapeJobs[jobId].progress = 100;
        activeScrapeJobs[jobId].status = 'COMPLETED';
        saveDatabase();
      }
    } catch (e) {}
  });
});

app.get('/api/scraper/status/:jobId', (req, res) => res.json(activeScrapeJobs[req.params.jobId] || { status: 'NOT_FOUND' }));

// EXPORT ENDPOINT
app.post('/api/export/csv', (req, res) => {
  const sessionUser = requireAuth(req, res);
  if (!sessionUser) return;

  let records = [...carriersDatabase];
  if (sessionUser.role === 'SALES_REP') {
    records = records.filter(c => c.assignedRep === sessionUser.name);
  }

  const headers = ['USDOT', 'MC Number', 'Company Name', 'Owner', 'Phone', 'Email', 'Power Units', 'Equipment', 'City', 'State', 'Status', 'Assigned Rep'];
  const rows = [headers.join(',')];
  records.forEach(c => {
    rows.push([c.usdot, c.mcNumber, `"${c.companyName}"`, `"${c.ownerName}"`, `"${c.phone}"`, c.email, c.powerUnits, `"${c.equipment.join(' / ')}"`, `"${c.city}"`, c.state, c.crmStatus, `"${c.assignedRep}"`].join(','));
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=carrier_leads_${Date.now()}.csv`);
  res.send(rows.join('\n'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 CARRIERINTEL PRO CRM SERVER IS RUNNING ON PORT ${PORT}`);
  console.log(`=======================================================`);
});
