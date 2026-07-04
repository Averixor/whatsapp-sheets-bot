/**
 * PersonsRepository.gs — доступ до бойців: графік з місячних листів + персональні дані з PERSONNEL.
 */

var PersonsRepository_ =
  PersonsRepository_ ||
  (function () {
    const monthlyRowLookupCache = {};

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
        throw buildContextError_(
          "PersonsRepository_.getDateContext",
          {
            sheet: sheet ? sheet.getName() : "",
            date: safeDate,
          },
          `Дата ${safeDate} не знайдена у шапці листа`,
        );
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
      const schema = SheetSchemas_.get(sh.getName());
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

    function getMonthlyRowLookup_(sheet) {
      const sh = sheet || getBotSheet_();
      const cacheKey = String(sh.getName() || "").trim();
      if (monthlyRowLookupCache[cacheKey]) {
        return monthlyRowLookupCache[cacheKey];
      }

      const schema = SheetSchemas_.get(sh.getName());
      const matrix = schema.matrix;
      const rowCount = matrix.endRow - matrix.startRow + 1;
      const callsignCol = Number(schema.columns.callsign || 0);
      if (callsignCol < 1) {
        monthlyRowLookupCache[cacheKey] = { byCallsign: {} };
        return monthlyRowLookupCache[cacheKey];
      }
      const brCol = Number(schema.columns.brDays || 0);
      const firstCol =
        callsignCol && brCol
          ? Math.min(callsignCol, brCol)
          : Math.max(callsignCol, brCol, 1);
      const lastCol =
        callsignCol && brCol
          ? Math.max(callsignCol, brCol)
          : Math.max(callsignCol, brCol, 1);
      const width = Math.max(lastCol - firstCol + 1, 1);
      const values = sh
        .getRange(matrix.startRow, firstCol, rowCount, width)
        .getDisplayValues();
      const byCallsign = {};

      values.forEach(function (row, idx) {
        const callsign = String(row[callsignCol - firstCol] || "").trim();
        if (!callsign) return;
        const key = _normCallsignKey_(callsign);
        if (!key || byCallsign[key]) return;
        byCallsign[key] = {
          rowNumber: matrix.startRow + idx,
          callsign: callsign,
          brDays:
            brCol > 0
              ? String(row[brCol - firstCol] || "").trim() || "0"
              : "0",
        };
      });

      monthlyRowLookupCache[cacheKey] = {
        byCallsign: byCallsign,
      };
      return monthlyRowLookupCache[cacheKey];
    }

    function findMonthlyRowMetaByCallsign_(callsign, sheet) {
      const key = _normCallsignKey_(callsign);
      if (!key) return null;
      const lookup = getMonthlyRowLookup_(sheet);
      return (lookup && lookup.byCallsign && lookup.byCallsign[key]) || null;
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

    function getPayloadByRow(rowNumber, dateStr, sheet, phonesIndexArg, dictMapArg) {
      const ctx = getDateContext(dateStr, sheet);
      const payload = buildPayloadForCell_(
        ctx.sheet,
        Number(rowNumber),
        Number(ctx.col),
        phonesIndexArg || DictionaryRepository_.getPhonesIndex(),
        dictMapArg || DictionaryRepository_.getDictMap(),
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
      const rowMeta = findMonthlyRowMetaByCallsign_(callsign, sheet);
      if (!rowMeta) {
        throw new Error(
          `Позивний "${callsign}" не знайдено на місячному графіку`,
        );
      }

      const phonesIndex = DictionaryRepository_.getPhonesIndex();
      const dictMap = DictionaryRepository_.getDictMap();
      const payload = getPayloadByRow(
        rowMeta.rowNumber,
        safeDate,
        sheet,
        phonesIndex,
        dictMap,
      );
      const personnel =
        _resolvePersonnel_(payload.callsign || rowMeta.callsign, payload.fml, payload.id) ||
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
            `Позивний "${callsign}" не знайдено в особовому складі`,
          );
        }
      }

      const merged = _mergeMonthlyWithPersonnel_(
        {
          callsign: rowMeta.callsign,
          brDays: rowMeta.brDays || "0",
          phone: "",
          position: "",
          oshs: "",
          rank: "",
          fml: payload.fml || "",
          id: payload.id || "",
        },
        personnel,
      );

      const phone =
        merged.phone ||
        payload.phone ||
        (typeof findPhone_ === "function"
          ? findPhone_(
              { callsign: merged.callsign, fml: merged.fml },
              { index: phonesIndex },
            )
          : "") ||
        "";

      const prevSheet = getPrevMonthSheetByDate(safeDate);
      const prevRow = prevSheet
        ? findMonthlyRowMetaByCallsign_(merged.callsign, prevSheet)
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
        brDaysThisMonth: rowMeta.brDays || "0",
        brDaysPrevMonth: prevRow ? prevRow.brDays || "0" : "0",
        todayGroup: getPersonGroupForDate_(
          sheet,
          rowMeta.rowNumber,
          safeDate,
        ),
        dateStr: safeDate,
        sheet: sheet.getName(),
        row: rowMeta.rowNumber,
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
      const ref = ctx.sheet.getRange(getMonthlyCodeRangeA1ForSheet_(ctx.sheet));
      const startRow = ref.getRow();
      const numRows = ref.getNumRows();
      const codes = ctx.sheet
        .getRange(startRow, ctx.col, numRows, 1)
        .getDisplayValues();
      const callsignCol = getMonthlyCallsignColForSheet_(ctx.sheet);
      const callsigns = ctx.sheet
        .getRange(startRow, callsignCol, numRows, 1)
        .getDisplayValues();

      const personnel = [];
      for (let i = 0; i < numRows; i++) {
        const code = String(codes[i][0] || "").trim();
        const rowCallsign = String(callsigns[i][0] || "").trim();
        if (!code || !rowCallsign) continue;

        try {
          const payload = getPayloadByRow(startRow + i, ctx.dateStr, ctx.sheet);
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
      const matrix = SheetSchemas_.get(sh.getName()).matrix;
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
