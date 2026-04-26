/**
 * WorkflowOrchestrator.Alias.gs
 *
 * Єдиний compatibility alias для historical / diagnostics checks,
 * які очікують глобальний об'єкт WorkflowOrchestrator_.
 *
 * Важливо:
 * - не використовує var / let / const WorkflowOrchestrator_;
 * - не створює повторне оголошення імені;
 * - canonical object лишається WorkflowOrchestrator;
 * - alias підключається через globalThis.WorkflowOrchestrator_.
 */

(function (root) {
  'use strict';

  var ALIAS_NAME = 'WorkflowOrchestrator_';
  var CANONICAL_NAME = 'WorkflowOrchestrator';

  function getCanonical_() {
    if (typeof WorkflowOrchestrator !== 'undefined' && WorkflowOrchestrator) {
      return WorkflowOrchestrator;
    }

    return null;
  }

  function listCanonicalKeys_() {
    var canonical = getCanonical_();

    if (!canonical || typeof canonical !== 'object') {
      return [];
    }

    try {
      return Object.keys(canonical).sort();
    } catch (error) {
      return [];
    }
  }

  function getCanonicalStatus_() {
    var canonical = getCanonical_();

    if (!canonical) {
      return {
        ok: false,
        status: 'MISSING',
        alias: ALIAS_NAME,
        canonical: CANONICAL_NAME,
        message: 'Missing global dependency: WorkflowOrchestrator.'
      };
    }

    return {
      ok: true,
      status: 'OK',
      alias: ALIAS_NAME,
      canonical: CANONICAL_NAME,
      type: typeof canonical,
      keys: listCanonicalKeys_()
    };
  }

  function hasCanonicalMethod_(methodName) {
    var canonical = getCanonical_();

    return Boolean(
      canonical &&
      methodName &&
      typeof canonical[methodName] === 'function'
    );
  }

  function callCanonical_(methodName, argsLike) {
    var canonical = getCanonical_();

    if (!canonical) {
      throw new Error('Missing global dependency: WorkflowOrchestrator.');
    }

    if (!methodName || typeof canonical[methodName] !== 'function') {
      throw new Error('WorkflowOrchestrator method is not available: ' + String(methodName || 'unknown'));
    }

    return canonical[methodName].apply(canonical, Array.prototype.slice.call(argsLike || []));
  }

  function callFirstAvailable_(methodNames, argsLike) {
    var canonical = getCanonical_();

    if (!canonical) {
      throw new Error('Missing global dependency: WorkflowOrchestrator.');
    }

    for (var i = 0; i < methodNames.length; i += 1) {
      var methodName = methodNames[i];

      if (typeof canonical[methodName] === 'function') {
        return canonical[methodName].apply(canonical, Array.prototype.slice.call(argsLike || []));
      }
    }

    throw new Error('WorkflowOrchestrator has none of required methods: ' + methodNames.join(', '));
  }

  var alias = {
    __compatibilityAlias: true,
    __aliasName: ALIAS_NAME,
    __canonicalName: CANONICAL_NAME,

    getCanonical: function () {
      return getCanonical_();
    },

    getStatus: function () {
      return getCanonicalStatus_();
    },

    healthCheck: function () {
      return getCanonicalStatus_();
    },

    isAvailable: function () {
      return Boolean(getCanonical_());
    },

    hasMethod: function (methodName) {
      return hasCanonicalMethod_(methodName);
    },

    listMethods: function () {
      return listCanonicalKeys_();
    },

    call: function (methodName) {
      var args = Array.prototype.slice.call(arguments, 1);
      return callCanonical_(methodName, args);
    },

    invoke: function (methodName) {
      var args = Array.prototype.slice.call(arguments, 1);
      return callCanonical_(methodName, args);
    },

    run: function () {
      return callFirstAvailable_([
        'run',
        'runScenario',
        'execute',
        'runMaintenanceScenario'
      ], arguments);
    },

    execute: function () {
      return callFirstAvailable_([
        'execute',
        'run',
        'runScenario',
        'runMaintenanceScenario'
      ], arguments);
    },

    runScenario: function () {
      return callFirstAvailable_([
        'runScenario',
        'run',
        'execute',
        'runMaintenanceScenario'
      ], arguments);
    },

    runMaintenanceScenario: function () {
      return callFirstAvailable_([
        'runMaintenanceScenario',
        'runScenario',
        'run',
        'execute'
      ], arguments);
    },

    runJob: function () {
      return callFirstAvailable_([
        'runJob',
        'runStage7Job',
        'run',
        'execute'
      ], arguments);
    },

    installJobs: function () {
      return callFirstAvailable_([
        'installJobs',
        'installStage7Jobs',
        'setupJobs',
        'run'
      ], arguments);
    },

    listJobs: function () {
      return callFirstAvailable_([
        'listJobs',
        'listStage7Jobs',
        'getJobs'
      ], arguments);
    },

    listRuntime: function () {
      return callFirstAvailable_([
        'listRuntime',
        'listJobRuntime',
        'getRuntime',
        'getStatus'
      ], arguments);
    },

    listPendingRepairs: function () {
      return callFirstAvailable_([
        'listPendingRepairs',
        'getPendingRepairs',
        'listRepairs'
      ], arguments);
    },

    getOperationDetails: function () {
      return callFirstAvailable_([
        'getOperationDetails',
        'getOperation',
        'operationDetails'
      ], arguments);
    },

    runRepair: function () {
      return callFirstAvailable_([
        'runRepair',
        'repair',
        'runMaintenanceScenario',
        'runScenario',
        'run'
      ], arguments);
    },

    runLifecycleRetentionCleanup: function () {
      return callFirstAvailable_([
        'runLifecycleRetentionCleanup',
        'cleanupLifecycleRetention',
        'runMaintenanceScenario',
        'runScenario',
        'run'
      ], arguments);
    },

    clearCache: function () {
      return callFirstAvailable_([
        'clearCache',
        'runClearCache',
        'runMaintenanceScenario',
        'runScenario',
        'run'
      ], arguments);
    },

    clearLog: function () {
      return callFirstAvailable_([
        'clearLog',
        'runClearLog',
        'runMaintenanceScenario',
        'runScenario',
        'run'
      ], arguments);
    },

    clearPhoneCache: function () {
      return callFirstAvailable_([
        'clearPhoneCache',
        'runClearPhoneCache',
        'runMaintenanceScenario',
        'runScenario',
        'run'
      ], arguments);
    },

    restartBot: function () {
      return callFirstAvailable_([
        'restartBot',
        'restart',
        'runMaintenanceScenario',
        'runScenario',
        'run'
      ], arguments);
    },

    setupVacationTriggers: function () {
      return callFirstAvailable_([
        'setupVacationTriggers',
        'installVacationTriggers',
        'runMaintenanceScenario',
        'runScenario',
        'run'
      ], arguments);
    },

    cleanupDuplicateTriggers: function () {
      return callFirstAvailable_([
        'cleanupDuplicateTriggers',
        'cleanupTriggers',
        'runMaintenanceScenario',
        'runScenario',
        'run'
      ], arguments);
    },

    debugPhones: function () {
      return callFirstAvailable_([
        'debugPhones',
        'runDebugPhones',
        'runMaintenanceScenario',
        'runScenario',
        'run'
      ], arguments);
    },

    buildBirthdayLink: function () {
      return callFirstAvailable_([
        'buildBirthdayLink',
        'makeBirthdayLink',
        'runMaintenanceScenario',
        'runScenario',
        'run'
      ], arguments);
    },

    fallbackResult: function (methodName) {
      return {
        ok: false,
        status: 'MISSING_METHOD',
        alias: ALIAS_NAME,
        canonical: CANONICAL_NAME,
        method: methodName || 'unknown',
        message: 'WorkflowOrchestrator method is not available: ' + String(methodName || 'unknown')
      };
    }
  };

  if (typeof Proxy !== 'undefined') {
    root[ALIAS_NAME] = new Proxy(alias, {
      get: function (target, prop) {
        if (prop in target) {
          return target[prop];
        }

        var canonical = getCanonical_();

        if (canonical && prop in canonical) {
          var value = canonical[prop];

          if (typeof value === 'function') {
            return function () {
              return value.apply(canonical, arguments);
            };
          }

          return value;
        }

        return undefined;
      },

      has: function (target, prop) {
        if (prop in target) {
          return true;
        }

        var canonical = getCanonical_();

        return Boolean(canonical && prop in canonical);
      },

      ownKeys: function (target) {
        var keys = Object.keys(target);
        var canonical = getCanonical_();

        if (canonical && typeof canonical === 'object') {
          Object.keys(canonical).forEach(function (key) {
            if (keys.indexOf(key) === -1) {
              keys.push(key);
            }
          });
        }

        return keys;
      },

      getOwnPropertyDescriptor: function (target, prop) {
        if (prop in target) {
          return {
            enumerable: true,
            configurable: true
          };
        }

        var canonical = getCanonical_();

        if (canonical && prop in canonical) {
          return {
            enumerable: true,
            configurable: true
          };
        }

        return undefined;
      }
    });

    return;
  }

  root[ALIAS_NAME] = alias;
})(typeof globalThis !== 'undefined' ? globalThis : this);
