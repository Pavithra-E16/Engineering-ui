import { useMemo, useState } from 'react';
import { AlertTriangle, Pencil, Plus, Printer, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Select, Tabs, useConfirm, useToast } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { useData } from '../../data/store';
import { useScope } from '../../data/scope';
import { labelOf, options } from '../../data/labels';
import { cn } from '../../lib/utils';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const PERIODS = [1, 2, 3, 4, 5, 6];
const TIMES = ['09:00–09:50', '09:50–10:40', '11:00–11:50', '11:50–12:40', '13:30–14:20', '14:20–15:10'];
const COLORS = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5'];

export function findConflicts(slots) {
  const out = [];
  const by = (k, what) => {
    const m = new Map();
    slots.forEach((s) => (m.get(k(s)) ?? m.set(k(s), []).get(k(s))).push(s));
    m.forEach((l) => l.length > 1 && l.forEach((s) => out.push({ slot: s, reason: what })));
  };
  by((s) => `${s.facultyId}|${s.day}|${s.period}`, 'Faculty double-booked');
  by((s) => `${s.roomId}|${s.day}|${s.period}`, 'Room double-booked');
  by((s) => `${s.sectionId}|${s.day}|${s.period}`, 'Section has two classes');
  return out;
}

export default function Timetable() {
  const { db, ayId, can, create, update, remove } = useData();
  const scope = useScope();
  const toast = useToast();
  const confirm = useConfirm();
  const editable = can('timetable', 'edit');
  const slots = useMemo(() => db.timetable.filter((t) => t.academicYearId === ayId && t.active !== false), [db.timetable, ayId]);
  const sections = db.sections.filter(
    (s) => s.academicYearId === ayId && s.active !== false && (!scope.departmentId || s.departmentId === scope.departmentId),
  );
  const facultyList = db.employees.filter(
    (e) => e.category === 'Teaching' && e.departmentId && (!scope.departmentId || e.departmentId === scope.departmentId),
  );
  const rooms = db.rooms.filter((r) => r.type !== 'Exam Hall');
  const [view, setView] = useState(scope.facultyId && !scope.personal ? 'faculty' : 'section');
  const [sectionId, setSectionId] = useState(scope.linkedStudent?.sectionId ?? sections[0]?.id ?? '');
  const [facultyId, setFacultyId] = useState(scope.facultyId ?? facultyList[0]?.id ?? '');
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? '');
  const [form, setForm] = useState(null); // null = closed; { id?, sectionId, day, period, courseId, facultyId, roomId }
  const [err, setErr] = useState('');

  const filtered = slots.filter((s) =>
    view === 'faculty' ? s.facultyId === facultyId : view === 'room' ? s.roomId === roomId : s.sectionId === sectionId,
  );
  const allConflicts = useMemo(() => findConflicts(slots), [slots]);
  const conflictIds = new Set(allConflicts.map((c) => c.slot.id));
  const shownConflicts = view === 'list' ? allConflicts : allConflicts.filter((c) => filtered.some((f) => f.id === c.slot.id));
  const courseIdx = new Map();
  filtered.forEach((s) => !courseIdx.has(s.courseId) && courseIdx.set(s.courseId, courseIdx.size));

  /* ---------- create / edit / delete ---------- */
  const openNew = (day = 'Mon', period = 1) => {
    const secId = view === 'section' ? sectionId : (sections[0]?.id ?? '');
    const sec = db.sections.find((s) => s.id === secId);
    setErr('');
    setForm({
      sectionId: secId,
      day,
      period,
      courseId: '',
      facultyId: view === 'faculty' ? facultyId : '',
      roomId: view === 'room' ? roomId : (sec?.room ?? ''),
    });
  };
  const openEdit = (slot) => {
    setErr('');
    setForm({
      id: slot.id,
      sectionId: slot.sectionId,
      day: slot.day,
      period: slot.period,
      courseId: slot.courseId,
      facultyId: slot.facultyId,
      roomId: slot.roomId,
    });
  };
  const onCellClick = (day, period) => {
    if (!editable || view !== 'section') return;
    const slot = filtered.find((s) => s.day === day && s.period === period);
    if (slot) openEdit(slot);
    else openNew(day, period);
  };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const onCourse = (courseId) => {
    const alloc = db.allocations.find((a) => a.courseId === courseId && a.sectionId === form.sectionId && a.academicYearId === ayId);
    setForm((f) => ({ ...f, courseId, facultyId: alloc?.facultyId ?? f.facultyId }));
  };
  const onSection = (secId) => {
    const sec = db.sections.find((s) => s.id === secId);
    setForm((f) => ({ ...f, sectionId: secId, courseId: '', roomId: f.roomId || sec?.room || '' }));
  };

  const save = async () => {
    const f = form;
    if (!f.sectionId || !f.day || !f.period || !f.courseId || !f.facultyId || !f.roomId) {
      setErr('Section, day, period, course, faculty and room are all required.');
      return;
    }
    const period = Number(f.period);
    const clash = slots.filter((s) => s.id !== f.id && s.day === f.day && s.period === period);
    const sec = clash.find((s) => s.sectionId === f.sectionId);
    const fac = clash.find((s) => s.facultyId === f.facultyId);
    const room = clash.find((s) => s.roomId === f.roomId);
    if (sec)
      return setErr(
        `Conflict: ${labelOf(db, 'sections', f.sectionId)} already has ${labelOf(db, 'courses', sec.courseId)} on ${f.day} period ${period}.`,
      );
    if (fac)
      return setErr(
        `Conflict: ${labelOf(db, 'employees', f.facultyId)} already teaches ${labelOf(db, 'sections', fac.sectionId)} at this time.`,
      );
    if (room)
      return setErr(`Conflict: room ${labelOf(db, 'rooms', f.roomId)} is used by ${labelOf(db, 'sections', room.sectionId)} at this time.`);
    const data = { sectionId: f.sectionId, day: f.day, period, courseId: f.courseId, facultyId: f.facultyId, roomId: f.roomId };
    try {
      if (f.id) await update('timetable', f.id, data, { details: `${f.day} P${period}` });
      else await create('timetable', { ...data, academicYearId: ayId }, { details: `${f.day} P${period}` });
      toast.success(f.id ? 'Class updated.' : 'Class added to the timetable.');
      setForm(null);
    } catch (e) {
      toast.error(e.message);
    }
  };
  const del = async (slot) => {
    const ok = await confirm({
      title: 'Delete class?',
      message: `Remove ${labelOf(db, 'courses', slot.courseId)} (${labelOf(db, 'sections', slot.sectionId)}) on ${slot.day} period ${slot.period} from the timetable?`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await remove('timetable', slot.id, { details: `${slot.day} P${slot.period}` });
      toast.success('Class deleted.');
      setForm(null);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const title =
    view === 'section'
      ? labelOf(db, 'sections', sectionId)
      : view === 'faculty'
        ? labelOf(db, 'employees', facultyId)
        : labelOf(db, 'rooms', roomId);
  const formSection = form && db.sections.find((s) => s.id === form.sectionId);
  const courseOpts = formSection
    ? options(db, 'courses', (c) => c.departmentId === formSection.departmentId && c.semesterNo === formSection.semesterNo)
    : [];

  return (
    <>
      <PageHeader
        title="Timetable Management"
        subtitle="Create, edit and delete weekly classes with faculty, room allocation and conflict detection"
        actions={
          <>
            {editable && (
              <Button icon={Plus} onClick={() => openNew()}>
                Add class
              </Button>
            )}
            <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
              Print
            </Button>
          </>
        }
      />
      {!scope.personal && (
        <Tabs
          tabs={[
            { id: 'section', label: 'By section' },
            { id: 'faculty', label: 'By faculty' },
            { id: 'room', label: 'By room' },
            { id: 'list', label: 'All classes (list)', count: slots.length },
          ]}
          value={view}
          onChange={setView}
        />
      )}

      {view !== 'list' && (
        <div className="filter-bar no-print">
          {view === 'section' && !scope.personal && (
            <Field label="Section" className="w-md">
              <Select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {labelOf(db, 'sections', s.id)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {view === 'faculty' && (
            <Field label="Faculty" className="w-md">
              <Select value={facultyId} onChange={(e) => setFacultyId(e.target.value)} disabled={!!scope.facultyId}>
                {facultyList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {view === 'room' && (
            <Field label="Room" className="w-md">
              <Select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {labelOf(db, 'rooms', r.id)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {editable && (
            <p className="xs muted">
              {view === 'section' ? 'Click an empty cell to add a class. ' : ''}Use the pencil to edit or the bin to delete a class.
            </p>
          )}
        </div>
      )}

      {shownConflicts.length > 0 && (
        <div className="mb-16">
          <Alert tone="warning" title={`${shownConflicts.length} scheduling conflict(s) detected`}>
            {[
              ...new Set(
                shownConflicts.map((c) => `${c.reason}: ${c.slot.day} P${c.slot.period} – ${labelOf(db, 'courses', c.slot.courseId)}`),
              ),
            ]
              .slice(0, 6)
              .map((t) => (
                <div key={t}>{t}</div>
              ))}
          </Alert>
        </div>
      )}

      {view === 'list' ? (
        <DataTable
          title="Timetable classes"
          rows={slots}
          initialSort={{ key: 'section', dir: 'asc' }}
          filters={[
            {
              key: 'section',
              label: 'Section',
              options: sections.map((s) => ({ value: s.id, label: labelOf(db, 'sections', s.id) })),
              match: (r, v) => r.sectionId === v,
            },
            { key: 'day', label: 'Day', options: DAYS.map((d) => ({ value: d, label: d })), match: (r, v) => r.day === v },
            {
              key: 'faculty',
              label: 'Faculty',
              options: facultyList.map((f) => ({ value: f.id, label: f.name })),
              match: (r, v) => r.facultyId === v,
            },
          ]}
          columns={[
            { key: 'section', header: 'Section', value: (r) => labelOf(db, 'sections', r.sectionId) },
            { key: 'day', header: 'Day', value: (r) => `${DAYS.indexOf(r.day)}${r.day}`, render: (r) => r.day },
            { key: 'period', header: 'Period', render: (r) => `P${r.period} · ${TIMES[r.period - 1]}` },
            { key: 'course', header: 'Course', value: (r) => labelOf(db, 'courses', r.courseId) },
            { key: 'faculty', header: 'Faculty', value: (r) => labelOf(db, 'employees', r.facultyId) },
            { key: 'room', header: 'Room', value: (r) => db.rooms.find((x) => x.id === r.roomId)?.code },
            {
              key: 'conflict',
              header: 'Check',
              value: (r) => (conflictIds.has(r.id) ? 'Conflict' : 'OK'),
              render: (r) => <Badge tone={conflictIds.has(r.id) ? 'red' : 'green'}>{conflictIds.has(r.id) ? 'Conflict' : 'OK'}</Badge>,
            },
          ]}
          toolbar={
            editable ? (
              <Button size="sm" icon={Plus} onClick={() => openNew()}>
                Add class
              </Button>
            ) : undefined
          }
          actions={
            editable
              ? (r) => (
                  <>
                    <Button size="sm" variant="ghost" icon={Pencil} title="Edit" onClick={() => openEdit(r)} />
                    <Button size="sm" variant="ghost" icon={Trash2} title="Delete" className="danger" onClick={() => del(r)} />
                  </>
                )
              : undefined
          }
        />
      ) : (
        <Card title={`Weekly timetable · ${title}`} subtitle={`${filtered.length} periods / week`} bodyClass="flush">
          {filtered.length === 0 && !editable ? (
            <EmptyState title="No timetable published yet" />
          ) : (
            <div className="table-wrap">
              <table className="tt">
                <thead>
                  <tr>
                    <th>Day</th>
                    {PERIODS.map((p) => (
                      <th key={p}>
                        P{p}
                        <small>{TIMES[p - 1]}</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map((d) => (
                    <tr key={d}>
                      <td className="day">{d}</td>
                      {PERIODS.map((p) => {
                        const cell = filtered.filter((s) => s.day === d && s.period === p);
                        return (
                          <td
                            key={p}
                            onClick={() => !cell.length && onCellClick(d, p)}
                            className={cn(editable && view === 'section' && !cell.length && 'editable')}
                          >
                            {cell.map((s) => {
                              const c = db.courses.find((x) => x.id === s.courseId);
                              return (
                                <div
                                  key={s.id}
                                  className={cn(
                                    'tt-slot',
                                    COLORS[(courseIdx.get(s.courseId) ?? 0) % COLORS.length],
                                    conflictIds.has(s.id) && 'conflict',
                                  )}
                                >
                                  {editable && (
                                    <span className="tt-actions no-print">
                                      <button
                                        title="Edit class"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openEdit(s);
                                        }}
                                      >
                                        <Pencil />
                                      </button>
                                      <button
                                        title="Delete class"
                                        className="bad"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          del(s);
                                        }}
                                      >
                                        <Trash2 />
                                      </button>
                                    </span>
                                  )}
                                  <p className="strong">{c?.code}</p>
                                  <p className="n" title={c?.name}>
                                    {c?.name}
                                  </p>
                                  <p className="f">
                                    {view === 'section' ? labelOf(db, 'employees', s.facultyId) : labelOf(db, 'sections', s.sectionId)} ·{' '}
                                    {db.rooms.find((r) => r.id === s.roomId)?.code}
                                  </p>
                                  {conflictIds.has(s.id) && <AlertTriangle className="icon-14 text-red" />}
                                </div>
                              );
                            })}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? 'Edit class' : 'Add class'}
        footer={
          <>
            {form?.id && (
              <Button variant="ghost" icon={Trash2} className="left bad" onClick={() => del(slots.find((s) => s.id === form.id))}>
                Delete
              </Button>
            )}
            <Button variant="secondary" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button onClick={save}>{form?.id ? 'Save changes' : 'Add class'}</Button>
          </>
        }
      >
        {form && (
          <div className="stack">
            {err && <Alert tone="error">{err}</Alert>}
            <div className="form-grid">
              <Field label="Section" required className="full">
                <Select value={form.sectionId} onChange={(e) => onSection(e.target.value)}>
                  <option value="">Select…</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {labelOf(db, 'sections', s.id)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Day" required>
                <Select value={form.day} onChange={(e) => set('day', e.target.value)}>
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Period" required>
                <Select value={form.period} onChange={(e) => set('period', Number(e.target.value))}>
                  {PERIODS.map((p) => (
                    <option key={p} value={p}>
                      P{p} · {TIMES[p - 1]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Course" required className="full" hint="Courses of the section's semester">
                <Select value={form.courseId} onChange={(e) => onCourse(e.target.value)}>
                  <option value="">Select…</option>
                  {courseOpts.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Faculty" required hint="Auto-filled from Faculty Allocation">
                <Select value={form.facultyId} onChange={(e) => set('facultyId', e.target.value)}>
                  <option value="">Select…</option>
                  {facultyList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Room" required>
                <Select value={form.roomId} onChange={(e) => set('roomId', e.target.value)}>
                  <option value="">Select…</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {labelOf(db, 'rooms', r.id)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <p className="xs muted">Section, faculty and room availability are checked against the whole timetable before saving.</p>
          </div>
        )}
      </Modal>
    </>
  );
}
