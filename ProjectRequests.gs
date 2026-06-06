/**
 * ProjectRequests.gs — заявки з сайдбару (Projects + Requests).
 *
 * Очікувані аркуші:
 * - "Проєкти": колонки id, проєкт, активний, email менеджера; при порожньому аркуші —
 *   заголовок + неактивний шаблонний рядок (не показується в сайдбарі доки active≠true).
 * - "Заявки": технічні заголовки для appendRow; при порожньому аркуші —
 *   заголовок + шаблонний рядок (timestamp 2000-01-01, dedupe_key `wasb-template-row-v1`, status template).
 */

const ProjectRequests_ = (function () {
  const PROJECTS_SHEET_NAME = "Проєкти";
  const REQUESTS_SHEET_NAME = "Заявки";
 
  const MAX_PAYLOAD_BYTES = 45000; 

  function isValidEmail_(value) {
    const s = String(value || "").trim();
    if (!s) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }

  function estimateUtf8Bytes_(value) {
    try {
      return Utilities.newBlob(
        String(value === null || value === undefined ? "" : value),
      ).getBytes().length;
    } catch (_) {
      return (
        String(value === null || value === undefined ? "" : value).length * 2
      ); 
    }
  }

  function assertPayloadSize_(payload) {
    const json = JSON.stringify(
      payload === null || payload === undefined ? {} : payload,
    );
    const bytes = estimateUtf8Bytes_(json);
    if (bytes > MAX_PAYLOAD_BYTES) {
      throw new Error(
        `Занадто великий запит (${bytes} байт). Скороти опис або прибери зайві дані.`,
      );
    }
    return { bytes };
  }

  function normalizeHeader_(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function findColumnIndex_(headers, variants) {
    const norm = headers.map(normalizeHeader_);
    for (let i = 0; i < norm.length; i++) {
      const h = norm[i];
      if (!h) continue;
      if (variants.some((v) => h === v || h.indexOf(v) !== -1)) return i;
    }
    return -1;
  }

  function ensureProjectsSheet_(ss) {
    let sh = ss.getSheetByName(PROJECTS_SHEET_NAME);
    if (!sh) sh = ss.insertSheet(PROJECTS_SHEET_NAME);

    if (sh.getLastRow() < 1) {
      const colCount = 4;
      sh.getRange(1, 1, 1, colCount).setValues([
        ["id", "проєкт", "активний", "email менеджера"],
      ]);
      sh.getRange(2, 1, 1, colCount).setValues([
        [
          "example-id",
          "Приклад: заміни на реальну назву",
          "false",
          "manager@company.com",
        ],
      ]);
      try {
        sh.setFrozenRows(1);
      } catch (_) {}
      try {
        const head = sh.getRange(1, 1, 1, colCount);
        head.setFontWeight("bold");
        head.setBackground("#eef2ff");
        head.setWrap(true);
      } catch (_) {}
      try {
        sh.autoResizeColumns(1, colCount);
      } catch (_) {}
    }

    return sh;
  }

  function readProjects_(ss) {
    const sh = ss.getSheetByName(PROJECTS_SHEET_NAME);
    if (!sh) return [];
    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();
    if (lastRow < 2 || lastCol < 1) return [];

    const values = sh.getRange(1, 1, lastRow, lastCol).getDisplayValues();
    const headers = (values[0] || []).map((v) => String(v || "").trim());

    const idIdx = findColumnIndex_(headers, ["id", "код", "key"]);
    const nameIdx = findColumnIndex_(headers, [
      "проєкт",
      "проект",
      "назва",
      "name",
      "project",
    ]);
    const activeIdx = findColumnIndex_(headers, [
      "актив",
      "active",
      "enabled",
      "статус",
    ]);

    if (nameIdx === -1) {
      throw new Error(
        'Аркуш "Проєкти": не знайдено колонку назви (очікував "Проєкт/Назва").',
      );
    }

    const out = [];
    for (let i = 1; i < values.length; i++) {
      const row = values[i] || [];
      const name = String(row[nameIdx] || "").trim();
      if (!name) continue;

      let active = true;
      if (activeIdx !== -1) {
        const raw = String(row[activeIdx] || "")
          .trim()
          .toLowerCase();
        if (
          raw === "false" ||
          raw === "0" ||
          raw === "ні" ||
          raw === "no" ||
          raw === "inactive"
        )
          active = false;
      }
      if (!active) continue;

      const id = idIdx !== -1 ? String(row[idIdx] || "").trim() : "";
      out.push({
        id: id || name,
        name,
      });
    }

    out.sort((a, b) => a.name.localeCompare(b.name, "uk-UA"));
    return out;
  }

  function ensureRequestsSheet_(ss) {
    let sh = ss.getSheetByName(REQUESTS_SHEET_NAME);
    if (!sh) sh = ss.insertSheet(REQUESTS_SHEET_NAME);

    if (sh.getLastRow() < 1) {
      const colCount = 8;
      sh.getRange(1, 1, 1, colCount).setValues([
        [
          "timestamp",
          "user_email",
          "project_id",
          "project_name",
          "title",
          "details",
          "dedupe_key",
          "status",
        ],
      ]);
      const tplTs = new Date(2000, 0, 1);
      sh.getRange(2, 1, 1, colCount).setValues([
        [
          tplTs,
          "",
          "example-id",
          "Приклад: назва проєкту",
          "Приклад теми заявки",
          "Шаблон: видали цей рядок після першої реальної заявки.",
          "wasb-template-row-v1",
          "template",
        ],
      ]);
      try {
        sh.getRange(2, 6).setWrap(true);
      } catch (_) {}
      try {
        sh.setFrozenRows(1);
      } catch (_) {}
      try {
        const head = sh.getRange(1, 1, 1, colCount);
        head.setFontWeight("bold");
        head.setBackground("#eef2ff");
        head.setWrap(true);
      } catch (_) {}
      try {
        sh.autoResizeColumns(1, colCount);
      } catch (_) {}
      try {
        sh.getRange(2, 1).setNumberFormat("dd.mm.yyyy hh:mm");
      } catch (_) {}
    }
    return sh;
  }

  function normalizeText_(value, maxLen) {
    const s = String(value ?? "")
      .trim()
      .replace(/\s+/g, " ");
    if (!maxLen) return s;
    return s.length > maxLen ? s.slice(0, maxLen) : s;
  }

  function computeDedupeKey_(userEmail, projectId, title, details) {
    const base = [
      String(userEmail || "")
        .trim()
        .toLowerCase(),
      String(projectId || "")
        .trim()
        .toLowerCase(),
      normalizeText_(title, 120).toLowerCase(),
      normalizeText_(details, 500).toLowerCase(),
    ].join("|");
    const digest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      base,
      Utilities.Charset.UTF_8,
    );
    return digest
      .map((b) => ("0" + (b & 0xff).toString(16)).slice(-2))
      .join("");
  }

  function findDuplicate_(sheet, dedupeKey) {
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 2 || lastCol < 1) return null;

    const col = 7;
    const values = sheet
      .getRange(2, col, lastRow, col)
      .getDisplayValues()
      .map((r) => String(r[0] || "").trim());
    const idx = values.findIndex((v) => v === dedupeKey);
    if (idx === -1) return null;
    return { rowNumber: 2 + idx };
  }

  return {
    readProjects_,
    ensureProjectsSheet_,
    ensureRequestsSheet_,
    normalizeText_,
    computeDedupeKey_,
    findDuplicate_,
    isValidEmail_,
    assertPayloadSize_,
  };
})();

