/**
 * AccessAutoFillPolicy.gs
 *
 * Автозаповнення ACCESS після заявки та після ручного рішення адміністратора.
 *
 * Ручний ввід адміністратора:
 * - role / роль
 * - enabled / активний
 *
 * Автоматично:
 * - note / примітка
 * - self_bind_allowed / дозволена самостійна привʼязка
 * - registration_status
 * - нормалізація телефону
 * - нормалізація позивного
 * - нормалізація ПІБ
 */

function wasbAccessAutoFillOnEdit_(e) {
  if (!e || !e.range) return;

  var sheet = e.range.getSheet();
  if (!sheet) return;

  if (String(sheet.getName()).toUpperCase() !== "ACCESS") return;

  var row = e.range.getRow();
  if (row <= 1) return;

  wasbAccessAutoFillRow_(sheet, row);
}

function wasbAccessAutoFillAll_() {
  var ss = getWasbSpreadsheet_();
  if (!ss) {
    throw new Error("getWasbSpreadsheet_() is empty. Запускайте з таблиці.");
  }

  var sheet = ss.getSheetByName("ACCESS");
  if (!sheet) {
    throw new Error("ACCESS sheet not found");
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: true, rows: 0 };

  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var map = wasbAccessGetHeaderMap_(sheet);
  var numRows = lastRow - 1;
  var range = sheet.getRange(2, 1, numRows, lastCol);
  var values = range.getValues();

  for (var i = 0; i < values.length; i++) {
    wasbAccessApplyPolicyToRow_(values[i], map);
  }

  range.setValues(values);
  SpreadsheetApp.flush();

  return {
    ok: true,
    rows: values.length,
  };
}

