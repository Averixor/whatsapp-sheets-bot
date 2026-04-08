function runDiagnostics() {
  const startedAt = new Date().toISOString();

  const sections = {
    sheets: checkSheets(),
    files: checkFiles(),
    duplicates: checkDuplicates(),
    functions: testFunctions()
  };

  const ok = Object.values(sections).every(function (section) {
    return section.status !== 'ERROR';
  });

  const finishedAt = new Date().toISOString();

  const summary = {
    ok: ok,
    startedAt: startedAt,
    finishedAt: finishedAt,
    sections: sections
  };

  DIAGNOSTICS.results.summary = summary;
  return summary;
}