/**
 * Для сайдбару: отримати активні проєкти з аркуша "Проєкти".
 * @returns {ReturnType<typeof okResponse_>}
 */
function apiGetActiveProjects() {
  try {
    const ss = getWasbSpreadsheet_();
    const wasMissing = !ss.getSheetByName("Проєкти");
    const projects = ProjectRequests_.readProjects_(ss);
    return okResponse_(
      { projects, projectsSheetMissing: wasMissing },
      wasMissing
        ? 'Аркуш "Проєкти" відсутній. Попросіть адміністратора виконати repair.'
        : "OK",
      {
        function: "apiGetActiveProjects",
      },
    );
  } catch (e) {
    return errorResponse_(e, "✕ Не вдалося отримати список проєктів", {
      function: "apiGetActiveProjects",
    });
  }
}

/**
 * Приймає дані з форми і записує в аркуш "Заявки" з дедупом.
 *
 * @param {{projectId?:string, projectName?:string, title?:string, details?:string}} payload
 * @returns {ReturnType<typeof okResponse_>}
 */
function apiSubmitRequest(payload) {
  const started = Date.now();
  try {
    _stage7AssertRole_("viewer", "submit project request");
    const size = ProjectRequests_.assertPayloadSize_(payload);
    const data = payload && typeof payload === "object" ? payload : {};
    const projectId = ProjectRequests_.normalizeText_(data.projectId, 80);
    const projectName = ProjectRequests_.normalizeText_(data.projectName, 120);
    const title = ProjectRequests_.normalizeText_(data.title, 140);
    const details = ProjectRequests_.normalizeText_(data.details, 3000);

    if (!projectId) throw new Error("Обери проєкт.");
    if (!title) throw new Error("Заповни тему заявки.");
    if (!details) throw new Error("Заповни опис заявки.");

    const userEmail = String(
      (Session.getActiveUser &&
        Session.getActiveUser().getEmail &&
        Session.getActiveUser().getEmail()) ||
        "",
    ).trim();
    if (userEmail && !ProjectRequests_.isValidEmail_(userEmail)) {
      throw new Error(
        "Некоректний email користувача (Session.getActiveUser()).",
      );
    }

    const ss = getWasbSpreadsheet_();
    const sheet = ss.getSheetByName("Заявки");
    if (!sheet) {
      throw new Error(
        'Аркуш "Заявки" відсутній. Попросіть адміністратора виконати repair.',
      );
    }

    const dedupeKey = ProjectRequests_.computeDedupeKey_(
      userEmail,
      projectId,
      title,
      details,
    );
    const dup = ProjectRequests_.findDuplicate_(sheet, dedupeKey);
    if (dup) {
      return warnResponse_(
        { duplicate: true, rowNumber: dup.rowNumber },
        "⚠ Така заявка вже існує (дубль).",
        { function: "apiSubmitRequest", durationMs: Date.now() - started },
      );
    }

    sheet.appendRow([
      new Date(),
      userEmail,
      projectId,
      projectName || projectId,
      title,
      details,
      dedupeKey,
      "new",
    ]);

    return okResponse_(
      { saved: true, duplicate: false, payloadBytes: size.bytes },
      "✓ Заявку збережено",
      { function: "apiSubmitRequest", durationMs: Date.now() - started },
    );
  } catch (e) {
    return errorResponse_(e, "✕ Не вдалося зберегти заявку", {
      function: "apiSubmitRequest",
      durationMs: Date.now() - started,
    });
  }
}
