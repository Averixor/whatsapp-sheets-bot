  // ==================== ACCESS POLICY ====================

  function _getAccessPolicy_() {
    if (_policyCache) return Object.assign({}, _policyCache);

    const entries = _readSheetEntries_();
    const hasAdminConfigured = entries.some(function(e) { return e.enabled && ['admin', 'sysadmin', 'owner'].includes(e.role); });
    const migrationModeEnabled = parseBoolean_(_getProperties_().getProperty(MIGRATION_EMAIL_BRIDGE_PROP), false);
    const accessSheetPresent = !!_getSheet_(false);

    _policyCache = {
      mode: migrationModeEnabled ? 'user-key+email-bridge' : 'strict-user-key',
      strictUserKeyMode: !migrationModeEnabled,
      migrationModeEnabled: migrationModeEnabled,
      allowEmailBridge: migrationModeEnabled,
      allowScriptPropertiesFallback: false,
      bootstrapAllowed: !hasAdminConfigured && (accessSheetPresent ? entries.length === 0 : true),
      adminConfigured: hasAdminConfigured,
      accessSheetPresent: accessSheetPresent,
      registeredKeysCount: entries.filter(function(e) { return e.userKeyCurrentHash || e.userKeyPrevHash; }).length
    };

    return Object.assign({}, _policyCache);
  }

