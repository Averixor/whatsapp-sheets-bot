/**
 * ProjectRequests.gs — аркуш «Проєкти» (email менеджерів для MonthlyReport).
 *
 * Форма сайдбару «Заявки» та аркуш «Заявки» видалені з продукту.
 * При порожньому аркуші «Проєкти»: заголовок + неактивний шаблонний рядок.
 */

const ProjectRequests_ = (function () {
  const PROJECTS_SHEET_NAME = "Проєкти";

  function ensureProjectsSheet_(ss) {
    let sh =
      typeof ensureLogicalSheet_ === "function"
        ? ensureLogicalSheet_(PROJECTS_SHEET_NAME)
        : null;
    if (!sh) {
      sh = ss.getSheetByName(PROJECTS_SHEET_NAME);
      if (!sh) sh = ss.insertSheet(PROJECTS_SHEET_NAME);
    }

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

  return {
    ensureProjectsSheet_,
  };
})();
