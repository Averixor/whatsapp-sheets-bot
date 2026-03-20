/**
 * DictionaryRepository.gs — доступ до словників, телефонів і профілів.
 */

const DictionaryRepository_ = (function() {
  function getPhonesMap() {
    return loadPhonesMap_();
  }

  function getProfiles() {
    return loadPhonesProfiles_();
  }

  function getDictMap() {
    return loadDictMap_();
  }

  function getSummaryRules() {
    return readDictSum_();
  }

  function getPhoneByRole(role) {
    return findPhoneByRole_(role);
  }

  function getPhoneByFio(fio) {
    if (!fio) return '';
    const phones = getPhonesMap();
    const raw = String(fio || '').trim();
    const norm = normalizeFIO_(raw);
    return phones[raw] || phones[norm] || '';
  }

  function getProfileByCallsign(callsign) {
    const profiles = getProfiles();
    const key = _normCallsignKey_(callsign);
    return (profiles && profiles.byCallsign && profiles.byCallsign[key]) || null;
  }

  function getProfileByFio(fio) {
    const profiles = getProfiles();
    const key = _normFioForProfiles_(fio);
    return (profiles && profiles.byFio && profiles.byFio[key]) || null;
  }

  function getDictEntry(code) {
    const dict = getDictMap();
    return dict[String(code || '').trim()] || null;
  }

  return {
    getPhonesMap: getPhonesMap,
    getProfiles: getProfiles,
    getDictMap: getDictMap,
    getSummaryRules: getSummaryRules,
    getPhoneByRole: getPhoneByRole,
    getPhoneByFio: getPhoneByFio,
    getProfileByCallsign: getProfileByCallsign,
    getProfileByFio: getProfileByFio,
    getDictEntry: getDictEntry
  };
})();