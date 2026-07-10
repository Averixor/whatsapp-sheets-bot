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


  function normalizeFmlKey_(value) {
    if (typeof _normFml_ === "function") return _normFml_(value);
    return clean_(value).toLowerCase();
  }

  function normalizeCallsignKey_(value) {
    if (typeof _normCallsignKey_ === "function") return _normCallsignKey_(value);
    return clean_(value).toUpperCase();
  }

  function normalizePhoneKey_(value) {
    if (typeof normalizePhone_ === "function") return normalizePhone_(value) || "";
    const digits = clean_(value).replace(/\D/g, "");
    return digits ? "+" + digits : "";
  }

  function splitFmlFallback_(fml) {
    const parts = clean_(fml).split(" ").filter(Boolean);
    return {
      lastName: parts[0] || "",
      firstName: parts[1] || "",
      patronymic: parts.slice(2).join(" "),
    };
  }

  function personnelReferenceAvailable_() {
    return !!(
      (typeof PersonnelRepository_ === "object" && PersonnelRepository_) ||
      typeof resolvePersonnelForLookup_ === "function"
    );
  }

  function resolvePersonnelReference_(hints) {
    const safe = hints || {};
    const callsign = clean_(safe.callsign);
    const fml = clean_(safe.fml || safe.fullName || safe.personDisplay || safe.owner);
    const id = clean_(safe.id);
    const phoneKey = normalizePhoneKey_(safe.phone || safe.phone2 || "");

    try {
      if (typeof PersonnelRepository_ === "object" && PersonnelRepository_) {
        if (
          callsign &&
          typeof PersonnelRepository_.getByCallsignAnyStatus === "function"
        ) {
          const byCallsign = PersonnelRepository_.getByCallsignAnyStatus(callsign);
          if (byCallsign) return byCallsign;
        }
        if (fml && typeof PersonnelRepository_.getByFml === "function") {
          const byFml = PersonnelRepository_.getByFml(fml, { activeOnly: false });
          if (byFml) return byFml;
        }
        if (id && typeof PersonnelRepository_.getById === "function") {
          const byId = PersonnelRepository_.getById(id);
          if (byId) return byId;
        }
        if (phoneKey && typeof PersonnelRepository_.getRows === "function") {
          const rows = PersonnelRepository_.getRows() || [];
          for (let i = 0; i < rows.length; i += 1) {
            const row = rows[i] || {};
            if (
              normalizePhoneKey_(row.phone) === phoneKey ||
              normalizePhoneKey_(row.phone2) === phoneKey
            ) {
              return row;
            }
          }
        }
      }
    } catch (e) {}

    try {
      if (typeof resolvePersonnelForLookup_ === "function") {
        const found = resolvePersonnelForLookup_(callsign, fml, id);
        if (found) return found;
      }
    } catch (e2) {}

    return null;
  }

  function canonicalPersonFromPersonnel_(fallback, hints) {
    const raw = fallback || {};
    const personnel = resolvePersonnelReference_(hints || raw);
    const source = personnel || raw;
    const fallbackName =
      clean_(raw.fullName || raw.personDisplay || raw.fml || raw.owner) || "";
    const parts = splitFmlFallback_(source.fml || source.fullName || fallbackName);
    const lastName = clean_(source.lastName || source.LastName || parts.lastName);
    const firstName = clean_(source.firstName || source.FirstName || parts.firstName);
    const patronymic = clean_(
      source.patronymic || source.Patronymic || parts.patronymic,
    );
    const fullName =
      clean_(source.fml || source.FML) ||
      buildPersonDisplayName_(lastName, firstName, patronymic) ||
      fallbackName;
    const phone = clean_(source.phone || source.Phone || raw.phone || "");
    const normalizedPhone = normalizePhoneKey_(phone);

    return {
      found: !!personnel,
      id: clean_(source.id || source.ID || raw.id || ""),
      callsign: clean_(source.callsign || source.Callsign || raw.callsign || ""),
      lastName: lastName,
      firstName: firstName,
      patronymic: patronymic,
      fullName: fullName,
      personDisplay: fullName,
      rank: clean_(source.rank || source.title || source.Title || raw.rank || ""),
      phone: normalizedPhone || phone,
      phoneDisplay: phone || normalizedPhone,
      status: clean_(source.status || source.Status || ""),
      sheetRow: source.sheetRow || raw.sheetRow || 0,
    };
  }

  function personMatchesItem_(person, item) {
    const safePerson = person || {};
    const safeItem = item || {};
    const personCallsign = normalizeCallsignKey_(safePerson.callsign);
    const itemCallsign = normalizeCallsignKey_(
      safeItem.ownerCallsign || safeItem.callsign || "",
    );
    if (personCallsign && itemCallsign && personCallsign === itemCallsign) return true;

    const personFml = normalizeFmlKey_(safePerson.fml || safePerson.personDisplay || "");
    const itemFml = normalizeFmlKey_(
      safeItem.owner || safeItem.ownerDisplay || safeItem.personDisplay || "",
    );
    if (personFml && itemFml && personFml === itemFml) return true;

    const personPhone = normalizePhoneKey_(safePerson.phone || safePerson.phone2 || "");
    const itemPhone = normalizePhoneKey_(safeItem.ownerPhone || safeItem.phone || "");
    return !!(personPhone && itemPhone && personPhone === itemPhone);
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
      .getRange(2, 1, sheet.getLastRow() - 1, Math.max(sheet.getLastColumn(), 8))
      .getDisplayValues();
    let totalCost = 0;
    let skippedMissingAssetName = 0;
    let unresolvedOwners = 0;
    const years = [];

    values.forEach(function (row, idx) {
      const ownerRaw = clean_(row[0]);
      const assetName = clean_(row[1]);
      const militaryNumber = clean_(row[2]);
      const chassisNumber = clean_(row[3]);
      const year = normalizeYear_(row[4]);
      const costDisplay = clean_(row[5]);
      const statusRaw = clean_(row[6]);
      const ownerCallsignRaw = clean_(row[7]);
      const status = normalizeCarStatus_(statusRaw);
      const statusDescription = getCarStatusDescription_(status);
      if (!ownerRaw && !assetName && !militaryNumber && !chassisNumber && !statusRaw) return;
      if (!assetName) {
        skippedMissingAssetName += 1;
        return;
      }

      const ownerPerson = canonicalPersonFromPersonnel_(
        { fullName: isDash_(ownerRaw) ? "" : ownerRaw, callsign: ownerCallsignRaw },
        { callsign: ownerCallsignRaw, fml: isDash_(ownerRaw) ? "" : ownerRaw },
      );
      const owner = ownerPerson.fullName || (isDash_(ownerRaw) ? "" : ownerRaw);
      if (
        personnelReferenceAvailable_() &&
        ownerRaw &&
        !isDash_(ownerRaw) &&
        !ownerPerson.found
      ) {
        unresolvedOwners += 1;
      }

      const cost = parseCost_(costDisplay);
      totalCost += cost;
      const yearNum = Number(year);
      if (yearNum >= 1900 && yearNum <= 2100) years.push(yearNum);

      out.items.push({
        rowNumber: idx + 2,
        owner: owner,
        ownerDisplay: owner || ownerRaw,
        ownerRaw: ownerRaw,
        ownerCanonical: ownerPerson.found,
        ownerCallsign: ownerPerson.callsign || ownerCallsignRaw,
        ownerRank: ownerPerson.rank,
        ownerPhone: ownerPerson.phone,
        assigned: !!owner && !isDash_(owner),
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
          owner,
          ownerPerson.callsign,
          ownerPerson.rank,
          ownerPerson.phone,
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
    if (unresolvedOwners > 0) {
      out.warnings.push(
        "Автотехніка: власників не знайдено в PERSONNEL: " + unresolvedOwners,
      );
    }
    return out;
  }


  function buildPersonDisplayName_(lastName, firstName, patronymic) {
    return [clean_(lastName), clean_(firstName), clean_(patronymic)]
      .filter(Boolean)
      .join(" ");
  }

  function detectWeaponAssetType_(assetName) {
    const text = clean_(assetName).toLowerCase();
    if (!text) return "Інше";
    if (text.indexOf("автомат") !== -1 || text.indexOf("ак-") !== -1 || text.indexOf("ак ") !== -1 || text.indexOf("ак74") !== -1) return "Автомати";
    if (text.indexOf("кулемет") !== -1) return "Кулемети";
    if (text.indexOf("гранатомет") !== -1) return "Гранатомети";
    if (text.indexOf("пістолет") !== -1 || text.indexOf("пистолет") !== -1) return "Пістолети";
    if (text.indexOf("гвинтів") !== -1 || text.indexOf("винтов") !== -1) return "Гвинтівки";
    if (text.indexOf("приціл") !== -1 || text.indexOf("прицел") !== -1) return "Приціли";
    if (text.indexOf("шолом") !== -1 || text.indexOf("брон") !== -1) return "Захисне майно";
    return "Інше";
  }

  function readWeaponBlock_(row, block, person, rowNumber) {
    const base = block.base;
    const assetName = clean_(row[base]);
    const year = normalizeYear_(row[base + 1]);
    const nomenclatureCode = clean_(row[base + 2]);
    const serialNumber = clean_(row[base + 3]);
    const unitPriceDisplay = clean_(row[base + 4]);
    const assignmentDateDisplay = block.hasAssignmentDate ? clean_(row[base + 5]) : "";
    const location = block.hasAssignmentDate ? clean_(row[base + 6]) : clean_(row[base + 5]);

    if (!assetName && !year && !nomenclatureCode && !serialNumber && !unitPriceDisplay && !assignmentDateDisplay && !location) {
      return null;
    }
    if (!assetName) {
      return { skipped: true, reason: "missing_asset_name" };
    }

    const unitPrice = parseCost_(unitPriceDisplay);
    const assigned = !!person.fullName || !!person.phone || !!person.callsign;

    return {
      rowNumber: rowNumber,
      block: block.index,
      blockLabel: block.label,
      lastName: person.lastName,
      firstName: person.firstName,
      patronymic: person.patronymic,
      personDisplay: person.fullName,
      personRawDisplay: person.rawFullName || person.fullName,
      personCanonical: person.found === true,
      callsign: person.callsign || "",
      rank: person.rank,
      phone: person.phone,
      assetName: assetName,
      type: detectWeaponAssetType_(assetName),
      year: year,
      nomenclatureCode: nomenclatureCode,
      serialNumber: serialNumber,
      unitPrice: unitPrice,
      unitPriceDisplay: unitPriceDisplay,
      assignmentDateDisplay: assignmentDateDisplay,
      location: location,
      assigned: assigned,
      searchText: [
        person.fullName,
        person.rawFullName,
        person.callsign,
        person.rank,
        person.phone,
        assetName,
        year,
        nomenclatureCode,
        serialNumber,
        unitPriceDisplay,
        assignmentDateDisplay,
        location,
        block.label,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    };
  }

  function buildLocationStats_(items) {
    return buildNamedStats_(items, "location", "Без місця", []);
  }

  function readWeaponsRegister() {
    const resolved = getSheet_("WEAPON_SHEET", "WEAPON");
    const sheet = resolved.sheet;
    const out = {
      sheet: resolved.name,
      exists: !!sheet,
      items: [],
      persons: [],
      stats: {
        persons: 0,
        total: 0,
        assigned: 0,
        unassigned: 0,
        totalUnitPrice: 0,
        totalUnitPriceDisplay: "0,00",
        minYear: "",
        maxYear: "",
        byType: [],
        byLocation: [],
      },
      warnings: [],
    };

    if (!sheet || sheet.getLastRow() < 2) {
      out.warnings.push("Аркуш озброєння не знайдено або він порожній");
      return out;
    }

    const values = sheet
      .getRange(2, 1, sheet.getLastRow() - 1, Math.max(sheet.getLastColumn(), 27))
      .getDisplayValues();
    const blocks = [
      { index: 1, base: 5, hasAssignmentDate: true, label: "Майно 1" },
      { index: 2, base: 12, hasAssignmentDate: true, label: "Майно 2" },
      { index: 3, base: 20, hasAssignmentDate: false, label: "Майно 3" },
    ];
    const personKeys = {};
    let totalUnitPrice = 0;
    let skippedMissingAssetName = 0;
    let unresolvedPersons = 0;
    const years = [];

    values.forEach(function (row, idx) {
      const rawPerson = {
        lastName: clean_(row[0]),
        firstName: clean_(row[1]),
        patronymic: clean_(row[2]),
        rank: clean_(row[3]),
        phone: clean_(row[4]),
        callsign: clean_(row[26]),
      };
      rawPerson.fullName = buildPersonDisplayName_(
        rawPerson.lastName,
        rawPerson.firstName,
        rawPerson.patronymic,
      );
      const person = canonicalPersonFromPersonnel_(rawPerson, {
        callsign: rawPerson.callsign,
        fml: rawPerson.fullName,
        phone: rawPerson.phone,
      });
      person.rawFullName = rawPerson.fullName;

      const hasPerson = !!(person.fullName || person.rank || person.phone);
      const hasAnyAsset = blocks.some(function (block) {
        const base = block.base;
        return !!(
          clean_(row[base]) ||
          clean_(row[base + 1]) ||
          clean_(row[base + 2]) ||
          clean_(row[base + 3]) ||
          clean_(row[base + 4]) ||
          clean_(row[base + 5]) ||
          (block.hasAssignmentDate && clean_(row[base + 6]))
        );
      });
      if (!hasPerson && !hasAnyAsset) return;
      if (
        personnelReferenceAvailable_() &&
        (rawPerson.fullName || rawPerson.phone) &&
        !person.found
      ) {
        unresolvedPersons += 1;
      }

      if (hasPerson) {
        const key = [person.callsign, person.fullName, person.phone].filter(Boolean).join("|") || "row:" + (idx + 2);
        if (!personKeys[key]) {
          personKeys[key] = true;
          out.persons.push({
            rowNumber: idx + 2,
            lastName: person.lastName,
            firstName: person.firstName,
            patronymic: person.patronymic,
            personDisplay: person.fullName,
            rawPersonDisplay: person.rawFullName || person.fullName,
            personCanonical: person.found === true,
            callsign: person.callsign || "",
            rank: person.rank,
            phone: person.phone,
          });
        }
      }

      blocks.forEach(function (block) {
        const item = readWeaponBlock_(row, block, person, idx + 2);
        if (!item) return;
        if (item.skipped) {
          skippedMissingAssetName += 1;
          return;
        }
        out.items.push(item);
        totalUnitPrice += Number(item.unitPrice) || 0;
        const yearNum = Number(item.year);
        if (yearNum >= 1900 && yearNum <= 2100) years.push(yearNum);
      });
    });

    out.stats.persons = out.persons.length;
    out.stats.total = out.items.length;
    out.stats.assigned = out.items.filter(function (item) {
      return item.assigned;
    }).length;
    out.stats.unassigned = out.stats.total - out.stats.assigned;
    out.stats.totalUnitPrice = totalUnitPrice;
    out.stats.totalUnitPriceDisplay = formatMoney_(totalUnitPrice);
    out.stats.minYear = years.length ? String(Math.min.apply(null, years)) : "";
    out.stats.maxYear = years.length ? String(Math.max.apply(null, years)) : "";
    out.stats.byType = buildTypeStats_(out.items);
    out.stats.byLocation = buildLocationStats_(out.items);

    if (skippedMissingAssetName > 0) {
      out.warnings.push(
        "Пропущено блоків без найменування майна: " + skippedMissingAssetName,
      );
    }
    if (unresolvedPersons > 0) {
      out.warnings.push(
        "Озброєння: осіб не знайдено в PERSONNEL: " + unresolvedPersons,
      );
    }
    return out;
  }

  function getCarsForPerson(person) {
    const safePerson = person || {};
    return readCarsRegister().items.filter(function (item) {
      return personMatchesItem_(safePerson, item);
    });
  }

  function getWeaponsForPerson(person) {
    const safePerson = person || {};
    return readWeaponsRegister().items.filter(function (item) {
      return personMatchesItem_(safePerson, item);
    });
  }

  function getEquipmentForPerson(person) {
    const cars = getCarsForPerson(person);
    const weapons = getWeaponsForPerson(person);
    return {
      cars: cars,
      weapons: weapons,
      total: cars.length + weapons.length,
    };
  }

  return {
    readPhoneDirectory: readPhoneDirectory,
    readCarsRegister: readCarsRegister,
    readWeaponsRegister: readWeaponsRegister,
    getCarsForPerson: getCarsForPerson,
    getWeaponsForPerson: getWeaponsForPerson,
    getEquipmentForPerson: getEquipmentForPerson,
  };
})();

