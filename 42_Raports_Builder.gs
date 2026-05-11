/** 42_Raports_Builder.gs — складання полів для Google Docs шаблону. */
(function(root) {
  'use strict';

  var NS = root.RaportsModule_ || (root.RaportsModule_ = {});
  var D = NS.Data;

  function pick_(row, field, fallback) {
    if (!row) return fallback || '';
    var v = row[field];
    return D.str(v) || fallback || '';
  }

  function splitPositionLines_(text) {
    text = D.str(text);
    if (!text) return ['', '', ''];
    var limit = 58;
    var words = text.split(/\s+/);
    var lines = ['', '', ''];
    var idx = 0;
    words.forEach(function(word) {
      if (!lines[idx]) lines[idx] = word;
      else if ((lines[idx] + ' ' + word).length <= limit || idx >= 2) lines[idx] += ' ' + word;
      else {
        idx++;
        lines[idx] = word;
      }
    });
    return lines;
  }

  function buildFio_(person) {
    var sur = D.getDictRow(NS.SHEETS.DICT_SURNAMES, person.SUR_KEY, 'прізвища');
    var name = D.getDictRow(NS.SHEETS.DICT_NAMES, person.NAME_KEY, 'імена');
    var patr = D.getDictRow(NS.SHEETS.DICT_PATR, person.PATR_KEY, 'по батькові');

    return {
      n: [pick_(sur, 'B', pick_(sur, 'n_lo')), pick_(name, 'B', pick_(name, 'n_lo')), pick_(patr, 'B', pick_(patr, 'n_lo'))].join(' ').trim(),
      d: [pick_(sur, 'F', pick_(sur, 'd_lo')), pick_(name, 'F', pick_(name, 'd_lo')), pick_(patr, 'F', pick_(patr, 'd_lo'))].join(' ').trim(),
      g: [pick_(sur, 'D', pick_(sur, 'r_lo')), pick_(name, 'D', pick_(name, 'r_lo')), pick_(patr, 'D', pick_(patr, 'r_lo'))].join(' ').trim(),
      s: [pick_(name, 'B', pick_(name, 'n_lo')), pick_(sur, 'C', pick_(sur, 'n_up'))].join(' ').trim(),
      sg: [pick_(name, 'D', pick_(name, 'r_lo')), pick_(sur, 'E', pick_(sur, 'r_up'))].join(' ').trim()
    };
  }

  function buildFields_(vacId, options) {
    options = options || {};
    var vacation = D.getVacation(vacId);
    var person = D.getPerson(vacation.PERSON_ID);
    var fio = buildFio_(person);
    var rank = D.getDictRow(NS.SHEETS.DICT_RANKS, person.RANK_KEY, 'звання');
    var pos = D.getDictRow(NS.SHEETS.DICT_POS, person.POS_KEY, 'посади');
    var osh = D.getDictRow(NS.SHEETS.DICT_OSH, person.OSH_KEY, 'ОШС');

    var pN = pick_(pos, 'n_lo');
    var pD = pick_(pos, 'd_lo');
    var pG = pick_(pos, 'r_lo');
    var oshN = pick_(osh, 'n_lo');
    var oshD = pick_(osh, 'd_lo');
    var oshG = pick_(osh, 'r_lo');
    var fpN = [pN, oshN].join(' ').trim();
    var fpD = [pD, oshD].join(' ').trim();
    var fpG = [pG, oshG].join(' ').trim();
    var lines = splitPositionLines_(fpN);

    return {
      person: person,
      vacation: vacation,
      sign: D.getSign(person),
      fields: {
        fio_n: fio.n,
        fio_d: fio.d,
        fio_g: fio.g,
        fio_s: fio.s,
        fio_sg: fio.sg,
        r_n: pick_(rank, 'n_lo'),
        r_d: pick_(rank, 'd_lo'),
        r_g: pick_(rank, 'r_lo'),
        p_n: pN,
        p_d: pD,
        p_g: pG,
        osh_n: oshN,
        osh_d: oshD,
        osh_g: oshG,
        fp_n: fpN,
        fp_d: fpD,
        fp_g: fpG,
        p1: lines[0],
        p2: lines[1],
        p3: lines[2],
        dd: D.fmtDate(options.documentDate || new Date()),
        ds: D.fmtDate(vacation.DS),
        de: D.fmtDate(vacation.DE),
        vd: D.str(vacation.VD),
        adr: D.str(vacation.ADR),
        tel: D.normalizePhone(person.PHONE),
        num: D.str(vacation.VAC_NUM),
        note: D.str(vacation.NOTE || person.NOTE),
        reason: D.str(options.reason || ''),
        person_id: D.str(person.ID),
        vac_id: D.str(vacation.VAC_ID)
      }
    };
  }

  NS.Builder = {
    buildFields: buildFields_
  };
})(this);
