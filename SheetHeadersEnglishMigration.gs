/** SheetHeadersEnglishMigration.gs — one-shot migration of existing workbook headers to English. */
function wasbNormalizeAllSheetHeadersToEnglish() {
  var ss = getWasbSpreadsheet_();
  var report = { ok: true, changedSheets: [], skippedSheets: [], errors: [] };
  function setHeaders(sheet, row, headers) {
    if (!sheet || !headers || !headers.length) return false;
    row = Math.max(Number(row) || 1, 1);
    if (sheet.getMaxColumns() < headers.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
    var current = sheet.getRange(row, 1, 1, headers.length).getDisplayValues()[0];
    var changed = false;
    for (var i = 0; i < headers.length; i++) if (String(current[i] || '').trim() !== String(headers[i] || '').trim()) { changed = true; break; }
    if (changed) sheet.getRange(row, 1, 1, headers.length).setValues([headers]);
    try { sheet.setFrozenRows(Math.max(sheet.getFrozenRows(), row)); sheet.getRange(row, 1, 1, headers.length).setFontWeight('bold').setBackground('#e8eaed'); } catch (_) {}
    return changed;
  }
  function run(name, fn) { try { if (fn()) report.changedSheets.push(name); else report.skippedSheets.push(name); } catch (e) { report.ok = false; report.errors.push({ sheet: name, error: e && e.message ? e.message : String(e) }); } }
  function schemaHeaders(key) {
    var schema = SheetSchemas_.get(key), fields = schema.fields || {}, max = 0;
    Object.keys(fields).forEach(function(k){ var c = Number(fields[k].col)||0; if (c > max) max = c; });
    var h = new Array(max); for (var i=0;i<max;i++) h[i]='';
    Object.keys(fields).forEach(function(k){ var f = fields[k], c = Number(f.col)||0; if (c > 0) h[c-1] = String(f.label || k); });
    return h;
  }
  var access = ss.getSheetByName(typeof ACCESS_SHEET !== 'undefined' ? ACCESS_SHEET : 'ACCESS');
  if (access) run('ACCESS', function(){ var changed = setHeaders(access, 1, SHEET_HEADERS.slice()); try { _applyRoleValidation_(access); _applyEmailValidation_(access); _applyEnabledValidation_(access); _applySelfBindAllowedValidation_(access); _applyRegistrationStatusValidation_(access); } catch (e) { report.errors.push({ sheet: 'ACCESS', error: 'validation: ' + e.message }); } return changed; });
  [
    ['PHONES', (CONFIG && CONFIG.PHONES_SHEET) || 'PHONES', 1], ['DICT', (CONFIG && CONFIG.DICT_SHEET) || 'DICT', 1], ['DICT_SUM', (CONFIG && CONFIG.DICT_SUM_SHEET) || 'DICT_SUM', 1],
    ['VACATIONS', (typeof VACATION_ENGINE_CONFIG !== 'undefined' && VACATION_ENGINE_CONFIG.VACATIONS_SHEET) || 'VACATIONS', 1], ['LOG', (CONFIG && CONFIG.LOG_SHEET) || 'LOG', 1], ['SEND_PANEL', (CONFIG && CONFIG.SEND_PANEL_SHEET) || 'SEND_PANEL', (CONFIG && CONFIG.SEND_PANEL_HEADER_ROW) || 2]
  ].forEach(function(x){ var sh = ss.getSheetByName(x[1]); if (sh) run(x[1], function(){ return setHeaders(sh, x[2], schemaHeaders(x[0])); }); });
  var fixed = {
    TEMPLATES:['key','text','enabled','tag_hint','note'], ALERTS_LOG:['Timestamp','Type','Severity','Action','Outcome','Role','DisplayName','UserKey','Email','Source','Message','DetailsJson'],
    AUDIT_LOG:['Timestamp','OperationId','Scenario','Level','Status','Initiator','DryRun','Partial','AffectedSheets','AffectedEntities','AppliedChanges','SkippedChanges','Warnings','PayloadJson','BeforeJson','AfterJson','ChangesJson','DiagnosticsJson','Message','Error'],
    OPS_LOG:['TimestampStarted','TimestampFinished','OperationId','ParentOperationId','Scenario','RawScenario','Initiator','RunSource','Status','Fingerprint','AffectedRows','AffectedEntities','VerificationResult','RepairNeeded','ErrorMessage','TransitionReason','Notes','ResolvedByOperationId','ResolvedAt','ResolutionStatus','LastHeartbeat','ExpiresAt','PayloadJson','ResultJson','CheckpointCount'],
    ACTIVE_OPERATIONS:['OperationId','Scenario','Fingerprint','Status','StartedAt','LastHeartbeat','Initiator','RunSource','ExpiresAt','LockHolder','ParentOperationId','Notes','PayloadJson'],
    CHECKPOINTS:['OperationId','CheckpointIndex','ProcessedUpTo','LastProcessedEntity','LastProcessedRow','CheckpointTimestamp','CheckpointPayload','VerificationSnapshot'],
    JOB_RUNTIME_LOG:['tsStart','tsEnd','jobName','status','source','durationMs','dryRun','operationId','message','error','initiatorEmail','initiatorName','initiatorRole','initiatorCallsign','entryPoint','triggerId','notes'],
    TEST_RESULTS:['RunId','Mode','StartedAt','FinishedAt','RunDurationMs','Group','Level','Id','Name','FunctionName','Status','Severity','Discovered','TaskDurationMs','Message','DetailsJson','ErrorStack'],
    DAILY_SUMMARIES:['Date','Group','Surname','Code']
  };
  Object.keys(fixed).forEach(function(n){ var sh = ss.getSheetByName(n); if (sh) run(n, function(){ return setHeaders(sh, 1, fixed[n]); }); });
  ss.getSheets().forEach(function(sh){ if (/^\d{2}$/.test(sh.getName())) run(sh.getName(), function(){ return setHeaders(sh, 1, ['Phone','Callsign','Position','OSHS','Rank','BRDays','FML']); }); });
  return report;
}
function apiStage7NormalizeAllSheetHeadersToEnglish() {
  var result = wasbNormalizeAllSheetHeadersToEnglish();
  return { success: result.ok !== false, message: result.ok !== false ? 'All known sheet headers normalized to English' : 'Header normalization finished with errors', result: result, warnings: result.errors || [] };
}
