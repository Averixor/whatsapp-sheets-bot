/**
 * DictionaryRepository.gs — доступ до словників, телефонів і профілів.
 */

const DictionaryRepository_ = (function() {
  function getPhonesIndex() {
    return typeof loadPhonesIndex_ === 'function'
      ? loadPhonesIndex_()
      : { byFml: {}, byNorm: {}, byRole: {}, byCallsign: {}, items: [] };
  }

  function getPhonesMap() {
    return loadPhonesMap_();
  }

  function getProfiles() {
    return loadPhonesProfiles_();
  }

  function getDictMap() {
    return loadDictMap_();
  }

  function getSummaryRules() {
    return readDictSum_();
  }

  function getPhoneByRole(role) {
    return findPhone_({ role: role });
  }

  function getPhoneByFml(fml) {
    return findPhone_({ fml: fml });
  }

  function getPhoneByCallsign(callsign) {
    return findPhone_({ callsign: callsign });
  }

  function getProfileByCallsign(callsign) {
    const profiles = getProfiles();
    const key = _normCallsignKey_(callsign);
    return (profiles && profiles.byCallsign && profiles.byCallsign[key]) || null;
  }

  function getProfileByFml(fml) {
    const profiles = getProfiles();
    const key = _normFmlForProfiles_(fml);
    return (profiles && profiles.byFml && profiles.byFml[key]) || null;
  }

  function getDictEntry(code) {
    const dict = getDictMap();
    return dict[String(code || '').trim()] || null;
  }

  return {
    getPhonesIndex: getPhonesIndex,
    getPhonesMap: getPhonesMap,
    getProfiles: getProfiles,
    getDictMap: getDictMap,
    getSummaryRules: getSummaryRules,
    getPhoneByRole: getPhoneByRole,
    getPhoneByFml: getPhoneByFml,
    getPhoneByCallsign: getPhoneByCallsign,
    getProfileByCallsign: getProfileByCallsign,
    getProfileByFml: getProfileByFml,
    getDictEntry: getDictEntry
  };
})();

