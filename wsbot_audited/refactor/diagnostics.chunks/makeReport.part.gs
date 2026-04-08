function _makeReport_(name) {
  return {
    name: name,
    timestamp: new Date().toISOString(),
    status: 'OK',
    checks: [],
    errors: []
  };
}
