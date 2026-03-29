/**
 * Simple spreadsheet triggers for ACCESS UI helpers.
 */
function onEdit(e) {
  try {
    if (typeof AccessControl_ === 'object' && AccessControl_.handleAccessSheetEdit) {
      AccessControl_.handleAccessSheetEdit(e);
    }
  } catch (error) {
    try { console.error('onEdit ACCESS helper error:', error); } catch (_) {}
  }
}
