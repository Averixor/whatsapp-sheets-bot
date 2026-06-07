#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const repoRoot = path.resolve(import.meta.dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(repoRoot, file), 'utf8');
}

function assertContains(file, pattern, message) {
  assert.match(read(file), pattern, `${file}: ${message}`);
}

function runGasFile(file, context, footer = '') {
  vm.runInContext(read(file) + footer, context, { filename: file });
}

function verifyDarkSelectContract() {
  const css = read('Styles_00_Base.html');
  assert.match(css, /select,\s*\n\s*textarea,\s*\n\s*input\s*\{\s*\n\s*color-scheme:\s*dark;/);
  assert.match(css, /select option,\s*\n\s*select optgroup\s*\{/);
  assert.match(css, /select option:checked\s*\{/);
  assert.match(css, /select option:disabled,\s*\n\s*select optgroup:disabled\s*\{/);
}

function verifyResolverBehavior() {
  const context = vm.createContext({
    CONFIG: { COMMANDER_ROLE: 'COMMANDER' },
    console,
  });

  runGasFile('Stage7PhoneDictPayloadShims.gs', context);

  const phones = {
    COMMANDER: '+380501111111',
    DEPUTY: '+380502222222',
  };
  context.findPhone_ = (query) =>
    phones[String(query?.callsign || query?.role || '').trim()] || '';
  context.normalizePhone_ = (value) => {
    let digits = String(value || '').replace(/\D/g, '');
    if (/^0\d{9}$/.test(digits)) digits = `38${digits}`;
    return /^380\d{9}$/.test(digits) ? `+${digits}` : '';
  };

  const selected = context.resolveMessageRecipient_({
    recipientRole: 'DEPUTY',
  });
  assert.equal(selected.phone, phones.DEPUTY);
  assert.equal(selected.role, 'DEPUTY');
  assert.equal(selected.source, 'selected');

  const fallback = context.resolveMessageRecipient_({});
  assert.equal(fallback.phone, phones.COMMANDER);
  assert.equal(fallback.role, 'COMMANDER');
  assert.equal(fallback.source, 'commander_fallback');

  const manual = context.resolveMessageRecipient_({
    recipientOverride: { phone: '050 333 33 33' },
  });
  assert.equal(manual.phone, '+380503333333');
  assert.equal(manual.source, 'override_phone');

  assert.throws(
    () => context.resolveMessageRecipient_({ recipientRole: 'UNKNOWN' }),
    /not found|не знайдено/i,
  );

  runGasFile('VacationEngine.gs', context);
  const engineRecipient = context._veCommanderRecipient_({
    recipientRole: 'DEPUTY',
  });
  assert.equal(engineRecipient.phone, phones.DEPUTY);
  assert.equal(engineRecipient.role, 'DEPUTY');
}

function verifySummaryRecipientOptions() {
  let capturedOptions = null;
  const context = vm.createContext({
    CONFIG: { COMMANDER_ROLE: 'COMMANDER' },
    console,
    _todayStr_: () => '01.06.2026',
    SummaryRepository_: {
      buildDaySummary: (date) => ({
        date,
        summary: 'Підсумок дня',
        sheet: '06',
      }),
      buildDetailedSummary: (date) => ({
        date,
        summary: 'Детальний підсумок',
        sheet: '06',
      }),
    },
    PreviewLinkService_: {
      buildWaLink: (phone, message) =>
        `https://wa.example/${phone}?text=${encodeURIComponent(message)}`,
    },
    resolveMessageRecipient_: (options) => {
      capturedOptions = { ...options };
      return {
        phone: '+380502222222',
        role: options.recipientRole || 'COMMANDER',
        callsign: options.recipientRole || 'COMMANDER',
        source: options.recipientRole ? 'selected' : 'commander_fallback',
      };
    },
  });

  runGasFile(
    'SummaryService.gs',
    context,
    '\nthis.__SummaryService_ = SummaryService_;',
  );

  const preview = context.__SummaryService_.buildCommanderPreview({
    date: '17.03.2026',
    recipientRole: 'DEPUTY',
  });

  assert.equal(capturedOptions.recipientRole, 'DEPUTY');
  assert.equal(preview.date, '17.03.2026');
  assert.equal(preview.phone, '+380502222222');
  assert.equal(preview.recipient.role, 'DEPUTY');
  assert.match(preview.link, /\+380502222222/);
}

function verifyVacationServiceRecipientForwarding() {
  const engineCalls = [];
  const context = vm.createContext({
    console,
    _todayStr_: () => '01.06.2026',
    getTimeZone_: () => 'Europe/Kyiv',
    Utilities: {
      formatDate: () => '17.03.2026',
    },
    DateUtils_: {
      parseUaDate: (value) =>
        value === '17.03.2026' ? new Date(2026, 2, 17, 12, 0, 0) : null,
    },
    runVacationEngine_: (targetDate, options) => {
      engineCalls.push({ engine: 'vacations', targetDate, options });
      return {
        soldierMessages: [],
        commanderMessages: [
          { type: 'commander_soon_3', recipientRole: options.recipientRole },
        ],
      };
    },
    runBirthdayEngine_: (targetDate, options) => {
      engineCalls.push({ engine: 'birthdays', targetDate, options });
      return {
        commanderMessages: [
          {
            type: 'birthday_commander_notice',
            recipientRole: options.recipientRole,
          },
        ],
        birthdayMessages: [],
      };
    },
    buildBirthdayLink: () => '',
  });

  runGasFile(
    'VacationService.gs',
    context,
    '\nthis.__VacationService_ = VacationService_;',
  );

  const result = context.__VacationService_.check({
    date: '17.03.2026',
    recipientRole: 'DEPUTY',
    recipientMode: 'selected',
  });

  assert.equal(engineCalls.length, 2);
  assert.deepEqual(
    engineCalls.map((call) => call.engine),
    ['vacations', 'birthdays'],
  );
  engineCalls.forEach((call) => {
    assert.equal(call.options.recipientRole, 'DEPUTY');
    assert.equal(call.options.recipientMode, 'selected');
    assert.ok(call.targetDate instanceof Date);
  });
  assert.equal(result.date, '17.03.2026');
  assert.equal(result.summary.vacationCommander, 1);
  assert.equal(result.summary.birthdayCommander, 1);
}

function verifyVacationApiRecipientForwarding() {
  const serviceCalls = [];
  const context = vm.createContext({
    CONFIG: { PHONES_SHEET: 'PHONES' },
    console,
    _todayStr_: () => '01.06.2026',
    getBotMonthSheetName_: () => '06',
    getProjectBundleMetadata_: () => ({ stageVersion: '7' }),
    stage7UniqueId_: (scenario) => `${scenario}_test`,
    validateDatePayload_: (input) => ({
      payload: {
        ...input,
        dateStr: input.dateStr || input.date || '01.06.2026',
      },
      warnings: [],
    }),
    buildServerResponse_: (
      success,
      message,
      error,
      result,
      changes,
      meta,
      trace,
      runtimeContext,
      warnings,
    ) => ({
      success,
      message,
      error,
      warnings: warnings || [],
      context: runtimeContext,
      data: { result, changes: changes || [], meta: meta || {} },
      operationId: meta && meta.operationId,
      affectedSheets: meta && meta.affectedSheets,
    }),
    VacationService_: {
      check: (options) => {
        serviceCalls.push({ ...options });
        return {
          date: options.date,
          vacations: {},
          birthdays: {},
          summary: {},
        };
      },
    },
  });

  runGasFile('Stage7ServerApi.gs', context);

  const response = context.apiCheckVacationsAndBirthdays({
    date: '17.03.2026',
    recipientRole: 'DEPUTY',
    recipientMode: 'selected',
  });

  assert.equal(serviceCalls.length, 1);
  assert.equal(serviceCalls[0].date, '17.03.2026');
  assert.equal(serviceCalls[0].dateStr, '17.03.2026');
  assert.equal(serviceCalls[0].recipientRole, 'DEPUTY');
  assert.equal(serviceCalls[0].recipientMode, 'selected');
  assert.equal(response.success, true);
  assert.equal(response.data.result.date, '17.03.2026');
  assert.deepEqual(response.affectedSheets, ['06', 'PHONES']);
}

function verifyRecipientRoutingContract() {
  assertContains(
    'SidebarServer.gs',
    /function prepareMessageToRecipientSidebar[\s\S]*_requireSidebarAccessGuard_\('assertCanUseWorkingActions'[\s\S]*resolveMessageRecipient_/,
    'prepared recipient links must be guarded and use the shared resolver',
  );
  assertContains(
    'SidebarServer.gs',
    /function _requireSidebarAccessGuard_[\s\S]*Access guard unavailable/,
    'sidebar recipient sends must fail closed when RBAC is unavailable',
  );
  assertContains(
    'SidebarServer.gs',
    /function sendDaySummaryToCommanderSidebar[\s\S]*resolveMessageRecipient_/,
    'day summary must use the shared resolver',
  );
  assertContains(
    'SidebarServer.gs',
    /function sendDetailedToCommanderSidebar[\s\S]*resolveMessageRecipient_/,
    'detailed summary must use the shared resolver',
  );
  assertContains(
    'SummaryService.gs',
    /function buildCommanderPreview[\s\S]*resolveMessageRecipient_/,
    'spreadsheet commander preview must use the shared resolver',
  );
  assertContains(
    'Summaries.gs',
    /function sendDetailedSummaryToCommander[\s\S]*resolveMessageRecipient_/,
    'legacy detailed summary send must use the shared resolver',
  );
  assertContains(
    'VacationEngine.gs',
    /function runVacationEngine_\(targetDate, options\)/,
    'vacation engine must accept recipient options',
  );
  assertContains(
    'VacationEngine.gs',
    /function runBirthdayEngine_\(targetDate, options\)/,
    'birthday engine must accept recipient options',
  );
  assertContains(
    'Js.Api.html',
    /Api\.run\('apiCheckVacationsAndBirthdays', options\)/,
    'client API must send recipient options',
  );
  assertContains(
    'Js.Actions.html',
    /prepareMessageToRecipientSidebar[\s\S]*recipientRole:\s*getSelectedCommanderRecipient_\(\)/,
    'notification send must resolve the currently selected recipient',
  );
  assertContains(
    'Js.Render.Panel.html',
    /renderSelectedRecipientSendButton_\(row\?\.message/,
    'vacation commander messages must use selected-recipient send',
  );
}

verifyDarkSelectContract();
verifyResolverBehavior();
verifySummaryRecipientOptions();
verifyVacationServiceRecipientForwarding();
verifyVacationApiRecipientForwarding();
verifyRecipientRoutingContract();

console.log('verify-recipient-contract: OK (dark selects, selected recipient, guarded fallback)');
