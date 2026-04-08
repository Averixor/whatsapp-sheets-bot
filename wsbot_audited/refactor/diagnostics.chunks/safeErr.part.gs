function _safeErr_(e) {
  try {
    return String(e && e.message ? e.message : e);
  } catch (_) {
    return 'Невідома помилка';
  }
}

/**
 * healthCheck() — перевірка стану системи
 * Викликається кнопкою "🩺 Перевірити" з сайдбару
 */
/************ HEALTH CHECK ************/
