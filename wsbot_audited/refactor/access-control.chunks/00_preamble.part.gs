/**
 * AccessControl.gs — strict user-key RBAC with hashed keys and escalation lockout.
 * 
 * Core principles:
 * - Primary identity: Session.getTemporaryActiveUserKey() hashed via SHA-256
 * - ACCESS is the single source of truth for user access
 * - Lockout escalation: 15 min → 30 min → 60 min → 24 h
 * - Clean separation of auth failures (lead to lockout) and role denials (log only)
 * - Header-based safe reads and writes to prevent data corruption
 */

const AccessControl_ = (function () {
  const ACCESS_SHEET = appGetCore('ACCESS_SHEET', 'ACCESS');

  // Runtime-local caches (per single Apps Script execution).
  let _sheetCache = null;
  let _entriesCache = null;
  let _policyCache = null;

  function _invalidateAccessCaches_(options) {
    const opts = options || {};
    _entriesCache = null;
    _policyCache = null;
    if (opts.resetSheet) _sheetCache = null;
  }

  // Script properties keys
  const LOCKOUT_PROP_PREFIX = 'WASB_ACCESS_LOCKOUT_V1__';
  const MIGRATION_EMAIL_BRIDGE_PROP = 'WASB_ACCESS_MIGRATION_EMAIL_BRIDGE';
  const SELF_BIND_LOGIN_PROP_PREFIX = 'WASB_ACCESS_SELF_BIND_LOGIN_V1__';

  // Lockout configuration
  const MINUTE_MS = 60 * 1000;
  const HOUR_MS = 60 * MINUTE_MS;

  const LOCKOUT_DURATION_MS = 15 * MINUTE_MS;
  const SELF_BIND_LOCK_DURATION_MS = 30 * MINUTE_MS;
  const MAX_SELF_BIND_LOGIN_ATTEMPTS = 5;
  const LOCKOUT_ESCALATION_MS = Object.freeze([
    LOCKOUT_DURATION_MS,
    30 * MINUTE_MS,
    60 * MINUTE_MS,
    24 * HOUR_MS
  ]);

  const MAX_FAILED_ATTEMPTS_SHEET = 5;
  const MAX_SHEET_ROWS = 30;
  const ROTATION_PERIOD_DAYS = 30;

  const ROLE_VALUES = Object.freeze([
    'guest',
    'viewer',
    'operator',
    'maintainer',
    'admin',
    'sysadmin',
    'owner'
  ]);

  const ROLE_ORDER = Object.freeze({
    guest: 0,
    viewer: 1,
    operator: 2,
    maintainer: 3,
    admin: 4,
    sysadmin: 5,
    owner: 6
  });

  const ROLE_METADATA = Object.freeze({
    guest: Object.freeze({ label: 'Гість', note: 'Гість • лише безпечний перегляд' }),
    viewer: Object.freeze({ label: 'Спостерігач', note: 'Спостерігач • тільки своя картка' }),
    operator: Object.freeze({ label: 'Оператор', note: 'Оператор • робочий доступ до карток, зведень' }),
    maintainer: Object.freeze({ label: 'Редактор', note: 'Редактор • розширений робочий доступ, перевірка і супровід' }),
    admin: Object.freeze({ label: 'Адмін', note: 'Адмін • керування доступом, журналами і системними інструментами' }),
    sysadmin: Object.freeze({ label: 'Сисадмін', note: 'Сисадмін • повне технічне обслуговування, repair і тригери' }),
    owner: Object.freeze({ label: 'Власник', note: 'Власник • повний root-доступ до всієї системи' })
  });

  const SHEET_HEADERS = Object.freeze([
    'email',
    'phone',
    'role',
    'enabled',
    'note',
    'display_name',
    'person_callsign',
    'self_bind_allowed',
    'user_key_current_hash',
    'user_key_prev_hash',
    'last_seen_at',
    'last_rotated_at',
    'failed_attempts',
    'locked_until_ms'
  ]);