function wasbInstallAccessAutoFillTrigger_() {
  var ss = getWasbSpreadsheet_();
  if (!ss) {
    throw new Error(
      "getWasbSpreadsheet_() is empty. Відкрийте таблицю і запускайте звідти.",
    );
  }

  var triggers = ScriptApp.getProjectTriggers();

  triggers.forEach(function (trigger) {
    if (
      trigger.getHandlerFunction &&
      trigger.getHandlerFunction() === "wasbAccessAutoFillOnEdit_"
    ) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger("wasbAccessAutoFillOnEdit_")
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  return {
    ok: true,
    installed: true,
    spreadsheetId: ss.getId(),
  };
}

function wasbAccessAutoFillRow_(sheet, row) {
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var map = wasbAccessGetHeaderMap_(sheet);
  var range = sheet.getRange(row, 1, 1, lastCol);
  var rowData = range.getValues()[0];

  wasbAccessApplyPolicyToRow_(rowData, map);
  range.setValues([rowData]);
}

/**
 * Ядро логіки: обробка одного рядка (масиву) в пам'яті.
 */
function wasbAccessApplyPolicyToRow_(rowData, map) {
  var role = wasbAccessGetFromRow_(rowData, map, "role");
  var enabledRaw = wasbAccessGetFromRow_(rowData, map, "enabled");

  var normalizedRole = String(role || "")
    .trim()
    .toLowerCase();
  var enabled = wasbAccessIsTruthy_(enabledRaw);

  var email = wasbAccessGetFromRow_(rowData, map, "email");
  var phone = wasbAccessGetFromRow_(rowData, map, "phone");
  var callsign = wasbAccessGetFromRow_(rowData, map, "person_callsign");
  var surname = wasbAccessGetFromRow_(rowData, map, "surname");
  var firstName = wasbAccessGetFromRow_(rowData, map, "first_name");
  var patronymic = wasbAccessGetFromRow_(rowData, map, "patronymic");
  var login = wasbAccessGetFromRow_(rowData, map, "login");
  var status = String(
    wasbAccessGetFromRow_(rowData, map, "registration_status") || "",
  )
    .trim()
    .toLowerCase();

  if (phone) {
    var normalizedPhone =
      typeof normalizePhone_ === "function"
        ? normalizePhone_(phone)
        : wasbAccessNormalizePhoneFallback_(phone);

    wasbAccessSetInRow_(rowData, map, "phone", normalizedPhone);
    phone = normalizedPhone;
  }

  if (callsign) {
    wasbAccessSetInRow_(
      rowData,
      map,
      "person_callsign",
      wasbAccessNormalizeCallsign_(callsign),
    );
  }

  if (surname) {
    wasbAccessSetInRow_(
      rowData,
      map,
      "surname",
      wasbAccessNormalizeHumanName_(surname),
    );
  }

  if (firstName) {
    wasbAccessSetInRow_(
      rowData,
      map,
      "first_name",
      wasbAccessNormalizeHumanName_(firstName),
    );
  }

  if (patronymic) {
    wasbAccessSetInRow_(
      rowData,
      map,
      "patronymic",
      wasbAccessNormalizeHumanName_(patronymic),
    );
  }

  if (!login) {
    var autoLogin = String(email || phone || "").trim();
    if (autoLogin) {
      wasbAccessSetInRow_(rowData, map, "login", autoLogin);
    }
  }

  if (normalizedRole) {
    wasbAccessSetInRow_(rowData, map, "role", normalizedRole);

    var note = "";
    if (typeof getRoleNoteTemplate_ === "function") {
      try {
        note = getRoleNoteTemplate_(normalizedRole);
      } catch (err) {
        note = "";
      }
    }

    if (!note) {
      note = wasbAccessRoleNoteFallback_(normalizedRole);
    }

    wasbAccessSetInRow_(rowData, map, "note", note);
  }

  var allowSelfBind = !!(normalizedRole && enabled);
  wasbAccessSetInRow_(rowData, map, "self_bind_allowed", allowSelfBind);

  /*
   * Статус не вводиться руками.
   *
   * pending_review — заявка подана, адмін ще не прийняв рішення.
   * approved — адмін поставив role + enabled, можна завершувати доступ.
   * active — якщо доступ уже активований або є постійний password_hash.
   */
  var passwordHash = String(
    wasbAccessGetFromRow_(rowData, map, "password_hash") || "",
  ).trim();

  if (allowSelfBind) {
    if (passwordHash) {
      wasbAccessSetInRow_(rowData, map, "registration_status", "active");
    } else if (
      !status ||
      status === "pending_review" ||
      status === "requested"
    ) {
      wasbAccessSetInRow_(rowData, map, "registration_status", "approved");
    }

    if (!wasbAccessGetFromRow_(rowData, map, "approved_at")) {
      wasbAccessSetInRow_(rowData, map, "approved_at", new Date());
    }

    if (!wasbAccessGetFromRow_(rowData, map, "approved_by")) {
      wasbAccessSetInRow_(rowData, map, "approved_by", "system:auto-fill");
    }
  } else if (!status) {
    wasbAccessSetInRow_(rowData, map, "registration_status", "pending_review");
  }
}

function wasbAccessGetHeaderMap_(sheet) {
  var aliases = wasbAccessHeaderAliases_();
  var lastColumn = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];

  var normalizedToColumn = {};
  var map = {};

  for (var i = 0; i < headers.length; i++) {
    var header = String(headers[i] || "").trim();
    if (!header) continue;
    normalizedToColumn[wasbAccessNormalizeHeader_(header)] = i + 1;
  }

  Object.keys(aliases).forEach(function (canonical) {
    var list = aliases[canonical];

    for (var i = 0; i < list.length; i++) {
      var normalized = wasbAccessNormalizeHeader_(list[i]);

      if (normalizedToColumn[normalized]) {
        map[canonical] = normalizedToColumn[normalized];
        return;
      }
    }
  });

  return map;
}

function wasbAccessHeaderAliases_() {
  return {
    email: ["email", "електронна пошта", "електронна_пошта", "пошта"],
    phone: ["phone", "телефон", "номер телефону"],
    role: ["role", "роль"],
    enabled: ["enabled", "активний", "активна", "увімкнено"],
    note: ["note", "примітка", "замітка"],
    display_name: [
      "display_name",
      "імʼя, що відображається",
      "ім’я, що відображається",
      "ім'я, що відображається",
      "імя, що відображається",
    ],
    person_callsign: ["person_callsign", "позивний користувача", "позивний"],
    self_bind_allowed: [
      "self_bind_allowed",
      "дозволена самостійна привʼязка",
      "дозволена самостійна прив’язка",
      "дозволена самостійна прив'язка",
    ],
    login: ["login", "логін"],
    password_hash: ["password_hash", "хеш пароля"],
    registration_status: ["registration_status", "статус реєстрації"],
    surname: ["surname", "прізвище", "фамілія"],
    first_name: ["first_name", "імʼя", "ім’я", "ім'я", "імя"],
    patronymic: ["patronymic", "по батькові"],
    approved_by: ["approved_by", "ким схвалено"],
    approved_at: ["approved_at", "час схвалення"],
  };
}

function wasbAccessGetFromRow_(rowData, map, key) {
  var col = map[key];
  if (!col || col > rowData.length) return "";
  return rowData[col - 1];
}

function wasbAccessSetInRow_(rowData, map, key, value) {
  var col = map[key];
  if (!col || col > rowData.length) return;
  rowData[col - 1] = value;
}

function wasbAccessGet_(sheet, map, row, key) {
  var col = map[key];
  if (!col) return "";
  return sheet.getRange(row, col).getValue();
}

function wasbAccessSet_(sheet, map, row, key, value) {
  var col = map[key];
  if (!col) return;
  sheet.getRange(row, col).setValue(value);
}

function wasbAccessIsTruthy_(value) {
  if (value === true) return true;

  var text = String(value || "")
    .trim()
    .toLowerCase();

  return (
    text === "true" ||
    text === "так" ||
    text === "да" ||
    text === "yes" ||
    text === "y" ||
    text === "1" ||
    text === "активний" ||
    text === "active"
  );
}

function wasbAccessNormalizeHeader_(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[ʼ’']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function wasbAccessNormalizeCallsign_(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function wasbAccessNormalizeHumanName_(value) {
  if (typeof normalizeHumanName_ === "function") {
    return normalizeHumanName_(value);
  }

  var text = String(value || "")
    .toLowerCase()
    .trim();

  if (!text) return "";

  return text
    .split(/(\s+|-)/)
    .map(function (part) {
      if (!part || /^\s+$/.test(part) || part === "-") return part;
      return part.charAt(0).toUpperCase() + part.substring(1);
    })
    .join("");
}

function wasbAccessNormalizePhoneFallback_(value) {
  var digits = String(value || "").replace(/[^\d]/g, "");

  if (digits.indexOf("00") === 0) {
    digits = digits.substring(2);
  }

  if (/^80\d{9}$/.test(digits)) {
    digits = digits.substring(1);
  }

  if (/^0\d{9}$/.test(digits)) {
    digits = "38" + digits;
  }

  if (/^\d{9}$/.test(digits)) {
    digits = "380" + digits;
  }

  if (/^380\d{9}$/.test(digits)) {
    return "+" + digits;
  }

  return "";
}

function wasbAccessRoleNoteFallback_(role) {
  var normalized = String(role || "")
    .toLowerCase()
    .trim();
  if (normalized === "owner")
    return "Owner • full root access to the entire system";
  if (normalized === "admin")
    return "Admin • access and system action management";
  if (normalized === "maintainer")
    return "Maintainer • diagnostics and maintenance";
  if (normalized === "operator") return "Operator • panel and daily actions";
  if (normalized === "viewer") return "Viewer • read-only access";
  if (normalized === "guest") return "Guest • access pending approval";
  return "Role: " + normalized;
}
