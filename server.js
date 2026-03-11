import express from 'express';
import pkg from 'pg';
import cors from 'cors';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const app = express();
const port = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'inspection_system_default_secret_2026';

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
  
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  
  req.user = user;
  next();
}

// Database Configuration
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
});

// Enable CORS and JSON parsing (with large limit for base64 images)
app.use(cors());
app.use(express.json({ limit: '100mb' }));

// 初始化 PostgreSQL 資料表
const initDB = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        has_buildings SMALLINT DEFAULT 1,
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
        is_inspected SMALLINT DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS pins (
        id TEXT PRIMARY KEY,
        unit_id TEXT REFERENCES units(id) ON DELETE CASCADE,
        x REAL,
        y REAL,
        created_at BIGINT
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
        id SERIAL PRIMARY KEY,
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
        exported_at BIGINT
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

    // Seed Admin Users
    const ADMIN_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD || 'admin123';
    const USER_PASSWORD = process.env.INITIAL_USER_PASSWORD || 'user123';

    await client.query(`
      INSERT INTO users (id, username, password, role, name) 
      VALUES ($1, $2, $3, $4, $5) 
      ON CONFLICT (username) DO NOTHING
    `, ['u1', 'admin', hashPassword(ADMIN_PASSWORD), 'admin', '管理員']);

    await client.query(`
      INSERT INTO users (id, username, password, role, name) 
      VALUES ($1, $2, $3, $4, $5) 
      ON CONFLICT (username) DO NOTHING
    `, ['u2', 'user', hashPassword(USER_PASSWORD), 'user', '第一現場巡檢員']);

    // Seed Default Projects
    await client.query(`
      INSERT INTO projects (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING
    `, ['KY85', '國揚數位案']);
    await client.query(`
      INSERT INTO projects (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING
    `, ['KY70', '忠孝大院案']);

    console.log("PostgreSQL Table Initialization Complete");
  } catch (err) {
    console.error("Database initialization failed:", err);
  } finally {
    client.release();
  }
};

initDB();

// --- 輔助函式 ---
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

