/************ БОКОВА ПАНЕЛЬ / SIDEBAR ENTRY POINTS ************/
/**
 * Sidebar host for google.script.run:
 * - no new domain logic here;
 * - thin delegates to apiStage7* / apiGenerateSendPanelForDate;
 * - client bootstrap: Sidebar.html + includeTemplate('JavaScript').
 */

function showSidebar() {
  const html = HtmlService.createTemplateFromFile("Sidebar")
    .evaluate()
    .setTitle("\u00A0\u00A0\u00A0WhatsApp-Sheets-Bot");
  SpreadsheetApp.getUi().showSidebar(html);
}

var WASB_SIDEBAR_LAUNCH_SECTION_KEY = "WASB_SIDEBAR_LAUNCH_SECTION";

function openVacationsInMainSidebar_() {
  PropertiesService.getUserProperties().setProperty(
    WASB_SIDEBAR_LAUNCH_SECTION_KEY,
    "vacations",
  );
  showSidebar();
}

function getSidebarLaunchSection_() {
  var props = PropertiesService.getUserProperties();
  var section = String(
    props.getProperty(WASB_SIDEBAR_LAUNCH_SECTION_KEY) || "",
  ).trim();
  if (section) {
    props.deleteProperty(WASB_SIDEBAR_LAUNCH_SECTION_KEY);
  }
  return section;
}

function _resolveCommanderRoleForSidebar_(commanderRole) {
  var selected = String(commanderRole || "").trim();
  if (selected) return selected;
  return String(
    typeof CONFIG !== "undefined" && CONFIG && CONFIG.COMMANDER_ROLE
      ? CONFIG.COMMANDER_ROLE
      : "ГРАФ",
  ).trim();
}

function _requireSidebarAccessGuard_(guardName, args) {
  if (
    typeof AccessEnforcement_ !== "object" ||
    !AccessEnforcement_ ||
    typeof AccessEnforcement_[guardName] !== "function"
  ) {
    throw new Error("Access guard unavailable: " + guardName);
  }
  return AccessEnforcement_[guardName].apply(AccessEnforcement_, args || []);
}

function getCommanderRecipientOptions_() {
  var defaultRole = _resolveCommanderRoleForSidebar_("");
  var seen = Object.create(null);
  var out = [];

  function add(value) {
    var key = String(value || "").trim();
    if (!key || seen[key]) return;
    seen[key] = true;
    out.push(key);
  }

  add(defaultRole);

  try {
    var index =
      typeof loadPhonesIndex_ === "function" ? loadPhonesIndex_() : null;
    if (index && Array.isArray(index.items)) {
      index.items.forEach(function (item) {
        var cs = String((item && (item.callsign || item.role)) || "").trim();
        if (cs && item.phone) add(cs);
      });
    }
  } catch (_) {}

  try {
    var list =
      typeof getPersonnelCallsignsListForUi_ === "function"
        ? getPersonnelCallsignsListForUi_()
        : typeof getPersonnelCallsignsList_ === "function"
          ? getPersonnelCallsignsList_()
          : [];
    if (Array.isArray(list)) {
      list.forEach(add);
    }
  } catch (_) {}

  return out;
}

function sendDaySummaryToCommanderSidebar(dateStr, summaryText, commanderRole) {
  try {
    _requireSidebarAccessGuard_("assertCanUseWorkingActions", [
      "sendDaySummaryToCommanderSidebar",
      { requestedDate: dateStr || "" },
    ]);
    if (!summaryText) {
      throw new Error("Немає тексту зведення");
    }

    var recipient = resolveMessageRecipient_({ recipientRole: commanderRole });
    var selectedRole = recipient.role;
    const phone = recipient.phone;

    const safe = trimToEncoded_(summaryText, CONFIG.MAX_WA_TEXT);
    const link = buildWhatsAppWebLink_(phone, safe);

    writeLogsBatch_([
      {
        timestamp: new Date(),
        reportDateStr: dateStr || "",
        sheet: "COMMANDER",
        cell: "SUMMARY",
        fml: `Командир (${selectedRole})`,
        phone: phone,
        code: "SUMMARY",
        message: String(summaryText).substring(0, 100) + "...",
        link: link,
      },
    ]);

    return okResponse_(
      { link: link, commanderRole: selectedRole, recipient: recipient },
      "Зведення для командира підготовлено",
      { function: "sendDaySummaryToCommanderSidebar" },
    );
  } catch (e) {
    return errorResponse_(e, { function: "sendDaySummaryToCommanderSidebar" });
  }
}