const ReferenceSheetsRepository_ = (function () {
  function getSheetName_(configKey, fallback) {
    if (
      typeof CONFIG !== "undefined" &&
      CONFIG &&
      CONFIG[configKey]
    ) {
      return String(CONFIG[configKey]).trim() || fallback;
    }
    return fallback;
  }

  function getSheet_(configKey, fallback) {
    const ss = getWasbSpreadsheet_();
    const name = getSheetName_(configKey, fallback);
    return { ss: ss, name: name, sheet: ss.getSheetByName(name) };
  }

  function clean_(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/\s+/g, " ")
      .trim();
  }

  function isDash_(value) {
    return /^[\-–—－]+$/.test(clean_(value));
  }

  function looksLikePhone_(value) {
    const text = clean_(value);
    if (!text) return false;
    if (typeof normalizePhone_ === "function" && normalizePhone_(text)) {
      return true;
    }
    return /^\+?\d[\d\s().-]{6,}$/.test(text);
  }

  function normalizeDirectoryPhone_(value) {
    const text = clean_(value);
    if (!text) return "";
    if (typeof normalizePhone_ === "function") {
      const normalized = normalizePhone_(text);
      if (normalized) return normalized;
    }
    const digits = text.replace(/\D/g, "");
    return digits ? "+" + digits : text;
  }

  function phoneDigits_(phone) {
    return String(phone || "").replace(/\D/g, "");
  }

  function buildWaLink_(phone) {
    if (typeof buildWhatsAppWebLink_ === "function") {
      return buildWhatsAppWebLink_(phone, "");
    }
    const digits = phoneDigits_(phone);
    return digits ? "https://web.whatsapp.com/send?phone=" + digits : "";
  }

  function groupItems_(items) {
    const order = [];
    const byName = {};
    (items || []).forEach(function (item) {
      const section = clean_(item.section) || "Інше";
      if (!byName[section]) {
        byName[section] = { name: section, count: 0, items: [] };
        order.push(section);
      }
      byName[section].count += 1;
      byName[section].items.push(item);
    });
    return order.map(function (name) {
      return byName[name];
    });
  }

  function isPhoneDirectoryHeader_(first, second) {
    const a = clean_(first).toLowerCase();
    const b = clean_(second).toLowerCase();
    return (
      (a === "phone / section" || a === "phone" || a === "телефон / розділ") &&
      (b === "name / note" || b === "name" || b === "назва / примітка")
    );
  }

  function readPhoneDirectory() {
    const resolved = getSheet_("PHONE_DIRECTORY_SHEET", "PHONE_DIRECTORY");
    const sheet = resolved.sheet;
    const out = {
      sheet: resolved.name,
      exists: !!sheet,
      items: [],
      sections: [],
      stats: { contacts: 0, sections: 0 },
      warnings: [],
    };

    if (!sheet || sheet.getLastRow() < 1) {
      out.warnings.push("Аркуш службових телефонів не знайдено або він порожній");
      return out;
    }

    const values = sheet
      .getRange(1, 1, sheet.getLastRow(), Math.max(sheet.getLastColumn(), 2))
      .getDisplayValues();
    let section = "Інше";

    values.forEach(function (row, idx) {
      const first = clean_(row[0]);
      const second = clean_(row[1]);
      if (idx === 0 && isPhoneDirectoryHeader_(first, second)) return;
      if (!first && !second) return;

      if (first && !second && !looksLikePhone_(first)) {
        section = first;
        return;
      }

      const rawPhone = looksLikePhone_(first)
        ? first
        : looksLikePhone_(second)
          ? second
          : "";
      const name = looksLikePhone_(first) ? second : first || second;
      const phone = normalizeDirectoryPhone_(rawPhone);

      if (!phone && !name) return;

      const item = {
        rowNumber: idx + 1,
        section: section,
        name: name,
        phone: phone,
        phoneDisplay: rawPhone || phone,
        link: phone ? buildWaLink_(phone) : "",
        searchText: [section, name, rawPhone, phone]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      };
      out.items.push(item);
    });

    out.sections = groupItems_(out.items);
    out.stats = {
      contacts: out.items.length,
      sections: out.sections.length,
    };
    return out;
  }

  function parseCost_(value) {
    const text = clean_(value).replace(/\s/g, "");
    if (!text) return 0;
    const normalized = text.replace(/[^\d,.-]/g, "").replace(",", ".");
    const num = Number(normalized);
    return isFinite(num) && !isNaN(num) ? num : 0;
  }

  function formatMoney_(value) {
    const num = Number(value) || 0;
    const rounded = Math.round(num * 100) / 100;
    const parts = rounded.toFixed(2).split(".");
    const whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return whole + "," + parts[1];
  }

  function normalizeYear_(value) {
    const text = clean_(value);
    if (!text) return "";
    const match = text.match(/\b(19\d{2}|20\d{2})\b/);
    return match ? match[1] : text.replace(/\.0$/, "");
  }

  function detectAssetType_(assetName) {
    const text = clean_(assetName).toLowerCase();
    if (!text) return "Інше";
    if (text.indexOf("мото") !== -1) return "Мотоцикли";
    if (text.indexOf("вантаж") !== -1) return "Вантажні";
    if (text.indexOf("автофургон") !== -1) return "Автофургони";
    if (text.indexOf("легков") !== -1) return "Легкові";
    return "Інше";
  }

  const CAR_STATUS_ORDER_ = [
    "Справна",
    "Обмежено БГ",
    "Не БГ (ремонт)",
    "Не БГ (дефіцит)",
    "Втрачена",
  ];

  const CAR_STATUS_DESCRIPTIONS_ = {
    Справна: "Справна.",
    "Обмежено БГ": "Потрібен ремонт.",
    "Не БГ (ремонт)": "На ремонті.",
    "Не БГ (дефіцит)": "Стоїть, без запчастин.",
    Втрачена: "Втрачена.",
  };

  function normalizeCarStatus_(value) {
    let text = clean_(value);
    if (!text) return "";
    text = text.replace(/\s+/g, " ").trim();
    text = text.replace(/[.。]+$/g, "").trim();
    if (text.indexOf("—") !== -1) text = text.split("—")[0].trim();
    if (text.indexOf(" - ") !== -1) text = text.split(" - ")[0].trim();
    text = text.replace(/[.。]+$/g, "").trim();
    if (/^Справна\s*\(БГ\)$/i.test(text)) return "Справна";

    const lower = text.toLowerCase();
    for (let i = 0; i < CAR_STATUS_ORDER_.length; i += 1) {
      if (CAR_STATUS_ORDER_[i].toLowerCase() === lower) return CAR_STATUS_ORDER_[i];
    }
    return text;
  }

  function getCarStatusDescription_(status) {
    return CAR_STATUS_DESCRIPTIONS_[status] || "";
  }

  function buildNamedStats_(items, fieldName, fallback, order) {
    const map = {};
    (items || []).forEach(function (item) {
      const name = item[fieldName] || fallback;
      map[name] = (map[name] || 0) + 1;
    });

    const ordered = [];
    (order || []).forEach(function (name) {
      if (map[name]) {
        ordered.push({ name: name, count: map[name] });
        delete map[name];
      }
    });

    return ordered.concat(
      Object.keys(map)
        .sort(function (a, b) {
          return a.localeCompare(b, "uk");
        })
        .map(function (name) {
          return { name: name, count: map[name] };
        }),
    );
  }

  function buildTypeStats_(items) {
    return buildNamedStats_(items, "type", "Інше", []);
  }

  function buildStatusStats_(items) {
    return buildNamedStats_(items, "status", "Без стану", CAR_STATUS_ORDER_);
  }

  function readCarsRegister() {
    const resolved = getSheet_("CAR_SHEET", "CAR");
    const sheet = resolved.sheet;
    const out = {
      sheet: resolved.name,
      exists: !!sheet,
      items: [],
      stats: {
        total: 0,
        assigned: 0,
        unassigned: 0,
        totalCost: 0,
        totalCostDisplay: "0,00",
        minYear: "",
        maxYear: "",
        byType: [],
        byStatus: [],
      },
      warnings: [],
    };

    if (!sheet || sheet.getLastRow() < 2) {
      out.warnings.push("Аркуш автотехніки не знайдено або він порожній");
      return out;
    }

    const values = sheet
      .getRange(2, 1, sheet.getLastRow() - 1, Math.max(sheet.getLastColumn(), 7))
      .getDisplayValues();
    let totalCost = 0;
    let skippedMissingAssetName = 0;
    const years = [];

    values.forEach(function (row, idx) {
      const ownerRaw = clean_(row[0]);
      const assetName = clean_(row[1]);
      const militaryNumber = clean_(row[2]);
      const chassisNumber = clean_(row[3]);
      const year = normalizeYear_(row[4]);
      const costDisplay = clean_(row[5]);
      const statusRaw = clean_(row[6]);
      const status = normalizeCarStatus_(statusRaw);
      const statusDescription = getCarStatusDescription_(status);
      if (!ownerRaw && !assetName && !militaryNumber && !chassisNumber && !statusRaw) return;
      if (!assetName) {
        skippedMissingAssetName += 1;
        return;
      }

      const cost = parseCost_(costDisplay);
      totalCost += cost;
      const yearNum = Number(year);
      if (yearNum >= 1900 && yearNum <= 2100) years.push(yearNum);

      out.items.push({
        rowNumber: idx + 2,
        owner: isDash_(ownerRaw) ? "" : ownerRaw,
        ownerDisplay: ownerRaw,
        assigned: !!ownerRaw && !isDash_(ownerRaw),
        assetName: assetName,
        militaryNumber: militaryNumber,
        chassisNumber: chassisNumber,
        year: year,
        cost: cost,
        costDisplay: costDisplay,
        status: status,
        statusRaw: statusRaw,
        statusDescription: statusDescription,
        type: detectAssetType_(assetName),
        searchText: [
          ownerRaw,
          assetName,
          militaryNumber,
          chassisNumber,
          year,
          status,
          statusDescription,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      });
    });

    out.stats.total = out.items.length;
    out.stats.assigned = out.items.filter(function (item) {
      return item.assigned;
    }).length;
    out.stats.unassigned = out.stats.total - out.stats.assigned;
    out.stats.totalCost = totalCost;
    out.stats.totalCostDisplay = formatMoney_(totalCost);
    out.stats.minYear = years.length ? String(Math.min.apply(null, years)) : "";
    out.stats.maxYear = years.length ? String(Math.max.apply(null, years)) : "";
    out.stats.byType = buildTypeStats_(out.items);
    out.stats.byStatus = buildStatusStats_(out.items);
    if (skippedMissingAssetName > 0) {
      out.warnings.push(
        "Пропущено рядків без найменування майна: " + skippedMissingAssetName,
      );
    }
    return out;
  }

  return {
    readPhoneDirectory: readPhoneDirectory,
    readCarsRegister: readCarsRegister,
  };
})();

