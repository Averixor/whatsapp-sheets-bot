/**
 * Stage7GlobalDependencyAliases.gs
 *
 * Єдиний безпечний шар global aliases для Stage 7 diagnostics / historical checks.
 * Не використовує var / let / const для underscore-alias і не створює повторних оголошень.
 */

(function (root) {
  'use strict';

  function hasGlobal_(name) {
    return Boolean(root && Object.prototype.hasOwnProperty.call(root, name) && root[name]);
  }

  function getGlobal_(name) {
    return hasGlobal_(name) ? root[name] : null;
  }

  function makeMissingAlias_(aliasName, canonicalName) {
    return Object.freeze({
      __compatibilityAlias: true,
      __aliasName: aliasName,
      __canonicalName: canonicalName,

      getStatus: function () {
        return {
          ok: false,
          status: 'MISSING',
          alias: aliasName,
          canonical: canonicalName,
          message: 'Missing global dependency: ' + aliasName
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

  function makeProxyAlias_(aliasName, canonicalName) {
    var canonical = getGlobal_(canonicalName);

    if (!canonical) {
      return makeMissingAlias_(aliasName, canonicalName);
    }

    if (typeof Proxy === 'undefined') {
      return canonical;
    }

    return new Proxy({
      __compatibilityAlias: true,
      __aliasName: aliasName,
      __canonicalName: canonicalName,

      getCanonical: function () {
        return getGlobal_(canonicalName);
      },

      getStatus: function () {
        var current = getGlobal_(canonicalName);

        return {
          ok: Boolean(current),
          status: current ? 'OK' : 'MISSING',
          alias: aliasName,
          canonical: canonicalName,
          type: typeof current,
          keys: current && typeof current === 'object' ? Object.keys(current).sort() : []
        };
      },

      healthCheck: function () {
        return this.getStatus();
      },

      isAvailable: function () {
        return Boolean(getGlobal_(canonicalName));
      }
    }, {
      get: function (target, prop) {
        if (prop in target) {
          return target[prop];
        }

        var current = getGlobal_(canonicalName);

        if (current && prop in current) {
          var value = current[prop];

          if (typeof value === 'function') {
            return function () {
              return value.apply(current, arguments);
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

        var current = getGlobal_(canonicalName);

        return Boolean(current && prop in current);
      },

      ownKeys: function (target) {
        var keys = Object.keys(target);
        var current = getGlobal_(canonicalName);

        if (current && typeof current === 'object') {
          Object.keys(current).forEach(function (key) {
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

        var current = getGlobal_(canonicalName);

        if (current && prop in current) {
          return {
            enumerable: true,
            configurable: true
          };
        }

        return undefined;
      }
    });
  }

  function installAlias_(aliasName, canonicalName) {
    if (hasGlobal_(aliasName)) {
      return;
    }

    root[aliasName] = makeProxyAlias_(aliasName, canonicalName);
  }

  installAlias_('WorkflowOrchestrator_', 'WorkflowOrchestrator');
  installAlias_('SelectionActionService_', 'SelectionActionService');
})(typeof globalThis !== 'undefined' ? globalThis : this);
