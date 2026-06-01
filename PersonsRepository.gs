/**
 * PersonsRepository.gs — доступ до бойців: графік з місячних листів + персональні дані з PERSONNEL.
 */

var PersonsRepository_ = PersonsRepository_ || (function () {
  function normalizeDateStr(dateStr) {
    const safe = String(dateStr || "").trim();
    return assertUaDateString_(safe);
  }

  function getSheetByDate(dateStr) {
    const safeDate = normalizeDateStr(dateStr);
    const d = DateUtils_.parseUaDate(safeDate);
    const ss = getWasbSpreadsheet_();
    if (d) {
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const sh = ss.getSheetByName(mm);
      if (sh) return sh;
    }
    return getBotSheet_();
  }

  function getPrevMonthSheetByDate(dateStr) {
    const safeDate = normalizeDateStr(dateStr);
    const d = DateUtils_.parseUaDate(safeDate);
    if (!d) return null;
    const ss = getWasbSpreadsheet_();
    const prev = new Date(d);
    prev.setMonth(prev.getMonth() - 1);
    const mm = String(prev.getMonth() + 1).padStart(2, "0");
    return ss.getSheetByName(mm);
  }

  function getDateContext(dateStr, explicitSheet) {
    const safeDate = normalizeDateStr(dateStr);
    const sheet = explicitSheet || getSheetByDate(safeDate);
    const col = findTodayColumn_(sheet, safeDate);
    if (col === -1) {
      throw buildContextError_("PersonsRepository_.getDateContext", {
        sheet: sheet ? sheet.getName() : "",
        date: safeDate,
      }, `Дата ${safeDate} не знайдена у шапці листа`);
    }
    return {
      sheet: sheet,
      dateStr: safeDate,
      col: col,
    };
  }

  function _isMonthlyPersonRow_(callsign, codeOnDate) {
    return !!String(callsign || "").trim();
  }

  function _resolvePersonnel_(callsign, fml, id) {
    if (typeof resolvePersonnelForLookup_ !== "function") return null;
    try {
      return resolvePersonnelForLookup_(callsign, fml, id);
    } catch (e) {
      return null;
    }
  }

  function _mergeMonthlyWithPersonnel_(monthlyPartial, personnel) {
    var base = Object.assign({}, monthlyPartial || {});
    if (!personnel) return base;
    if (typeof mergePersonnelIntoPersonView_ === "function") {
      return mergePersonnelIntoPersonView_(base, personnel);
    }
    return base;
  }

  /**
   * Рядки місячного листа: позивний + БР + координати рядка; персональні поля з PERSONNEL.
   */
  function getMonthlyRows(sheet) {
    const sh = sheet || getBotSheet_();
    const schema = SheetSchemas_.get("MONTHLY");
    const matrix = schema.matrix;
    const rowCount = matrix.endRow - matrix.startRow + 1;
    const width = Math.max(schema.columns.callsign, schema.columns.brDays);

    const values = sh
      .getRange(matrix.startRow, 1, rowCount, width)
      .getDisplayValues();

    return values
      .map(function (row, idx) {
        const callsign = String(
          row[schema.columns.callsign - 1] || "",
        ).trim();
        const brDays = String(row[schema.columns.brDays - 1] || "").trim();

        if (!_isMonthlyPersonRow_(callsign, "")) {
          return null;
        }

        const personnel = _resolvePersonnel_(callsign, "", "");
        const merged = _mergeMonthlyWithPersonnel_(
          {
            callsign: callsign,
            brDays: brDays || "0",
            phone: "",
            position: "",
            oshs: "",
            rank: "",
            fml: "",
            id: "",
          },
          personnel,
        );

        return Object.assign(merged, {
          _meta: {
            rowNumber: matrix.startRow + idx,
            sheetName: sh.getName(),
          },
        });
      })
      .filter(Boolean);
  }

  function findRowByCallsign(callsign, sheet) {
    const key = _normCallsignKey_(callsign);
    return (
      getMonthlyRows(sheet).find(function (item) {
        return _normCallsignKey_(item.callsign) === key;
      }) || null
    );
  }

  function findRowByFml(fml, sheet) {
    const personnel = _resolvePersonnel_("", fml, "");
    if (personnel && personnel.callsign) {
      return findRowByCallsign(personnel.callsign, sheet);
    }
    const key = _normFml_(fml);
    return (
      getMonthlyRows(sheet).find(function (item) {
        return _normFml_(item.fml) === key;
      }) || null
    );
  }

  function getPayloadByRow(rowNumber, dateStr, sheet) {
    const ctx = getDateContext(dateStr, sheet);
    const payload = buildPayloadForCell_(
      ctx.sheet,
      Number(rowNumber),
      Number(ctx.col),
      DictionaryRepository_.getPhonesIndex(),
      DictionaryRepository_.getDictMap(),
    );

    const personnel = _resolvePersonnel_(
      payload.callsign,
      payload.fml,
      payload.id,
    );
    if (personnel && typeof mergePersonnelIntoPersonView_ === "function") {
      return mergePersonnelIntoPersonView_(payload, personnel);
    }
    return payload;
  }

  function getPersonByCallsign(callsign, dateStr) {
    const safeDate = normalizeDateStr(dateStr);
    const sheet = getSheetByDate(safeDate);
    const item = findRowByCallsign(callsign, sheet);
    if (!item) {
      throw new Error(`Позивний "${callsign}" не знайдено на місячному графіку`);
    }

    const personnel =
      _resolvePersonnel_(item.callsign, item.fml, item.id) ||
      (function () {
        try {
          return getPersonnelByCallsign_(callsign);
        } catch (e) {
          return null;
        }
      })();

    if (!personnel && typeof isPersonnelSheetAvailable_ === "function") {
      if (isPersonnelSheetAvailable_()) {
        throw new Error(
          `Позивний "${callsign}" не знайдено в аркуші PERSONNEL`,
        );
      }
    }

    const payload = getPayloadByRow(item._meta.rowNumber, safeDate, sheet);
    const merged = _mergeMonthlyWithPersonnel_(item, personnel);

    const phone =
      merged.phone ||
      payload.phone ||
      DictionaryRepository_.getPhoneByCallsign(merged.callsign) ||
      DictionaryRepository_.getPhoneByFml(merged.fml) ||
      "";

    const prevSheet = getPrevMonthSheetByDate(safeDate);
    const prevRow = prevSheet
      ? findRowByCallsign(merged.callsign, prevSheet)
      : null;

    const fmlForVacation = merged.fml || payload.fml || "";

    return {
      id: merged.id || "",
      callsign: merged.callsign || item.callsign,
      fml: merged.fml || payload.fml || "",
      rank: merged.rank || merged.title || "",
      position: merged.position || "",
      oshs: merged.oshs || "",
      unit: merged.unit || "",
      phone: phone,
      phone2: merged.phone2 || "",
      birthday: merged.birthday || "",
      brDaysThisMonth: item.brDays || "0",
      brDaysPrevMonth: prevRow ? prevRow.brDays || "0" : "0",
      todayGroup: getPersonGroupForDate_(
        sheet,
        item._meta.rowNumber,
        safeDate,
      ),
      dateStr: safeDate,
      sheet: sheet.getName(),
      row: item._meta.rowNumber,
      col: payload.col,
      message: payload.message || "",
      waLink: payload.link || "",
      nextVacation: VacationsRepository_.getNextForFml(
        fmlForVacation,
        safeDate,
      ),
      vac: VacationsRepository_.getCurrentForFml(fmlForVacation, safeDate),
      phoneDisplay: _formatPhoneDisplay_(phone),
    };
  }

  function getSidebarPersonnel(dateStr) {
    const ctx = getDateContext(dateStr);
    const ref = ctx.sheet.getRange(CONFIG.CODE_RANGE_A1);
    const startRow = ref.getRow();
    const numRows = ref.getNumRows();
    const codes = ctx.sheet
      .getRange(startRow, ctx.col, numRows, 1)
      .getDisplayValues();
    const callsignCol = Number(CONFIG.CALLSIGN_COL) || 2;
    const callsigns = ctx.sheet
      .getRange(startRow, callsignCol, numRows, 1)
      .getDisplayValues();

    const personnel = [];
    for (let i = 0; i < numRows; i++) {
      const code = String(codes[i][0] || "").trim();
      const rowCallsign = String(callsigns[i][0] || "").trim();
      if (!code || !rowCallsign) continue;

      try {
        const payload = getPayloadByRow(
          startRow + i,
          ctx.dateStr,
          ctx.sheet,
        );
        personnel.push({
          fml: payload.fml,
          phone: payload.phone,
          code: payload.code,
          service: payload.service,
          place: payload.place,
          tasks: payload.tasks,
          message: payload.message,
          link: payload.link,
          date: payload.reportDateStr,
          row: startRow + i,
          col: ctx.col,
          callsign: payload.callsign || rowCallsign,
          status: "ready",
        });
      } catch (e) {
        const personnelRow = _resolvePersonnel_(rowCallsign, "", "");
        personnel.push({
          fml: personnelRow ? personnelRow.fml : "",
          phone: "—",
          code: code,
          service: "—",
          place: "—",
          tasks: "—",
          message: "",
          link: "",
          date: ctx.dateStr,
          row: startRow + i,
          col: ctx.col,
          callsign: rowCallsign,
          status: "error",
          error: e && e.message ? e.message : String(e),
        });
      }
    }

    return {
      month: ctx.sheet.getName(),
      date: ctx.dateStr,
      personnel: personnel,
    };
  }

  function getAnyCallsign(sheet) {
    const rows = getMonthlyRows(sheet || getBotSheet_());
    const first = rows.find(function (item) {
      return !!String(item.callsign || "").trim();
    });
    return first ? first.callsign : "";
  }

  function getAvailableDates(sheet) {
    const sh = sheet || getBotSheet_();
    const matrix = SheetSchemas_.get("MONTHLY").matrix;
    const width = matrix.endCol - matrix.startCol + 1;
    const values = sh
      .getRange(Number(CONFIG.DATE_ROW) || 1, matrix.startCol, 1, width)
      .getDisplayValues()[0];
    const dates = [];
    const seen = Object.create(null);

    values.forEach(function (value) {
      const raw = String(value || "").trim();
      if (!raw) return;
      try {
        const normalized = DateUtils_.normalizeDate(raw, raw);
        if (/^\d{2}\.\d{2}\.\d{4}$/.test(normalized) && !seen[normalized]) {
          seen[normalized] = true;
          dates.push(normalized);
        }
      } catch (_) {}
    });

    return dates;
  }

  return {
    normalizeDateStr: normalizeDateStr,
    getSheetByDate: getSheetByDate,
    getPrevMonthSheetByDate: getPrevMonthSheetByDate,
    getDateContext: getDateContext,
    getMonthlyRows: getMonthlyRows,
    findRowByCallsign: findRowByCallsign,
    findRowByFml: findRowByFml,
    getPayloadByRow: getPayloadByRow,
    getPersonByCallsign: getPersonByCallsign,
    getSidebarPersonnel: getSidebarPersonnel,
    getAnyCallsign: getAnyCallsign,
    getAvailableDates: getAvailableDates,
  };
})();
