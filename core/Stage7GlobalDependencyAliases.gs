/**
 * Stage7GlobalDependencyAliases.gs
 *
 * Safe global dependency aliases for Stage 7 diagnostics and historical checks.
 * This file does not redeclare underscore globals with var / let / const.
 */

(function (root) {
  'use strict';

  function makeMissing_(publicName, sourceName) {
    return Object.freeze({
      __compatibilityAlias: true,
      __missingDependency: true,
      __publicName: publicName,
      __sourceName: sourceName,

      ok: false,
      status: 'MISSING',

      getStatus: function () {
        return {
          ok: false,
          status: 'MISSING',
          publicName: publicName,
          sourceName: sourceName,
          message: 'Missing global dependency: ' + publicName + '.'
        };
      },

      healthCheck: function () {
        return this.getStatus();
      },

      isAvailable: function () {
        return false;
      }
    });
  }

  function resolveWorkflowOrchestrator_() {
    try {
      if (typeof WorkflowOrchestrator_ !== 'undefined' && WorkflowOrchestrator_) {
        return WorkflowOrchestrator_;
      }
    } catch (error) {}

    try {
      if (
        root &&
        Object.prototype.hasOwnProperty.call(root, 'WorkflowOrchestrator_') &&
        root.WorkflowOrchestrator_
      ) {
        return root.WorkflowOrchestrator_;
      }
    } catch (error) {}

    return null;
  }

  function resolveSelectionActionService_() {
    try {
      if (typeof SelectionActionService_ !== 'undefined' && SelectionActionService_) {
        return SelectionActionService_;
      }
    } catch (error) {}

    try {
      if (
        root &&
        Object.prototype.hasOwnProperty.call(root, 'SelectionActionService_') &&
        root.SelectionActionService_
      ) {
        return root.SelectionActionService_;
      }
    } catch (error) {}

    return null;
  }

  function defineLazyAlias_(publicName, sourceName, resolver) {
    try {
      var existingDescriptor = Object.getOwnPropertyDescriptor(root, publicName);

      if (existingDescriptor && existingDescriptor.value) {
        return;
      }

      Object.defineProperty(root, publicName, {
        configurable: true,
        enumerable: true,
        get: function () {
          return resolver() || makeMissing_(publicName, sourceName);
        }
      });
    } catch (error) {
      try {
        root[publicName] = resolver() || makeMissing_(publicName, sourceName);
      } catch (ignored) {}
    }
  }

  function exposeUnderscoreValueIfAlreadyLoaded_(publicName, resolver) {
    try {
      var value = resolver();

      if (value && root && !Object.prototype.hasOwnProperty.call(root, publicName)) {
        Object.defineProperty(root, publicName, {
          configurable: true,
          enumerable: true,
          value: value
        });
      }
    } catch (error) {}
  }

  defineLazyAlias_('WorkflowOrchestrator', 'WorkflowOrchestrator_', resolveWorkflowOrchestrator_);
  defineLazyAlias_('SelectionActionService', 'SelectionActionService_', resolveSelectionActionService_);

  exposeUnderscoreValueIfAlreadyLoaded_('SelectionActionService_', resolveSelectionActionService_);
  exposeUnderscoreValueIfAlreadyLoaded_('WorkflowOrchestrator_', resolveWorkflowOrchestrator_);
})(typeof globalThis !== 'undefined' ? globalThis : this);
