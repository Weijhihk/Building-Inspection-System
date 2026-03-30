import express from 'express';
import Database from 'better-sqlite3';
import cors from 'cors';
import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'inspection_system_default_secret_2026';

// SQLite Database Configuration
const db = new Database('database.sqlite');
console.log('[Database] Using SQLite at database.sqlite');

// Shim pool to mimic pg.Pool for minimal code changes
const pool = {
  query: (sql, params = []) => {
    try {
      // Replace $1, $2, ... with ?
      const sqliteSql = sql.replace(/\$\d+/g, '?');
      const stmt = db.prepare(sqliteSql);
      
      const normalizedSql = sqliteSql.trim().toLowerCase();
      if (normalizedSql.startsWith('select') || normalizedSql.includes('returning')) {
        const rows = stmt.all(params);
        return Promise.resolve({ rows });
      } else {
        const result = stmt.run(params);
        return Promise.resolve({ rows: [], lastInsertRowid: result.lastInsertRowid, changes: result.changes });
      }
    } catch (err) {
      console.error('[SQLite Error]', err, sql, params);
      return Promise.reject(err);
    }
  },
  connect: async () => {
    // In SQLite, we use the same db object for transactions
    return {
      query: (sql, params = []) => pool.query(sql, params),
      release: () => {}
    };
  }
};

// Photo Storage Configuration
const STORAGE_PATH = process.env.PHOTO_STORAGE_PATH || 'D:/Github/PublicPic';
if (!fs.existsSync(STORAGE_PATH)) {
  fs.mkdirSync(STORAGE_PATH, { recursive: true });
  console.log(`[Photo Storage] Created directory: ${STORAGE_PATH}`);
}
console.log(`[Photo Storage] Storing photos in: ${STORAGE_PATH}`);

/**
 * Save a base64 photo to disk and return its relative URL.
 */
function savePhotoToDisk(base64Data, filename) {
  const base64String = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const buffer = Buffer.from(base64String, 'base64');
  const filePath = path.join(STORAGE_PATH, filename);
  fs.writeFileSync(filePath, buffer);
  return `/pics/${filename}`;
}

// Token Security Helpers
function signToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('hex');
  return `${data}.${signature}`;
}

function verifyToken(token) {
  if (!token) return null;
  const [data, signature] = token.split('.');
  if (!data || !signature) return null;
  const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('hex');
  if (signature !== expectedSignature) return null;
  try {
    return JSON.parse(Buffer.from(data, 'base64').toString());
  } catch (e) {
    return null;
  }
}

function adminOnly(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];
  const user = verifyToken(token);
  if (!user) return res.status(403).json({ error: 'Forbidden: Invalid token' });
  const userRole = (user.role || '').toString().trim().toLowerCase();
  if (userRole !== 'admin') return res.status(403).json({ error: 'Forbidden: Admin access required' });
  req.user = user;
  next();
}

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use('/pics', express.static(STORAGE_PATH));

