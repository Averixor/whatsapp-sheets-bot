/**
 * LeaveBirthdayReminderMail.gs — email digest for vacation/birthday reminders.
 * Sends to Script Property WASB_OWNER_EMAIL on system trigger when reminders exist.
 */

function _lbrShouldSendDigestEmail_(options) {
  const input = options && typeof options === "object" ? options : {};
  if (input.sendEmail === false) return false;
  if (input.sendEmail === true) return true;
  return input.trigger === true || input.isSystemTrigger === true;
}

function _lbrReminderCounts_(vacations, birthdays) {
  const vac = vacations && typeof vacations === "object" ? vacations : {};
  const bday = birthdays && typeof birthdays === "object" ? birthdays : {};
  return {
    vacationSoldiers: Number((vac.soldierMessages || []).length),
    vacationCommander: Number((vac.commanderMessages || []).length),
    birthdayCommander: Number((bday.commanderMessages || []).length),
    birthdayPeople: Number((bday.birthdayMessages || []).length),
  };
}

function _lbrFormatMessageLines_(items, formatter) {
  return (items || []).map(function (item, index) {
    return String(index + 1) + ". " + formatter(item || {});
  });
}

function _lbrBuildDigestBody_(dateLabel, vacations, birthdays) {
  const lines = [
    "WASB — щоденний дайджест нагадувань",
    "Дата перевірки: " + String(dateLabel || ""),
    "",
  ];
  const vac = vacations && typeof vacations === "object" ? vacations : {};
  const bday = birthdays && typeof birthdays === "object" ? birthdays : {};

  const soldierLines = _lbrFormatMessageLines_(vac.soldierMessages, function (item) {
    return (
      (item.callsign || item.fml || "—") +
      " — за " +
      String(item.daysUntil || "?") +
      " дн., " +
      String(item.startDate || "") +
      "…" +
      String(item.endDate || "") +
      "\n   " +
      String(item.message || "").replace(/\n/g, "\n   ") +
      (item.link ? "\n   " + item.link : "")
    );
  });
  if (soldierLines.length) {
    lines.push("🏖️ Відпустки — бійцям (" + soldierLines.length + "):");
    lines.push.apply(lines, soldierLines);
    lines.push("");
  }

  const vacationCommanderLines = _lbrFormatMessageLines_(
    vac.commanderMessages,
    function (item) {
      return (
        (item.callsign || item.fml || "—") +
        " — за " +
        String(item.daysUntil || "?") +
        " дн.\n   " +
        String(item.message || "").replace(/\n/g, "\n   ") +
        (item.link ? "\n   " + item.link : "")
      );
    },
  );
  if (vacationCommanderLines.length) {
    lines.push("🏖️ Відпустки — командиру (" + vacationCommanderLines.length + "):");
    lines.push.apply(lines, vacationCommanderLines);
    lines.push("");
  }

  const birthdayCommanderLines = _lbrFormatMessageLines_(
    bday.commanderMessages,
    function (item) {
      return (
        (item.callsign || item.fml || "—") +
        " — за " +
        String(item.daysUntil || "?") +
        " дн.\n   " +
        String(item.message || "").replace(/\n/g, "\n   ") +
        (item.link ? "\n   " + item.link : "")
      );
    },
  );
  if (birthdayCommanderLines.length) {
    lines.push("🎂 Дні народження — командиру (" + birthdayCommanderLines.length + "):");
    lines.push.apply(lines, birthdayCommanderLines);
    lines.push("");
  }

  const birthdayPeopleLines = _lbrFormatMessageLines_(
    bday.birthdayMessages,
    function (item) {
      return (
        (item.displayName || item.fml || "—") +
        (item.age ? " (" + Number(item.age) + " р.)" : "") +
        "\n   " +
        String(item.message || "").replace(/\n/g, "\n   ") +
        (item.link ? "\n   " + item.link : "")
      );
    },
  );
  if (birthdayPeopleLines.length) {
    lines.push("🎂 Дні народження — іменинникам (" + birthdayPeopleLines.length + "):");
    lines.push.apply(lines, birthdayPeopleLines);
    lines.push("");
  }

  lines.push(
    "—",
    "Це автоматичний дайджест WASB. WhatsApp-повідомлення відкривайте за посиланнями або через панель WASB.",
  );
  return lines.join("\n");
}

function sendLeaveBirthdayReminderDigestEmail_(vacations, birthdays, options) {
  if (!_lbrShouldSendDigestEmail_(options)) {
    return { sent: false, skipped: true, reason: "email_not_requested" };
  }

  const counts = _lbrReminderCounts_(vacations, birthdays);
  const total =
    counts.vacationSoldiers +
    counts.vacationCommander +
    counts.birthdayCommander +
    counts.birthdayPeople;

  if (total <= 0) {
    return { sent: false, skipped: true, reason: "no_reminders", counts: counts };
  }

  const ownerEmail =
    typeof getWasbOwnerEmail_ === "function" ? getWasbOwnerEmail_() : "";
  const ownerDiag =
    typeof getWasbOwnerEmailDiagnostics_ === "function"
      ? getWasbOwnerEmailDiagnostics_()
      : { ownerEmailConfigured: false, warning: "getWasbOwnerEmailDiagnostics_ недоступний" };

  if (!ownerDiag.ownerEmailConfigured || !ownerEmail) {
    return {
      sent: false,
      skipped: true,
      reason: "owner_email_not_configured",
      warning: ownerDiag.warning || "WASB_OWNER_EMAIL не заданий",
      counts: counts,
    };
  }

  const input = options && typeof options === "object" ? options : {};
  const dateLabel =
    input.dateStr ||
    input.date ||
    Utilities.formatDate(new Date(), getTimeZone_(), "dd.MM.yyyy");
  const subject =
    "WASB: нагадування (" +
    dateLabel +
    ") — відпустки " +
    (counts.vacationSoldiers + counts.vacationCommander) +
    ", ДН " +
    (counts.birthdayCommander + counts.birthdayPeople) +
    ")";
  const body = _lbrBuildDigestBody_(dateLabel, vacations, birthdays);

  try {
    MailApp.sendEmail(ownerEmail, subject, body);
    return {
      sent: true,
      skipped: false,
      recipients: [ownerEmail],
      counts: counts,
      subject: subject,
    };
  } catch (error) {
    return {
      sent: false,
      skipped: false,
      reason: "mail_error",
      error: error && error.message ? error.message : String(error),
      counts: counts,
    };
  }
}

function apiSendLeaveBirthdayReminderDigestTest(options) {
  _stage7AssertRole_("admin", "send leave/birthday reminder digest test");
  const input = Object.assign({ sendEmail: true }, options || {});
  const target =
    DateUtils_.parseUaDate(input.dateStr || input.date) || new Date();
  const vacations = runVacationEngine_(target, input) || {};
  const birthdays = runBirthdayEngine_(target, input) || {};
  const emailResult = sendLeaveBirthdayReminderDigestEmail_(
    vacations,
    birthdays,
    input,
  );
  return _stage7FastResponse_(
    "sendLeaveBirthdayReminderDigestTest",
    emailResult.sent
      ? "Email-дайджест надіслано"
      : "Email-дайджест не надіслано",
    {
      date: Utilities.formatDate(target, getTimeZone_(), "dd.MM.yyyy"),
      emailDigest: emailResult,
      summary: _lbrReminderCounts_(vacations, birthdays),
    },
  );
}