function sendDetailedToCommanderSidebar(dateStr, detailedText, commanderRole) {
  try {
    _requireSidebarAccessGuard_("assertCanUseDetailedSummary", [dateStr || ""]);
    if (!detailedText) {
      throw new Error("Немає тексту детального зведення");
    }

    var recipient = resolveMessageRecipient_({ recipientRole: commanderRole });
    var selectedRole = recipient.role;
    const phone = recipient.phone;

    const safe = trimToEncoded_(detailedText, CONFIG.MAX_WA_TEXT);
    const link = buildWhatsAppWebLink_(phone, safe);

    writeLogsBatch_([
      {
        timestamp: new Date(),
        reportDateStr: dateStr || "",
        sheet: "COMMANDER",
        cell: "DETAILED",
        fml: `Командир (${selectedRole})`,
        phone: phone,
        code: "DETAILED",
        message: String(detailedText).substring(0, 100) + "...",
        link: link,
      },
    ]);

    return okResponse_(
      { link: link, commanderRole: selectedRole, recipient: recipient },
      "Детальне зведення для командира підготовлено",
      { function: "sendDetailedToCommanderSidebar" },
    );
  } catch (e) {
    return errorResponse_(e, { function: "sendDetailedToCommanderSidebar" });
  }
}

function prepareMessageToRecipientSidebar(message, recipientOptions) {
  try {
    _requireSidebarAccessGuard_("assertCanUseWorkingActions", [
      "prepareMessageToRecipientSidebar",
      {
        recipientMode: String(
          (recipientOptions && recipientOptions.recipientMode) || "",
        ),
      },
    ]);
    if (!String(message || "").trim()) {
      throw new Error("Немає тексту повідомлення");
    }

    var recipient = resolveMessageRecipient_(recipientOptions || {});
    var safe = trimToEncoded_(message, CONFIG.MAX_WA_TEXT);
    var link = buildWhatsAppWebLink_(recipient.phone, safe);

    return okResponse_(
      { link: link, recipient: recipient },
      "Повідомлення для отримувача підготовлено",
      { function: "prepareMessageToRecipientSidebar" },
    );
  } catch (e) {
    return errorResponse_(e, { function: "prepareMessageToRecipientSidebar" });
  }
}

function testCommanderPhone() {
  const ui = SpreadsheetApp.getUi();
  try {
    const phoneIndex =
      typeof loadPhonesIndex_ === "function" ? loadPhonesIndex_() : null;
    const role = CONFIG.COMMANDER_ROLE;
    const lines = [];
    lines.push("🔍 ПОШУК ТЕЛЕФОНУ КОМАНДИРА");
    lines.push("============================");
    lines.push("");
    lines.push(`Позивний в конфігу: "${role}"`);
    lines.push("");
    lines.push(`📞 Canonical lookup: ${findPhone_({ role: role }) || "✕"}`);
    lines.push(
      `📞 byRole[${role}]: ${
        phoneIndex && phoneIndex.byRole
          ? phoneIndex.byRole[role] ||
            phoneIndex.byRole[_normCallsignKey_(role)] ||
            "✕"
          : "✕"
      }`,
    );
    lines.push(
      `📞 byCallsign[${role}]: ${
        phoneIndex && phoneIndex.byCallsign
          ? phoneIndex.byCallsign[role] ||
            phoneIndex.byCallsign[_normCallsignKey_(role)] ||
            "✕"
          : "✕"
      }`,
    );
    lines.push("");
    lines.push("📋 Можливі кандидати:");
    lines.push("");

    let found = 0;
    (phoneIndex && Array.isArray(phoneIndex.items)
      ? phoneIndex.items
      : []
    ).forEach(function (item) {
      const probe = [item.role, item.callsign, item.fml]
        .filter(Boolean)
        .join(" | ");
      const upperProbe = probe.toUpperCase();
      if (
        upperProbe.indexOf("КОМАНДИР") !== -1 ||
        upperProbe.indexOf("ГРАФ") !== -1 ||
        upperProbe.indexOf(String(role || "").toUpperCase()) !== -1
      ) {
        lines.push(`  ${probe} → ${item.phone || "—"}`);
        found++;
      }
    });

    if (!found) {
      lines.push("  (нічого не знайдено)");
      lines.push("");
      lines.push(
        `✕ В листі PHONES немає запису для командира. Додайте роль або позивний "${role}".`,
      );
    }

    const result = lines.join("\n");
    ui.alert("📱 Діагностика командира", result, ui.ButtonSet.OK);
  } catch (e) {
    ui.alert(
      "✕ Помилка",
      String(e && e.message ? e.message : e),
      ui.ButtonSet.OK,
    );
  }
}