// 1. Get all projects
app.get('/api/projects', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM projects');
    const projects = result.rows;

    const parsedProjects = projects.map(p => {
      let buildingsArr = [];
      try {
        buildingsArr = JSON.parse(p.buildings || '[]');
      } catch(e) {}

      let legacyLayout = [];
      try {
        legacyLayout = JSON.parse(p.layout || '[]');
      } catch(e) {}

      if (buildingsArr.length > 0 && typeof buildingsArr[0] === 'string') {
        buildingsArr = buildingsArr.map(b => ({
          name: b,
          layout: legacyLayout.length > 0 ? JSON.parse(JSON.stringify(legacyLayout)) : []
        }));
      } else if (buildingsArr.length === 0 && p.has_buildings === 0) {
        buildingsArr = [{
          name: '無分棟',
          layout: legacyLayout.length > 0 ? JSON.parse(JSON.stringify(legacyLayout)) : []
        }];
      }

      return {
        ...p,
        has_buildings: p.has_buildings === 1,
        buildings: buildingsArr
      };
    });
    res.json(parsedProjects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get unit and fetch floor plan
app.get('/api/units/:projectId/:building/:floor/:unitNum', async (req, res) => {
  const { projectId, building, floor, unitNum } = req.params;
  try {
    const unitId = await ensureUnitExists(projectId, building, floor, unitNum);
    const result = await pool.query('SELECT * FROM units WHERE id = $1', [unitId]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Update unit floor plan
app.post('/api/units/:unitId/floorplan', async (req, res) => {
  const { unitId } = req.params;
  const { floorPlanUrl } = req.body;
  if (!floorPlanUrl) return res.status(400).json({ error: 'floorPlanUrl is required' });
  
  try {
    await pool.query('UPDATE units SET floor_plan_url = $1 WHERE id = $2', [floorPlanUrl, unitId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Get all pins and defects for a unit
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
        return {
          ...d,
          photos: photosResult.rows.map(p => p.photo_data)
        };
      }));
    }
    res.json(pins);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Save pins and defects
app.post('/api/pins/:unitId', async (req, res) => {
  const { unitId } = req.params;
  const { pins } = req.body;
  if (!Array.isArray(pins)) return res.status(400).json({ error: 'Invalid pins format' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Delete existing
    const existingPins = await client.query('SELECT id FROM pins WHERE unit_id = $1', [unitId]);
    for (const p of existingPins.rows) {
      const existingDefects = await client.query('SELECT id FROM defects WHERE pin_id = $1', [p.id]);
      for (const d of existingDefects.rows) {
        await client.query('DELETE FROM defect_photos WHERE defect_id = $1', [d.id]);
      }
      await client.query('DELETE FROM defects WHERE pin_id = $1', [p.id]);
    }
    await client.query('DELETE FROM pins WHERE unit_id = $1', [unitId]);

    // Insert new
    for (const pin of pins) {
      await client.query('INSERT INTO pins (id, unit_id, x, y, created_at) VALUES ($1, $2, $3, $4, $5)', 
        [pin.id, unitId, pin.x, pin.y, pin.createdAt]);
      
      for (const defect of pin.defects) {
        await client.query('INSERT INTO defects (id, pin_id, category, name, area, description, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [defect.id, pin.id, defect.category, defect.name, defect.area, defect.description, defect.status]);
        
        if (defect.photos && defect.photos.length > 0) {
          for (const photoData of defect.photos) {
            const photoId = Math.random().toString(36).substr(2, 9);
            await client.query('INSERT INTO defect_photos (id, defect_id, photo_data) VALUES ($1, $2, $3)', 
              [photoId, defect.id, photoData]);
          }
        }
      }
    }
    
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 6. Export flattened defect list
app.post('/api/export-defects', async (req, res) => {
  const { defects } = req.body;
  if (!Array.isArray(defects)) return res.status(400).json({ error: 'Invalid export format' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (defects.length > 0) {
      const { project_id, building, floor, unit_number } = defects[0];
      await client.query('DELETE FROM exported_defects WHERE project_id = $1 AND building = $2 AND floor = $3 AND unit_number = $4',
        [project_id, building, floor, unit_number]);
      await client.query('UPDATE units SET is_inspected = 1 WHERE project_id = $1 AND building = $2 AND floor = $3 AND unit_number = $4',
        [project_id, building, floor, unit_number]);
    }

    const insertQuery = `
      INSERT INTO exported_defects (
        project_id, building, floor, unit_number, defect_id, pin_coords, 
        area, category_1, category_2, defect_name, description, photos_base64, exported_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `;

    for (const d of defects) {
      await client.query(insertQuery, [
        d.project_id, d.building, d.floor, d.unit_number, d.defect_id, d.pin_coords,
        d.area, d.category_1, d.category_2, d.defect_name, d.description, d.photos_base64, Date.now()
      ]);
    }
    await client.query('COMMIT');
    res.json({ success: true, count: defects.length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 7. Get unit status for Grid UI
app.get('/api/projects/:projectId/:building/units-status', async (req, res) => {
  const { projectId, building } = req.params;
  try {
    const unitsResult = await pool.query('SELECT id, floor, unit_number, is_inspected FROM units WHERE project_id = $1 AND building = $2', [projectId, building]);
    const units = unitsResult.rows;
    const statusMap = {};
    
    for (const u of units) {
      const countResult = await pool.query(`
        SELECT COUNT(d.id) as count 
        FROM defects d
        JOIN pins p ON d.pin_id = p.id
        WHERE p.unit_id = $1
      `, [u.id]);
      
      const key = `${u.floor}-${u.unit_number}`;
      statusMap[key] = {
        defectCount: parseInt(countResult.rows[0].count),
        isInspected: u.is_inspected === 1,
        unitId: u.id
      };
    }
    res.json(statusMap);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Admin toggle inspection
app.post('/api/admin/toggle-inspection', async (req, res) => {
  const { unitId, status } = req.body;
  if (typeof status !== 'number') return res.status(400).json({ error: 'Status must be 0 or 1' });
  try {
    await pool.query('UPDATE units SET is_inspected = $1 WHERE id = $2', [status, unitId]);
    res.json({ success: true, unitId, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Auth Routes
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    
    const hashPassword = (p) => crypto.createHash('sha256').update(p + 'inspection_salt').digest('hex');
    
    if (!user || user.password !== hashPassword(password)) {
      return res.status(401).json({ error: '帳號或密碼錯誤' });
    }
    
    const token = signToken({ id: user.id, role: user.role, name: user.name });
    res.json({ success: true, token, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Admin Project Management
app.post('/api/admin/projects', adminOnly, async (req, res) => {
  const { id, name, has_buildings, buildings } = req.body;
  try {
    await pool.query(`
      INSERT INTO projects (id, name, has_buildings, buildings) 
      VALUES ($1, $2, $3, $4)
    `, [id, name, has_buildings ? 1 : 0, JSON.stringify(buildings || [])]);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/projects/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  const { name, has_buildings, buildings } = req.body;
  try {
    await pool.query(`
      UPDATE projects SET name = $1, has_buildings = $2, buildings = $3 WHERE id = $4
    `, [name, has_buildings ? 1 : 0, JSON.stringify(buildings || []), id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/projects/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const unitsResult = await client.query('SELECT id FROM units WHERE project_id = $1', [id]);
    const units = unitsResult.rows;
    for (const u of units) {
      const pinsResult = await client.query('SELECT id FROM pins WHERE unit_id = $1', [u.id]);
      for (const p of pinsResult.rows) {
        const defectsResult = await client.query('SELECT id FROM defects WHERE pin_id = $1', [p.id]);
        for (const d of defectsResult.rows) {
          await client.query('DELETE FROM defect_photos WHERE defect_id = $1', [d.id]);
        }
        await client.query('DELETE FROM defects WHERE pin_id = $1', [p.id]);
      }
      await client.query('DELETE FROM pins WHERE unit_id = $1', [u.id]);
    }
    await client.query('DELETE FROM exported_defects WHERE project_id = $1', [id]);
    await client.query('DELETE FROM units WHERE project_id = $1', [id]);
    await client.query('DELETE FROM projects WHERE id = $1', [id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.get('/api/admin/users', adminOnly, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role, name FROM users');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/users', adminOnly, async (req, res) => {
  const { username, password, role, name } = req.body;
  if (!username || !password || !role || !name) return res.status(400).json({ error: 'Missing fields' });
  const id = 'u_' + Math.random().toString(36).substr(2, 9);
  const hashPassword = (p) => crypto.createHash('sha256').update(p + 'inspection_salt').digest('hex');
  try {
    await pool.query('INSERT INTO users (id, username, password, role, name) VALUES ($1, $2, $3, $4, $5)', 
      [id, username, hashPassword(password), role, name]);
    res.json({ success: true, id });
  } catch (err) {
    if (err.message.includes('unique')) return res.status(400).json({ error: '帳號已存在' });
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/users/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  const { username, password, role, name } = req.body;
  const hashPassword = (p) => crypto.createHash('sha256').update(p + 'inspection_salt').digest('hex');
  try {
    if (password && password.trim() !== '') {
      await pool.query('UPDATE users SET username = $1, password = $2, role = $3, name = $4 WHERE id = $5', 
        [username, hashPassword(password), role, name, id]);
    } else {
      await pool.query('UPDATE users SET username = $1, role = $2, name = $3 WHERE id = $4', 
        [username, role, name, id]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  if (id === 'u1') return res.status(400).json({ error: '不能刪除超級管理員' });
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/units/:unitId/defects', adminOnly, async (req, res) => {
  const { unitId } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const unitResult = await client.query('SELECT project_id, building, floor, unit_number FROM units WHERE id = $1', [unitId]);
    const unit = unitResult.rows[0];
    if (unit) {
      await client.query('DELETE FROM exported_defects WHERE project_id = $1 AND building = $2 AND floor = $3 AND unit_number = $4',
        [unit.project_id, unit.building, unit.floor, unit.unit_number]);
    }
    const pinsResult = await client.query('SELECT id FROM pins WHERE unit_id = $1', [unitId]);
    for (const p of pinsResult.rows) {
      const defectsResult = await client.query('SELECT id FROM defects WHERE pin_id = $1', [p.id]);
      for (const d of defectsResult.rows) {
        await client.query('DELETE FROM defect_photos WHERE defect_id = $1', [d.id]);
      }
      await client.query('DELETE FROM defects WHERE pin_id = $1', [p.id]);
    }
    await client.query('DELETE FROM pins WHERE unit_id = $1', [unitId]);
    await client.query('UPDATE units SET is_inspected = 0 WHERE id = $1', [unitId]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.delete('/api/admin/defects/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM defect_photos WHERE defect_id = $1', [id]);
    await client.query('DELETE FROM exported_defects WHERE defect_id = $1', [id]);
    await client.query('DELETE FROM defects WHERE id = $1', [id]);
    // Clean up pins that have no defects left
    await client.query('DELETE FROM pins WHERE id NOT IN (SELECT pin_id FROM defects)');
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.get('/api/admin/projects/:projectId/defects', adminOnly, async (req, res) => {
  const { projectId } = req.params;
  try {
    const rowsResult = await pool.query(`
      SELECT 
        u.building, u.floor, u.unit_number,
        p.id as pin_id, p.x, p.y,
        d.id as defect_id, d.category, d.name, d.area, d.description, d.status
      FROM units u
      JOIN pins p ON u.id = p.unit_id
      JOIN defects d ON p.id = d.pin_id
      WHERE u.project_id = $1
    `, [projectId]);
    const rows = rowsResult.rows;

    const defects = await Promise.all(rows.map(async (row) => {
      const photosResult = await pool.query('SELECT photo_data FROM defect_photos WHERE defect_id = $1', [row.defect_id]);
      return {
        ...row,
        photos: photosResult.rows.map(ph => ph.photo_data)
      };
    }));
    res.json(defects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`PostgreSQL-backed Server running at http://localhost:${port}`);
});
