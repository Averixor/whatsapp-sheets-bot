function checkDuplicates() {
  const report = _makeReport_('🧬 ПЕРЕВІРКА ДУБЛІКАТІВ');

  try {
    const ss = _getSS_();
    const sh = ss.getSheetByName(CONFIG.PHONES_SHEET || 'PHONES');

    if (!sh || sh.getLastRow() < 2) {
      _pushCheck_(report, {
        type: 'duplicates_skip',
        name: 'PHONES',
        status: 'WARN',
        message: '⚠ Лист PHONES не знайдено або порожній'
      });
      DIAGNOSTICS.results.duplicates = report;
      return report;
    }

    const values = sh.getDataRange().getValues();
    const header = values[0].map(function (v) {
      return String(v || '').trim().toLowerCase();
    });
    const data = values.slice(1);

    function findCol(predicates) {
      return header.findIndex(function (h) {
        return predicates.some(function (p) {
          return h.indexOf(p) !== -1;
        });
      });
    }

    const fioCol = findCol(['піб', 'фіо', 'фио']);
    const callsignCol = findCol(['позив', 'callsign', 'роль']);
    const phoneCol = findCol(['тел', 'phone']);

    const counters = {
      fio: {},
      callsign: {},
      phone: {}
    };

    data.forEach(function (row, idx) {
      const r = idx + 2;

      if (fioCol >= 0) {
        const fio = String(row[fioCol] || '').trim().toUpperCase();
        if (fio) {
          if (!counters.fio[fio]) counters.fio[fio] = [];
          counters.fio[fio].push(r);
        }
      }

      if (callsignCol >= 0) {
        const cs = String(row[callsignCol] || '').trim().toUpperCase();
        if (cs) {
          if (!counters.callsign[cs]) counters.callsign[cs] = [];
          counters.callsign[cs].push(r);
        }
      }

      if (phoneCol >= 0) {
        const phone = String(row[phoneCol] || '').replace(/[^\d+]/g, '').trim();
        if (phone) {
          if (!counters.phone[phone]) counters.phone[phone] = [];
          counters.phone[phone].push(r);
        }
      }
    });

    const dups = [];

    Object.entries(counters.fio).forEach(function (entry) {
      const value = entry[0];
      const rows = entry[1];
      if (rows.length > 1) {
        dups.push('ПІБ "' + value + '" → ' + rows.join(', '));
      }
    });

    Object.entries(counters.callsign).forEach(function (entry) {
      const value = entry[0];
      const rows = entry[1];
      if (rows.length > 1) {
        dups.push('Позивний "' + value + '" → ' + rows.join(', '));
      }
    });

    Object.entries(counters.phone).forEach(function (entry) {
      const value = entry[0];
      const rows = entry[1];
      if (rows.length > 1) {
        dups.push('Телефон "' + value + '" → ' + rows.join(', '));
      }
    });

    if (!dups.length) {
      _pushCheck_(report, {
        type: 'duplicates_result',
        name: 'duplicates',
        status: 'OK',
        message: '✓ Явних дублікатів не знайдено'
      });
    } else {
      dups.forEach(function (message) {
        _pushCheck_(report, {
          type: 'duplicate',
          name: 'duplicate',
          status: 'WARN',
          message: '⚠ ' + message
        });
      });
    }

  } catch (e) {
    report.status = 'ERROR';
    report.errors.push('Помилка checkDuplicates: ' + _safeErr_(e));
  }

  DIAGNOSTICS.results.duplicates = report;
  return report;
}
