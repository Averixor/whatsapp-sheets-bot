/**
 * ProjectRequests.gs — заявки з сайдбару (Projects + Requests).
 *
 * Очікувані аркуші:
 * - "Проєкти": список проєктів (мін. колонки: назва; бажано: активний, id)
 * - "Заявки": база заявок
 */

const ProjectRequests_ = (function () {
  const PROJECTS_SHEET_NAME = "Проєкти";
  const REQUESTS_SHEET_NAME = "Заявки";
  // GAS інколи запускається на парсері без numeric separators (45_000), тому тримаємо просте число.
  const MAX_PAYLOAD_BYTES = 45000; // запас під ліміт передачі/серіалізації google.script.run

  function isValidEmail_(value) {
    const s = String(value || "").trim();
    if (!s) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }

  function estimateUtf8Bytes_(value) {
    // Utilities.newBlob uses UTF-8 by default for string data in GAS.
    try {
      return Utilities.newBlob(
        String(value === null || value === undefined ? "" : value),
      ).getBytes().length;
    } catch (_) {
      return (
        String(value === null || value === undefined ? "" : value).length * 2
      ); // fallback approximation
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

  function getSheetRequired_(ss, name) {
    const sh = ss.getSheetByName(name);
    if (!sh) throw new Error(`Аркуш "${name}" не знайдено`);
    return sh;
  }

  function readProjects_(ss) {
    const sh = getSheetRequired_(ss, PROJECTS_SHEET_NAME);
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

    // стабільний порядок
    out.sort((a, b) => a.name.localeCompare(b.name, "uk"));
    return out;
  }

  function ensureRequestsSheet_(ss) {
    let sh = ss.getSheetByName(REQUESTS_SHEET_NAME);
    if (!sh) sh = ss.insertSheet(REQUESTS_SHEET_NAME);

    // Заголовки (якщо порожній)
    if (sh.getLastRow() < 1) {
      sh.getRange(1, 1, 1, 8).setValues([
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

    // dedupe_key в нашому заголовку — 7 колонка
    const col = 7;
    const values = sheet
      .getRange(2, col, lastRow - 1, 1)
      .getDisplayValues()
      .map((r) => String(r[0] || "").trim());
    const idx = values.findIndex((v) => v === dedupeKey);
    if (idx === -1) return null;
    return { rowNumber: 2 + idx };
  }

  return {
    readProjects_,
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
    const projects = ProjectRequests_.readProjects_(ss);
    return okResponse_({ projects }, "OK", {
      function: "apiGetActiveProjects",
    });
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
    const size = ProjectRequests_.assertPayloadSize_(payload);
    const data = payload && typeof payload === "object" ? payload : {};
    const projectId = ProjectRequests_.normalizeText_(data.projectId, 80);
    const projectName = ProjectRequests_.normalizeText_(data.projectName, 120);
    const title = ProjectRequests_.normalizeText_(data.title, 140);
    const details = ProjectRequests_.normalizeText_(data.details, 3000);

    if (!projectId) throw new Error("Обери проєкт.");
    if (!title) throw new Error("Заповни тему заявки.");
    if (!details) throw new Error("Заповни опис заявки.");

    // Email може бути порожнім в деяких доменних налаштуваннях.
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
    const sheet = ProjectRequests_.ensureRequestsSheet_(ss);

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
