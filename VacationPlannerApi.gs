/**
 * VacationPlannerApi.gs — planner orchestration and global GAS entry points.
 */

const VacationPlannerApi_ = (function () {
  function _toast_(message, title, seconds) {
    try {
      _spreadsheet_().toast(message, title || "Відпустки", seconds || 5);
    } catch (_) {}
  }

  function _spreadsheet_() {
    if (
      typeof DataAccess_ === "object" &&
      DataAccess_ &&
      typeof DataAccess_.getSpreadsheet === "function"
    ) {
      return DataAccess_.getSpreadsheet();
    }
    return getWasbSpreadsheet_();
  }

  function _withDocumentLock_(callback) {
    const lock = LockService.getDocumentLock();
    lock.waitLock(30000);
    try {
      return callback();
    } finally {
      lock.releaseLock();
    }
  }

  function _assertWorkingAccess_(actionName) {
    if (
      typeof AccessEnforcement_ === "object" &&
      AccessEnforcement_ &&
      typeof AccessEnforcement_.assertCanUseWorkingActions === "function"
    ) {
      AccessEnforcement_.assertCanUseWorkingActions(actionName, {
        source: "vacationPlanner",
      });
    }
  }

  function showDialog() {
    _assertWorkingAccess_("showVacationPlannerDialog");
    const html = HtmlService.createHtmlOutputFromFile("VacationPlannerDialog")
      .setWidth(460)
      .setHeight(590);
    SpreadsheetApp.getUi().showModalDialog(html, "Планувальник відпусток");
  }

  function processRequest(formData) {
    _assertWorkingAccess_("processVacationPlannerRequest");
    const options = VacationPlannerService_.suggestVacationOptions(formData);
    const sheet = VacationOptionsWriter_.writeVacationOptions(options);
    const validCount = options.filter(function (option) {
      return option.status === "VALID";
    }).length;
    return {
      success: true,
      optionCount: validCount,
      sheetName: sheet.getName(),
    };
  }

  function applySelected() {
    _assertWorkingAccess_("applySelectedVacationOption");
    const result = _withDocumentLock_(function () {
      return VacationOptionsWriter_.applySelectedOption();
    });
    _toast_(
      "Відпустку для " + result.option.fml + " застосовано",
      "Успішно",
      5,
    );
    return result;
  }

  function rebuild() {
    _assertWorkingAccess_("rebuildVacationSystem");
    const result = _withDocumentLock_(function () {
      return VacationOptionsWriter_.rebuildVacationSystem();
    });
    _toast_(
      "Графік оновлено: " +
        result.scheduleRows +
        " відпусток, " +
        result.errorCount +
        " порушень",
      "Відпустки",
      5,
    );
    return result;
  }

  function checkOnly() {
    _assertWorkingAccess_("checkVacationScheduleOnly");
    const result = _withDocumentLock_(function () {
      return VacationOptionsWriter_.checkVacationScheduleOnly();
    });
    _toast_(
      result.errorCount
        ? "Знайдено порушень: " + result.errorCount
        : "Порушень не знайдено",
      "Перевірка відпусток",
      5,
    );
    return result;
  }

  function highlightProblems() {
    _assertWorkingAccess_("highlightVacationProblems");
    const result = _withDocumentLock_(function () {
      return VacationOptionsWriter_.highlightVacationProblems();
    });
    _toast_(
      result.errorCount
        ? "Підсвічено " + result.errorCount + " порушень"
        : "Порушень не знайдено",
      "Відпустки",
      5,
    );
    return result;
  }

  function generateReport() {
    _assertWorkingAccess_("generateVacationReport");
    const result = VacationOptionsWriter_.generateVacationReport();
    try {
      SpreadsheetApp.getUi().alert(
        "Звіт по відпустках",
        result.summary,
        SpreadsheetApp.getUi().ButtonSet.OK,
      );
    } catch (_) {
      _toast_(result.summary, "Звіт по відпустках", 10);
    }
    return result;
  }

  function showValidateDialog() {
    _assertWorkingAccess_("showValidateVacationDateDialog");
    const html = HtmlService.createHtmlOutputFromFile("VacationValidateDialog")
      .setWidth(460)
      .setHeight(520);
    SpreadsheetApp.getUi().showModalDialog(html, "Перевірка дати відпустки");
  }

  function processDateValidation(formData) {
    _assertWorkingAccess_("processVacationDateValidation");
    const request = VacationPlannerService_.normalizeRequest(formData);
    const allVacations = VacationsRepository_.listAll();
    const option = {
      fml: request.fml,
      vacationNumber: request.vacationNumber,
      startDate: request.desiredStart,
      endDate: VacationPlannerService_.calculateEndDate(
        request.desiredStart,
        request.durationDays,
      ),
      days: request.durationDays,
    };
    const validation = VacationPlannerService_.validateVacationOption(
      option,
      allVacations,
    );
    const score = validation.isValid
      ? VacationPlannerService_.scoreVacationOption(
          option,
          allVacations,
          request,
          validation,
        )
      : null;
    const lines = [];
    if (validation.isValid) {
      lines.push("Дата допустима.");
      lines.push("Оцінка (score): " + score + " — чим менше, тим краще.");
      if (validation.concurrentCount) {
        lines.push(
          "Пік одночасних відпусток: " +
            validation.concurrentCount.maxWithCandidate,
        );
      }
    } else {
      lines.push("Дата не допустима:");
      validation.violations.forEach(function (item) {
        lines.push("• " + item.message);
      });
    }
    return {
      isValid: validation.isValid,
      score: score,
      summary: lines.join("\n"),
      validation: validation,
    };
  }

  return {
    showDialog: showDialog,
    processRequest: processRequest,
    applySelected: applySelected,
    rebuild: rebuild,
    checkOnly: checkOnly,
    highlightProblems: highlightProblems,
    generateReport: generateReport,
    showValidateDialog: showValidateDialog,
    processDateValidation: processDateValidation,
  };
})();

function showVacationPlannerDialog() {
  return VacationPlannerApi_.showDialog();
}

function processVacationPlannerRequest(formData) {
  return VacationPlannerApi_.processRequest(formData);
}

function applySelectedVacationOption() {
  return VacationPlannerApi_.applySelected();
}

function rebuildVacationSystem() {
  return VacationPlannerApi_.rebuild();
}

function checkVacationScheduleOnly() {
  return VacationPlannerApi_.checkOnly();
}

function highlightVacationProblems() {
  return VacationPlannerApi_.highlightProblems();
}

function generateVacationReport() {
  return VacationPlannerApi_.generateReport();
}

function showValidateVacationDateDialog() {
  return VacationPlannerApi_.showValidateDialog();
}

function processVacationDateValidation(formData) {
  return VacationPlannerApi_.processDateValidation(formData);
}
