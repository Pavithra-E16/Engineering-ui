import { useMemo } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useData } from './store';
/**
 * Row-level scope for the signed-in user. Students are already limited to
 * their own records by the data layer (and Firestore rules in production).
 */
export function useScope() {
  const { user } = useAuth();
  const { db, ayId } = useData();
  return useMemo(() => {
    const role = user?.role;
    const personal = role === 'student';
    const linked = user?.linkedStudentIds ?? (user?.studentId ? [user.studentId] : []);
    const students = db.students.filter((s) => s.active !== false && (!personal || linked.includes(s.id)));
    const linkedStudent = personal ? db.students.find((s) => s.id === linked[0]) : undefined;
    return { role, personal, linked, students, linkedStudent, ayId };
  }, [user, db, ayId]);
}
