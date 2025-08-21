#!/usr/bin/env node
/**
 * Migration: Convert all annotations of type 'regular' (or missing type)
 * into a builtin custom type: 'builtin-regular-keypoint'.
 *
 * Scope:
 * - annotations/plant_annotations.json (server aggregate store)
 *   - Convert annotations arrays under each plant
 *   - Convert timeSeriesData.annotationData[*].annotations arrays if present
 * - annotations/*.json (per-image annotation files saved by FileSystemManager)
 *   - Convert the annotations array in each file
 *
 * Notes:
 * - Creates timestamped backups before writing changes
 * - Provides --dry-run to preview changes without writing
 * - Skips backup, status, skip_info helper files
 *
 * Usage:
 *   node scripts/migrate-regular-to-builtin.js
 *   node scripts/migrate-regular-to-builtin.js --dry-run
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');

// Parse CLI args
function getArgValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return null;
}

const dirArg = getArgValue('--dir');
const DEFAULT_DATASET_DIR = path.join(PROJECT_ROOT, 'annotations');
let ANNOTATIONS_DIR = dirArg ? path.resolve(dirArg) : DEFAULT_DATASET_DIR;
let PLANT_FILE = path.join(ANNOTATIONS_DIR, 'plant_annotations.json');

const BUILTIN_TYPE_ID = 'builtin-regular-keypoint';
const DRY_RUN = process.argv.includes('--dry-run');

function normalizeDirection(direction) {
  if (typeof direction === 'number') return { value: direction, type: 'angle' };
  if (direction === 'left') return { value: 180, type: 'angle' };
  if (direction === 'right') return { value: 0, type: 'angle' };
  return { value: direction ?? null, type: null };
}

function transformAnnotation(annotation) {
  const ann = { ...annotation };

  // Normalize annotation type
  if (!ann.annotationType || ann.annotationType === 'regular') {
    ann.annotationType = 'custom';
    if (!ann.customTypeId) ann.customTypeId = BUILTIN_TYPE_ID;
  }

  // Normalize direction to angle when possible
  const { value, type } = normalizeDirection(ann.direction);
  ann.direction = value;
  if (type) ann.directionType = type;

  return ann;
}

function transformAnnotationsArray(arr, stats) {
  if (!Array.isArray(arr)) return arr;
  return arr.map((a) => {
    const before = JSON.stringify(a);
    const t = transformAnnotation(a);
    const after = JSON.stringify(t);
    if (before !== after) stats.modifiedAnnotations++;
    return t;
  });
}

async function backupFile(filePath) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, '.json');
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(dir, `${base}_backup_${ts}.json`);
  await fs.copyFile(filePath, backupPath);
  return backupPath;
}

async function migratePlantAggregate(stats) {
  try {
    const raw = await fs.readFile(PLANT_FILE, 'utf-8');
    const data = JSON.parse(raw);

    if (!data || typeof data !== 'object') return false;
    if (!data.annotations || typeof data.annotations !== 'object') return false;

    let modified = false;

    for (const [plantId, plantData] of Object.entries(data.annotations)) {
      if (!plantData || typeof plantData !== 'object') continue;

      // Convert current-image annotations
      if (Array.isArray(plantData.annotations)) {
        const beforeCount = plantData.annotations.length;
        plantData.annotations = transformAnnotationsArray(plantData.annotations, stats);
        if (beforeCount > 0) modified = true;
      }

      // Convert time series annotations if present
      if (plantData.timeSeriesData && Array.isArray(plantData.timeSeriesData.annotationData)) {
        for (const item of plantData.timeSeriesData.annotationData) {
          if (Array.isArray(item.annotations)) {
            const beforeCount = item.annotations.length;
            item.annotations = transformAnnotationsArray(item.annotations, stats);
            if (beforeCount > 0) modified = true;
          }
        }
      }
    }

    if (modified && !DRY_RUN) {
      await backupFile(PLANT_FILE);
      await fs.writeFile(PLANT_FILE, JSON.stringify(data, null, 2));
      stats.modifiedFiles++;
    }

    stats.scannedFiles++;
    return modified;
  } catch (err) {
    if (err.code === 'ENOENT') return false; // file not present is fine
    console.warn(`[migrate] Failed to process ${PLANT_FILE}:`, err.message);
    stats.errors.push({ file: PLANT_FILE, error: err.message });
    return false;
  }
}

function shouldSkipName(name) {
  if (!name.endsWith('.json')) return true;
  if (name === 'plant_annotations.json') return true;
  if (name.includes('_backup_')) return true;
  if (name.includes('_deleted_')) return true;
  if (name.endsWith('_status.json')) return true;
  if (name.endsWith('_skip_info.json')) return true;
  return false;
}

async function migratePerImageFiles(stats) {
  let modifiedAny = false;
  async function walk(dir) {
    let dirents;
    try {
      dirents = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      if (err.code === 'ENOENT') return; // directory not found
      throw err;
    }
    for (const de of dirents) {
      const fullPath = path.join(dir, de.name);
      if (de.isDirectory()) {
        await walk(fullPath);
      } else if (de.isFile()) {
        const name = de.name;
        if (shouldSkipName(name)) continue;
        try {
          const raw = await fs.readFile(fullPath, 'utf-8');
          const data = JSON.parse(raw);
          if (!data || typeof data !== 'object') {
            stats.scannedFiles++;
            continue;
          }

          let modified = false;

          if (Array.isArray(data.annotations)) {
            const beforeCount = data.annotations.length;
            data.annotations = transformAnnotationsArray(data.annotations, stats);
            if (beforeCount > 0) modified = true;
          }

          if (modified) {
            modifiedAny = true;
            stats.scannedFiles++;
            if (!DRY_RUN) {
              await backupFile(fullPath);
              await fs.writeFile(fullPath, JSON.stringify(data, null, 2));
              stats.modifiedFiles++;
            }
          } else {
            stats.scannedFiles++;
          }
        } catch (e) {
          console.warn(`[migrate] Failed to process ${fullPath}:`, e.message);
          stats.errors.push({ file: fullPath, error: e.message });
        }
      }
    }
  }

  try {
    await walk(ANNOTATIONS_DIR);
  } catch (err) {
    console.warn('[migrate] Error during directory walk:', err.message);
    return false;
  }
  return modifiedAny;
}

async function main() {
  const stats = {
    scannedFiles: 0,
    modifiedFiles: 0,
    modifiedAnnotations: 0,
    errors: []
  };

  console.log(`\n=== Migration: regular -> ${BUILTIN_TYPE_ID} ===`);
  console.log(`Project: ${PROJECT_ROOT}`);
  console.log(`Annotations dir: ${ANNOTATIONS_DIR}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'WRITE'}`);

  const aggModified = await migratePlantAggregate(stats);
  const imgModified = await migratePerImageFiles(stats);

  console.log('\n--- Summary ---');
  console.log(`Files scanned: ${stats.scannedFiles}`);
  console.log(`Files modified: ${DRY_RUN ? 0 : stats.modifiedFiles}${DRY_RUN ? ' (would modify on write mode)' : ''}`);
  console.log(`Annotations modified: ${stats.modifiedAnnotations}`);
  if (stats.errors.length > 0) {
    console.log(`Errors: ${stats.errors.length}`);
    for (const err of stats.errors.slice(0, 5)) {
      console.log(` - ${err.file}: ${err.error}`);
    }
    if (stats.errors.length > 5) console.log(` ... and ${stats.errors.length - 5} more`);
  }

  if (!aggModified && !imgModified) {
    console.log('No changes were necessary.');
  } else {
    console.log('Migration completed.');
  }
}

main().catch((e) => {
  console.error('Fatal migration error:', e);
  process.exitCode = 1;
});


