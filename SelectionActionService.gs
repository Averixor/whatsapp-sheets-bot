
/**
 * Reconciliation.gs — stage 5 reconciliation 2.0 with targeted safe repair.
 */

const Reconciliation_ = (function () {
  function _indexRows(rows) {
    const map = {};
    const duplicates = [];
    stage4AsArray_(rows).forEach(function (row) {
      const key = makeSendPanelKey_(row.fio, row.phone, row.code);
      if (!key || key === '||') return;
      if (!map[key]) map[key] = [];
      map[key].push(row);
      if (map[key].length > 1) duplicates.push(key);
    });
    return {
      map: map,
      duplicates: [...new Set(duplicates)]
    };
  }

  function _issue(type, severity, repairable, details) {
    return Object.assign({
      type: type,
      severity: severity || 'WARN',
      repairable: !!repairable
    }, details || {});
  }

  function _allowedStatuses() {
    return getSendPanelAllAllowedStatuses_();
  }

  function compareRows(expectedRows, actualRows) {
    const expectedIndex = _indexRows(expectedRows || []);
    const actualIndex = _indexRows(actualRows || []);
    const issues = [];

    Object.keys(expectedIndex.map).forEach(function (key) {
      if (!actualIndex.map[key]) {
        const sample = expectedIndex.map[key][0];
        issues.push(_issue('missingExpectedItem', 'CRITICAL', true, {
          key: key,
          fio: sample.fio,
          code: sample.code,
          expectedStatus: sample.status,
          expectedRow: sample.row
        }));
      }
    });

    Object.keys(actualIndex.map).forEach(function (key) {
      if (!expectedIndex.map[key]) {
        const sample = actualIndex.map[key][0];
        issues.push(_issue('orphanSendPanelRow', 'WARN', true, {
          key: key,
          fio: sample.fio,
          code: sample.code,
          actualStatus: sample.status,
          actualRow: sample.row
        }));
      }
    });

    actualIndex.duplicates.forEach(function (key) {
      const sample = actualIndex.map[key][0];
      issues.push(_issue('duplicateSendPanelRow', 'CRITICAL', true, {
        key: key,
        fio: sample.fio,
        code: sample.code,
        count: actualIndex.map[key].length,
        rows: actualIndex.map[key].map(function (item) { return item.row; })
      }));
    });

    Object.keys(expectedIndex.map).forEach(function (key) {
      if (!actualIndex.map[key]) return;

      const exp = expectedIndex.map[key][0];
      const act = actualIndex.map[key][0];
      const status = String(act.status || '').trim();

      if (!act.link && exp.link) {
        issues.push(_issue('brokenActionLink', 'WARN', true, {
          key: key,
          fio: act.fio,
          code: act.code,
          actualRow: act.row
        }));
      }

      if (_allowedStatuses().indexOf(status) === -1 && !status.startsWith(getSendPanelErrorPrefix_())) {
        issues.push(_issue('staleStatus', 'WARN', true, {
          key: key,
          fio: act.fio,
          code: act.code,
          actualStatus: act.status,
          actualRow: act.row
        }));
      }
    });

    return {
      expectedRows: expectedRows || [],
      actualRows: actualRows || [],
      issues: issues,
      summary: {
        expectedCount: stage4AsArray_(expectedRows).length,
        actualCount: stage4AsArray_(actualRows).length,
        duplicateCount: actualIndex.duplicates.length,
        issueCount: issues.length
      }
    };
  }

  function compareMonthlyToSendPanel(dateStr) {
    const expected = SendPanelRepository_.preview(dateStr);
    const actualRows = SendPanelRepository_.readRows();
    const compared = compareRows(expected.rows || [], actualRows || []);
    const issues = (compared.issues || []).slice();

    const vacationsSheet = DataAccess_.getSheet('VACATIONS', null, false);
    if (!vacationsSheet) {
      issues.push(_issue('vacationsMismatch', 'WARN', false, {
        details: 'Аркуш VACATIONS відсутній'
      }));
    }

    const logSheet = DataAccess_.getSheet('LOG', null, false);
    if (!logSheet) {
      issues.push(_issue('logInconsistency', 'WARN', false, {
        details: 'Аркуш LOG відсутній'
      }));
    }

    try {
      const daySummary = SummaryRepository_.buildDaySummary(dateStr);
      const detailed = SummaryRepository_.buildDetailedSummary(dateStr);
      if (!daySummary || !detailed || !String(daySummary.summary || '').trim() || !String(detailed.summary || '').trim()) {
        issues.push(_issue('summaryMismatch', 'WARN', false, {
          details: 'Не вдалося побудувати одне зі зведень'
        }));
      }
    } catch (e) {
      issues.push(_issue('summaryMismatch', 'WARN', false, {
        details: e && e.message ? e.message : String(e)
      }));
    }

    return {
      date: dateStr,
      month: expected.month,
      expectedRows: expected.rows || [],
      actualRows: actualRows,
      issues: issues,
      summary: Object.assign({}, compared.summary || {}, {
        expectedCount: (expected.rows || []).length,
        actualCount: actualRows.length,
        issueCount: issues.length
      })
    };
  }

  function _expectedRowMap(check) {
    const map = {};
    stage4AsArray_(check.expectedRows).forEach(function (item) {
      map[makeSendPanelKey_(item.fio, item.phone, item.code)] = item;
    });
    return map;
  }

  function _actualRowMap(check) {
    const indexed = _indexRows(check.actualRows || []);
    const flat = {};
    Object.keys(indexed.map).forEach(function (key) {
      flat[key] = indexed.map[key];
    });
    return flat;
  }

  function previewRepairPlan(issues, options) {
    const opts = options || {};
    const allowedTypes = stage4AsArray_(opts.issueTypes).map(String);
    const selected = stage4AsArray_(issues).filter(function (item) {
      return !allowedTypes.length || allowedTypes.indexOf(item.type) !== -1;
    });
    return {
      selectedCount: selected.length,
      repairableCount: selected.filter(function (item) { return item.repairable; }).length,
      canRebuild: selected.length > 0,
      plannedOperations: selected.map(function (item) {
        return {
          type: item.type,
          key: item.key || '',
          targetRow: item.actualRow || item.expectedRow || '',
          repairable: item.repairable
        };
      })
    };
  }

  function previewRepair(options) {
    const opts = options || {};
    const check = compareMonthlyToSendPanel(String(opts.date || opts.dateStr || _todayStr_()).trim());
    const allowedTypes = stage4AsArray_(opts.issueTypes).map(String);
    const selected = check.issues.filter(function (item) {
      return !allowedTypes.length || allowedTypes.indexOf(item.type) !== -1;
    });

    const plan = previewRepairPlan(selected, opts);
    return {
      date: check.date,
      mode: 'previewRepair',
      issues: selected,
      selectedCount: plan.selectedCount,
      repairableCount: plan.repairableCount,
      canRebuild: plan.canRebuild,
      plannedOperations: plan.plannedOperations
    };
  }

  function _setPanelFormula(row, link) {
    const panel = DataAccess_.getSheet('SEND_PANEL', null, true);
    const formula = link ? `=HYPERLINK("${link}"; "📱 НАДІСЛАТИ")` : '';
    panel.getRange(row, 6).setFormula(formula);
  }

  function _setPanelStatus(row, value) {
    const panel = DataAccess_.getSheet('SEND_PANEL', null, true);
    panel.getRange(row, 5).setValue(value);
  }

  function _appendPanelRow(expectedRow) {
    const panel = DataAccess_.getSheet('SEND_PANEL', null, true);
    const nextRow = Math.max(panel.getLastRow() + 1, Number(CONFIG.SEND_PANEL_DATA_START_ROW) || 3);
    const formattedPhone = String(expectedRow.phone || '').trim().startsWith('+')
      ? "'" + String(expectedRow.phone || '').trim()
      : String(expectedRow.phone || '').trim() || '—';
    const formula = expectedRow.link ? `=HYPERLINK("${expectedRow.link}"; "📱 НАДІСЛАТИ")` : '';
    panel.getRange(nextRow, 1, 1, 7).setValues([[
      expectedRow.fio || '',
      formattedPhone,
      expectedRow.code || '',
      expectedRow.tasks || '—',
      expectedRow.sent === true ? getSendPanelSentStatus_() : getSendPanelReadyStatus_(),
      formula,
      expectedRow.sent === true
    ]]);
    panel.getRange(nextRow, 7).insertCheckboxes();
    return nextRow;
  }

  function _deleteRowsDescending(rows) {
    const panel = DataAccess_.getSheet('SEND_PANEL', null, true);
    [...new Set(stage4AsArray_(rows).map(Number).filter(Number.isFinite))]
      .sort(function (a, b) { return b - a; })
      .forEach(function (row) { panel.deleteRow(row); });
  }

  function repairSelectedIssues(options) {
    const opts = Object.assign({
      dryRun: true,
      limit: STAGE5_CONFIG.MAX_SAFE_REPAIR_ITEMS
    }, options || {});

    const operationId = String(opts.operationId || stage4UniqueId_('repairSelectedIssues'));
    const check = compareMonthlyToSendPanel(String(opts.date || opts.dateStr || _todayStr_()).trim());
    const expectedMap = _expectedRowMap(check);
    const actualMap = _actualRowMap(check);
    const allowedTypes = stage4AsArray_(opts.issueTypes).map(String);
    const selected = check.issues.filter(function (item) {
      return item.repairable && (!allowedTypes.length || allowedTypes.indexOf(item.type) !== -1);
    }).slice(0, Number(opts.limit) || STAGE5_CONFIG.MAX_SAFE_REPAIR_ITEMS);

    const repairs = [];
    const warnings = [];
    const deferredDeletes = [];

    selected.forEach(function (issue) {
      if (issue.type === 'missingExpectedItem') {
        const expected = expectedMap[issue.key];
        if (!expected) return;
        if (opts.dryRun) {
          repairs.push({ type: issue.type, key: issue.key, dryRun: true });
        } else {
          const row = _appendPanelRow(expected);
          repairs.push({ type: issue.type, key: issue.key, row: row });
        }
        return;
      }

      if (issue.type === 'brokenActionLink') {
        const expected = expectedMap[issue.key];
        if (!expected || !issue.actualRow) return;
        if (opts.dryRun) {
          repairs.push({ type: issue.type, key: issue.key, row: issue.actualRow, dryRun: true });
        } else {
          _setPanelFormula(issue.actualRow, expected.link || '');
          repairs.push({ type: issue.type, key: issue.key, row: issue.actualRow });
        }
        return;
      }

      if (issue.type === 'staleStatus') {
        const expected = expectedMap[issue.key];
        const status = expected && expected.sent === true ? getSendPanelSentStatus_() : getSendPanelReadyStatus_();
        if (!issue.actualRow) return;
        if (opts.dryRun) {
          repairs.push({ type: issue.type, key: issue.key, row: issue.actualRow, dryRun: true, status: status });
        } else {
          _setPanelStatus(issue.actualRow, status);
          repairs.push({ type: issue.type, key: issue.key, row: issue.actualRow, status: status });
        }
        return;
      }

      if (issue.type === 'duplicateSendPanelRow') {
        const rows = stage4AsArray_(issue.rows).map(Number).filter(Number.isFinite).sort(function (a, b) { return a - b; });
        const rowsToDelete = rows.slice(1);
        if (opts.dryRun) {
          repairs.push({ type: issue.type, key: issue.key, rowsToDelete: rowsToDelete, dryRun: true });
        } else {
          deferredDeletes.push.apply(deferredDeletes, rowsToDelete);
          repairs.push({ type: issue.type, key: issue.key, rowsToDelete: rowsToDelete });
        }
        return;
      }

      if (issue.type === 'orphanSendPanelRow') {
        if (!issue.actualRow) return;
        if (opts.dryRun) {
          repairs.push({ type: issue.type, key: issue.key, row: issue.actualRow, dryRun: true });
        } else {
          deferredDeletes.push(issue.actualRow);
          repairs.push({ type: issue.type, key: issue.key, row: issue.actualRow });
        }
        return;
      }

      warnings.push(`Немає safe repair для ${issue.type}`);
    });

    if (!opts.dryRun && deferredDeletes.length) {
      _deleteRowsDescending(deferredDeletes);
    }

    return {
      date: check.date,
      mode: 'repairSelectedIssues',
      dryRun: !!opts.dryRun,
      operationId: operationId,
      selectedCount: selected.length,
      repairs: repairs,
      warnings: warnings,
      appliedChangesCount: opts.dryRun ? 0 : repairs.length,
      skippedChangesCount: opts.dryRun ? repairs.length : 0,
      affectedSheets: [CONFIG.SEND_PANEL_SHEET, getBotMonthSheetName_()]
    };
  }

  function verifyRepairResult(beforeCheck, afterCheck) {
    const afterIssues = stage4AsArray_(afterCheck && afterCheck.issues);
    return {
      beforeIssues: stage4AsArray_(beforeCheck && beforeCheck.issues).length,
      remainingIssues: afterIssues.length,
      criticalRemaining: afterIssues.filter(function (item) { return item.severity === 'CRITICAL'; }).length
    };
  }

  function repairWithVerification(options) {
    const opts = options || {};
    const dateStr = String(opts.date || opts.dateStr || _todayStr_()).trim();
    const beforeCheck = compareMonthlyToSendPanel(dateStr);
    const repaired = repairSelectedIssues(opts);
    const afterCheck = compareMonthlyToSendPanel(dateStr);

    return Object.assign({}, repaired, {
      mode: 'repairWithVerification',
      postCheck: verifyRepairResult(beforeCheck, afterCheck)
    });
  }

  function _buildChecks(dateStr, check) {
    const checks = [];

    checks.push({
      name: 'monthly ↔ SEND_PANEL',
      status: (check.issues || []).length ? 'WARN' : 'OK',
      details: check.summary
    });

    try {
      const sidebar = PersonsRepository_.getSidebarPersonnel(dateStr);
      checks.push({
        name: 'monthly ↔ sidebar-view data',
        status: (sidebar.personnel || []).filter(function (item) { return item.status === 'error'; }).length ? 'WARN' : 'OK',
        details: {
          month: sidebar.month,
          count: (sidebar.personnel || []).length
        }
      });
    } catch (e) {
      checks.push({
        name: 'monthly ↔ sidebar-view data',
        status: 'FAIL',
        details: e && e.message ? e.message : String(e)
      });
    }

    try {
      const summary = SummaryService_.buildDay(dateStr);
      const detailed = SummaryService_.buildDetailed(dateStr);
      checks.push({
        name: 'monthly ↔ summaries',
        status: summary && detailed ? 'OK' : 'WARN',
        details: {
          daySummaryLength: String(summary.summary || '').length,
          detailedSummaryLength: String(detailed.summary || '').length
        }
      });
    } catch (e) {
      checks.push({
        name: 'monthly ↔ summaries',
        status: 'FAIL',
        details: e && e.message ? e.message : String(e)
      });
    }

    checks.push({
      name: 'monthly ↔ vacations',
      status: DataAccess_.getSheet('VACATIONS', null, false) ? 'OK' : 'WARN',
      details: DataAccess_.getSheet('VACATIONS', null, false) ? 'VACATIONS доступний' : 'VACATIONS відсутній'
    });

    checks.push({
      name: 'LOG ↔ critical write-operations',
      status: DataAccess_.getSheet('LOG', null, false) ? 'OK' : 'WARN',
      details: DataAccess_.getSheet('LOG', null, false) ? 'LOG доступний' : 'LOG відсутній'
    });

    return checks;
  }

  function run(options) {
    const opts = options || {};
    const dateStr = String(opts.date || opts.dateStr || _todayStr_()).trim();
    const mode = String(opts.mode || 'check').trim();
    const check = compareMonthlyToSendPanel(dateStr);
    const checks = _buildChecks(dateStr, check);

    if (mode === 'previewRepair') {
      const preview = previewRepair(opts);
      return {
        date: dateStr,
        mode: mode,
        dryRun: true,
        checks: checks,
        issues: check.issues,
        repairs: preview.plannedOperations,
        criticalCount: (check.issues || []).filter(function (item) { return item.severity === 'CRITICAL'; }).length,
        repairableCount: (check.issues || []).filter(function (item) { return item.repairable; }).length,
        canRepairAutomatically: true,
        affectedSheets: [CONFIG.SEND_PANEL_SHEET, getBotMonthSheetName_()],
        appliedChangesCount: 0,
        skippedChangesCount: preview.selectedCount,
        partial: false,
        warnings: [],
        summary: {
          checked: checks.map(function (item) { return item.name; }),
          issues: check.summary.issueCount,
          previewedRepairs: preview.selectedCount
        },
        message: preview.selectedCount
          ? `Preview repair: заплановано ${preview.selectedCount} safe repair`
          : 'Preview repair: проблем для safe repair не знайдено'
      };
    }

    if (mode === 'repairSelectedIssues' || mode === 'repair') {
      const repaired = opts.dryRun === true ? repairSelectedIssues(opts) : repairWithVerification(opts);
      return {
        date: dateStr,
        mode: mode,
        dryRun: !!repaired.dryRun,
        checks: checks,
        issues: check.issues,
        repairs: repaired.repairs,
        criticalCount: (check.issues || []).filter(function (item) { return item.severity === 'CRITICAL'; }).length,
        repairableCount: (check.issues || []).filter(function (item) { return item.repairable; }).length,
        canRepairAutomatically: true,
        affectedSheets: repaired.affectedSheets,
        appliedChangesCount: repaired.appliedChangesCount,
        skippedChangesCount: repaired.skippedChangesCount,
        partial: false,
        warnings: repaired.warnings || [],
        operationId: repaired.operationId,
        postCheck: repaired.postCheck || null,
        summary: {
          checked: checks.map(function (item) { return item.name; }),
          issues: check.summary.issueCount,
          repairs: (repaired.repairs || []).length,
          remainingIssues: repaired.postCheck ? repaired.postCheck.remainingIssues : undefined
        },
        message: repaired.dryRun
          ? `Dry-run repair: ${(repaired.repairs || []).length}`
          : (repaired.postCheck ? `Repair виконано: ${(repaired.repairs || []).length}. Залишилось проблем: ${repaired.postCheck.remainingIssues}` : `Repair виконано: ${(repaired.repairs || []).length}`)
      };
    }

    if (mode === 'repairWithVerification') {
      const repaired = repairWithVerification(opts);
      return {
        date: dateStr,
        mode: mode,
        dryRun: !!repaired.dryRun,
        checks: checks,
        issues: check.issues,
        repairs: repaired.repairs,
        postCheck: repaired.postCheck,
        criticalCount: (check.issues || []).filter(function (item) { return item.severity === 'CRITICAL'; }).length,
        repairableCount: (check.issues || []).filter(function (item) { return item.repairable; }).length,
        canRepairAutomatically: true,
        affectedSheets: repaired.affectedSheets,
        appliedChangesCount: repaired.appliedChangesCount,
        skippedChangesCount: repaired.skippedChangesCount,
        partial: false,
        warnings: repaired.warnings || [],
        operationId: repaired.operationId,
        summary: {
          checked: checks.map(function (item) { return item.name; }),
          issues: check.summary.issueCount,
          repairs: (repaired.repairs || []).length,
          remainingIssues: repaired.postCheck.remainingIssues
        },
        message: repaired.dryRun
          ? `Dry-run repair+verify: ${(repaired.repairs || []).length}`
          : `Repair+verify завершено. Залишилось проблем: ${repaired.postCheck.remainingIssues}`
      };
    }

    return {
      date: dateStr,
      mode: mode,
      dryRun: !!opts.dryRun,
      checks: checks,
      issues: check.issues,
      criticalCount: (check.issues || []).filter(function (item) { return item.severity === 'CRITICAL'; }).length,
      repairableCount: (check.issues || []).filter(function (item) { return item.repairable; }).length,
      canRepairAutomatically: (check.issues || []).some(function (item) { return item.repairable; }),
      repairs: [],
      affectedSheets: [CONFIG.SEND_PANEL_SHEET, getBotMonthSheetName_()],
      appliedChangesCount: 0,
      skippedChangesCount: 0,
      partial: false,
      warnings: [],
      summary: {
        checked: checks.map(function (item) { return item.name; }),
        issues: check.summary.issueCount,
        critical: (check.issues || []).filter(function (item) { return item.severity === 'CRITICAL'; }).length,
        repairable: (check.issues || []).filter(function (item) { return item.repairable; }).length
      },
      message: (check.issues || []).length
        ? `Reconciliation завершено: проблем ${(check.issues || []).length}`
        : 'Reconciliation OK: проблем не знайдено'
    };
  }

  return {
    compareRows: compareRows,
    compareMonthlyToSendPanel: compareMonthlyToSendPanel,
    previewRepairPlan: previewRepairPlan,
    previewRepair: previewRepair,
    verifyRepairResult: verifyRepairResult,
    repairSelectedIssues: repairSelectedIssues,
    repairWithVerification: repairWithVerification,
    run: run
  };
})();