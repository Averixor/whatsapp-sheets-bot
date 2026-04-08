function setTestMode(enabled) {
  DIAGNOSTICS.testMode = !!enabled;
  return { success: true, testMode: DIAGNOSTICS.testMode };
}
