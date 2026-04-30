const fs = require("fs");

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, content) {
  fs.writeFileSync(path, content, "utf8");
  console.log("updated:", path);
}

function findFunctionRange(source, functionName) {
  const marker = "function " + functionName + "(";
  const start = source.indexOf(marker);
  if (start === -1) return null;

  const braceStart = source.indexOf("{", start);
  if (braceStart === -1) throw new Error("Opening brace not found: " + functionName);

  let depth = 0;
  let quote = null;
  let escape = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = braceStart; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];

    if (lineComment) {
      if (ch === "\n") lineComment = false;
      continue;
    }

    if (blockComment) {
      if (ch === "*" && next === "/") {
        blockComment = false;
        i++;
      }
      continue;
    }

    if (quote) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === "/" && next === "/") {
      lineComment = true;
      i++;
      continue;
    }

    if (ch === "/" && next === "*") {
      blockComment = true;
      i++;
      continue;
    }

    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      continue;
    }

    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return { start, end: i + 1 };
    }
  }

  throw new Error("Closing brace not found: " + functionName);
}

function removeFunction(source, functionName) {
  const range = findFunctionRange(source, functionName);
  if (!range) return source;
  console.log("removed function:", functionName);
  return source.slice(0, range.start) + source.slice(range.end);
}

function removeLines(content, patterns) {
  return content
    .split(/\r?\n/)
    .filter(line => !patterns.some(pattern => pattern.test(line)))
    .join("\n");
}

// 1. Core: убрать header position_title
let core = read("AccessControl.Core.gs");
core = removeLines(core, [
  /^\s*'position_title',?\s*$/
]);
write("AccessControl.Core.gs", core);

// 2. AuthResolver: не писать position_title в заявку
let auth = read("AccessControl.AuthResolver.gs");
auth = removeLines(auth, [
  /^\s*position_title:\s*['"][^'"]*['"],?\s*$/,
  /^\s*position_title:\s*'',?\s*$/
]);
auth = auth.replace(/\n\s*position_title:\s*[^,\n]+,?/g, "");
write("AccessControl.AuthResolver.gs", auth);

// 3. SheetRepository: убрать всю логику position_title / посада
let repo = read("AccessControl.SheetRepository.gs");

// если refresh был переключен на derived-fields, вернуть обычную синхронизацию note
repo = repo.replace(/var syncedNotes = _syncAllRoleDerivedFields_\(sh\);/g, "var syncedNotes = _syncAllRoleNotes_(sh);");
repo = repo.replace(/_syncRoleDerivedFieldsForRow_\(sh, row \+ syncOffset\);/g, "_syncRoleNoteForRow_(sh, row + syncOffset);");

// удалить функции, связанные с position_title
[
  "_getAccessPositionTitleValues_",
  "_applyPositionTitleValidation_",
  "_getDefaultPositionTitleForRole_",
  "_syncRoleDerivedFieldsForRow_",
  "_syncAllRoleDerivedFields_"
].forEach(fn => {
  repo = removeFunction(repo, fn);
});

// удалить вызовы validation
repo = removeLines(repo, [
  /^\s*_applyPositionTitleValidation_\(sh\);\s*$/,
  /^\s*positionTitle:\s*String\(read\('position_title'\)[\s\S]*$/,
  /^\s*if \(entry\.positionTitle !== undefined\) updates\.position_title = entry\.positionTitle;\s*$/,
  /^\s*case 'position_title': return[\s\S]*$/,
  /^\s*position_title:\s*'[^']*',?\s*$/,
  /^\s*aliases\['посада \/ должность'\][\s\S]*$/,
  /^\s*aliases\['должность'\][\s\S]*$/,
  /^\s*aliases\['position_title'\][\s\S]*$/,
  /^\s*aliases\['посада'\][\s\S]*$/
]);

// удалить update-блоки position_title
repo = repo.replace(
  /\n\s*if \(Object\.prototype\.hasOwnProperty\.call\(updates, 'position_title'\)\) \{\s*\n\s*mapped\.positionTitle = String\(updates\.position_title \|\| ''\)\.trim\(\);\s*\n\s*\}/g,
  ""
);

repo = repo.replace(
  /\n\s*if \(Object\.prototype\.hasOwnProperty\.call\(updates, 'positionTitle'\)\) \{\s*\n\s*mapped\.positionTitle = String\(updates\.positionTitle \|\| ''\)\.trim\(\);\s*\n\s*\}/g,
  ""
);

// добавить position_title/посада в список старых колонок на удаление
if (repo.includes("function _removeAccessObsoleteColumns_")) {
  if (!repo.includes("position_title: true")) {
    repo = repo.replace(
      /var obsolete = \{/,
      "var obsolete = {\n    position_title: true,\n    'посада': true,\n    'должность': true,"
    );
  }
} else {
  const obsoleteFn = `
// ==================== ACCESS OBSOLETE COLUMNS CLEANUP ====================

function _removeAccessObsoleteColumns_(sh) {
  if (!sh) return 0;

  var obsolete = {
    position_title: true,
    'посада': true,
    'должность': true
  };

  var lastColumn = Number(sh.getLastColumn()) || 0;
  if (lastColumn < 1) return 0;

  var headers = sh.getRange(1, 1, 1, lastColumn).getValues()[0];
  var removed = 0;

  for (var i = headers.length - 1; i >= 0; i--) {
    var header = String(headers[i] || '').trim().toLowerCase();
    if (!header) continue;

    if (obsolete[header]) {
      sh.deleteColumn(i + 1);
      removed++;
    }
  }

  return removed;
}
`;

  repo = repo.replace(
    "\n// ==================== SHEET OPERATIONS",
    obsoleteFn + "\n// ==================== SHEET OPERATIONS"
  );
}

if (!repo.includes("_removeAccessObsoleteColumns_(sh);")) {
  repo = repo.replace(
    "function _ensureSheetSchema_(sh) {\n  if (!sh) return;",
    "function _ensureSheetSchema_(sh) {\n  if (!sh) return;\n\n  _removeAccessObsoleteColumns_(sh);"
  );
}

write("AccessControl.SheetRepository.gs", repo);

console.log("Removed position_title / посада from ACCESS.");
