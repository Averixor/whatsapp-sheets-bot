function debugOpenPersonCardShahtar_() {
  return apiOpenPersonCard('ШАХТАР', '28.04.2026');
}

function debugOpenPersonCardGraf_() {
  return apiOpenPersonCard('ГРАФ', '28.04.2026');
}

function runStage6ADomainTestsManual() {
  var result = runStage6ADomainTests_({ dryRun: true });
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function debugFindPhoneContractManual() {
  var index = {
    byFml: { 'Петренко Іван Іванович': '+380661111111' },
    byNorm: { 'петренко іван іванович': '+380661111111' },
    byRole: { 'ГРАФ': '+380662222222' },
    byCallsign: { 'РОЛАНД': '+380663333333' },
    items: []
  };

  var result = {
    byFml: findPhone_({ fml: 'Петренко Іван Іванович' }, { index: index }),
    byRole: findPhone_({ role: 'ГРАФ' }, { index: index }),
    byCallsign: findPhone_({ callsign: 'роланд' }, { index: index })
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