// Initialize SQLite Schema
const initDB = async () => {
  try {
    // Note: SQLite syntax for SERIAL is INTEGER PRIMARY KEY AUTOINCREMENT
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        has_buildings INTEGER DEFAULT 1,
        buildings TEXT DEFAULT '[]',
        layout TEXT DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS units (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
        building TEXT,
        floor TEXT,
        unit_number TEXT,
        floor_plan_url TEXT,
        is_inspected INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS pins (
        id TEXT PRIMARY KEY,
        unit_id TEXT REFERENCES units(id) ON DELETE CASCADE,
        x REAL,
        y REAL,
        created_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS defects (
        id TEXT PRIMARY KEY,
        pin_id TEXT REFERENCES pins(id) ON DELETE CASCADE,
        category TEXT,
        name TEXT,
        area TEXT,
        description TEXT,
        status TEXT
      );

      CREATE TABLE IF NOT EXISTS defect_photos (
        id TEXT PRIMARY KEY,
        defect_id TEXT REFERENCES defects(id) ON DELETE CASCADE,
        photo_data TEXT
      );

      CREATE TABLE IF NOT EXISTS exported_defects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT,
        building TEXT,
        floor TEXT,
        unit_number TEXT,
        defect_id TEXT,
        pin_coords TEXT,
        area TEXT,
        category_1 TEXT,
        category_2 TEXT,
        defect_name TEXT,
        description TEXT,
        photos_base64 TEXT,
        exported_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT,
        name TEXT
      );
    `);

    // --- Seed Data ---
    const hashPassword = (password) => {
      return crypto.createHash('sha256').update(password + 'inspection_salt').digest('hex');
    };

    const ADMIN_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD || 'admin123';
    const USER_PASSWORD = process.env.INITIAL_USER_PASSWORD || 'user123';

    pool.query(`
      INSERT INTO users (id, username, password, role, name) 
      VALUES ($1, $2, $3, $4, $5) 
      ON CONFLICT (username) DO NOTHING
    `, ['u1', 'admin', hashPassword(ADMIN_PASSWORD), 'admin', '管理員']);

    pool.query(`
      INSERT INTO users (id, username, password, role, name) 
      VALUES ($1, $2, $3, $4, $5) 
      ON CONFLICT (username) DO NOTHING
    `, ['u2', 'user', hashPassword(USER_PASSWORD), 'user', '第一現場巡檢員']);

    pool.query(`
      INSERT INTO projects (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING
    `, ['KY85', '國揚數位案']);
    pool.query(`
      INSERT INTO projects (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING
    `, ['KY70', '忠孝大院案']);

    console.log("SQLite Initialization Complete");
  } catch (err) {
    console.error("Database initialization failed:", err);
  }
};

initDB();

// --- Assistant Functions ---
async function ensureUnitExists(projectId, building, floor, unitNumber) {
  const unitId = `${projectId}-${building}-${floor}-${unitNumber}`;
  const query = `
    INSERT INTO units (id, project_id, building, floor, unit_number, is_inspected) 
    VALUES ($1, $2, $3, $4, $5, 0)
    ON CONFLICT (id) DO NOTHING
  `;
  await pool.query(query, [unitId, projectId, building, floor, unitNumber]);
  return unitId;
}

// --- API Routes ---

app.get('/api/projects', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM projects');
    const projects = result.rows;
    res.json(projects.map(p => {
      let buildingsArr = [];
      try { buildingsArr = JSON.parse(p.buildings || '[]'); } catch(e) {}
      let legacyLayout = [];
      try { legacyLayout = JSON.parse(p.layout || '[]'); } catch(e) {}
      if (buildingsArr.length > 0 && typeof buildingsArr[0] === 'string') {
        buildingsArr = buildingsArr.map(b => ({
          name: b,
          layout: legacyLayout.length > 0 ? JSON.parse(JSON.stringify(legacyLayout)) : []
        }));
      } else if (buildingsArr.length === 0 && p.has_buildings === 0) {
        buildingsArr = [{ name: '無分棟', layout: legacyLayout.length > 0 ? JSON.parse(JSON.stringify(legacyLayout)) : [] }];
      }
      return { ...p, has_buildings: p.has_buildings === 1, buildings: buildingsArr };
    }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/units/:projectId/:building/:floor/:unitNum', async (req, res) => {
  const { projectId, building, floor, unitNum } = req.params;
  try {
    const unitId = await ensureUnitExists(projectId, building, floor, unitNum);
    const result = await pool.query('SELECT * FROM units WHERE id = $1', [unitId]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/units/:unitId/floorplan', async (req, res) => {
  const { unitId } = req.params;
  const { floorPlanUrl } = req.body;
  if (!floorPlanUrl) return res.status(400).json({ error: 'floorPlanUrl is required' });
  try {
    await pool.query('UPDATE units SET floor_plan_url = $1 WHERE id = $2', [floorPlanUrl, unitId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/pins/:unitId', async (req, res) => {
  const { unitId } = req.params;
  try {
    const pinsResult = await pool.query('SELECT * FROM pins WHERE unit_id = $1', [unitId]);
    const pins = pinsResult.rows;
    for (let pin of pins) {
      const defectsResult = await pool.query('SELECT * FROM defects WHERE pin_id = $1', [pin.id]);
      const defects = defectsResult.rows;
      pin.defects = await Promise.all(defects.map(async (d) => {
        const photosResult = await pool.query('SELECT photo_data FROM defect_photos WHERE defect_id = $1', [d.id]);
        return { ...d, photos: photosResult.rows.map(p => p.photo_data) };
      }));
    }
    res.json(pins);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/pins/:unitId', async (req, res) => {
  const { unitId } = req.params;
  const { pins, projectId, building, floor, unitNum } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existingPins = await client.query('SELECT id FROM pins WHERE unit_id = $1', [unitId]);
    for (const p of existingPins.rows) {
      const existingDefects = await client.query('SELECT id FROM defects WHERE pin_id = $1', [p.id]);
      for (const d of existingDefects.rows) {
        const existingPhotos = await client.query('SELECT photo_data FROM defect_photos WHERE defect_id = $1', [d.id]);
        for (const ph of existingPhotos.rows) {
          if (ph.photo_data && ph.photo_data.startsWith('/pics/')) {
            const oldFile = path.join(STORAGE_PATH, path.basename(ph.photo_data));
            if (fs.existsSync(oldFile)) try { fs.unlinkSync(oldFile); } catch(e) {}
          }
        }
        await client.query('DELETE FROM defect_photos WHERE defect_id = $1', [d.id]);
      }
      await client.query('DELETE FROM defects WHERE pin_id = $1', [p.id]);
    }
    await client.query('DELETE FROM pins WHERE unit_id = $1', [unitId]);
    const safeProject = (projectId || 'UNK').replace(/[^a-zA-Z0-9_-]/g, '');
    const safeBuilding = (building || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const safeFloor = (floor || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const safeUnit = (unitNum || '').replace(/[^a-zA-Z0-9_-]/g, '');
    for (const pin of pins) {
      await client.query('INSERT INTO pins (id, unit_id, x, y, created_at) VALUES ($1, $2, $3, $4, $5)', [pin.id, unitId, pin.x, pin.y, pin.createdAt]);
      for (const defect of pin.defects) {
        await client.query('INSERT INTO defects (id, pin_id, category, name, area, description, status) VALUES ($1, $2, $3, $4, $5, $6, $7)', [defect.id, pin.id, defect.category, defect.name, defect.area, defect.description, defect.status]);
        if (defect.photos) {
          defect.photos.forEach((photoData, idx) => {
            const photoId = Math.random().toString(36).substr(2, 9);
            let storedValue = photoData;
            if (photoData && !photoData.startsWith('/pics/') && !photoData.startsWith('http')) {
              const safeDefectId = defect.id.replace(/[^a-zA-Z0-9_-]/g, '');
              storedValue = savePhotoToDisk(photoData, `${safeProject}_${safeBuilding}_${safeFloor}_${safeUnit}_${safeDefectId}_${idx + 1}.jpg`);
            }
            client.query('INSERT INTO defect_photos (id, defect_id, photo_data) VALUES ($1, $2, $3)', [photoId, defect.id, storedValue]);
          });
        }
      }
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
});

app.post('/api/export-defects', async (req, res) => {
  const { defects } = req.body;
  if (!Array.isArray(defects)) return res.status(400).json({ error: 'Invalid export format' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (defects.length > 0) {
      const { project_id, building, floor, unit_number } = defects[0];
      await client.query('DELETE FROM exported_defects WHERE project_id = $1 AND building = $2 AND floor = $3 AND unit_number = $4', [project_id, building, floor, unit_number]);
      await client.query('UPDATE units SET is_inspected = 1 WHERE project_id = $1 AND building = $2 AND floor = $3 AND unit_number = $4', [project_id, building, floor, unit_number]);
    }
    for (const d of defects) {
      const rawPhotos = JSON.parse(d.photos_base64 || '[]');
      const safeProject = (d.project_id || 'UNK').replace(/[^a-zA-Z0-9_-]/g, '');
      const safeBuilding = (d.building || '').replace(/[^a-zA-Z0-9_-]/g, '');
      const safeFloor = (d.floor || '').replace(/[^a-zA-Z0-9_-]/g, '');
      const safeUnit = (d.unit_number || '').replace(/[^a-zA-Z0-9_-]/g, '');
      const safeDefectId = (d.defect_id || '').replace(/[^a-zA-Z0-9_-]/g, '');
      const savedPhotoPaths = rawPhotos.map((photoData, idx) => {
        if (!photoData || photoData.startsWith('/pics/') || photoData.startsWith('http')) return photoData;
        return savePhotoToDisk(photoData, `${safeProject}_${safeBuilding}_${safeFloor}_${safeUnit}_${safeDefectId}_${idx + 1}.jpg`);
      });
      await client.query(`INSERT INTO exported_defects (project_id, building, floor, unit_number, defect_id, pin_coords, area, category_1, category_2, defect_name, description, photos_base64, exported_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`, [d.project_id, d.building, d.floor, d.unit_number, d.defect_id, d.pin_coords, d.area, d.category_1, d.category_2, d.defect_name, d.description, JSON.stringify(savedPhotoPaths), Date.now()]);
    }
    await client.query('COMMIT');
    res.json({ success: true, count: defects.length });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
});

app.get('/api/projects/:projectId/:building/units-status', async (req, res) => {
  const { projectId, building } = req.params;
  try {
    const unitsResult = await pool.query('SELECT id, floor, unit_number, is_inspected FROM units WHERE project_id = $1 AND building = $2', [projectId, building]);
    const statusMap = {};
    for (const u of unitsResult.rows) {
      const countResult = await pool.query('SELECT COUNT(d.id) as count FROM defects d JOIN pins p ON d.pin_id = p.id WHERE p.unit_id = $1', [u.id]);
      statusMap[`${u.floor}-${u.unit_number}`] = { defectCount: parseInt(countResult.rows[0].count), isInspected: u.is_inspected === 1, unitId: u.id };
    }
    res.json(statusMap);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/toggle-inspection', async (req, res) => {
  const { unitId, status } = req.body;
  try {
    await pool.query('UPDATE units SET is_inspected = $1 WHERE id = $2', [status, unitId]);
    res.json({ success: true, unitId, status });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    const hash = (p) => crypto.createHash('sha256').update(p + 'inspection_salt').digest('hex');
    if (!user || user.password !== hash(password)) return res.status(401).json({ error: '帳號或密碼錯誤' });
    const token = signToken({ id: user.id, role: user.role, name: user.name });
    res.json({ success: true, token, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin Routes
app.post('/api/admin/projects', adminOnly, async (req, res) => {
  const { id, name, has_buildings, buildings } = req.body;
  try {
    await pool.query('INSERT INTO projects (id, name, has_buildings, buildings) VALUES ($1, $2, $3, $4)', [id, name, has_buildings ? 1 : 0, JSON.stringify(buildings || [])]);
    res.json({ success: true, id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/projects/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  const { name, has_buildings, buildings } = req.body;
  try {
    await pool.query('UPDATE projects SET name = $1, has_buildings = $2, buildings = $3 WHERE id = $4', [name, has_buildings ? 1 : 0, JSON.stringify(buildings || []), id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/projects/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const units = await client.query('SELECT id FROM units WHERE project_id = $1', [id]);
    for (const u of units.rows) {
      const pins = await client.query('SELECT id FROM pins WHERE unit_id = $1', [u.id]);
      for (const p of pins.rows) {
        const defects = await client.query('SELECT id FROM defects WHERE pin_id = $1', [p.id]);
        for (const d of defects.rows) await client.query('DELETE FROM defect_photos WHERE defect_id = $1', [d.id]);
        await client.query('DELETE FROM defects WHERE pin_id = $1', [p.id]);
      }
      await client.query('DELETE FROM pins WHERE unit_id = $1', [u.id]);
    }
    await client.query('DELETE FROM exported_defects WHERE project_id = $1', [id]);
    await client.query('DELETE FROM units WHERE project_id = $1', [id]);
    await client.query('DELETE FROM projects WHERE id = $1', [id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/users', adminOnly, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role, name FROM users');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/users', adminOnly, async (req, res) => {
  const { username, password, role, name } = req.body;
  const id = 'u_' + Math.random().toString(36).substr(2, 9);
  const hash = (p) => crypto.createHash('sha256').update(p + 'inspection_salt').digest('hex');
  try {
    await pool.query('INSERT INTO users (id, username, password, role, name) VALUES ($1, $2, $3, $4, $5)', [id, username, hash(password), role, name]);
    res.json({ success: true, id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/users/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  const { username, password, role, name } = req.body;
  const hash = (p) => crypto.createHash('sha256').update(p + 'inspection_salt').digest('hex');
  try {
    if (password) await pool.query('UPDATE users SET username = $1, password = $2, role = $3, name = $4 WHERE id = $5', [username, hash(password), role, name, id]);
    else await pool.query('UPDATE users SET username = $1, role = $2, name = $3 WHERE id = $4', [username, role, name, id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/users/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  if (id === 'u1') return res.status(400).json({ error: '不能刪除超級管理員' });
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/units/:unitId/defects', adminOnly, async (req, res) => {
  const { unitId } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const unit = (await client.query('SELECT project_id, building, floor, unit_number FROM units WHERE id = $1', [unitId])).rows[0];
    if (unit) await client.query('DELETE FROM exported_defects WHERE project_id = $1 AND building = $2 AND floor = $3 AND unit_number = $4', [unit.project_id, unit.building, unit.floor, unit.unit_number]);
    const pins = await client.query('SELECT id FROM pins WHERE unit_id = $1', [unitId]);
    for (const p of pins.rows) {
      const defects = await client.query('SELECT id FROM defects WHERE pin_id = $1', [p.id]);
      for (const d of defects.rows) await client.query('DELETE FROM defect_photos WHERE defect_id = $1', [d.id]);
      await client.query('DELETE FROM defects WHERE pin_id = $1', [p.id]);
    }
    await client.query('DELETE FROM pins WHERE unit_id = $1', [unitId]);
    await client.query('UPDATE units SET is_inspected = 0 WHERE id = $1', [unitId]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/defects/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM defect_photos WHERE defect_id = $1', [id]);
    await client.query('DELETE FROM exported_defects WHERE defect_id = $1', [id]);
    await client.query('DELETE FROM defects WHERE id = $1', [id]);
    await client.query('DELETE FROM pins WHERE id NOT IN (SELECT pin_id FROM defects)');
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/projects/:projectId/defects', adminOnly, async (req, res) => {
  const { projectId } = req.params;
  try {
    const rows = (await pool.query('SELECT u.building, u.floor, u.unit_number, p.id as pin_id, p.x, p.y, d.id as defect_id, d.category, d.name, d.area, d.description, d.status FROM units u JOIN pins p ON u.id = p.unit_id JOIN defects d ON p.id = d.pin_id WHERE u.project_id = $1', [projectId])).rows;
    const defects = await Promise.all(rows.map(async (row) => {
      const photos = (await pool.query('SELECT photo_data FROM defect_photos WHERE defect_id = $1', [row.defect_id])).rows;
      return { ...row, photos: photos.map(ph => ph.photo_data) };
    }));
    res.json(defects);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(port, () => {
  console.log(`SQLite-backed Server running at http://localhost:${port}`);
});
