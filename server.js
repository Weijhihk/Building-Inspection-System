import express from 'express';
import Database from 'better-sqlite3';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'database.sqlite');

const app = express();
const port = process.env.PORT || 3001;

// Enable CORS and JSON parsing (with large limit for base64 images)
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize SQLite Database
const db = new Database(dbPath, { verbose: console.log });

// Create Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS units (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    building TEXT,
    floor TEXT,
    unit_number TEXT,
    floor_plan_url TEXT,
    is_inspected INTEGER DEFAULT 0,
    FOREIGN KEY(project_id) REFERENCES projects(id)
  );

  CREATE TABLE IF NOT EXISTS pins (
    id TEXT PRIMARY KEY,
    unit_id TEXT,
    x REAL,
    y REAL,
    created_at INTEGER,
    FOREIGN KEY(unit_id) REFERENCES units(id)
  );

  CREATE TABLE IF NOT EXISTS defects (
    id TEXT PRIMARY KEY,
    pin_id TEXT,
    category TEXT,
    name TEXT,
    area TEXT,
    description TEXT,
    status TEXT,
    FOREIGN KEY(pin_id) REFERENCES pins(id)
  );

  CREATE TABLE IF NOT EXISTS defect_photos (
    id TEXT PRIMARY KEY,
    defect_id TEXT,
    photo_data TEXT,
    FOREIGN KEY(defect_id) REFERENCES defects(id)
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
`);

// --- Migrations ---
const unitsTableInfo = db.prepare("PRAGMA table_info(units)").all();
const hasIsInspected = unitsTableInfo.some(col => col.name === 'is_inspected');
if (!hasIsInspected) {
  db.prepare("ALTER TABLE units ADD COLUMN is_inspected INTEGER DEFAULT 0").run();
  console.log("[Migration] Added is_inspected column to units table.");
}
// ------------------

// Clean up old arbitrary projects if they exist (Handle Foreign Keys)
db.prepare("PRAGMA foreign_keys = OFF").run();
db.prepare("DELETE FROM projects WHERE id IN ('p1', 'p2')").run();
db.prepare("DELETE FROM units WHERE project_id IN ('p1', 'p2')").run();
// (pins and defects can cascade or be orphaned harmlessly since they are local sqlite, but let's delete them properly)
db.prepare("DELETE FROM pins WHERE unit_id IN (SELECT id FROM units WHERE project_id IN ('p1', 'p2'))").run();
db.prepare("PRAGMA foreign_keys = ON").run();

// Seed default projects if they don't exist
const seedStmt = db.prepare('INSERT OR IGNORE INTO projects (id, name) VALUES (?, ?)');
seedStmt.run('KY85', '國揚數位案');
seedStmt.run('KY70', '忠孝大院案');

// Add helper to populate units lazily or seed them
function ensureUnitExists(projectId, building, floor, unitNumber) {
  const unitId = `${projectId}-${building}-${floor}-${unitNumber}`;
  const stmt = db.prepare('INSERT OR IGNORE INTO units (id, project_id, building, floor, unit_number, is_inspected) VALUES (?, ?, ?, ?, ?, 0)');
  stmt.run(unitId, projectId, building, floor, unitNumber);
  return unitId;
}

// Routes

// 1. Get all projects
app.get('/api/projects', (req, res) => {
  const projects = db.prepare('SELECT * FROM projects').all();
  res.json(projects);
});

// 2. Get or Create a specific unit and fetch its floor plan
app.get('/api/units/:projectId/:building/:floor/:unitNum', (req, res) => {
  const { projectId, building, floor, unitNum } = req.params;
  const unitId = ensureUnitExists(projectId, building, floor, unitNum);
  const unit = db.prepare('SELECT * FROM units WHERE id = ?').get(unitId);
  res.json(unit);
});

// 3. Update unit floor plan
app.post('/api/units/:unitId/floorplan', (req, res) => {
  const { unitId } = req.params;
  const { floorPlanUrl } = req.body;
  
  if (!floorPlanUrl) return res.status(400).json({ error: 'floorPlanUrl is required' });
  
  db.prepare('UPDATE units SET floor_plan_url = ? WHERE id = ?').run(floorPlanUrl, unitId);
  res.json({ success: true });
});

// 4. Get all pins and defects for a unit
app.get('/api/pins/:unitId', (req, res) => {
  const { unitId } = req.params;
  
  const pins = db.prepare('SELECT * FROM pins WHERE unit_id = ?').all(unitId);
  
  for (let pin of pins) {
    const defects = db.prepare('SELECT * FROM defects WHERE pin_id = ?').all(pin.id);
    pin.defects = defects.map(d => {
      const photos = db.prepare('SELECT photo_data FROM defect_photos WHERE defect_id = ?').all(d.id);
      return {
        ...d,
        photos: photos.map(p => p.photo_data)
      };
    });
  }
  
  res.json(pins);
});

// 5. Save pins and defects for a unit
// This replaces all pins for the unit for simplicity (or we can diff them)
app.post('/api/pins/:unitId', (req, res) => {
  const { unitId } = req.params;
  const { pins } = req.body; // Array of Pin objects
  
  if (!Array.isArray(pins)) return res.status(400).json({ error: 'Invalid pins format' });

  const performTransaction = db.transaction(() => {
    // 1. Delete existing data for this unit
    const existingPins = db.prepare('SELECT id FROM pins WHERE unit_id = ?').all(unitId);
    for (const p of existingPins) {
      const existingDefects = db.prepare('SELECT id FROM defects WHERE pin_id = ?').all(p.id);
      for (const d of existingDefects) {
        db.prepare('DELETE FROM defect_photos WHERE defect_id = ?').run(d.id);
      }
      db.prepare('DELETE FROM defects WHERE pin_id = ?').run(p.id);
    }
    db.prepare('DELETE FROM pins WHERE unit_id = ?').run(unitId);

    // 2. Insert new data
    const insertPin = db.prepare('INSERT INTO pins (id, unit_id, x, y, created_at) VALUES (?, ?, ?, ?, ?)');
    const insertDefect = db.prepare('INSERT INTO defects (id, pin_id, category, name, area, description, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const insertPhoto = db.prepare('INSERT INTO defect_photos (id, defect_id, photo_data) VALUES (?, ?, ?)');

    for (const pin of pins) {
      insertPin.run(pin.id, unitId, pin.x, pin.y, pin.createdAt);
      
      for (const defect of pin.defects) {
        insertDefect.run(defect.id, pin.id, defect.category, defect.name, defect.area, defect.description, defect.status);
        
        if (defect.photos && defect.photos.length > 0) {
          for (const photoData of defect.photos) {
            const photoId = Math.random().toString(36).substr(2, 9);
            insertPhoto.run(photoId, defect.id, photoData);
          }
        }
      }
    }
  });

  try {
    performTransaction();
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database transaction failed' });
  }
});

// 6. Export flattened defect list
app.post('/api/export-defects', (req, res) => {
  const { defects } = req.body; // Array of flattened defect objects
  
  if (!Array.isArray(defects)) return res.status(400).json({ error: 'Invalid export format' });

  const performExport = db.transaction(() => {
    // If we want to replace existing exports for the specific unit, we would need the unit details.
    // For simplicity and auditability, we will just delete exact defect_ids provided, or replace by unit.
    // Let's assume the frontend sends the *entire* unit's defects every time they press save on a unit.
    // So we can delete all previously exported defects for this unit first if they exist in the payload.
    if (defects.length > 0) {
      const { project_id, building, floor, unit_number } = defects[0];
      db.prepare('DELETE FROM exported_defects WHERE project_id = ? AND building = ? AND floor = ? AND unit_number = ?')
        .run(project_id, building, floor, unit_number);
        
      // Also lock the unit as inspected
      db.prepare('UPDATE units SET is_inspected = 1 WHERE project_id = ? AND building = ? AND floor = ? AND unit_number = ?')
        .run(project_id, building, floor, unit_number);
    }

    const insertStmt = db.prepare(`
      INSERT INTO exported_defects (
        project_id, building, floor, unit_number, defect_id, pin_coords, 
        area, category_1, category_2, defect_name, description, photos_base64, exported_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const d of defects) {
      insertStmt.run(
        d.project_id,
        d.building,
        d.floor,
        d.unit_number,
        d.defect_id,
        d.pin_coords,
        d.area,
        d.category_1,
        d.category_2,
        d.defect_name,
        d.description,
        d.photos_base64,
        Date.now()
      );
    }
  });

  try {
    performExport();
    res.json({ success: true, count: defects.length });
  } catch (error) {
    console.error('Export Error:', error);
    res.status(500).json({ error: 'Export transaction failed' });
  }
});

