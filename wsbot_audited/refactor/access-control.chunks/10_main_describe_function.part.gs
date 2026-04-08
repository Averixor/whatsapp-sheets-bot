  // ==================== MAIN DESCRIBE FUNCTION ====================

  function describe(emailOrOptions, maybeOptions) {
    const opts = (emailOrOptions && typeof emailOrOptions === 'object' && !Array.isArray(emailOrOptions))
      ? Object.assign({}, emailOrOptions)
      : Object.assign({}, maybeOptions || {});
    const email = (emailOrOptions && typeof emailOrOptions === 'object' && !Array.isArray(emailOrOptions))
      ? ''
      : emailOrOptions;

    const currentKeyHash = getCurrentUserKeyHash_();
    const sessionEmail = normalizeEmail_(email) || safeGetUserEmail_();
    const context = {
      currentKeyHash: currentKeyHash,
      sessionEmail: sessionEmail,
      keyAvailable: !!currentKeyHash,
      emailAvailable: !!sessionEmail
    };

    const policy = _getAccessPolicy_();
    const descriptor = _resolveAccessSubjectReadOnly_(context);

    return _buildPublicAccessResponse_(descriptor, context, policy, opts);
  }

  function _resolveEntryForAccessFailure_(context) {
    if (context.currentKeyHash) {
      const byKey = _findByUserKey_(context.currentKeyHash, { includeLocked: true, includeDisabled: true });
      if (byKey) return byKey;
    }
    if (context.sessionEmail) {
      const byEmail = _findByEmailInSheet_(context.sessionEmail, { includeLocked: true, includeDisabled: true });
      if (byEmail) return byEmail;
    }
    return null;
  }

