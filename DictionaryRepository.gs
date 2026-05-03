/**
 * DictionaryRepository.gs — доступ до словників, телефонів і профілів.
 */

const DictionaryRepository_ = (function() {
  function getPhonesIndex() {
    return typeof loadPhonesIndex_ === 'function'
      ? loadPhonesIndex_()
      : { byFml: {}, byNorm: {}, byRole: {}, byCallsign: {}, items: [] };
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

  function getPhoneByFml(fml) {
    return findPhone_({ fml: fml });
  }

  function getPhoneByCallsign(callsign) {
    return findPhone_({ callsign: callsign });
  }

  function getProfileByCallsign(callsign) {
    const profiles = getProfiles();
    const key = _normCallsignKey_(callsign);
    return (profiles && profiles.byCallsign && profiles.byCallsign[key]) || null;
  }

  function getProfileByFml(fml) {
    const profiles = getProfiles();
    const key = _normFmlForProfiles_(fml);
    return (profiles && profiles.byFml && profiles.byFml[key]) || null;
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
    getPhoneByFml: getPhoneByFml,
    getPhoneByCallsign: getPhoneByCallsign,
    getProfileByCallsign: getProfileByCallsign,
    getProfileByFml: getProfileByFml,
    getDictEntry: getDictEntry
  };
})();