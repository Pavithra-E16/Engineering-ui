import { useMemo, useState } from 'react';
import { FileBarChart, ChevronRight } from 'lucide-react';
import { useData } from '../data/store';
import { useScope } from '../data/scope';
import { attendanceStats, computeResults, overallAttendancePct } from '../data/analytics';
import { labelOf } from '../data/labels';
import { DataTable } from '../components/DataTable';
import { Card, EmptyState, PageHeader } from '../components/ui';
import { avg, cn, fmtMoney, pct, round1, sum, todayISO } from '../lib/utils';
const REPORTS = [
  {
    id: 'strength',
    title: 'Student strength',
    description: 'Active students by department, program and semester',
    module: 'academic-structure',
    build: (db, { scope }) => {
      const rows = [];
      db.sections
        .filter(
          (s) =>
            s.academicYearId === db.settings[0].currentAcademicYearId && (!scope.departmentId || s.departmentId === scope.departmentId),
        )
        .forEach((s) => {
          const st = db.students.filter((x) => x.sectionId === s.id && x.active !== false);
          rows.push({
            id: s.id,
            dept: labelOf(db, 'departments', s.departmentId),
            program: labelOf(db, 'programs', s.programId),
            sem: s.semesterNo,
            section: s.name,
            total: st.length,
            male: st.filter((x) => x.gender === 'Male').length,
            female: st.filter((x) => x.gender === 'Female').length,
          });
        });
      return {
        rows,
        columns: [
          { key: 'dept', header: 'Department' },
          { key: 'program', header: 'Program' },
          { key: 'sem', header: 'Semester' },
          { key: 'section', header: 'Section' },
          { key: 'male', header: 'Male' },
          { key: 'female', header: 'Female' },
          { key: 'total', header: 'Total' },
        ],
      };
    },
  },
  {
    id: 'attendance',
    title: 'Attendance summary',
    description: 'Attendance % by course and section',
    module: 'attendance',
    build: (db, { ayId, settings, scope }) => {
      const rows = db.allocations
        .filter((a) => a.academicYearId === ayId && scope.csAllowed(a.courseId, a.sectionId))
        .map((a) => {
          const ss = db.attendance.filter((s) => s.courseId === a.courseId && s.sectionId === a.sectionId && s.academicYearId === ayId);
          const st = attendanceStats(ss);
          return {
            id: a.id,
            course: labelOf(db, 'courses', a.courseId),
            section: labelOf(db, 'sections', a.sectionId),
            faculty: labelOf(db, 'employees', a.facultyId),
            sessions: ss.length,
            pct: overallAttendancePct(ss),
            below: [...st.values()].filter((v) => v.pct < settings.minAttendance).length,
          };
        });
      return {
        rows,
        columns: [
          { key: 'course', header: 'Course' },
          { key: 'section', header: 'Section' },
          { key: 'faculty', header: 'Faculty' },
          { key: 'sessions', header: 'Sessions' },
          { key: 'pct', header: 'Attendance %' },
          { key: 'below', header: `Students < ${settings.minAttendance}%` },
        ],
      };
    },
  },
  {
    id: 'assessment',
    title: 'Assessment performance',
    description: 'Average, highest and lowest marks per assessment',
    module: 'assessments',
    build: (db, { ayId, scope }) => {
      const rows = db.assessments
        .filter((a) => a.academicYearId === ayId && a.status !== 'Scheduled' && scope.csAllowed(a.courseId, a.sectionId))
        .map((a) => {
          const v = Object.values(a.marks)
            .filter((x) => x != null)
            .map((x) => (Number(x) / a.maxMarks) * 100);
          return {
            id: a.id,
            course: labelOf(db, 'courses', a.courseId),
            section: labelOf(db, 'sections', a.sectionId),
            name: a.name,
            type: a.type,
            avg: round1(avg(v)),
            max: round1(Math.max(...v)),
            min: round1(Math.min(...v)),
            status: a.status,
          };
        });
      return {
        rows,
        columns: [
          { key: 'course', header: 'Course' },
          { key: 'section', header: 'Section' },
          { key: 'name', header: 'Assessment' },
          { key: 'type', header: 'Type' },
          { key: 'avg', header: 'Avg %' },
          { key: 'max', header: 'Max %' },
          { key: 'min', header: 'Min %' },
          { key: 'status', header: 'Status' },
        ],
      };
    },
  },
  {
    id: 'results',
    title: 'Result analysis',
    description: 'Pass percentage and grade summary for published results',
    module: 'results',
    build: (db, { settings, scope }) => {
      const rows = db.resultPublications
        .filter((p) => p.status === 'Published' && scope.courseAllowed(p.courseId))
        .map((p) => {
          const r = computeResults(
            db.assessments.filter((a) => a.courseId === p.courseId && a.sectionId === p.sectionId),
            settings,
          );
          return {
            id: p.id,
            ay: labelOf(db, 'academicYears', p.academicYearId),
            course: labelOf(db, 'courses', p.courseId),
            section: labelOf(db, 'sections', p.sectionId),
            students: r.length,
            pass: pct(r.filter((x) => x.pass).length, r.length),
            avg: round1(avg(r.map((x) => x.total ?? 0))),
            o: r.filter((x) => x.grade === 'O').length,
            f: r.filter((x) => x.grade === 'F').length,
          };
        });
      return {
        rows,
        columns: [
          { key: 'ay', header: 'AY' },
          { key: 'course', header: 'Course' },
          { key: 'section', header: 'Section' },
          { key: 'students', header: 'Students' },
          { key: 'pass', header: 'Pass %' },
          { key: 'avg', header: 'Avg total' },
          { key: 'o', header: 'O grades' },
          { key: 'f', header: 'F grades' },
        ],
      };
    },
  },
  {
    id: 'workload',
    title: 'Faculty workload',
    description: 'Allocated hours vs maximum per faculty',
    module: 'faculty-allocation',
    build: (db, { ayId, scope }) => {
      const rows = db.employees
        .filter((e) => e.category === 'Teaching' && e.departmentId && (!scope.departmentId || e.departmentId === scope.departmentId))
        .map((e) => {
          const a = db.allocations.filter((x) => x.facultyId === e.id && x.academicYearId === ayId);
          const h = sum(a.map((x) => x.hoursPerWeek));
          return {
            id: e.id,
            name: e.name,
            dept: labelOf(db, 'departments', e.departmentId),
            designation: e.designation,
            courses: a.length,
            hours: h,
            max: e.maxWorkload,
            util: pct(h, e.maxWorkload),
          };
        });
      return {
        rows,
        columns: [
          { key: 'name', header: 'Faculty' },
          { key: 'dept', header: 'Dept' },
          { key: 'designation', header: 'Designation' },
          { key: 'courses', header: 'Courses' },
          { key: 'hours', header: 'Hours/wk' },
          { key: 'max', header: 'Max' },
          { key: 'util', header: 'Utilisation %' },
        ],
      };
    },
  },
  {
    id: 'fees',
    title: 'Fee collection by program',
    description: 'Billed, collected and outstanding amounts',
    module: 'finance',
    build: (db, { ayId }) => {
      const rows = db.programs
        .map((p) => {
          const inv = db.invoices.filter(
            (i) =>
              i.academicYearId === ayId && i.status !== 'Cancelled' && db.students.find((s) => s.id === i.studentId)?.programId === p.id,
          );
          const b = sum(inv.map((i) => i.amount)),
            c = sum(inv.map((i) => i.paid));
          return { id: p.id, program: p.name, invoices: inv.length, billed: b, collected: c, outstanding: b - c, rate: pct(c, b) };
        })
        .filter((r) => r.invoices);
      return {
        rows,
        columns: [
          { key: 'program', header: 'Program' },
          { key: 'invoices', header: 'Invoices' },
          { key: 'billed', header: 'Billed', render: (r) => fmtMoney(r.billed) },
          { key: 'collected', header: 'Collected', render: (r) => fmtMoney(r.collected) },
          { key: 'outstanding', header: 'Outstanding', render: (r) => fmtMoney(r.outstanding) },
          { key: 'rate', header: 'Collection %' },
        ],
      };
    },
  },
  {
    id: 'placement',
    title: 'Placement summary',
    description: 'Final-year placement by department',
    module: 'placements',
    build: (db) => {
      const sel = db.placementApplications.filter((a) => a.status === 'Selected');
      const rows = db.departments.map((d) => {
        const fy = db.students.filter((s) => s.departmentId === d.id && s.semesterNo === 7);
        const offers = sel.filter((a) => fy.some((s) => s.id === a.studentId));
        const ctc = offers.map((a) => db.drives.find((x) => x.id === a.driveId)?.ctcLpa ?? 0);
        return {
          id: d.id,
          dept: d.name,
          eligible: fy.length,
          placed: new Set(offers.map((o) => o.studentId)).size,
          offers: offers.length,
          pct: pct(new Set(offers.map((o) => o.studentId)).size, fy.length),
          avg: round1(avg(ctc)),
          max: ctc.length ? Math.max(...ctc) : 0,
        };
      });
      return {
        rows,
        columns: [
          { key: 'dept', header: 'Department' },
          { key: 'eligible', header: 'Final-year' },
          { key: 'placed', header: 'Placed' },
          { key: 'offers', header: 'Offers' },
          { key: 'pct', header: 'Placed %' },
          { key: 'avg', header: 'Avg CTC (LPA)' },
          { key: 'max', header: 'Max CTC (LPA)' },
        ],
      };
    },
  },
  {
    id: 'library',
    title: 'Library circulation',
    description: 'Issues, returns, overdue and fines by category',
    module: 'library',
    build: (db) => {
      const cats = [...new Set(db.books.map((b) => b.category))];
      const rows = cats.map((c) => {
        const ids = new Set(db.books.filter((b) => b.category === c).map((b) => b.id));
        const iss = db.bookIssues.filter((i) => ids.has(i.bookId));
        return {
          id: c,
          category: c,
          titles: ids.size,
          issues: iss.length,
          current: iss.filter((i) => i.status === 'Issued').length,
          overdue: iss.filter((i) => i.status === 'Issued' && i.dueDate < todayISO()).length,
          fines: sum(iss.map((i) => i.fine)),
        };
      });
      return {
        rows,
        columns: [
          { key: 'category', header: 'Category' },
          { key: 'titles', header: 'Titles' },
          { key: 'issues', header: 'Total issues' },
          { key: 'current', header: 'Currently issued' },
          { key: 'overdue', header: 'Overdue' },
          { key: 'fines', header: 'Fines collected', render: (r) => fmtMoney(r.fines) },
        ],
      };
    },
  },
  {
    id: 'hostel',
    title: 'Hostel occupancy',
    description: 'Beds and occupancy by hostel',
    module: 'hostel',
    build: (db) => {
      const rows = db.hostels.map((h) => {
        const rooms = db.hostelRooms.filter((r) => r.hostelId === h.id);
        const beds = sum(rooms.map((r) => r.capacity));
        const occ = db.hostelAllocations.filter((a) => a.status === 'Allocated' && rooms.some((r) => r.id === a.roomId)).length;
        return { id: h.id, hostel: h.name, type: h.type, rooms: rooms.length, beds, occ, pct: pct(occ, beds) };
      });
      return {
        rows,
        columns: [
          { key: 'hostel', header: 'Hostel' },
          { key: 'type', header: 'Type' },
          { key: 'rooms', header: 'Rooms' },
          { key: 'beds', header: 'Beds' },
          { key: 'occ', header: 'Occupied' },
          { key: 'pct', header: 'Occupancy %' },
        ],
      };
    },
  },
  {
    id: 'admissions',
    title: 'Admissions summary',
    description: 'Applications and status by program',
    module: 'admissions',
    build: (db) => {
      const rows = db.programs.map((p) => {
        const a = db.applicants.filter((x) => x.programId === p.id);
        return {
          id: p.id,
          program: p.name,
          intake: p.intake,
          applied: a.length,
          review: a.filter((x) => x.status === 'Under Review' || x.status === 'Applied').length,
          approved: a.filter((x) => x.status === 'Approved').length,
          admitted: a.filter((x) => x.status === 'Admitted').length,
          rejected: a.filter((x) => x.status === 'Rejected').length,
        };
      });
      return {
        rows,
        columns: [
          { key: 'program', header: 'Program' },
          { key: 'intake', header: 'Intake' },
          { key: 'applied', header: 'Applications' },
          { key: 'review', header: 'Pending' },
          { key: 'approved', header: 'Approved' },
          { key: 'admitted', header: 'Admitted' },
          { key: 'rejected', header: 'Rejected' },
        ],
      };
    },
  },
  {
    id: 'feedback',
    title: 'Feedback summary',
    description: 'Average rating per feedback form',
    module: 'feedback',
    build: (db) => {
      const rows = db.feedbackForms.map((f) => {
        const r = db.feedbackResponses.filter((x) => x.formId === f.id);
        return {
          id: f.id,
          title: f.title,
          type: f.type,
          status: f.status,
          responses: r.length,
          avg: round1(avg(r.flatMap((x) => x.ratings))),
        };
      });
      return {
        rows,
        columns: [
          { key: 'title', header: 'Form' },
          { key: 'type', header: 'Type' },
          { key: 'status', header: 'Status' },
          { key: 'responses', header: 'Responses' },
          { key: 'avg', header: 'Avg rating (/5)' },
        ],
      };
    },
  },
];
export default function Reports() {
  const { db, can, ayId, settings } = useData();
  const scope = useScope();
  const available = REPORTS.filter((r) => can(r.module));
  const [sel, setSel] = useState(available[0]?.id ?? '');
  const rep = available.find((r) => r.id === sel);
  const built = useMemo(() => rep?.build(db, { ayId, settings, scope }), [rep, db, ayId, settings, scope]);
  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={`Authorised institutional reports · AY ${labelOf(db, 'academicYears', ayId)} · export to CSV or print`}
      />
      {!available.length ? (
        <EmptyState icon={FileBarChart} title="No reports available for your role" />
      ) : (
        <div className="grid cols-4">
          <Card title="Report catalogue" bodyClass="p-2">
            <ul>
              {available.map((r) => (
                <li key={r.id}>
                  <button onClick={() => setSel(r.id)} className={sel === r.id ? 'active' : ''}>
                    <span>
                      <span className="strong">{r.title}</span>
                      <span className="xs muted">{r.description}</span>
                    </span>
                    <ChevronRight />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          <div className="span-3">
            {rep && built && (
              <DataTable
                key={rep.id}
                title={rep.title}
                exportName={`${rep.id}-report`}
                rows={built.rows}
                columns={built.columns}
                pageSize={25}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
