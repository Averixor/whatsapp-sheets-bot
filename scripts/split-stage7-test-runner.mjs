/**
 * One-off splitter: Stage7TestRunner.gs -> modular attach files.
 * Run: node scripts/split-stage7-test-runner.mjs
 */
import fs from 'fs';
import path from 'path';

import { fileURLToPath } from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcPath = path.join(root, 'Stage7TestRunner.gs');
const lines = fs.readFileSync(srcPath, 'utf8').split(/\r?\n/);

function slice(start1, end1) {
  return lines.slice(start1 - 1, end1).join('\n');
}

const reportingBody = slice(654, 1807);
const sheetBody = slice(1973, 2071);
const uiBody = slice(2073, 2242);
const helpersBody = [
  slice(1880, 1882),
  slice(1923, 1971),
  slice(2244, 2399),
].join('\n');
const apiBody = slice(2419, 2718);

const reportingFns = [
  'normalizeTaskReturn_',
  'isCompatibilityTask_',
  'normalizeCompatibilityStatus_',
  'inferStatus_',
  'inferChecksStatus_',
  'isFailStatus_',
  'isWarnStatus_',
  'isPseudoInfo_',
  'statusToUiGroup_',
  'humanizeReportValue_',
  'compactReportText_',
  'summarizeReportArray_',
  'summarizeReportObject_',
  'normalizeTestResultsDetailsForRun_',
  'detailsJsonCellToHumanText_',
  'detailsObjectToHumanText_',
  'detailsChecksToHumanText_',
  'formatOneCheckLine_',
  'withDetailsTitle_',
  'buildHumanTaskMessageFromRaw_',
  'buildTaskMessage_',
  'buildRecommendation_',
  'finalizeReport_',
  'resultToCheck_',
  'makeSkippedResult_',
];

const sheetFns = [
  'writeReportToSheet_',
  'ensureResultHeader_',
  'getOrCreateSheet_',
  'styleResultsSheet_',
  'styleResultRows_',
];

const uiFns = ['showDialog', 'addMenu', 'installOpenTrigger', 'resetResultsSheet', 'buildDialogHtml_'];

const helperFns = [
  'isTimeoutReached_',
  'getGlobalObject_',
  'collectEnvironment_',
  'buildRunId_',
  'toIso_',
  'safeJson_',
  'getErrorMessage_',
  'getErrorStack_',
  'slugify_',
  'numberGreaterThanZero_',
  'arrayHasItems_',
  'objectHasNonEmptyArrays_',
];

function toCtxAttach(body, fns, header, extraCtxRefs) {
  let out = body.replace(/^\s{2}function ([A-Za-z0-9_]+)\(/gm, '  ctx.$1 = function(');
  const allRefs = [...new Set([...fns, ...(extraCtxRefs || [])])];
  for (const fn of allRefs) {
    const re = new RegExp(`(?<!ctx\\.)\\b${fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\(`, 'g');
    out = out.replace(re, `ctx.${fn}(`);
  }
  out = out.replace(/ctx\.ctx\./g, 'ctx.');
  return `${header}\n\nfunction ${header.includes('Helpers') ? 'stage7TestRunnerAttachHelpers_' : header.includes('Reporting') ? 'stage7TestRunnerAttachReporting_' : header.includes('Sheet') ? 'stage7TestRunnerAttachSheet_' : 'stage7TestRunnerAttachUi_'}(ctx) {\n${out}\n}\n`;
}

const helpersHeader = `/**
 * Stage7TestRunner.Helpers.gs — shared runner utilities (ctx attach).
 */`;

const reportingHeader = `/**
 * Stage7TestRunner.Reporting.gs — task result inference and human-readable reporting.
 */`;

const sheetHeader = `/**
 * Stage7TestRunner.Sheet.gs — TEST_RESULTS sheet IO.
 */`;

const uiHeader = `/**
 * Stage7TestRunner.Ui.gs — menus, dialog, results sheet reset.
 */`;

const apiHeader = `/**
 * Stage7TestRunner.Api.gs — global entrypoints for menus, triggers, and UI alerts.
 */\n`;

fs.writeFileSync(
  path.join(root, 'Stage7TestRunner.Helpers.gs'),
  toCtxAttach(helpersBody, helperFns, helpersHeader, reportingFns.filter((f) => f.startsWith('details') || f === 'humanizeReportValue_')),
);
fs.writeFileSync(
  path.join(root, 'Stage7TestRunner.Reporting.gs'),
  toCtxAttach(reportingBody, reportingFns, reportingHeader, helperFns),
);
fs.writeFileSync(
  path.join(root, 'Stage7TestRunner.Sheet.gs'),
  toCtxAttach(sheetBody, sheetFns, sheetHeader, [
    ...helperFns,
    'compactReportText_',
    'detailsJsonCellToHumanText_',
    'safeJson_',
    'DEFAULT_RESULT_SHEET_NAME',
  ]),
);
fs.writeFileSync(
  path.join(root, 'Stage7TestRunner.Ui.gs'),
  toCtxAttach(uiBody, uiFns, uiHeader, [
    'runFast',
    'normalizeTestResultsDetailsForRun_',
    'DEFAULT_RESULT_SHEET_NAME',
    'getOrCreateSheet_',
    'ensureResultHeader_',
  ]),
);
fs.writeFileSync(path.join(root, 'Stage7TestRunner.Api.gs'), apiHeader + apiBody + '\n');

console.log('Wrote Stage7TestRunner.{Helpers,Reporting,Sheet,Ui,Api}.gs');
