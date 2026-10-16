import { useState } from 'react';
import { Database, Plus, RotateCcw, Save, Trash2, UploadCloud } from 'lucide-react';
import { useData } from '../../data/store';
import { seedFirestore } from '../../data/firestoreBackend';
import { generateSeed } from '../../data/seed';
import { Alert, Button, Card, Field, Input, PageHeader, Select, useConfirm, useToast } from '../../components/ui';
export default function Settings() {
  const { settings, db, update, mode, resetDemo, can } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const [f, setF] = useState(() => JSON.parse(JSON.stringify(settings)));
  const [saving, setSaving] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');
  const edit = can('settings', 'edit');
  const wsum = Object.values(f.assessmentWeights).reduce((a, b) => a + Number(b), 0);
  const save = async () => {
    if (!f.institutionName.trim()) return toast.error('Institution name is required.');
    if (wsum !== 100) return toast.error(`Assessment weights must total 100 (currently ${wsum}).`);
    if (f.minAttendance < 0 || f.minAttendance > 100) return toast.error('Minimum attendance must be 0–100.');
    const mins = f.gradeRules.map((g) => g.min);
    if (new Set(mins).size !== mins.length || !mins.includes(0)) return toast.error('Grade minimums must be unique and include a 0 band.');
    if (!(f.attainmentLevels.level3 > f.attainmentLevels.level2 && f.attainmentLevels.level2 > f.attainmentLevels.level1))
      return toast.error('Attainment levels must be L3> L2> L1.');
    setSaving(true);
    try {
      const { id, createdAt, updatedAt, active, ...rest } = f;
      void id;
      void createdAt;
      void updatedAt;
      void active;
      await update('settings', settings.id, rest, { audit: 'Updated', details: 'Institution settings' });
      toast.success('Settings saved. Calculations across the ERP now use the new rules.');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };
  const setW = (k, v) => setF({ ...f, assessmentWeights: { ...f.assessmentWeights, [k]: Number(v) } });
  const setG = (i, patch) => setF({ ...f, gradeRules: f.gradeRules.map((g, j) => (j === i ? { ...g, ...patch } : g)) });
  const doReset = async () => {
    if (
      await confirm({
        title: 'Reset demo data?',
        message: 'All changes made in this browser will be discarded and the synthetic dataset regenerated. You will stay signed in.',
        confirmLabel: 'Reset data',
      })
    )
      await resetDemo();
  };
  const doSeed = async () => {
    if (
      !(await confirm({
        title: 'Seed Firestore?',
        message:
          'Writes the synthetic dataset (all collections except users and audit logs) into Firestore. Use only on an empty development project.',
        confirmLabel: 'Seed database',
        tone: 'primary',
      }))
    )
      return;
    try {
      await seedFirestore(generateSeed(), (m) => setSeedMsg(m));
      toast.success('Firestore seeded.');
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <>
      <PageHeader
        title="Institution Settings"
        subtitle="Institution profile, academic year, attendance, assessment and grading rules, OBE and library parameters"
        actions={
          edit && (
            <Button icon={Save} onClick={save} loading={saving}>
              Save settings
            </Button>
          )
        }
      />
      <fieldset disabled={!edit} className="grid cols-2">
        <Card title="Institution">
          <div className="form-grid">
            <Field label="Institution name" required className="full">
              <Input value={f.institutionName} onChange={(e) => setF({ ...f, institutionName: e.target.value })} />
            </Field>
            <Field label="Short name">
              <Input value={f.shortName} onChange={(e) => setF({ ...f, shortName: e.target.value })} />
            </Field>
            <Field label="Current academic year">
              <Select value={f.currentAcademicYearId} onChange={(e) => setF({ ...f, currentAcademicYearId: e.target.value })}>
                {db.academicYears.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Address" className="full">
              <Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
            </Field>
            <Field label="Affiliation / approvals" className="full">
              <Input value={f.affiliation} onChange={(e) => setF({ ...f, affiliation: e.target.value })} />
            </Field>
          </div>
        </Card>
        <Card title="Attendance & assessment rules">
          <div className="form-grid">
            <Field label="Minimum attendance %">
              <Input
                type="number"
                min={0}
                max={100}
                value={f.minAttendance}
                onChange={(e) => setF({ ...f, minAttendance: Number(e.target.value) })}
              />
            </Field>
            <Field label="Pass mark (out of 100)">
              <Input
                type="number"
                min={0}
                max={100}
                value={f.passMarks}
                onChange={(e) => setF({ ...f, passMarks: Number(e.target.value) })}
              />
            </Field>
            {Object.keys(f.assessmentWeights).map((k) => (
              <Field key={k} label={`${k} weight %`}>
                <Input type="number" min={0} max={100} value={f.assessmentWeights[k]} onChange={(e) => setW(k, e.target.value)} />
              </Field>
            ))}
          </div>
          <p className={`mt-8 xs ${wsum === 100 ? 'text-green' : 'text-red'}`}>
            Weights total {wsum}% {wsum === 100 ? '✓' : '(must be 100)'}
          </p>
        </Card>
        <Card
          title="Grading rules"
          actions={
            edit && (
              <Button
                size="sm"
                variant="secondary"
                icon={Plus}
                onClick={() => setF({ ...f, gradeRules: [...f.gradeRules, { grade: 'New', min: 1, points: 1 }] })}
              >
                Add grade
              </Button>
            )
          }
        >
          <table className="simple-table">
            <thead>
              <tr>
                <th>Grade</th>
                <th>Min total</th>
                <th>Grade points</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {f.gradeRules.map((g, i) => (
                <tr key={i}>
                  <td>
                    <Input value={g.grade} onChange={(e) => setG(i, { grade: e.target.value })} />
                  </td>
                  <td>
                    <Input type="number" value={g.min} onChange={(e) => setG(i, { min: Number(e.target.value) })} />
                  </td>
                  <td>
                    <Input type="number" value={g.points} onChange={(e) => setG(i, { points: Number(e.target.value) })} />
                  </td>
                  <td>
                    {edit && (
                      <button
                        type="button"
                        onClick={() => setF({ ...f, gradeRules: f.gradeRules.filter((_, j) => j !== i) })}
                        className="close-btn"
                        aria-label="Remove grade"
                      >
                        <Trash2 className="icon-16" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="OBE & library">
          <div className="form-grid">
            <Field label="CO target score %" hint="Student counts as attaining a CO at or above this score">
              <Input type="number" value={f.coTargetPercent} onChange={(e) => setF({ ...f, coTargetPercent: Number(e.target.value) })} />
            </Field>
            <Field label="Direct attainment weight %">
              <Input type="number" value={f.directWeight} onChange={(e) => setF({ ...f, directWeight: Number(e.target.value) })} />
            </Field>
            <Field label="Level 3 if ≥ % students">
              <Input
                type="number"
                value={f.attainmentLevels.level3}
                onChange={(e) => setF({ ...f, attainmentLevels: { ...f.attainmentLevels, level3: Number(e.target.value) } })}
              />
            </Field>
            <Field label="Level 2 if ≥ % students">
              <Input
                type="number"
                value={f.attainmentLevels.level2}
                onChange={(e) => setF({ ...f, attainmentLevels: { ...f.attainmentLevels, level2: Number(e.target.value) } })}
              />
            </Field>
            <Field label="Level 1 if ≥ % students">
              <Input
                type="number"
                value={f.attainmentLevels.level1}
                onChange={(e) => setF({ ...f, attainmentLevels: { ...f.attainmentLevels, level1: Number(e.target.value) } })}
              />
            </Field>
            <Field label="Library loan days">
              <Input type="number" value={f.libraryLoanDays} onChange={(e) => setF({ ...f, libraryLoanDays: Number(e.target.value) })} />
            </Field>
            <Field label="Library fine per day (₹)">
              <Input
                type="number"
                value={f.libraryFinePerDay}
                onChange={(e) => setF({ ...f, libraryFinePerDay: Number(e.target.value) })}
              />
            </Field>
          </div>
        </Card>
      </fieldset>
      {edit && (
        <Card title="Data management" className="mt-16">
          {mode === 'demo' ? (
            <div className="row between">
              <Alert tone="warning">
                Demo mode: data is stored in this browser (IndexedDB). Resetting regenerates the synthetic dataset.
              </Alert>
              <Button variant="danger" icon={RotateCcw} onClick={doReset}>
                Reset demo data
              </Button>
            </div>
          ) : (
            <div className="stack">
              <Alert tone="info">
                Firebase mode. For a new, empty development project you can load the synthetic dataset. Users must be created in Firebase
                Authentication and linked in User Management.
              </Alert>
              <div className="row">
                <Button variant="secondary" icon={UploadCloud} onClick={doSeed}>
                  Seed Firestore with demo data
                </Button>
                <span className="xs muted">{seedMsg}</span>
              </div>
            </div>
          )}
          <p className="row mt-12 xs muted">
            <Database className="icon-14" />
            Backend: {mode === 'demo' ? 'Demo (browser IndexedDB)' : 'Cloud Firestore'}
          </p>
        </Card>
      )}
    </>
  );
}