// 7. Get unit status (defect count and inspected flag) for the Grid UI
app.get('/api/projects/:projectId/:building/units-status', (req, res) => {
  const { projectId, building } = req.params;
  
  // Get all existing units for this building
  const units = db.prepare('SELECT id, floor, unit_number, is_inspected FROM units WHERE project_id = ? AND building = ?').all(projectId, building);
  
  const statusMap = {};
  
  for (const u of units) {
    // Count defects for this unit via pins
    const result = db.prepare(`
      SELECT COUNT(d.id) as count 
      FROM defects d
      JOIN pins p ON d.pin_id = p.id
      WHERE p.unit_id = ?
    `).get(u.id);
    
    // Key format: '2F-1戶'
    const key = `${u.floor}-${u.unit_number}`;
    statusMap[key] = {
      defectCount: result ? result.count : 0,
      isInspected: u.is_inspected === 1,
      unitId: u.id
    };
  }
  
  res.json(statusMap);
});

// 8. Admin endpoint to unlock or lock a unit
app.post('/api/admin/toggle-inspection', (req, res) => {
  const { unitId, status } = req.body; // status should be 0 or 1
  if (typeof status !== 'number') return res.status(400).json({ error: 'Status must be 0 or 1' });
  
  db.prepare('UPDATE units SET is_inspected = ? WHERE id = ?').run(status, unitId);
  res.json({ success: true, unitId, status });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
