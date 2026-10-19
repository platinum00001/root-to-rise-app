/*!
 * Root to Rise — reference "may qualify" screener.
 * Pure function, no network, no storage. Works in the browser (window.RootToRiseScreener)
 * and in Node (module.exports). Pass in the parsed eligibility-rules.json.
 *
 *   const results = screen(answers, rules, { date: new Date() });
 *
 * Returns one entry per relevant program:
 *   { program_id, name, category, result: 'may_qualify' | 'might_not_qualify_income' | 'check_with_program',
 *     message, reasons: [..], limit_used: {value, unit, basis, as_of, source_url} | null, next_steps }
 * Programs that don't apply (wrong state, WIC with no pregnancy/child <5, RAFT with no housing crisis)
 * are omitted. NEVER renders a definite "no".
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RootToRiseScreener = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function limitFor(table, size) {
    if (!table || !table.by_household_size) return null;
    var byKey = table.by_household_size;
    if (byKey[String(size)] != null) return Number(byKey[String(size)]);
    var keys = Object.keys(byKey).map(Number).sort(function (a, b) { return a - b; });
    var max = keys[keys.length - 1];
    if (size > max && table.each_additional_person != null) {
      return Number(byKey[String(max)]) + (size - max) * Number(table.each_additional_person);
    }
    return null; // unknown -> caller should return check_with_program
  }

  function monthlyLimit(table, size) {
    var v = limitFor(table, size);
    if (v == null) return null;
    return table.unit === 'USD_per_year' ? v / 12 : v;
  }

  function meta(table, value) {
    if (!table) return null;
    return { value: value, unit: table.unit, basis: table.basis, as_of: table.as_of, source_url: table.source_url };
  }

  function has(list, items) {
    list = list || [];
    for (var i = 0; i < items.length; i++) if (list.indexOf(items[i]) !== -1) return true;
    return false;
  }

  function fplMonthly(rules, size) {
    var a = limitFor(rules.federal_poverty_guidelines_2026, size);
    return a == null ? null : a / 12;
  }

  function normalize(a) {
    var n = {
      state: (a.state || '').toUpperCase(),
      household_size: Math.max(1, parseInt(a.household_size, 10) || 1),
      monthly_gross_income: Math.max(0, Number(a.monthly_gross_income) || 0),
      age: a.age == null || a.age === '' ? null : Number(a.age),
      has_elderly_or_disabled_member: !!a.has_elderly_or_disabled_member,
      has_disability: !!a.has_disability,
      is_pregnant: !!a.is_pregnant,
      expected_babies: Math.max(1, parseInt(a.expected_babies, 10) || 1),
      is_postpartum_or_breastfeeding: !!a.is_postpartum_or_breastfeeding,
      has_child_under_5: !!a.has_child_under_5,
      has_child_under_19: !!a.has_child_under_19 || !!a.has_child_under_5,
      on_medicare: !!a.on_medicare,
      receives: Array.isArray(a.receives) ? a.receives : [],
      housing_crisis: !!a.housing_crisis,
      experiencing_homelessness: !!a.experiencing_homelessness,
      pays_for_heat: a.pays_for_heat || 'not_sure'
    };
    if (n.age != null && n.age >= 60) n.has_elderly_or_disabled_member = true;
    if (n.has_disability) n.has_elderly_or_disabled_member = true;
    if (has(n.receives, ['SSI'])) n.has_elderly_or_disabled_member = true;
    n.size_with_unborn = n.household_size + (n.is_pregnant ? n.expected_babies : 0);
    return n;
  }

  function incomeTest(n, table, size, reasonsIfUnder) {
    var lim = monthlyLimit(table, size);
    if (lim == null) return { result: 'check_with_program', reasons: ['Household size is larger than the published table — ask the program.'], limit: null };
    var ok = n.monthly_gross_income <= lim;
    return { result: ok ? 'may_qualify' : 'might_not_qualify_income', reasons: [ok ? reasonsIfUnder : 'Your monthly income ($' + n.monthly_gross_income.toFixed(0) + ') is above the screening limit of about $' + lim.toFixed(0) + '/month for ' + size + ' people.'], limit: meta(table, Math.round(lim * 100) / 100) };
  }

  var handlers = {
    snap_ma: snap, snap_nh: snap,
    masshealth: function (p, n) {
      var r = p.rules;
      if (has(n.receives, ['Medicaid'])) return { result: 'may_qualify', reasons: ['You already have MassHealth — keep your coverage by renewing on time.'] };
      var tries = [];
      if (n.age != null && n.age >= 65) {
        var s = incomeTest(n, r.seniors_100_plus20, n.household_size, 'Income is within the MassHealth Standard limit for age 65+ (asset limits also apply).');
        if (s.result === 'may_qualify') return s;
        var q = incomeTest(n, r.msp_qi_225_plus20, n.household_size, 'You may qualify for a Medicare Savings Program (help paying Medicare costs).');
        if (q.result !== 'might_not_qualify_income') return q;
        return s;
      }
      if (n.has_disability) return { result: 'may_qualify', reasons: ['MassHealth CommonHealth for people with disabilities has no upper income limit (a premium may apply).'], limit: { value: null, basis: 'No upper income limit', as_of: r.commonhealth_disability.as_of, source_url: r.commonhealth_disability.source_url } };
      if (n.is_pregnant) tries.push(incomeTest(n, r.pregnant_200_plus5, n.size_with_unborn, 'Income is within the MassHealth limit for pregnant people (baby counted in household).'));
      if (n.has_child_under_19) {
        var c = incomeTest(n, r.children_300_plus5, n.size_with_unborn, 'Your children may qualify for MassHealth (children can qualify even if adults do not).');
        tries.push(c);
      }
      if (n.age == null || (n.age >= 19 && n.age < 65)) tries.push(incomeTest(n, r.adult_133_plus5, n.size_with_unborn, 'Income is within the MassHealth adult limit.'));
      if (n.age != null && n.age < 21) tries.push(incomeTest(n, r.under21_150_plus5, n.size_with_unborn, 'Income is within the MassHealth limit for people under 21.'));
      return best(tries, 'Other options: Health Connector plans may lower your costs.');
    },
    nh_medicaid: function (p, n, rules) {
      var r = p.rules;
      if (has(n.receives, ['Medicaid'])) return { result: 'may_qualify', reasons: ['You already have NH Medicaid — keep it by renewing on time.'] };
      if ((n.age != null && n.age >= 65) || n.has_disability || n.on_medicare) {
        return { result: 'check_with_program', reasons: ['NH uses different rules for people 65+, with disabilities, or on Medicare. DHHS can check programs like APTD/OAA and Medicare Savings Programs.'] };
      }
      var five = function (size) { var t = r.five_pct_disregard.by_household_size[String(size)]; if (t != null) return t; var f = fplMonthly(rules, size); return f == null ? 0 : Math.round(f * 0.05); };
      var withFive = function (table, size) {
        var base = limitFor(table, size); if (base == null) return null;
        return { unit: 'USD_per_month', basis: table.basis + ' + 5% FPG disregard', as_of: table.as_of, source_url: table.source_url, by_household_size: (function () { var o = {}; o[String(size)] = base + five(size); return o; })(), each_additional_person: null };
      };
      var tries = [];
      if (n.is_pregnant) tries.push(incomeTest(n, withFive(r.children_pregnant_196, n.size_with_unborn), n.size_with_unborn, 'Income is within the NH Medicaid limit for pregnant women (baby counted).'));
      if (n.has_child_under_19) {
        tries.push(incomeTest(n, withFive(r.children_pregnant_196, n.size_with_unborn), n.size_with_unborn, "Your children may qualify for NH Children's Medicaid."));
        tries.push(incomeTest(n, r.expanded_cm_318, n.size_with_unborn, "Your children may qualify for NH Expanded Children's Medicaid."));
      }
      if ((n.age == null || (n.age >= 19 && n.age < 65)) && !n.is_pregnant) tries.push(incomeTest(n, withFive(r.granite_advantage_133, n.household_size), n.household_size, 'Income is within the Granite Advantage (adult Medicaid) limit.'));
      return best(tries, 'If over income, HealthCare.gov plans may lower your costs.');
    },
    lifeline: function (p, n) {
      var r = p.rules;
      if (has(n.receives, r.categorical_shortcuts[0].if_receives_any)) return { result: 'may_qualify', reasons: ['Someone in your household gets a program (like SNAP, Medicaid, SSI, public housing or VA pension) that qualifies for Lifeline.'] };
      return incomeTest(n, r.income_135, n.household_size, 'Income is at or below 135% of the poverty guidelines.');
    },
    liheap_ma: function (p, n) { return incomeTest(n, p.rules.smi_60_fy2027, n.household_size, 'Income is within the MA fuel assistance (HEAP) limit for the 2026–27 heating season.'); },
    liheap_nh: function (p, n) {
      if (n.pays_for_heat === 'heat_in_rent_subsidized') return { result: 'check_with_program', reasons: ['With heat included in subsidized rent, Fuel Assistance usually does not apply — but you may qualify for the Electric Assistance Program. CAPHR can check.'] };
      var t = incomeTest(n, p.rules.smi_60, n.household_size, 'Income is within the NH Fuel Assistance limit.');
      if (t.result === 'might_not_qualify_income') t.reasons.push('CAPHR recommends applying if you are close — some income is not counted and income can be averaged over the year.');
      return t;
    },
    wic: function (p, n) {
      if (!(n.is_pregnant || n.is_postpartum_or_breastfeeding || n.has_child_under_5)) return null;
      if (has(n.receives, p.rules.categorical_shortcuts[0].if_receives_any)) return { result: 'may_qualify', reasons: ['Getting SNAP, Medicaid/MassHealth, or cash assistance (TANF) usually means you already meet WIC income rules.'] };
      return incomeTest(n, p.rules.income_185, n.size_with_unborn, 'Income is within the WIC limit (185% of poverty).');
    },
    raft_ma: function (p, n) {
      if (!n.housing_crisis) return null;
      return { result: 'check_with_program', reasons: ['RAFT can help with up to $7,000 in 12 months for rent, utilities, moving or mortgage costs when you face a housing emergency. The income limit depends on your town (50% of Area Median Income), so apply or call 211 to check.'] };
    },
    nh_housing_help: function (p, n) {
      if (!(n.housing_crisis || n.experiencing_homelessness)) return null;
      return { result: 'check_with_program', reasons: ['Call Greater Nashua Coordinated Entry (1-844-800-9911) or 211. Every NH town has a welfare office that can help with rent, food, or utilities.'] };
    },
    emergency_shelter: function (p, n) {
      if (!n.experiencing_homelessness) return null;
      return { result: 'check_with_program', reasons: [n.state === 'MA' ? ((n.has_child_under_19 || n.is_pregnant) ? 'Families with children or who are pregnant can apply for MA Emergency Assistance shelter (866-584-0653 or applyhousinghelp.mass.gov).' : 'Call Mass 211 (dial 211, 24/7) for shelter openings on Cape Cod.') : 'Call Greater Nashua Coordinated Entry at 1-844-800-9911 (or 211 after hours).'] };
    },
    food_pantries_meals: function () { return { result: 'may_qualify', reasons: ['Most food pantries and community meals have no income test. Call ahead — hours change.'] }; }
  };

  function snap(p, n, rules, opts) {
    var r = p.rules;
    if (has(n.receives, ['SNAP'])) return { result: 'may_qualify', reasons: ['You already get SNAP — remember to recertify on time.'] };
    if (has(n.receives, r.categorical_shortcuts[0].if_receives_any)) return { result: 'may_qualify', reasons: ['Households getting SSI or cash assistance (TANF) may be automatically income-eligible for SNAP.'] };
    var t = incomeTest(n, r.gross_limit_200, n.household_size, 'Income is under 200% of poverty — the gross income limit most households in ' + n.state + ' must meet.');
    if (t.result === 'might_not_qualify_income' && n.has_elderly_or_disabled_member) {
      return { result: 'check_with_program', reasons: ['Households with someone 60+ or with a disability do not have a gross income limit. Medical and housing costs may be deducted, so apply to find out.'], limit: t.limit };
    }
    return t;
  }

  function best(tries, fallbackNote) {
    tries = tries.filter(Boolean);
    for (var i = 0; i < tries.length; i++) if (tries[i].result === 'may_qualify') return tries[i];
    for (var j = 0; j < tries.length; j++) if (tries[j].result === 'check_with_program') return tries[j];
    var out = tries[0] || { result: 'check_with_program', reasons: [] };
    out.reasons = out.reasons.concat([fallbackNote]);
    return out;
  }

  function screen(answers, rules, opts) {
    opts = opts || {};
    var n = normalize(answers || {});
    if (n.state !== 'MA' && n.state !== 'NH') {
      return [{ program_id: 'out_of_area', name: 'Outside Massachusetts / New Hampshire', category: 'info', result: 'check_with_program',
        message: rules.result_wording.check_with_program, reasons: ['This screener covers MA and NH. Call 211 anywhere in the U.S. for local help.'], limit_used: null, next_steps: null }];
    }
    var out = [];
    rules.programs.forEach(function (p) {
      if (p.states.indexOf(n.state) === -1) return;
      var h = handlers[p.id]; if (!h) return;
      var r = h(p, n, rules, opts);
      if (!r) return;
      var ns = p.next_steps && p.next_steps[n.state] ? p.next_steps[n.state] : p.next_steps;
      out.push({ program_id: p.id, name: p.name, category: p.category, result: r.result,
        message: rules.result_wording[r.result], reasons: r.reasons || [], limit_used: r.limit || null, next_steps: ns });
    });
    var order = { may_qualify: 0, check_with_program: 1, might_not_qualify_income: 2 };
    out.sort(function (a, b) { return order[a.result] - order[b.result]; });
    return out;
  }

  return { screen: screen, limitFor: limitFor, _normalize: normalize };
});
