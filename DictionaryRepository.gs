/**
 * DictionaryRepository.gs — доступ до словників, телефонів і профілів.
 */

const DictionaryRepository_ = (function() {
  function getPhonesIndex() {
    return typeof loadPhonesIndex_ === 'function'
      ? loadPhonesIndex_()
      : { byFio: {}, byNorm: {}, byRole: {}, byCallsign: {}, items: [] };
  }

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
    return findPhone_({ role: role });
  }

  function getPhoneByFio(fio) {
    return findPhone_({ fio: fio });
  }

  function getPhoneByCallsign(callsign) {
    return findPhone_({ callsign: callsign });
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
    getPhonesIndex: getPhonesIndex,
    getPhonesMap: getPhonesMap,
    getProfiles: getProfiles,
    getDictMap: getDictMap,
    getSummaryRules: getSummaryRules,
    getPhoneByRole: getPhoneByRole,
    getPhoneByFio: getPhoneByFio,
    getPhoneByCallsign: getPhoneByCallsign,
    getProfileByCallsign: getProfileByCallsign,
    getProfileByFio: getProfileByFio,
    getDictEntry: getDictEntry
  };
})();