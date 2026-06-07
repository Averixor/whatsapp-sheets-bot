#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const repoRoot = path.resolve(import.meta.dirname, "..");

function read(file) {
  return fs.readFileSync(path.join(repoRoot, file), "utf8");
}

function assertContains(file, pattern, message) {
  assert.match(read(file), pattern, `${file}: ${message}`);
}

function verifyDarkSelectContract() {
  const css = read("Styles_00_Base.html");
  assert.match(
    css,
    /select,\s*\n\s*textarea,\s*\n\s*input\s*\{\s*\n\s*color-scheme:\s*dark;/,
  );
  assert.match(css, /select option,\s*\n\s*select optgroup\s*\{/);
  assert.match(css, /select option:checked\s*\{/);
  assert.match(
    css,
    /select option:disabled,\s*\n\s*select optgroup:disabled\s*\{/,
  );
}

function verifyResolverBehavior() {
  const context = vm.createContext({
    CONFIG: { COMMANDER_ROLE: "COMMANDER" },
    console,
  });

  vm.runInContext(read("Stage7PhoneDictPayloadShims.gs"), context, {
    filename: "Stage7PhoneDictPayloadShims.gs",
  });

  const phones = {
    COMMANDER: "+380501111111",
    DEPUTY: "+380502222222",
  };
  context.findPhone_ = (query) =>
    phones[String(query?.callsign || query?.role || "").trim()] || "";
  context.normalizePhone_ = (value) => {
    let digits = String(value || "").replace(/\D/g, "");
    if (/^0\d{9}$/.test(digits)) digits = `38${digits}`;
    return /^380\d{9}$/.test(digits) ? `+${digits}` : "";
  };

  const selected = context.resolveMessageRecipient_({
    recipientRole: "DEPUTY",
  });
  assert.equal(selected.phone, phones.DEPUTY);
  assert.equal(selected.role, "DEPUTY");
  assert.equal(selected.source, "selected");

  const fallback = context.resolveMessageRecipient_({});
  assert.equal(fallback.phone, phones.COMMANDER);
  assert.equal(fallback.role, "COMMANDER");
  assert.equal(fallback.source, "commander_fallback");

  const manual = context.resolveMessageRecipient_({
    recipientOverride: { phone: "050 333 33 33" },
  });
  assert.equal(manual.phone, "+380503333333");
  assert.equal(manual.source, "override_phone");

  assert.throws(
    () => context.resolveMessageRecipient_({ recipientRole: "UNKNOWN" }),
    /not found|не знайдено/i,
  );

  vm.runInContext(read("VacationEngine.gs"), context, {
    filename: "VacationEngine.gs",
  });
  const engineRecipient = context._veCommanderRecipient_({
    recipientRole: "DEPUTY",
  });
  assert.equal(engineRecipient.phone, phones.DEPUTY);
  assert.equal(engineRecipient.role, "DEPUTY");
}

function verifyRecipientRoutingContract() {
  assertContains(
    "SidebarServer.gs",
    /function prepareMessageToRecipientSidebar[\s\S]*_requireSidebarAccessGuard_\('assertCanUseWorkingActions'[\s\S]*resolveMessageRecipient_/,
    "prepared recipient links must be guarded and use the shared resolver",
  );
  assertContains(
    "SidebarServer.gs",
    /function _requireSidebarAccessGuard_[\s\S]*Access guard unavailable/,
    "sidebar recipient sends must fail closed when RBAC is unavailable",
  );
  assertContains(
    "SidebarServer.gs",
    /function sendDaySummaryToCommanderSidebar[\s\S]*resolveMessageRecipient_/,
    "day summary must use the shared resolver",
  );
  assertContains(
    "SidebarServer.gs",
    /function sendDetailedToCommanderSidebar[\s\S]*resolveMessageRecipient_/,
    "detailed summary must use the shared resolver",
  );
  assertContains(
    "SummaryService.gs",
    /function buildCommanderPreview[\s\S]*resolveMessageRecipient_/,
    "spreadsheet commander preview must use the shared resolver",
  );
  assertContains(
    "Summaries.gs",
    /function sendDetailedSummaryToCommander[\s\S]*resolveMessageRecipient_/,
    "legacy detailed summary send must use the shared resolver",
  );
  assertContains(
    "VacationEngine.gs",
    /function runVacationEngine_\(targetDate, options\)/,
    "vacation engine must accept recipient options",
  );
  assertContains(
    "VacationEngine.gs",
    /function runBirthdayEngine_\(targetDate, options\)/,
    "birthday engine must accept recipient options",
  );
  assertContains(
    "Js.Api.html",
    /Api\.run\(["']apiCheckVacationsAndBirthdays["'], options\)/,
    "client API must send recipient options",
  );
  assertContains(
    "Js.Actions.html",
    /prepareMessageToRecipientSidebar[\s\S]*recipientRole:\s*getSelectedCommanderRecipient_\(\)/,
    "notification send must resolve the currently selected recipient",
  );
  assertContains(
    "Js.Render.Panel.html",
    /renderSelectedRecipientSendButton_\(row\?\.message/,
    "vacation commander messages must use selected-recipient send",
  );
}

verifyDarkSelectContract();
verifyResolverBehavior();
verifyRecipientRoutingContract();

console.log(
  "verify-recipient-contract: OK (dark selects, selected recipient, guarded fallback)",
);
