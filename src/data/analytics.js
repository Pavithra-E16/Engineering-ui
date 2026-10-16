import { avg, round1 } from '../lib/utils';
const blank = () => ({ present: 0, absent: 0, leave: 0, total: 0, pct: 0 });
/** Approved leave (L) is excluded from the denominator. */
export function attendanceStats(sessions, key = (_s, id) => id) {
  const out = new Map();
  sessions.forEach((s) => {
    for (const [sid, m] of Object.entries(s.marks)) {
      const k = key(s, sid);
      const a = out.get(k) ?? blank();
      if (m === 'P') a.present++;
      else if (m === 'A') a.absent++;
      else a.leave++;
      out.set(k, a);
    }
  });
  out.forEach((a) => {
    a.total = a.present + a.absent;
    a.pct = a.total ? round1((a.present / a.total) * 100) : 0;
  });
  return out;
}
export const overallAttendancePct = (sessions) => {
  let p = 0,
    t = 0;
  sessions.forEach((s) =>
    Object.values(s.marks).forEach((m) => {
      if (m === 'P') {
        p++;
        t++;
      } else if (m === 'A') t++;
    }),
  );
  return t ? round1((p / t) * 100) : 0;
};
/** Weighted result for one course-section using configurable weights and grade rules. */
export function computeResults(assessments, settings) {
  const weights = settings.assessmentWeights;
  const ids = new Set();
  assessments.forEach((a) => a.studentIds.forEach((s) => ids.add(s)));
  const types = Object.keys(weights);
  return [...ids].map((sid) => {
    const components = {};
    let total = 0,
      usedWeight = 0,
      complete = true;
    types.forEach((t) => {
      const list = assessments.filter((a) => a.type === t && a.studentIds.includes(sid));
      const vals = list.map((a) => a.marks[sid]).filter((v) => v !== null && v !== undefined);
      if (!list.length || vals.length < list.length) complete = false;
      if (!vals.length) {
        components[t] = null;
        return;
      }
      const p = avg(list.filter((a) => a.marks[sid] != null).map((a) => (Number(a.marks[sid]) / a.maxMarks) * 100));
      components[t] = round1(p);
      total += (p * weights[t]) / 100;
      usedWeight += weights[t];
    });
    const tot = usedWeight ? round1(total) : null;
    const g = gradeFor(tot ?? 0, settings, complete);
    return {
      studentId: sid,
      components,
      total: tot,
      grade: complete ? g.grade : 'Pending',
      points: complete ? g.points : 0,
      pass: complete && g.points > 0 && (tot ?? 0) >= settings.passMarks,
      complete,
    };
  });
}
/** Normalised internal performance (percent) from whatever has been entered so far. */
export function internalPercent(assessments, sid) {
  const list = assessments.filter((a) => a.type !== 'End Semester Exam' && a.marks[sid] != null);
  if (!list.length) return null;
  return round1(avg(list.map((a) => (Number(a.marks[sid]) / a.maxMarks) * 100)));
}
export function gradeFor(total, settings, _complete = true) {
  const rules = [...settings.gradeRules].sort((a, b) => b.min - a.min);
  return rules.find((r) => total >= r.min) ?? rules[rules.length - 1];
}
/** Direct CO attainment: % students scoring ≥ target in assessments mapped to each CO. */
export function coAttainment(cos, assessments, settings) {
  const { level3, level2, level1 } = settings.attainmentLevels;
  return cos.map((co) => {
    const list = assessments.filter((a) => a.coIds.includes(co.id));
    let hit = 0,
      n = 0;
    list.forEach((a) =>
      Object.values(a.marks).forEach((m) => {
        if (m === null || m === undefined) return;
        n++;
        if ((Number(m) / a.maxMarks) * 100 >= settings.coTargetPercent) hit++;
      }),
    );
    const pctv = n ? round1((hit / n) * 100) : 0;
    const level = !n ? 0 : pctv >= level3 ? 3 : pctv >= level2 ? 2 : pctv >= level1 ? 1 : 0;
    return { coId: co.id, code: co.code, attainedPct: pctv, level, assessed: n };
  });
}
/** PO attainment = Σ(CO level × strength) / Σ strength, per PO. */
export function poAttainment(maps, coAtt) {
  const acc = new Map();
  maps.forEach((m) => {
    const c = coAtt.get(m.coId);
    if (!c || !c.assessed) return;
    const a = acc.get(m.poId) ?? { num: 0, den: 0 };
    a.num += c.level * m.strength;
    a.den += m.strength;
    acc.set(m.poId, a);
  });
  const out = new Map();
  acc.forEach((v, k) => out.set(k, v.den ? Math.round((v.num / v.den) * 100) / 100 : 0));
  return out;
}
/** Transparent, rule-based risk model (explainable; no black box). */
export function studentRisk(students, att, assessments, invoices, settings, extra) {
  const bySid = new Map();
  assessments.forEach((a) => a.studentIds.forEach((s) => (bySid.get(s) ?? bySid.set(s, []).get(s)).push(a)));
  const inv = new Map();
  invoices.forEach((i) => inv.set(i.studentId, i));
  return students
    .map((s) => {
      const factors = [];
      const a = att.get(s.id)?.pct ?? 100;
      const internal = internalPercent(bySid.get(s.id) ?? [], s.id);
      if (a < settings.minAttendance)
        factors.push({ label: 'Low attendance', detail: `${a}% vs ${settings.minAttendance}% required`, weight: a < 65 ? 40 : 28 });
      else if (a < settings.minAttendance + 5) factors.push({ label: 'Attendance near threshold', detail: `${a}%`, weight: 10 });
      if (internal !== null && internal < 40)
        factors.push({ label: 'Poor internal marks', detail: `${internal}% average in internal assessments`, weight: 35 });
      else if (internal !== null && internal < 55)
        factors.push({ label: 'Below-average internal marks', detail: `${internal}% average`, weight: 18 });
      // declining trend: last assessment vs earlier average
      const list = (bySid.get(s.id) ?? []).filter((x) => x.marks[s.id] != null).sort((x, y) => x.date.localeCompare(y.date));
      if (list.length >= 3) {
        const ps = list.map((x) => (Number(x.marks[s.id]) / x.maxMarks) * 100);
        const last = ps[ps.length - 1],
          prev = avg(ps.slice(0, -1));
        if (prev - last > 15)
          factors.push({ label: 'Declining performance', detail: `Latest ${round1(last)}% vs earlier ${round1(prev)}%`, weight: 12 });
      }
      if (s.cgpa !== undefined && s.cgpa < 6) factors.push({ label: 'Low CGPA', detail: `CGPA ${s.cgpa}`, weight: 12 });
      const i = inv.get(s.id);
      if (i && i.status === 'Unpaid')
        factors.push({ label: 'Fee unpaid', detail: `Outstanding ₹${(i.amount - i.paid).toLocaleString('en-IN')}`, weight: 6 });
      const fu = extra?.openFollowUps?.get(s.id) ?? 0;
      if (fu) factors.push({ label: 'Open mentoring follow-up', detail: `${fu} unresolved action item(s)`, weight: 6 });
      const score = Math.min(
        100,
        factors.reduce((t, f) => t + f.weight, 0),
      );
      const level = score >= 45 ? 'High Risk' : score >= 20 ? 'Moderate Risk' : 'Low Risk';
      const actions = [];
      if (factors.some((f) => f.label.includes('attendance'))) actions.push('Mentor meeting on attendance; inform parent; monitor weekly');
      if (factors.some((f) => f.label.includes('internal') || f.label.includes('Declining')))
        actions.push('Enrol in remedial / tutorial sessions for weak courses');
      if (factors.some((f) => f.label.includes('CGPA'))) actions.push('Academic counselling and backlog-clearance plan');
      if (factors.some((f) => f.label.includes('Fee'))) actions.push('Refer to finance office for instalment / scholarship options');
      if (fu) actions.push('Close pending mentoring follow-ups');
      return { student: s, score, level, factors, attendance: a, internal, actions };
    })
    .sort((x, y) => y.score - x.score);
}
