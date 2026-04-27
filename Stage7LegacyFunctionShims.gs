/**
 * Stage7LegacyFunctionShims.gs
 *
 * Thin compatibility shims for old diagnostics/basic checks.
 * Do not put business logic here. Canonical implementation stays in Stage7UseCases_,
 * Stage7ServerApi.gs, repositories and services.
 */

(function registerStage7LegacyFunctionShims_(root) {
  root = root || this;

  function unwrapStage7Response_(response) {
    if (!response) return response;

    if (response.data && response.data.result !== undefined) {
      return response.data.result;
    }

    if (response.result !== undefined) {
      return response.result;
    }

    if (response.data !== undefined) {
      return response.data;
    }

    return response;
  }

  function safeDate_(dateStr) {
    try {
      return String(dateStr || '').trim() || (typeof _todayStr_ === 'function' ? _todayStr_() : '');
    } catch (e) {
      return String(dateStr || '').trim();
    }
  }

  function safeRows_(rowNumbers) {
    if (Array.isArray(rowNumbers)) {
      return rowNumbers
        .map(function(value) { return Number(value); })
        .filter(function(value) { return Number.isFinite(value) && value > 0; });
    }

    if (rowNumbers === null || rowNumbers === undefined || rowNumbers === '') {
      return [];
    }

    var one = Number(rowNumbers);
    return Number.isFinite(one) && one > 0 ? [one] : [];
  }

  function buildPlainMessage_(params) {
    params = params || {};

    var reportDate = String(params.reportDate || params.date || params.dateStr || '').trim();
    var service = String(params.service || params.label || params.status || '').trim();
    var place = String(params.place || params.location || '').trim();
    var tasks = String(params.tasks || params.task || params.message || '').trim();
    var brDays = params.brDays === undefined || params.brDays === null ? '' : String(params.brDays).trim();

    var lines = [];

    if (reportDate) lines.push('Дата: ' + reportDate);
    if (service) lines.push('Вид служби: ' + service);
    if (place) lines.push('Місце: ' + place);
    if (tasks) lines.push('Завдання: ' + tasks);
    if (brDays && brDays !== '0') lines.push('БР: ' + brDays);

    if (!lines.length) {
      return 'Дані відсутні.';
    }

    return lines.join('\n');
  }

  if (typeof root.getDaySummaryByDate !== 'function') {
    root.getDaySummaryByDate = function getDaySummaryByDate(dateStr) {
      var date = safeDate_(dateStr);

      if (typeof apiBuildDaySummary === 'function') {
        return unwrapStage7Response_(apiBuildDaySummary(date));
      }

      if (typeof Stage7UseCases_ === 'object' && Stage7UseCases_ && typeof Stage7UseCases_.buildDaySummary === 'function') {
        return unwrapStage7Response_(Stage7UseCases_.buildDaySummary({ date: date }));
      }

      if (typeof SummaryRepository_ === 'object' && SummaryRepository_ && typeof SummaryRepository_.buildDaySummary === 'function') {
        return SummaryRepository_.buildDaySummary(date);
      }

      throw new Error('getDaySummaryByDate: canonical summary API не знайдено');
    };
  }

  if (typeof root.getDetailedDaySummaryByDate !== 'function') {
    root.getDetailedDaySummaryByDate = function getDetailedDaySummaryByDate(dateStr) {
      var date = safeDate_(dateStr);

      if (typeof apiBuildDetailedSummary === 'function') {
        return unwrapStage7Response_(apiBuildDetailedSummary(date));
      }

      if (typeof Stage7UseCases_ === 'object' && Stage7UseCases_ && typeof Stage7UseCases_.buildDetailedSummary === 'function') {
        return unwrapStage7Response_(Stage7UseCases_.buildDetailedSummary({ date: date }));
      }

      if (typeof SummaryRepository_ === 'object' && SummaryRepository_ && typeof SummaryRepository_.buildDetailedSummary === 'function') {
        return SummaryRepository_.buildDetailedSummary(date);
      }

      throw new Error('getDetailedDaySummaryByDate: canonical detailed summary API не знайдено');
    };
  }

  if (typeof root.getPersonCardData !== 'function') {
    root.getPersonCardData = function getPersonCardData(callsignOrOptions, dateStr) {
      var payload = (callsignOrOptions && typeof callsignOrOptions === 'object')
        ? Object.assign({}, callsignOrOptions)
        : { callsign: String(callsignOrOptions || '').trim(), date: safeDate_(dateStr) };

      if (typeof apiOpenPersonCard === 'function') {
        return unwrapStage7Response_(apiOpenPersonCard(payload.callsign || payload.fml || '', payload.date || payload.dateStr || safeDate_()));
      }

      if (typeof Stage7UseCases_ === 'object' && Stage7UseCases_ && typeof Stage7UseCases_.openPersonCard === 'function') {
        return unwrapStage7Response_(Stage7UseCases_.openPersonCard(payload));
      }

      if (typeof PersonsRepository_ === 'object' && PersonsRepository_ && typeof PersonsRepository_.getPersonByCallsign === 'function') {
        return PersonsRepository_.getPersonByCallsign(payload.callsign || payload.fml || '', payload.date || payload.dateStr || safeDate_());
      }

      throw new Error('getPersonCardData: canonical person-card API не знайдено');
    };
  }

  if (typeof root._buildPersonCardData_ !== 'function') {
    root._buildPersonCardData_ = function _buildPersonCardData_(callsignOrOptions, dateStr) {
      return root.getPersonCardData(callsignOrOptions, dateStr);
    };
  }

  if (typeof root.generateSendPanelSidebar !== 'function') {
    root.generateSendPanelSidebar = function generateSendPanelSidebar(optionsOrDate) {
      var payload = (optionsOrDate && typeof optionsOrDate === 'object')
        ? Object.assign({}, optionsOrDate)
        : { date: safeDate_(optionsOrDate) };

      if (typeof apiGenerateSendPanelForDate === 'function') {
        return apiGenerateSendPanelForDate(payload);
      }

      if (typeof Stage7UseCases_ === 'object' && Stage7UseCases_ && typeof Stage7UseCases_.generateSendPanelForDate === 'function') {
        return Stage7UseCases_.generateSendPanelForDate(payload);
      }

      if (typeof SendPanelRepository_ === 'object' && SendPanelRepository_ && typeof SendPanelRepository_.rebuild === 'function') {
        return SendPanelRepository_.rebuild(payload.date || payload.dateStr || safeDate_());
      }

      throw new Error('generateSendPanelSidebar: canonical send-panel API не знайдено');
    };
  }

  if (typeof root.markMultipleAsSentFromSidebar !== 'function') {
    root.markMultipleAsSentFromSidebar = function markMultipleAsSentFromSidebar(rowNumbers, options) {
      var rows = safeRows_(rowNumbers);
      var opts = options || {};

      if (!rows.length) {
        return {
          success: true,
          updatedRows: [],
          message: 'Не передано рядків для позначення'
        };
      }

      if (typeof apiMarkPanelRowsAsSent === 'function') {
        return apiMarkPanelRowsAsSent(rows, opts);
      }

      if (typeof Stage7UseCases_ === 'object' && Stage7UseCases_ && typeof Stage7UseCases_.markPanelRowsAsSent === 'function') {
        return Stage7UseCases_.markPanelRowsAsSent(rows, opts);
      }

      if (typeof SendPanelRepository_ === 'object' && SendPanelRepository_ && typeof SendPanelRepository_.markRowsAsSent === 'function') {
        return SendPanelRepository_.markRowsAsSent(rows, opts);
      }

      throw new Error('markMultipleAsSentFromSidebar: canonical mark-sent API не знайдено');
    };
  }

  if (typeof root.buildMessage_ !== 'function') {
    root.buildMessage_ = function buildMessage_(params) {
      return buildPlainMessage_(params || {});
    };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);