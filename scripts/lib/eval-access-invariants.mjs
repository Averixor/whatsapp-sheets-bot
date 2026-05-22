/**
 * Evaluate access.contract.json invariants against a captured descriptor.
 */
function getByPath(obj, dotPath) {
  return dotPath.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function parseLiteral(token) {
  const t = token.trim();
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null') return null;
  if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) {
    return t.slice(1, -1);
  }
  const num = Number(t);
  if (!Number.isNaN(num) && t !== '') return num;
  return t;
}

function evalSimpleExpr(descriptor, expr) {
  const trimmed = String(expr || '').trim();
  const eq = trimmed.match(/^(.+?)\s*===\s*(.+)$/);
  if (eq) return getByPath(descriptor, eq[1].trim()) === parseLiteral(eq[2]);
  const ne = trimmed.match(/^(.+?)\s*!==\s*(.+)$/);
  if (ne) return getByPath(descriptor, ne[1].trim()) !== parseLiteral(ne[2]);
  throw new Error(`unsupported invariant expression: ${expr}`);
}

/**
 * @param {object[]} invariants
 * @param {object|null} descriptor
 * @returns {string[]} errors
 */
export function evalAccessInvariants(invariants, descriptor) {
  if (!descriptor || typeof descriptor !== 'object') return [];
  const errors = [];
  for (const rule of invariants || []) {
    try {
      if (!evalSimpleExpr(descriptor, rule.when)) continue;
      if (!evalSimpleExpr(descriptor, rule.assert)) {
        errors.push(`invariant ${rule.id}: when (${rule.when}) but assert (${rule.assert}) failed`);
      }
    } catch (err) {
      errors.push(`invariant ${rule.id}: ${err.message}`);
    }
  }
  return errors;
}

/**
 * @param {object[]} invariants
 * @returns {string[]} schema errors
 */
export function validateInvariantSchema(invariants) {
  const errors = [];
  if (!Array.isArray(invariants) || !invariants.length) {
    errors.push('invariants must be a non-empty array');
    return errors;
  }
  invariants.forEach((rule, i) => {
    if (!rule?.id) errors.push(`invariants[${i}]: missing id`);
    if (!rule?.when) errors.push(`invariants[${i}]: missing when`);
    if (!rule?.assert) errors.push(`invariants[${i}]: missing assert`);
  });
  return errors;
}
