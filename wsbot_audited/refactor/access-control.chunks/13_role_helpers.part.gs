  // ==================== ROLE HELPERS ====================

  function getRoleMeta_(role) {
    return ROLE_METADATA[normalizeRole_(role)] || ROLE_METADATA.guest;
  }

  function getRoleLabel_(role) {
    return getRoleMeta_(role).label;
  }

  function getRoleNoteTemplate_(role) {
    return getRoleMeta_(role).note;
  }

  function listAllowedActionsForRole_(role) {
    switch (normalizeRole_(role)) {
      case 'guest': return ['безпечний перегляд'];
      case 'viewer': return ['власна картка'];
      case 'operator': return ['усі картки', 'коротке зведення', 'детальне зведення'];
      case 'maintainer': return ['усі дії operator', 'SEND_PANEL', 'робочі дії', 'діагностика'];
      case 'admin': return ['усі дії maintainer', 'керування ACCESS', 'журнали порушень'];
      case 'sysadmin': return ['усі дії admin', 'repair', 'protections', 'triggers'];
      case 'owner': return ['повний доступ до всієї системи'];
      default: return ['безпечний перегляд'];
    }
  }

