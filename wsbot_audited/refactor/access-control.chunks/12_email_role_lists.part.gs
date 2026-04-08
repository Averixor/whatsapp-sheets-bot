  // ==================== EMAIL ROLE LISTS ====================

  function listEmailsByRole(role) {
    const normalizedRole = normalizeRole_(role);
    const entries = _readSheetEntries_();
    return entries
      .filter(e => e.enabled && e.role === normalizedRole)
      .map(e => e.email);
  }

  function listAdminEmails() {
    const entries = _readSheetEntries_();
    return entries
      .filter(e => e.enabled && ['owner', 'sysadmin', 'admin'].includes(e.role))
      .map(e => e.email);
  }

  function listNotificationEmails() {
    const entries = _readSheetEntries_();
    return entries
      .filter(e => e.enabled && ['owner', 'sysadmin', 'admin'].includes(e.role))
      .map(e => e.email);
  }

  function getAccessRowByEmail(email) {
    const normalizedEmail = normalizeEmail_(email);
    if (!normalizedEmail) return null;
    return _findByEmailInSheet_(normalizedEmail, { includeLocked: true, includeDisabled: true });
  }

