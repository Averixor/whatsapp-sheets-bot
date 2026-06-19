/**
 * FunctionBindingAudit.gs — перевірка прив'язок menu/trigger/client → top-level GAS functions.
 * Дублює scripts/audit-function-graph.mjs для запуску з редактора або тестів.
 */

function runFunctionBindingAudit() {
  var bound = _fbaCollectBoundRefs_();
  var defs = _fbaCollectTopLevelDefs_();
  var defSet = {};
  defs.forEach(function (d) {
    defSet[d.name] = true;
  });

  var missing = [];
  Object.keys(bound).forEach(function (name) {
    if (!defSet[name]) missing.push({ name: name, refs: bound[name] });
  });
  missing.sort(function (a, b) {
    return a.name.localeCompare(b.name);
  });

  return {
    ok: missing.length === 0,
    definitionCount: defs.length,
    boundNameCount: Object.keys(bound).length,
    missing: missing,
  };
}

function _fbaCollectTopLevelDefs_() {
  var files = _fbaListProjectGsFiles_();
  var defs = [];
  files.forEach(function (file) {
    var text = file.content;
    text.split("\n").forEach(function (line, i) {
      var m = line.match(/^function\s+([A-Za-z_$][\w$]*)\s*\(/);
      if (m) defs.push({ name: m[1], file: file.name, line: i + 1 });
    });
  });
  return defs;
}

function _fbaCollectBoundRefs_() {
  var files = _fbaListProjectGsAndHtml_();
  var bound = {};

  function add(name, ref) {
    if (!name) return;
    if (!bound[name]) bound[name] = [];
    bound[name].push(ref);
  }

  files.forEach(function (file) {
    var text = file.content;
    var m;
    var menuRe =
      /\.add(?:Item|SubMenu)\s*\([^,]+,\s*['"]([A-Za-z_$][\w$]*)['"]/g;
    while ((m = menuRe.exec(text))) {
      add(m[1], {
        kind: "menu",
        file: file.name,
        line: _fbaLineOf_(text, m.index),
      });
    }
    var trigRe = /ScriptApp\.newTrigger\s*\(\s*['"]([A-Za-z_$][\w$]*)['"]/g;
    while ((m = trigRe.exec(text))) {
      add(m[1], {
        kind: "trigger",
        file: file.name,
        line: _fbaLineOf_(text, m.index),
      });
    }
    var clientRe = /(?:gsRun|Api\.run)\s*\(\s*['"]([A-Za-z_$][\w$]*)['"]/g;
    while ((m = clientRe.exec(text))) {
      add(m[1], {
        kind: "client",
        file: file.name,
        line: _fbaLineOf_(text, m.index),
      });
    }
    var gsrRe =
      /google\.script\.run(?:\.(?:withSuccessHandler|withFailureHandler|withUserObject)\([^)]*\))*\.([A-Za-z_$][\w$]*)\s*\(/g;
    while ((m = gsrRe.exec(text))) {
      var gsrName = m[1];
      if (
        gsrName === "withSuccessHandler" ||
        gsrName === "withFailureHandler" ||
        gsrName === "withUserObject" ||
        gsrName === "withLogger"
      ) {
        continue;
      }
      add(gsrName, {
        kind: "client",
        file: file.name,
        line: _fbaLineOf_(text, m.index),
      });
    }
  });

  return bound;
}

function _fbaLineOf_(text, index) {
  return text.slice(0, index).split("\n").length;
}

function _fbaListProjectGsFiles_() {
  return _fbaListProjectGsAndHtml_().filter(function (f) {
    return /\.gs$/i.test(f.name);
  });
}

function _fbaListProjectGsAndHtml_() {
  if (typeof _projectBundleListFiles_ === "function") {
    return _projectBundleListFiles_()
      .filter(function (name) {
        return /\.(gs|html)$/i.test(name);
      })
      .map(function (name) {
        return { name: name, content: _projectBundleReadFile_(name) || "" };
      });
  }
  return [];
}
