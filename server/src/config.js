// ─── Configuration ────────────────────────────────────────────
// Reads from .env, config.json, and provides sensible defaults.
// All config values can be overridden via environment variables.

const path = require('path');
const fs = require('fs');

// Load .env from server root
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Load config.json if it exists
let fileConfig = {};
const configPath = path.resolve(__dirname, '../../config.json');
if (fs.existsSync(configPath)) {
  try {
    fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (e) {
    console.warn('[config] Failed to parse config.json:', e.message);
  }
}

// Runtime overrides (changed via POST /api/config)
const runtimeOverrides = {};

function get(key, defaultValue) {
  // Priority: runtime override > env var > config.json > default
  if (runtimeOverrides[key] !== undefined) return runtimeOverrides[key];
  if (process.env[key] !== undefined) return process.env[key];
  if (fileConfig[key] !== undefined) return fileConfig[key];
  return defaultValue;
}

function getInt(key, defaultValue) {
  const val = get(key, defaultValue);
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getFloat(key, defaultValue) {
  const val = get(key, defaultValue);
  const parsed = parseFloat(val);
  return isNaN(parsed) ? defaultValue : parsed;
}

function setRuntime(key, value) {
  runtimeOverrides[key] = value;
}

function getRuntime(key) {
  return runtimeOverrides[key];
}

function getAllConfig() {
  return {
    FLEET_SIZE: getInt('FLEET_SIZE', 8),
    UPDATE_INTERVAL_MS: getInt('UPDATE_INTERVAL_MS', 5000),
    STALE_TIMEOUT_MS: getInt('STALE_TIMEOUT_MS', 15000),
    HISTORY_WINDOW_S: getInt('HISTORY_WINDOW_S', 1800),
    PORT: getInt('PORT', 3001),
    AUTH_TOKEN: get('AUTH_TOKEN', 'fleet-admin-token'),
    SITE_WIDTH: getInt('SITE_WIDTH', 900),
    SITE_HEIGHT: getInt('SITE_HEIGHT', 560),
    ROBOT_SPEED: getFloat('ROBOT_SPEED', 3.0),
    BATTERY_DRAIN_ACTIVE: getFloat('BATTERY_DRAIN_ACTIVE', 0.12),
    BATTERY_DRAIN_IDLE: getFloat('BATTERY_DRAIN_IDLE', 0.02),
    BATTERY_CHARGE_RATE: getFloat('BATTERY_CHARGE_RATE', 0.5),
    LOW_BATTERY_THRESHOLD: getFloat('LOW_BATTERY_THRESHOLD', 20),
    CHARGE_TARGET: getFloat('CHARGE_TARGET', 35),
  };
}

module.exports = {
  get,
  getInt,
  getFloat,
  setRuntime,
  getRuntime,
  getAllConfig,
};
