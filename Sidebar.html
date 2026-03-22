<!DOCTYPE html>
<html>

<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <?!= include('Styles'); ?>
  <base target="_top">
</head>

<body>
  <div class="sidebar-container">
    <div class="header">
      <div class="header-content">
        <h1 class="logo"
          style="display: flex; flex-direction: row-reverse; align-items: center; gap: 45px; justify-content: flex-end;">
          <span class="whatsapp-icon">🧑‍💻</span>
          <span>WASB</span>
        </h1>

        <div class="status-badge" id="botMonthStatus">
          <span class="status-dot"></span>
          <span class="status-text">Завантаження...</span>
        </div>
      </div>
    </div>

    <div class="main-content" id="mainContent">
      <div class="menu-section active" id="menuSection">
        <div class="menu-grid">

          <button class="menu-item" onclick="SidebarApp.handleMenuAction('generatePanel')" title="Створити панель відправки на сьогодні">
            <span class="menu-icon">🎲</span><span class="menu-text">Панель відправок</span>
          </button>

          <button id="sendUnsentBtn" class="btn btn" onclick="SidebarApp.handleMenuAction('sendUnsent')" title="Немає невідправлених" disabled>🚀 Невідправлені
          </button>

          <button class="menu-item" onclick="SidebarApp.handleMenuAction('detailedDay')" title="Детальне зведення за день">
            <span class="menu-icon">🪬</span><span class="menu-text">Детальне зведення</span>
          </button>

          <button class="menu-item" onclick="SidebarApp.handleMenuAction('daySummary')" title="Коротке зведення за день">
            <span class="menu-icon">1️⃣</span><span class="menu-text">Зведення дня</span>
          </button>

          <div class="personnel-launch-wrap" style="grid-column: span 2;">
            <button id="btnOpenPersonnelModal" class="btn personnel-launch-btn" type="button">🪖 Особовий склад</button>
          </div>

          <button class="menu-item" onclick="SidebarApp.handleMenuAction('createNextMonth')" title="Створити аркуш наступного місяця">
            <span class="menu-icon">🗓️</span><span class="menu-text">Новий аркуш місяця</span>
          </button>

          <button class="menu-item" onclick="SidebarApp.handleMenuAction('switchMonth')" title="Перемкнути бота на інший місяць">
            <span class="menu-icon">🏃‍♂️‍➡️✈️</span><span class="menu-text">Перемістити бота</span>
          </button>

          <button class="menu-item" onclick="SidebarApp.handleMenuAction('restartBot')" title="Перезапуск бота із очищенням runtime та завислих маркерів">
            <span class="menu-icon">♻️</span><span class="menu-text">Перезапуск бота</span>
          </button>

          <button class="menu-item" onclick="SidebarApp.handleMenuAction('vacationReminder')" title="Перевірити відпустки">
            <span class="menu-icon">🏖️</span><span class="menu-text">Відпустки</span>
          </button>

          <button class="menu-item" onclick="SidebarApp.handleMenuAction('birthdayCheck')" title="Перевірити іменинників">
            <span class="menu-icon">🎂</span><span class="menu-text">Дні народження</span>
          </button>

          <button class="menu-item" onclick="SidebarApp.handleMenuAction('clearCache')" title="Очистити кеш">
            <span class="menu-icon">🧹</span><span class="menu-text">Очистити кеш</span>
          </button>

          <button class="menu-item" onclick="SidebarApp.handleMenuAction('clearLog')" title="Очистити логи">
            <span class="menu-icon">🗑️</span><span class="menu-text">Очистити логи</span>
          </button>

          <div class="menu-divider" style="grid-column: span 2"></div>

          <div class="health-actions" style="grid-column: span 2;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:8px;">

              <button class="btn btn-secondary" onclick="SidebarApp.showPendingRepairs()" style="padding:6px; font-size:0.72rem; grid-column: span 2;">🛠 Потребують виправлення</button>

              <button class="btn btn-secondary" onclick="SidebarApp.runHealthCheck()" style="padding:6px; font-size:0.72rem;">🩺 Перевірка системи</button>

              <button class="btn btn-secondary" onclick="SidebarApp.cleanupTriggers()" style="padding:6px; font-size:0.72rem;">🎏 Перевірка дублів тригерів</button>

              <button class="btn btn-secondary" onclick="SidebarApp.debugPhones()" style="padding:6px; font-size:0.72rem;">📞 Діагностика тел.</button>

              <button class="btn btn-secondary" onclick="SidebarApp.clearPhoneCache()" style="padding:6px; font-size:0.72rem;">🧹 Очистити кеш тел.</button>

              <button class="btn btn-secondary" onclick="SidebarApp.setupTrigger()" style="padding:6px; font-size:0.72rem;">⏰ Створити тригер</button>

              <button class="btn btn-secondary" onclick="SidebarApp.copyHealthReport()" style="padding:6px; font-size:0.72rem;">📋 Копія звіту</button>

            </div>
          </div>
        </div>
      </div>

      <div class="result-section" id="resultSection">
        <div class="result-header">
          <button class="back-button" onclick="SidebarApp.showMenu()" title="Повернутися до меню"><span class="back-icon">↩</span><span>Назад</span></button>
          <h2 id="resultTitle">Результат</h2>
        </div>
        <div class="result-content" id="resultContent"></div>
        <div id="personCardContainer" style="display:none;"></div>
      </div>
    </div>

    <div class="console-wrapper" id="consoleWrapper">
      <button class="console-toggle" id="consoleToggle" onclick="SidebarApp.toggleConsole()" title="Показати/приховати консоль">
        <span class="console-toggle-icon" id="consoleToggleIcon">👾</span><span>Консоль</span><span class="console-toggle-arrow" id="consoleArrow">▼</span>
      </button>
      <div class="console-section" id="consoleSection">
        <div class="console-header">
          <div class="console-title"><span class="console-icon">✓</span><span>Лог виконання</span></div>
          <div class="console-actions">
            <button class="console-btn" onclick="SidebarApp.copyConsole()" title="Скопіювати лог із заголовком, датою та активним місяцем">📋</button>
            <button class="console-btn" onclick="SidebarApp.clearConsole()" title="Очистити консоль">🗑️</button>
            <button class="console-btn" onclick="SidebarApp.scrollConsole('top')" title="Прокрутити вгору">↥</button>
            <button class="console-btn" onclick="SidebarApp.scrollConsole('bottom')" title="Прокрутити вниз">↧</button>
          </div>
        </div>
        <div class="console-content" id="consoleOutput">
          <div class="log-entry log-info"><span class="log-time">[ініціалізація]</span> Консоль готова до роботи</div>
        </div>
      </div>
    </div>

    <div class="loading-overlay" id="loadingOverlay" style="display:none;">
      <div class="spinner"></div>
      <div class="loading-text">Обробка запиту...</div>
    </div>

    <div class="personnel-modal" id="personnelModal" aria-hidden="true">
      <div class="personnel-modal__backdrop" id="personnelModalBackdrop"></div>
      <div class="personnel-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="personnelModalTitle">
        <div class="personnel-modal__header">
          <div class="personnel-modal__title-wrap">
            <div class="personnel-modal__title" id="personnelModalTitle">Особовий склад</div>
            <div class="personnel-modal__subtitle" id="personnelModalCount">Усього: 0</div>
          </div>
          <button class="personnel-modal__close" id="btnClosePersonnelModal" type="button">✕</button>
        </div>
        <div class="personnel-modal__controls"><input id="personnelSearchInput" class="personnel-search" type="text" placeholder="Пошук позивного..." />
        </div>
        <div class="personnel-modal__body">
          <div class="personnel-grid" id="personnelGrid"></div>
          <div class="personnel-empty hidden" id="personnelEmptyState">Нічого не знайдено</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Active bootstrap policy: Sidebar.html loads Stage 7 modular runtime through includeTemplate(JavaScript), and JavaScript.html aggregates Js.* fragments. -->
  <?!= includeTemplate('JavaScript'); ?>

</body>

</html>