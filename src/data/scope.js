import { useMemo } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { isDepartmentRole } from '../lib/roles';
import { useData } from './store';
/**
 * Row-level scope for the signed-in user. Personal roles are already limited
 * by the data layer; this adds department / own-course / mentee filters.
 */
export function useScope() {
  const { user } = useAuth();
  const { db, ayId } = useData();
  return useMemo(() => {
    const role = user?.role;
    const personal = role === 'student' || role === 'parent';
    const linked = user?.linkedStudentIds ?? (user?.studentId ? [user.studentId] : []);
    const departmentId = isDepartmentRole(role) ? (user?.departmentId ?? null) : null;
    const facultyId = role === 'faculty' || role === 'course-champion' || role === 'mentor' ? (user?.employeeId ?? null) : null;
    const myAllocations = facultyId ? db.allocations.filter((a) => a.facultyId === facultyId) : null;
    const myCourseSections = myAllocations ? new Set(myAllocations.map((a) => a.courseId + '|' + a.sectionId)) : null;
    const myCourses = myAllocations ? new Set(myAllocations.map((a) => a.courseId)) : null;
    const menteeIds = role === 'mentor' ? new Set(db.students.filter((s) => s.mentorId === facultyId).map((s) => s.id)) : null;
    const studentAllowed = (id) => {
      if (personal) return linked.includes(id);
      if (menteeIds) return menteeIds.has(id);
      if (departmentId) return db.students.find((s) => s.id === id)?.departmentId === departmentId;
      return true;
    };
    const students = db.students.filter(
      (s) =>
        s.active !== false &&
        (personal ? linked.includes(s.id) : menteeIds ? menteeIds.has(s.id) : departmentId ? s.departmentId === departmentId : true),
    );
    const courseAllowed = (courseId) => {
      if (departmentId) return db.courses.find((c) => c.id === courseId)?.departmentId === departmentId;
      if (myCourses && role !== 'mentor') return myCourses.has(courseId);
      return true;
    };
    const csAllowed = (courseId, sectionId) => {
      if (myCourseSections && role !== 'mentor') return myCourseSections.has(courseId + '|' + sectionId);
      return courseAllowed(courseId);
    };
    const linkedStudent = personal ? db.students.find((s) => s.id === linked[0]) : undefined;
    return {
      role,
      personal,
      linked,
      departmentId,
      facultyId,
      myAllocations,
      menteeIds,
      students,
      studentAllowed,
      courseAllowed,
      csAllowed,
      linkedStudent,
      ayId,
    };
  }, [user, db, ayId]);
}
