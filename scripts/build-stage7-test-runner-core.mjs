import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lines = fs.readFileSync(path.join(root, 'Stage7TestRunner.gs'), 'utf8').split('\n');

const header = `/**
 * Stage7TestRunner.gs — orchestration core (suites, tasks, discovery, registry).
 * Reporting / sheet / UI / public API: Stage7TestRunner.{Reporting,Sheet,Ui,Api}.gs
 */

var Stage7TestRunner = (function () {
  var DEFAULT_TIMEOUT_MS = 330000;
  var DEFAULT_RESULT_SHEET_NAME = "TEST_RESULTS";
  var DEFAULT_LOCK_WAIT_MS = 60000;

  var ctx = {
    VERSION: "stage7-project-test-runner-3.2.0-modular",
    DEFAULT_TIMEOUT_MS: DEFAULT_TIMEOUT_MS,
    DEFAULT_RESULT_SHEET_NAME: DEFAULT_RESULT_SHEET_NAME,
    DEFAULT_LOCK_WAIT_MS: DEFAULT_LOCK_WAIT_MS,
  };

  stage7TestRunnerAttachHelpers_(ctx);
  stage7TestRunnerAttachReporting_(ctx);
  stage7TestRunnerAttachSheet_(ctx);

`;

const footer = `
  ctx.runFast = runFast;
  ctx.runSuite_ = runSuite_;
  stage7TestRunnerAttachUi_(ctx);

  return {
    runAll: runAll,
    runAllProjectTests: runAllProjectTests,
    runProjectTestChunk: runProjectTestChunk,
    runFast: runFast,
    runDiagnosticsOnly: runDiagnosticsOnly,
    runHealthOnly: runHealthOnly,
    runAccessOnly: runAccessOnly,
    runDomainOnly: runDomainOnly,
    listTasks: listTasks,
    showDialog: ctx.showDialog,
    addMenu: ctx.addMenu,
    installOpenTrigger: ctx.installOpenTrigger,
    resetResultsSheet: ctx.resetResultsSheet,
  };
})();
`;

const coreBody = [...lines.slice(12, 652), ...lines.slice(1808, 1920)].join('\n');

const ctxRefs = [
  'toIso_',
  'buildRunId_',
  'collectEnvironment_',
  'isTimeoutReached_',
  'getErrorMessage_',
  'getErrorStack_',
  'normalizeOptions_',
  'buildLockFailedReport_',
  'normalizeTaskReturn_',
  'normalizeCompatibilityStatus_',
  'inferStatus_',
  'statusToUiGroup_',
  'buildTaskMessage_',
  'buildRecommendation_',
  'finalizeReport_',
  'resultToCheck_',
  'makeSkippedResult_',
  'writeReportToSheet_',
  'normalizeTestResultsDetailsForRun_',
  'resolveFunction_',
  'getStage7TestRunnerExplicitRegistry_',
  'getGlobalObject_',
];

let body = coreBody;
body = body.replace(/\bVERSION\b/g, 'ctx.VERSION');
for (const fn of ctxRefs) {
  const re = new RegExp(`(?<!ctx\\.)\\b${fn}\\(`, 'g');
  body = body.replace(re, `ctx.${fn}(`);
}
body = body.replace(/ctx\.ctx\./g, 'ctx.');

fs.writeFileSync(path.join(root, 'Stage7TestRunner.gs'), header + body + footer);
console.log('Stage7TestRunner.gs lines:', (header + body + footer).split('\n').length);
