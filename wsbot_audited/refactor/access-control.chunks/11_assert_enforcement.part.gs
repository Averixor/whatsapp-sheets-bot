  // ==================== ASSERT / ENFORCEMENT ====================

  function assertRoleAtLeast(requiredRole, actionLabel) {
    const descriptor = describe();
    const need = normalizeRole_(requiredRole || 'viewer');
    const currentRole = descriptor.role;
    const currentRoleLevel = ROLE_ORDER[currentRole] || 0;
    const requiredLevel = ROLE_ORDER[need] || 0;

    if (!descriptor.enabled || currentRoleLevel < requiredLevel) {
      Logger.log(`[AccessControl] Role denied: required ${need}, current ${currentRole}, action: ${actionLabel || 'unspecified'}`);

      if (typeof AccessEnforcement_ === 'object' && AccessEnforcement_.reportViolation) {
        AccessEnforcement_.reportViolation('roleDenied', {
          requiredRole: need,
          actionLabel: String(actionLabel || 'ця дія'),
          currentRole: currentRole,
          currentRoleLabel: getRoleLabel_(currentRole),
          locked: descriptor.lockout.locked,
          disabledByAdmin: descriptor.lockout.disabledByAdmin
        }, descriptor);
      }

      if (descriptor.lockout.disabledByAdmin) {
        throw new Error('Користувача вимкнено адміністратором.');
      }

      if (descriptor.lockout.locked) {
        throw new Error(
          'Доступ тимчасово заблоковано.' +
          (descriptor.lockout.remainingMinutes ? ` Залишилось ${descriptor.lockout.remainingMinutes} хв.` : '')
        );
      }

      throw new Error(
        'Недостатньо прав для дії: ' + (actionLabel || 'ця дія') +
        '. Поточна роль: ' + currentRole + '.'
      );
    }

    return descriptor;
  }

