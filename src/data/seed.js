import { addDays, clamp, hashPassword, rng } from '../lib/utils';
export const DEMO_PASSWORD = 'Demo@123';
export const DEMO_DOMAIN = 'kvce.demo';
const TS = '2026-07-01T09:00:00.000Z';
const base = (id) => ({ id, createdAt: TS, updatedAt: TS, active: true });
const FIRST_M = [
  'Aarav',
  'Vihaan',
  'Arjun',
  'Sai',
  'Rohan',
  'Karthik',
  'Rahul',
  'Aditya',
  'Nikhil',
  'Pranav',
  'Harsha',
  'Varun',
  'Siddharth',
  'Manoj',
  'Kiran',
  'Abhishek',
  'Teja',
  'Akash',
  'Vivek',
  'Naveen',
  'Ravi',
  'Surya',
  'Ganesh',
  'Yash',
  'Ishaan',
  'Dhruv',
  'Ajay',
  'Charan',
  'Mahesh',
  'Rakesh',
];
const FIRST_F = [
  'Ananya',
  'Diya',
  'Priya',
  'Sneha',
  'Kavya',
  'Meghana',
  'Divya',
  'Pooja',
  'Lakshmi',
  'Swathi',
  'Harini',
  'Nandini',
  'Bhavana',
  'Keerthi',
  'Sravani',
  'Aishwarya',
  'Ishita',
  'Riya',
  'Tanvi',
  'Sahithi',
  'Navya',
  'Deepika',
  'Sindhu',
  'Pallavi',
  'Shreya',
  'Anjali',
  'Varsha',
  'Madhuri',
  'Neha',
  'Jyothi',
];
const LAST = [
  'Reddy',
  'Sharma',
  'Rao',
  'Naidu',
  'Iyer',
  'Patel',
  'Kumar',
  'Gupta',
  'Varma',
  'Chowdary',
  'Nair',
  'Menon',
  'Krishnan',
  'Joshi',
  'Mehta',
  'Bhat',
  'Pillai',
  'Das',
  'Singh',
  'Agarwal',
  'Murthy',
  'Shetty',
  'Kulkarni',
  'Prasad',
  'Hegde',
];
const DEPTS = [
  { code: 'CSE', name: 'Computer Science & Engineering', block: 'A Block', est: 1998 },
  { code: 'ECE', name: 'Electronics & Communication Engineering', block: 'B Block', est: 1998 },
  { code: 'EEE', name: 'Electrical & Electronics Engineering', block: 'C Block', est: 2001 },
  { code: 'MECH', name: 'Mechanical Engineering', block: 'D Block', est: 2001 },
  { code: 'CIVIL', name: 'Civil Engineering', block: 'E Block', est: 2005 },
  { code: 'IT', name: 'Information Technology', block: 'A Block', est: 2008 },
];
const COMMON = {
  1: ['Engineering Mathematics I', 'Engineering Physics', 'Programming for Problem Solving', 'Basic Electrical Engineering'],
  2: ['Engineering Mathematics II', 'Engineering Chemistry', 'Engineering Graphics'],
  8: ['Major Project Work', 'Professional Ethics & Human Values'],
};
const DEPT_COURSES = {
  CSE: {
    3: ['Data Structures', 'Discrete Mathematics', 'Digital Logic Design', 'Object Oriented Programming'],
    4: ['Design and Analysis of Algorithms', 'Operating Systems', 'Database Management Systems'],
    5: ['Computer Networks', 'Theory of Computation', 'Software Engineering', 'Machine Learning'],
    6: ['Compiler Design', 'Cloud Computing', 'Artificial Intelligence'],
    7: ['Cryptography and Network Security', 'Big Data Analytics', 'Deep Learning', 'Internet of Things'],
  },
  ECE: {
    3: ['Electronic Devices and Circuits', 'Signals and Systems', 'Network Theory', 'Digital Electronics'],
    4: ['Analog Circuits', 'Electromagnetic Fields', 'Linear Integrated Circuits'],
    5: ['Analog and Digital Communication', 'Microprocessors and Microcontrollers', 'Control Systems', 'Digital Signal Processing'],
    6: ['VLSI Design', 'Antennas and Wave Propagation', 'Embedded Systems'],
    7: ['Microwave Engineering', 'Optical Communication', 'Wireless Communication', 'IoT Systems Design'],
  },
  EEE: {
    3: ['Electrical Circuit Analysis', 'Electrical Machines I', 'Electromagnetic Theory', 'Analog Electronics'],
    4: ['Electrical Machines II', 'Power Systems I', 'Control Systems'],
    5: ['Power Systems II', 'Power Electronics', 'Measurements and Instrumentation', 'Microcontrollers'],
    6: ['Switchgear and Protection', 'Electric Drives', 'Renewable Energy Systems'],
    7: ['Power System Operation and Control', 'High Voltage Engineering', 'Smart Grid Technologies', 'Electric Vehicles'],
  },
  MECH: {
    3: ['Engineering Mechanics', 'Engineering Thermodynamics', 'Manufacturing Processes', 'Material Science'],
    4: ['Fluid Mechanics', 'Strength of Materials', 'Kinematics of Machinery'],
    5: ['Heat Transfer', 'Dynamics of Machinery', 'Design of Machine Elements', 'Metrology and Measurements'],
    6: ['CAD/CAM', 'Finite Element Analysis', 'Refrigeration and Air Conditioning'],
    7: ['Automobile Engineering', 'Robotics', 'Operations Research', 'Additive Manufacturing'],
  },
  CIVIL: {
    3: ['Surveying', 'Building Materials', 'Mechanics of Solids', 'Fluid Mechanics'],
    4: ['Structural Analysis I', 'Concrete Technology', 'Geotechnical Engineering I'],
    5: ['Structural Analysis II', 'Design of RC Structures', 'Transportation Engineering', 'Engineering Hydrology'],
    6: ['Design of Steel Structures', 'Environmental Engineering', 'Geotechnical Engineering II'],
    7: ['Estimation and Costing', 'Prestressed Concrete', 'Remote Sensing and GIS', 'Construction Management'],
  },
  IT: {
    3: ['Data Structures', 'Computer Organization', 'Discrete Mathematics', 'Java Programming'],
    4: ['Algorithms', 'Operating Systems', 'Database Systems'],
    5: ['Web Technologies', 'Computer Networks', 'Software Engineering', 'Data Mining'],
    6: ['Cloud Computing', 'Information Security', 'Mobile Application Development'],
    7: ['Blockchain Technology', 'Natural Language Processing', 'DevOps', 'Cyber Forensics'],
  },
};
const PO_TITLES = [
  'Engineering knowledge',
  'Problem analysis',
  'Design/development of solutions',
  'Conduct investigations of complex problems',
  'Modern tool usage',
  'The engineer and society',
  'Environment and sustainability',
  'Ethics',
  'Individual and team work',
  'Communication',
  'Project management and finance',
  'Life-long learning',
];
const BLOOMS = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'];
const CO_VERBS = [
  'Explain the fundamental concepts of',
  'Apply the principles of',
  'Analyze problems using',
  'Design solutions based on',
  'Evaluate the performance of',
];
export const CURRENT_AY = 'ay_2026';
export const PREV_AY = 'ay_2025';
export function generateSeed() {
  const r = rng(20261016);
  const name = (g) => `${r.pick(g === 'Male' ? FIRST_M : FIRST_F)} ${r.pick(LAST)}`;
  const phone = () => '9' + String(r.int(100000000, 999999999));
  const db = {};
  // ---------- structure ----------
  db.academicYears = [
    { ...base('ay_2024'), name: '2024-25', startDate: '2024-07-01', endDate: '2025-06-30', current: false },
    { ...base(PREV_AY), name: '2025-26', startDate: '2025-07-01', endDate: '2026-06-30', current: false },
    { ...base(CURRENT_AY), name: '2026-27', startDate: '2026-07-01', endDate: '2027-06-30', current: true },
  ];
  db.semesters = [
    {
      ...base('sem_2025_odd'),
      academicYearId: PREV_AY,
      number: 1,
      term: 'Odd',
      startDate: '2025-07-14',
      endDate: '2025-12-20',
      status: 'Completed',
    },
    {
      ...base('sem_2025_even'),
      academicYearId: PREV_AY,
      number: 2,
      term: 'Even',
      startDate: '2026-01-05',
      endDate: '2026-05-30',
      status: 'Completed',
    },
    {
      ...base('sem_2026_odd'),
      academicYearId: CURRENT_AY,
      number: 1,
      term: 'Odd',
      startDate: '2026-07-13',
      endDate: '2026-12-19',
      status: 'Ongoing',
    },
    {
      ...base('sem_2026_even'),
      academicYearId: CURRENT_AY,
      number: 2,
      term: 'Even',
      startDate: '2027-01-04',
      endDate: '2027-05-29',
      status: 'Planned',
    },
  ];
  const departments = DEPTS.map((d) => ({
    ...base('dep_' + d.code.toLowerCase()),
    code: d.code,
    name: d.name,
    block: d.block,
    established: d.est,
  }));
  db.departments = departments;
  const programs = [];
  departments.forEach((d) =>
    programs.push({
      ...base('prg_' + d.code.toLowerCase()),
      code: 'BT-' + d.code,
      name: 'B.Tech ' + d.name,
      level: 'UG',
      departmentId: d.id,
      durationYears: 4,
      intake: 120,
    }),
  );
  programs.push({
    ...base('prg_mtech_cse'),
    code: 'MT-CSE',
    name: 'M.Tech Computer Science & Engineering',
    level: 'PG',
    departmentId: 'dep_cse',
    durationYears: 2,
    intake: 18,
  });
  programs.push({
    ...base('prg_mtech_vlsi'),
    code: 'MT-VLSI',
    name: 'M.Tech VLSI Design',
    level: 'PG',
    departmentId: 'dep_ece',
    durationYears: 2,
    intake: 18,
  });
  db.programs = programs;
  // ---------- rooms ----------
  const rooms = [];
  DEPTS.forEach((d, i) => {
    for (let k = 1; k <= 5; k++)
      rooms.push({
        ...base(`room_${d.code.toLowerCase()}_${k}`),
        code: `${String.fromCharCode(65 + i)}-${100 + k}`,
        block: d.block,
        capacity: 66,
        type: k === 5 ? 'Lab' : 'Classroom',
      });
  });
  ['EH-1', 'EH-2', 'EH-3', 'EH-4'].forEach((c, i) =>
    rooms.push({ ...base('room_exam_' + i), code: c, block: 'Exam Block', capacity: 48, type: 'Exam Hall' }),
  );
  rooms.push({ ...base('room_seminar'), code: 'SH-1', block: 'Admin Block', capacity: 250, type: 'Seminar Hall' });
  db.rooms = rooms;
  // ---------- employees ----------
  const employees = [];
  let empN = 1;
  const mkEmp = (p) => {
    const g = p.gender ?? (r.chance(0.45) ? 'Female' : 'Male');
    const nm = p.name ?? (p.category === 'Teaching' ? 'Dr. ' : '') + name(g);
    const id = 'emp_' + String(empN).padStart(3, '0');
    const e = {
      ...base(id),
      empNo: 'KV' + String(1000 + empN),
      name: nm,
      email:
        nm
          .replace(/^Dr\. /, '')
          .toLowerCase()
          .replace(/[^a-z]+/g, '.') +
        empN +
        '@' +
        DEPT_DOMAIN,
      phone: phone(),
      gender: g,
      category: 'Teaching',
      designation: 'Assistant Professor',
      qualification: 'M.Tech',
      joiningDate: `${r.int(2005, 2023)}-0${r.int(1, 9)}-1${r.int(0, 9)}`,
      experienceYears: r.int(2, 24),
      employmentType: 'Permanent',
      status: 'Active',
      maxWorkload: 16,
      ...p,
    };
    empN++;
    employees.push(e);
    return e;
  };
  const deptFaculty = {};
  departments.forEach((d) => {
    const list = [];
    list.push(
      mkEmp({
        category: 'Teaching',
        designation: 'Professor & HOD',
        departmentId: d.id,
        qualification: 'Ph.D',
        experienceYears: r.int(18, 28),
        maxWorkload: 8,
      }),
    );
    for (let i = 0; i < 2; i++)
      list.push(
        mkEmp({
          category: 'Teaching',
          designation: 'Associate Professor',
          departmentId: d.id,
          qualification: 'Ph.D',
          experienceYears: r.int(10, 18),
          maxWorkload: 14,
        }),
      );
    for (let i = 0; i < 5; i++) {
      const e = mkEmp({
        category: 'Teaching',
        designation: 'Assistant Professor',
        departmentId: d.id,
        qualification: r.chance(0.3) ? 'Ph.D' : 'M.Tech',
        experienceYears: r.int(2, 10),
        employmentType: r.chance(0.15) ? 'Contract' : 'Permanent',
        maxWorkload: 16,
      });
      e.name = e.qualification === 'Ph.D' ? e.name : e.name.replace(/^Dr\. /, '');
      list.push(e);
    }
    d.hodId = list[0].id;
    deptFaculty[d.id] = list;
  });
  const staff = [
    ['Principal', 'Ph.D'],
    ['Dean - Academics', 'Ph.D'],
    ['Controller of Examinations', 'Ph.D'],
    ['IQAC Coordinator', 'Ph.D'],
    ['HR Manager', 'MBA'],
    ['Finance Officer', 'M.Com'],
    ['Accounts Assistant', 'B.Com'],
    ['Librarian', 'M.Lib.Sc'],
    ['Training & Placement Officer', 'MBA'],
    ['System Administrator', 'M.Tech'],
    ['Hostel Warden', 'M.A'],
    ['Transport Supervisor', 'B.A'],
    ['Office Superintendent', 'B.Com'],
    ['Lab Technician', 'Diploma'],
  ];
  const staffMap = {};
  staff.forEach(([des, q]) => {
    const teaching = ['Principal', 'Dean - Academics', 'Controller of Examinations', 'IQAC Coordinator'].includes(des);
    staffMap[des] = mkEmp({
      category: teaching ? 'Teaching' : 'Non-Teaching',
      designation: des,
      qualification: q,
      maxWorkload: teaching ? 4 : 0,
      departmentId: teaching ? 'dep_cse' : undefined,
      name: (teaching ? 'Dr. ' : '') + name(r.chance(0.4) ? 'Female' : 'Male'),
    });
  });
  employees[employees.length - 1].status = 'On Leave';
  db.employees = employees;
  // ---------- sections & students ----------
  const sections = [];
  const students = [];
  const ability = {};
  const attP = {};
  let sN = 1;
  departments.forEach((d, di) => {
    [1, 3, 5, 7].forEach((sem) => {
      const sec = {
        ...base(`sec_${d.code.toLowerCase()}_${sem}`),
        programId: 'prg_' + d.code.toLowerCase(),
        departmentId: d.id,
        academicYearId: CURRENT_AY,
        semesterNo: sem,
        name: 'A',
        capacity: 66,
        room: rooms[di * 5 + (sem - 1) / 2].id,
        classTeacherId: deptFaculty[d.id][1 + (((sem - 1) / 2) % 7)].id,
      };
      sections.push(sec);
      const admYear = 2026 - (sem - 1) / 2;
      for (let k = 0; k < 12; k++) {
        const g = r.chance(0.42) ? 'Female' : 'Male';
        const nm = name(g);
        const id = 'stu_' + String(sN).padStart(4, '0');
        const atRisk = r.chance(0.09);
        ability[id] = atRisk ? clamp(r.normal(0.38, 0.06), 0.22, 0.5) : clamp(r.normal(0.68, 0.12), 0.4, 0.97);
        attP[id] = atRisk ? clamp(r.normal(0.66, 0.05), 0.5, 0.74) : clamp(r.normal(0.88, 0.06), 0.72, 0.99);
        students.push({
          ...base(id),
          rollNo: `${String(admYear).slice(2)}KV1A${String(di + 1).padStart(2, '0')}${String(k + 1).padStart(2, '0')}`,
          name: nm,
          email: nm.toLowerCase().replace(/\s+/g, '.') + sN + '@student.' + DEMO_DOMAIN,
          phone: phone(),
          gender: g,
          dob: `${admYear - 18}-${String(r.int(1, 12)).padStart(2, '0')}-${String(r.int(1, 28)).padStart(2, '0')}`,
          departmentId: d.id,
          programId: sec.programId,
          sectionId: sec.id,
          semesterNo: sem,
          batch: `${admYear}-${admYear + 4}`,
          admissionYear: admYear,
          parentName: `${r.pick(FIRST_M)} ${nm.split(' ')[1]}`,
          parentPhone: phone(),
          category: r.pick(['OC', 'BC-A', 'BC-B', 'BC-D', 'SC', 'ST', 'EWS']),
          status: 'Active',
          cgpa: sem > 1 ? Math.round(clamp(4 + ability[id] * 6 + r.normal(0, 0.3), 4.5, 9.9) * 100) / 100 : undefined,
        });
        sN++;
      }
    });
    // previous-year even-semester sections (history)
    [2, 4, 6].forEach((sem) =>
      sections.push({
        ...base(`sec_${d.code.toLowerCase()}_${sem}_prev`),
        programId: 'prg_' + d.code.toLowerCase(),
        departmentId: d.id,
        academicYearId: PREV_AY,
        semesterNo: sem,
        name: 'A',
        capacity: 66,
      }),
    );
  });
  db.sections = sections;
  db.students = students;
  // mentors: each department faculty (excluding HOD) mentors students of that department
  departments.forEach((d) => {
    const fac = deptFaculty[d.id].slice(1);
    students.filter((s) => s.departmentId === d.id).forEach((s, i) => (s.mentorId = fac[i % fac.length].id));
  });
  // ---------- curriculum & courses ----------
  const curricula = [];
  programs
    .filter((p) => p.level === 'UG')
    .forEach((p) => {
      curricula.push({
        ...base('cur_' + p.id + '_r22'),
        programId: p.id,
        regulation: 'R22',
        version: '1.2',
        effectiveFrom: '2022-07-01',
        totalCredits: 160,
        status: 'Approved',
        approvedBy: 'Academic Council',
      });
    });
  curricula.push({
    ...base('cur_prg_cse_r26'),
    programId: 'prg_cse',
    regulation: 'R26',
    version: '0.9',
    effectiveFrom: '2027-07-01',
    totalCredits: 163,
    status: 'Draft',
  });
  db.curricula = curricula;
  const courses = [];
  departments.forEach((d) => {
    const dc = d.code === 'CIVIL' ? 'CE' : d.code === 'MECH' ? 'ME' : d.code.slice(0, 2);
    for (let sem = 1; sem <= 8; sem++) {
      const names = COMMON[sem] ?? DEPT_COURSES[d.code][sem];
      names.forEach((n, i) => {
        const isLab = /Programming|Data Structures|Java/.test(n) && sem < 5;
        courses.push({
          ...base(`crs_${d.code.toLowerCase()}_${sem}${i + 1}`),
          code: `22${dc}${sem}0${i + 1}`,
          name: n,
          credits: n.includes('Project') ? 8 : n.includes('Ethics') ? 2 : 3 + (i === 0 ? 1 : 0),
          L: 3,
          T: i === 0 ? 1 : 0,
          P: isLab ? 2 : 0,
          departmentId: d.id,
          programId: 'prg_' + d.code.toLowerCase(),
          semesterNo: sem,
          type: n.includes('Project') ? 'Project' : sem >= 7 && i >= 2 ? 'Elective' : 'Core',
          curriculumId: 'cur_prg_' + d.code.toLowerCase() + '_r22',
          prerequisites: sem > 2 && i < 2 ? `22${dc}${sem - 1}0${i + 1}` : '',
          status: 'Active',
        });
      });
    }
  });
  db.courses = courses;
  // ---------- allocations & timetable ----------
  const allocations = [];
  const timetable = [];
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const facBusy = new Set();
  departments.forEach((d) => {
    const fac = deptFaculty[d.id];
    const pairs = [];
    sections
      .filter((s) => s.departmentId === d.id && s.academicYearId === CURRENT_AY)
      .forEach((s) => {
        courses.filter((c) => c.departmentId === d.id && c.semesterNo === s.semesterNo).forEach((c) => pairs.push({ c, s }));
      });
    pairs.forEach(({ c, s }, i) => {
      // HOD takes only one course; others share the rest
      const f = i === 0 ? fac[0] : fac[1 + ((i - 1) % (fac.length - 1))];
      allocations.push({
        ...base(`alc_${c.id}_${s.id}`),
        academicYearId: CURRENT_AY,
        courseId: c.id,
        sectionId: s.id,
        facultyId: f.id,
        hoursPerWeek: 5,
        role: 'Theory',
      });
      c.championId = f.id;
    });
    // previous year
    sections
      .filter((s) => s.departmentId === d.id && s.academicYearId === PREV_AY)
      .forEach((s, si) => {
        courses
          .filter((c) => c.departmentId === d.id && c.semesterNo === s.semesterNo)
          .forEach((c, ci) => {
            allocations.push({
              ...base(`alc_${c.id}_${s.id}`),
              academicYearId: PREV_AY,
              courseId: c.id,
              sectionId: s.id,
              facultyId: fac[1 + ((si * 3 + ci) % 7)].id,
              hoursPerWeek: 4,
              role: 'Theory',
            });
          });
      });
  });
  allocations
    .filter((a) => a.academicYearId === CURRENT_AY)
    .forEach((a) => {
      const s = sections.find((x) => x.id === a.sectionId);
      let placed = 0;
      for (let pass = 0; pass < 2 && placed < a.hoursPerWeek; pass++) {
        for (let di = 0; di < 5 && placed < a.hoursPerWeek; di++) {
          for (let p = 1; p <= 6 && placed < a.hoursPerWeek; p++) {
            const day = DAYS[(di + courses.findIndex((c) => c.id === a.courseId)) % 5];
            const secKey = `${s.id}|${day}|${p}`,
              fKey = `${a.facultyId}|${day}|${p}`;
            if (facBusy.has(secKey) || facBusy.has(fKey)) continue;
            if (pass === 0 && timetable.some((t) => t.sectionId === s.id && t.day === day && t.courseId === a.courseId)) continue;
            facBusy.add(secKey);
            facBusy.add(fKey);
            timetable.push({
              ...base(`tt_${s.id}_${day}_${p}`),
              academicYearId: CURRENT_AY,
              sectionId: s.id,
              day,
              period: p,
              courseId: a.courseId,
              facultyId: a.facultyId,
              roomId: s.room,
            });
            placed++;
          }
        }
      }
    });
  db.allocations = allocations;
  db.timetable = timetable;
  // ---------- OBE ----------
  const pos = PO_TITLES.map((t, i) => ({
    ...base('po_' + (i + 1)),
    code: 'PO' + (i + 1),
    title: t,
    statement: `Graduates will demonstrate ${t.toLowerCase()} relevant to engineering practice.`,
    kind: 'PO',
  }));
  pos.push({
    ...base('pso_1'),
    code: 'PSO1',
    title: 'Domain expertise',
    statement: 'Apply domain-specific knowledge to design and develop engineering systems.',
    kind: 'PSO',
  });
  pos.push({
    ...base('pso_2'),
    code: 'PSO2',
    title: 'Professional practice',
    statement: 'Use modern tools and practices to solve real-world industry problems.',
    kind: 'PSO',
  });
  db.programOutcomes = pos;
  const activeCourseIds = new Set(allocations.map((a) => a.courseId));
  const cos = [];
  const maps = [];
  courses
    .filter((c) => activeCourseIds.has(c.id))
    .forEach((c) => {
      for (let k = 1; k <= 5; k++) {
        const id = `co_${c.id}_${k}`;
        cos.push({
          ...base(id),
          courseId: c.id,
          code: `CO${k}`,
          statement: `${CO_VERBS[k - 1]} ${c.name.toLowerCase()}.`,
          bloom: BLOOMS[Math.min(k, 5)],
          target: 60,
        });
        const used = new Set();
        const n = r.int(2, 4);
        for (let j = 0; j < n; j++) {
          let po = r.int(1, 12);
          if (j === 0) po = k <= 2 ? 1 : k === 3 ? 2 : 3;
          if (used.has(po)) continue;
          used.add(po);
          maps.push({ ...base(`map_${id}_${po}`), courseId: c.id, coId: id, poId: 'po_' + po, strength: j === 0 ? 3 : r.int(1, 3) });
        }
        if (r.chance(0.5)) maps.push({ ...base(`map_${id}_pso1`), courseId: c.id, coId: id, poId: 'pso_1', strength: 2 });
      }
    });
  db.courseOutcomes = cos;
  db.coPoMaps = maps;
  // ---------- attendance ----------
  const attendance = [];
  const secStudents = (secId) => students.filter((s) => s.sectionId === secId).map((s) => s.id);
  const prevSecStudents = (secId) => {
    const s = sections.find((x) => x.id === secId);
    return students.filter((x) => x.departmentId === s.departmentId && x.semesterNo === s.semesterNo + 1).map((x) => x.id);
  };
  allocations
    .filter((a) => a.academicYearId === CURRENT_AY)
    .forEach((a, ai) => {
      const ids = secStudents(a.sectionId);
      for (let k = 0; k < 14; k++) {
        let date = addDays('2026-07-14', k * 7 + (ai % 4));
        const dow = new Date(date).getDay();
        if (dow === 0) date = addDays(date, 1);
        if (dow === 6) date = addDays(date, 2);
        if (date > '2026-10-15') continue;
        const marks = {};
        ids.forEach((id) => (marks[id] = r.chance(attP[id]) ? 'P' : r.chance(0.12) ? 'L' : 'A'));
        attendance.push({
          ...base(`att_${a.id}_${k}`),
          createdAt: date + 'T10:00:00.000Z',
          academicYearId: CURRENT_AY,
          courseId: a.courseId,
          sectionId: a.sectionId,
          facultyId: a.facultyId,
          date,
          period: 1 + (k % 6),
          topic: `Unit ${1 + Math.floor(k / 3)} - session ${k + 1}`,
          studentIds: ids,
          marks,
        });
      }
    });
  db.attendance = attendance;
  // ---------- assessments ----------
  const assessments = [];
  const mkMarks = (ids, max, bias = 0) => {
    const m = {};
    ids.forEach((id) => (m[id] = Math.round(clamp(r.normal(ability[id] + bias, 0.1), 0.05, 1) * max)));
    return m;
  };
  const coIdsOf = (cid, ks) => ks.map((k) => `co_${cid}_${k}`);
  allocations.forEach((a) => {
    const cur = a.academicYearId === CURRENT_AY;
    const ids = cur ? secStudents(a.sectionId) : prevSecStudents(a.sectionId);
    const sec = sections.find((s) => s.id === a.sectionId);
    if (!ids.length) return;
    const yr = cur ? '2026' : '2026';
    const defs = cur
      ? [
          ['CIA-1', 'Internal Test', 30, '2026-08-24', [1, 2], true],
          ['Assignment-1', 'Assignment', 10, '2026-09-05', [2, 3], true],
          ['Quiz-1', 'Quiz', 10, '2026-09-19', [1, 3], true],
          ['CIA-2', 'Internal Test', 30, '2026-10-26', [3, 4, 5], false],
        ]
      : [
          ['CIA-1', 'Internal Test', 30, '2026-02-16', [1, 2], true],
          ['Assignment-1', 'Assignment', 10, '2026-03-02', [2, 3], true],
          ['Quiz-1', 'Quiz', 10, '2026-03-16', [1, 3], true],
          ['CIA-2', 'Internal Test', 30, '2026-04-13', [3, 4, 5], true],
          ['End Semester Exam', 'End Semester Exam', 100, '2026-05-18', [1, 2, 3, 4, 5], true],
        ];
    void yr;
    void sec;
    defs.forEach(([n, type, max, date, ks, done], i) => {
      const marks = done ? mkMarks(ids, max, type === 'Assignment' ? 0.12 : 0) : Object.fromEntries(ids.map((id) => [id, null]));
      assessments.push({
        ...base(`asm_${a.id}_${i}`),
        academicYearId: a.academicYearId,
        courseId: a.courseId,
        sectionId: a.sectionId,
        name: n,
        type,
        maxMarks: max,
        date,
        coIds: coIdsOf(a.courseId, ks),
        status: done ? (cur && i === 2 && r.chance(0.5) ? 'Marks Entered' : 'Verified') : 'Scheduled',
        studentIds: ids,
        marks,
      });
    });
  });
  db.assessments = assessments;
  db.resultPublications = allocations.map((a) => ({
    ...base(`rp_${a.id}`),
    academicYearId: a.academicYearId,
    courseId: a.courseId,
    sectionId: a.sectionId,
    status: a.academicYearId === PREV_AY ? 'Published' : 'Draft',
    publishedAt: a.academicYearId === PREV_AY ? '2026-06-12T10:00:00.000Z' : undefined,
    publishedBy: a.academicYearId === PREV_AY ? staffMap['Controller of Examinations'].name : undefined,
  }));
  // ---------- lesson plans ----------
  const lessonPlans = [];
  allocations
    .filter((a) => a.academicYearId === CURRENT_AY)
    .forEach((a) => {
      const c = courses.find((x) => x.id === a.courseId);
      for (let u = 1; u <= 5; u++)
        for (let t = 1; t <= 2; t++) {
          const planned = addDays('2026-07-15', ((u - 1) * 2 + t - 1) * 11);
          const past = planned < '2026-10-16';
          const delayed = past && r.chance(0.12);
          lessonPlans.push({
            ...base(`lp_${a.id}_${u}${t}`),
            academicYearId: CURRENT_AY,
            courseId: a.courseId,
            sectionId: a.sectionId,
            facultyId: a.facultyId,
            unit: u,
            topic: `${c.name} – Unit ${u}: ${t === 1 ? 'Concepts and fundamentals' : 'Applications and problem solving'}`,
            plannedDate: planned,
            completedDate: past && !delayed ? addDays(planned, r.int(0, 2)) : undefined,
            status: past ? (delayed ? 'Delayed' : 'Completed') : 'Planned',
            method: r.pick(['Lecture', 'Lecture + PPT', 'Flipped Classroom', 'Case Study', 'Problem Solving', 'Demonstration']),
            coIds: [`co_${c.id}_${Math.min(u, 5)}`],
          });
        }
    });
  db.lessonPlans = lessonPlans;
  // ---------- question bank ----------
  const questions = [];
  const QT = [
    ['Short Answer', 'Easy', 'Remember', 2],
    ['Short Answer', 'Medium', 'Understand', 2],
    ['Long Answer', 'Medium', 'Apply', 10],
    ['Long Answer', 'Hard', 'Analyze', 10],
    ['MCQ', 'Easy', 'Remember', 1],
    ['Numerical', 'Hard', 'Apply', 8],
  ];
  allocations
    .filter((a) => a.academicYearId === CURRENT_AY)
    .forEach((a, i) => {
      const c = courses.find((x) => x.id === a.courseId);
      QT.forEach(([type, diff, bloom, marks], k) => {
        const u = 1 + (k % 5);
        const stems = {
          'Short Answer': `Define the key terms used in Unit ${u} of ${c.name}.`,
          'Long Answer': `With a neat diagram, explain and analyze the core technique covered in Unit ${u} of ${c.name}. Discuss its merits and limitations.`,
          MCQ: `Which of the following best describes the primary objective of ${c.name} (Unit ${u})?`,
          Numerical: `Solve the given numerical problem applying the methods of Unit ${u} in ${c.name}; show all intermediate steps.`,
        };
        questions.push({
          ...base(`q_${a.id}_${k}`),
          courseId: c.id,
          unit: u,
          topic: `Unit ${u}`,
          text: stems[type],
          type,
          difficulty: diff,
          bloom,
          marks,
          coId: `co_${c.id}_${u}`,
          status: i % 9 === 0 && k === 5 ? 'Pending Review' : 'Approved',
          source: 'Faculty',
          authorId: a.facultyId,
        });
      });
    });
  db.questions = questions;
  // ---------- examinations ----------
  const exams = [];
  const examHalls = rooms.filter((x) => x.type === 'Exam Hall');
  const allFac = employees.filter((e) => e.category === 'Teaching' && e.departmentId);
  allocations
    .filter((a) => a.academicYearId === CURRENT_AY)
    .forEach((a, i) => {
      const c = courses.find((x) => x.id === a.courseId);
      exams.push({
        ...base(`exm_mid_${a.id}`),
        academicYearId: CURRENT_AY,
        name: 'CIA-2 / Mid Term II',
        type: 'Mid Term',
        courseId: c.id,
        date: addDays('2026-10-26', (c.semesterNo % 4) + (i % 4)),
        session: i % 2 ? 'AN' : 'FN',
        roomId: examHalls[i % 4].id,
        invigilatorId: allFac[(i * 7) % allFac.length].id,
        durationMins: 90,
        status: 'Scheduled',
      });
      exams.push({
        ...base(`exm_end_${a.id}`),
        academicYearId: CURRENT_AY,
        name: 'End Semester Examination Nov/Dec 2026',
        type: 'End Semester',
        courseId: c.id,
        date: addDays('2026-11-23', (c.semesterNo - 1) / 2 + (i % 4) * 3),
        session: c.semesterNo <= 3 ? 'FN' : 'AN',
        roomId: examHalls[(i + 1) % 4].id,
        invigilatorId: allFac[(i * 11) % allFac.length].id,
        durationMins: 180,
        status: 'Scheduled',
      });
    });
  db.exams = exams;
  // ---------- course files & evidence ----------
  const courseFiles = [];
  const DOC_TYPES = [
    'Syllabus',
    'Lesson Plan',
    'Lecture Notes',
    'Question Paper',
    'Assignment Evidence',
    'CO Attainment Sheet',
    'Lab Manual',
  ];
  const CRIT = [
    'NBA C2 – Teaching-Learning',
    'NBA C3 – CO & PO Attainment',
    'NBA C4 – Student Performance',
    'NAAC C2 – Teaching-Learning & Evaluation',
  ];
  allocations
    .filter((a) => a.academicYearId === CURRENT_AY)
    .forEach((a, i) => {
      const c = courses.find((x) => x.id === a.courseId);
      const n = 2 + (i % 4);
      for (let k = 0; k < n; k++) {
        const dt = DOC_TYPES[(i + k) % DOC_TYPES.length];
        courseFiles.push({
          ...base(`cf_${a.id}_${k}`),
          academicYearId: CURRENT_AY,
          departmentId: c.departmentId,
          courseId: c.id,
          semesterNo: c.semesterNo,
          title: `${c.code} ${dt}`,
          docType: dt,
          fileName: `${c.code}_${dt.replace(/\s+/g, '_')}.pdf`,
          uploadedById: a.facultyId,
          status: k === n - 1 && i % 3 === 0 ? 'Pending Review' : 'Approved',
          criterion: dt.includes('Attainment') ? CRIT[1] : dt.includes('Question') || dt.includes('Assignment') ? CRIT[2] : CRIT[0],
        });
      }
    });
  db.courseFiles = courseFiles;
  db.evidence = courseFiles
    .filter((f) => f.status === 'Approved')
    .slice(0, 140)
    .map((f, i) => ({
      ...base('ev_' + i),
      framework: f.criterion.startsWith('NAAC') ? 'NAAC' : 'NBA',
      criterion: f.criterion,
      title: f.title,
      courseFileId: f.id,
      departmentId: f.departmentId,
      status: i % 3 ? 'Verified' : 'Mapped',
    }));
  // ---------- mentoring ----------
  const meetings = [];
  const CONCERNS = [
    'Low attendance in core courses',
    'Difficulty with problem solving in mathematics',
    'Career guidance – higher studies',
    'Internship planning',
    'Personal / health related absence',
    'Preparation for placements',
    'Backlog clearance plan',
    'Project topic selection',
  ];
  students.forEach((s, i) => {
    if (i % 2 === 0 || attP[s.id] < 0.75) {
      const low = attP[s.id] < 0.75 || ability[s.id] < 0.5;
      meetings.push({
        ...base(`mm_${s.id}`),
        mentorId: s.mentorId,
        studentId: s.id,
        date: addDays('2026-08-10', i % 50),
        mode: r.pick(['In-person', 'In-person', 'Online', 'Phone']),
        concerns: low ? r.pick(CONCERNS.slice(0, 2).concat(CONCERNS[6])) : r.pick(CONCERNS.slice(2)),
        actionItems: low
          ? 'Attend remedial classes; weekly check-in with mentor; parent to be informed.'
          : 'Share resources; follow up after mid-term.',
        followUpDate: addDays('2026-09-20', i % 40),
        followUpStatus: low ? r.pick(['Open', 'In Progress']) : 'Closed',
        confidential: low && r.chance(0.3),
      });
    }
  });
  db.mentoringMeetings = meetings;
  // ---------- admissions ----------
  const applicants = [];
  for (let i = 0; i < 45; i++) {
    const g = r.chance(0.45) ? 'Female' : 'Male';
    const nm = name(g);
    const st = r.pick(['Applied', 'Applied', 'Under Review', 'Under Review', 'Approved', 'Rejected', 'Admitted']);
    applicants.push({
      ...base('app_' + i),
      appNo: 'ADM27' + String(1001 + i),
      name: nm,
      email: nm.toLowerCase().replace(/\s+/g, '.') + '@mail.demo',
      phone: phone(),
      gender: g,
      dob: `2008-${String(r.int(1, 12)).padStart(2, '0')}-${String(r.int(1, 28)).padStart(2, '0')}`,
      programId: r.pick(programs).id,
      entranceExam: r.pick(['EAPCET', 'JEE Main', 'Management Quota']),
      rank: r.int(800, 45000),
      qualifyingPercent: r.int(62, 98),
      category: r.pick(['OC', 'BC-A', 'BC-B', 'SC', 'ST', 'EWS']),
      status: st === 'Admitted' ? 'Approved' : st,
      docs: {
        'Intermediate Marksheet': r.chance(0.9),
        'Transfer Certificate': r.chance(0.8),
        'Rank Card': r.chance(0.9),
        'Caste Certificate': r.chance(0.7),
        Aadhaar: true,
        Photographs: r.chance(0.95),
      },
      appliedOn: addDays('2026-09-01', i),
    });
  }
  db.applicants = applicants;
  // ---------- finance ----------
  const feeStructures = programs.map((p) => ({
    ...base('fs_' + p.id),
    academicYearId: CURRENT_AY,
    programId: p.id,
    name: `${p.code} Annual Fee 2026-27`,
    tuition: p.level === 'PG' ? 90000 : p.code.includes('CSE') || p.code.includes('IT') ? 115000 : 98000,
    exam: 3500,
    development: 12000,
    other: 4500,
  }));
  db.feeStructures = feeStructures;
  const invoices = [];
  const payments = [];
  let rcpt = 1;
  students.forEach((s, i) => {
    const fs = feeStructures.find((f) => f.programId === s.programId);
    const amount = fs.tuition + fs.exam + fs.development + fs.other;
    const roll = r.next();
    const paid = roll < 0.62 ? amount : roll < 0.84 ? Math.round((amount * r.int(30, 70)) / 100 / 1000) * 1000 : 0;
    const inv = {
      ...base('inv_' + s.id),
      invoiceNo: 'INV26-' + String(10001 + i),
      studentId: s.id,
      academicYearId: CURRENT_AY,
      feeStructureId: fs.id,
      description: fs.name,
      amount,
      dueDate: '2026-08-31',
      paid,
      status: paid >= amount ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Unpaid',
    };
    invoices.push(inv);
    if (paid > 0) {
      const parts = paid === amount && r.chance(0.4) ? [Math.round(amount / 2), amount - Math.round(amount / 2)] : [paid];
      parts.forEach((p, k) => {
        const date = addDays('2026-07-05', r.int(0, 70) + k * 20);
        payments.push({
          ...base('pay_' + rcpt),
          createdAt: date + 'T11:00:00.000Z',
          receiptNo: 'RCPT26-' + String(50000 + rcpt),
          invoiceId: inv.id,
          studentId: s.id,
          amount: p,
          date,
          mode: r.pick(['UPI', 'UPI', 'Bank Transfer', 'Card', 'DD', 'Cash']),
          reference: 'TXN' + r.int(10000000, 99999999),
          recordedBy: staffMap['Finance Officer'].name,
        });
        rcpt++;
      });
    }
  });
  db.invoices = invoices;
  db.payments = payments;
  // ---------- library ----------
  const BOOKS = [
    ['Introduction to Algorithms', 'Thomas H. Cormen', 'Computer Science'],
    ['Operating System Concepts', 'Abraham Silberschatz', 'Computer Science'],
    ['Computer Networking: A Top-Down Approach', 'James Kurose', 'Computer Science'],
    ['Database System Concepts', 'Henry Korth', 'Computer Science'],
    ['Artificial Intelligence: A Modern Approach', 'Stuart Russell', 'Computer Science'],
    ['Pattern Recognition and Machine Learning', 'Christopher Bishop', 'Computer Science'],
    ['Clean Code', 'Robert C. Martin', 'Computer Science'],
    ['Compilers: Principles, Techniques and Tools', 'Alfred Aho', 'Computer Science'],
    ['Microelectronic Circuits', 'Adel Sedra', 'Electronics'],
    ['Signals and Systems', 'Alan Oppenheim', 'Electronics'],
    ['Digital Design', 'M. Morris Mano', 'Electronics'],
    ['Communication Systems', 'Simon Haykin', 'Electronics'],
    ['CMOS VLSI Design', 'Neil Weste', 'Electronics'],
    ['Electrical Machinery', 'P. S. Bimbhra', 'Electrical'],
    ['Power System Engineering', 'D. P. Kothari', 'Electrical'],
    ['Power Electronics', 'M. H. Rashid', 'Electrical'],
    ['Modern Control Engineering', 'Katsuhiko Ogata', 'Electrical'],
    ['Engineering Thermodynamics', 'P. K. Nag', 'Mechanical'],
    ['Fluid Mechanics', 'Frank M. White', 'Mechanical'],
    ['Design of Machine Elements', 'V. B. Bhandari', 'Mechanical'],
    ['Heat and Mass Transfer', 'Yunus Cengel', 'Mechanical'],
    ['Theory of Machines', 'S. S. Rattan', 'Mechanical'],
    ['Surveying Vol. 1', 'B. C. Punmia', 'Civil'],
    ['Concrete Technology', 'M. S. Shetty', 'Civil'],
    ['Structural Analysis', 'R. C. Hibbeler', 'Civil'],
    ['Soil Mechanics and Foundations', 'B. C. Punmia', 'Civil'],
    ['Higher Engineering Mathematics', 'B. S. Grewal', 'Mathematics'],
    ['Advanced Engineering Mathematics', 'Erwin Kreyszig', 'Mathematics'],
    ['Engineering Physics', 'R. K. Gaur', 'Physics'],
    ['Engineering Chemistry', 'Jain & Jain', 'Chemistry'],
    ['The Pragmatic Programmer', 'David Thomas', 'Computer Science'],
    ['Wings of Fire', 'A. P. J. Abdul Kalam', 'General'],
    ['Quantitative Aptitude', 'R. S. Aggarwal', 'Aptitude'],
    ['Word Power Made Easy', 'Norman Lewis', 'General'],
  ];
  const books = BOOKS.map(([t, a, c], i) => {
    const copies = r.int(3, 12);
    return {
      ...base('bk_' + i),
      accessionNo: 'ACC' + String(20001 + i * 13),
      isbn: '978' + r.int(1000000000, 9999999999),
      title: t,
      author: a,
      publisher: r.pick(['Pearson', 'McGraw Hill', 'Wiley', 'Oxford', 'Cengage', 'PHI Learning', 'Khanna Publishers']),
      category: c,
      copies,
      available: copies,
      rack: `R-${String.fromCharCode(65 + (i % 8))}${1 + (i % 5)}`,
      year: r.int(2005, 2023),
    };
  });
  const issues = [];
  for (let i = 0; i < 70; i++) {
    const b = r.pick(books);
    if (b.available <= 1) continue;
    const st = r.pick(students);
    const issueDate = addDays('2026-08-01', r.int(0, 70));
    const due = addDays(issueDate, 14);
    const returned = r.chance(0.5) && due < '2026-10-14';
    const returnDate = returned ? addDays(issueDate, r.int(5, 20)) : undefined;
    const late = returnDate ? Math.max(0, Math.round((+new Date(returnDate) - +new Date(due)) / 86400000)) : 0;
    if (!returned) b.available--;
    issues.push({
      ...base('iss_' + i),
      bookId: b.id,
      memberType: 'Student',
      memberId: st.id,
      issueDate,
      dueDate: due,
      returnDate,
      fine: late * 2,
      status: returned ? 'Returned' : 'Issued',
    });
  }
  db.books = books;
  db.bookIssues = issues;
  // ---------- hostel ----------
  db.hostels = [
    { ...base('hos_boys'), name: 'Krishna Boys Hostel', type: 'Boys', warden: staffMap['Hostel Warden'].name, floors: 4 },
    { ...base('hos_girls'), name: 'Godavari Girls Hostel', type: 'Girls', warden: 'Mrs. ' + name('Female'), floors: 3 },
  ];
  const hRooms = [];
  ['hos_boys', 'hos_girls'].forEach((h) => {
    for (let f = 1; f <= 3; f++)
      for (let k = 1; k <= 8; k++)
        hRooms.push({
          ...base(`hr_${h}_${f}${k}`),
          hostelId: h,
          roomNo: `${f}0${k}`,
          capacity: k <= 2 ? 2 : 3,
          type: k <= 2 ? 'Double (AC)' : 'Triple',
          fee: k <= 2 ? 95000 : 72000,
        });
  });
  db.hostelRooms = hRooms;
  const hAlloc = [];
  const occ = {};
  students.forEach((s, i) => {
    if (i % 3 !== 0) return;
    const h = s.gender === 'Male' ? 'hos_boys' : 'hos_girls';
    const room = hRooms.find((x) => x.hostelId === h && (occ[x.id] ?? 0) < x.capacity);
    if (!room) return;
    occ[room.id] = (occ[room.id] ?? 0) + 1;
    hAlloc.push({ ...base('ha_' + s.id), roomId: room.id, studentId: s.id, fromDate: '2026-07-10', status: 'Allocated' });
  });
  db.hostelAllocations = hAlloc;
  // ---------- transport ----------
  const vehicles = [];
  const routes = [];
  const RT = [
    ['Benz Circle', 'Benz Circle, Ring Road, Auto Nagar, Kanuru'],
    ['Gannavaram', 'Gannavaram, Kesarapalli, Enikepadu, Ramavarappadu'],
    ['Guntur', 'Guntur Bus Stand, Mangalagiri, Tadepalli, Kunchanapalli'],
    ['Ibrahimpatnam', 'Ibrahimpatnam, Gollapudi, Bhavanipuram, Vidyadharapuram'],
    ['Nuzvid', 'Nuzvid, Hanuman Junction, Gannavaram, Nidamanuru'],
    ['Machilipatnam', 'Machilipatnam, Pamarru, Vuyyuru, Kankipadu'],
  ];
  RT.forEach(([n, stops], i) => {
    vehicles.push({
      ...base('veh_' + i),
      regNo: `AP 16 TB ${4400 + i * 37}`,
      type: i < 4 ? 'Bus (52 seater)' : 'Mini Bus (32 seater)',
      capacity: i < 4 ? 52 : 32,
      driver: name('Male'),
      driverPhone: phone(),
      status: i === 5 ? 'Maintenance' : 'In Service',
    });
    routes.push({
      ...base('rt_' + i),
      code: 'R' + (i + 1),
      name: n + ' Route',
      vehicleId: 'veh_' + i,
      stops,
      distanceKm: r.int(12, 48),
      fee: 18000 + i * 2500,
    });
  });
  db.vehicles = vehicles;
  db.routes = routes;
  db.transportAllocations = students
    .filter((_, i) => i % 3 === 1 && i % 2 === 0)
    .map((s, i) => {
      const rt = routes[i % routes.length];
      return { ...base('ta_' + s.id), routeId: rt.id, studentId: s.id, stop: rt.stops.split(', ')[i % 4], status: 'Active' };
    });
  // ---------- assets ----------
  const ASSETS = [
    ['Desktop Computer (i7, 16GB)', 'IT Equipment', 62000],
    ['Laptop', 'IT Equipment', 78000],
    ['LCD Projector', 'AV Equipment', 45000],
    ['Interactive Smart Board', 'AV Equipment', 135000],
    ['Digital Storage Oscilloscope', 'Lab Equipment', 88000],
    ['Function Generator', 'Lab Equipment', 24000],
    ['CNC Lathe Trainer', 'Lab Equipment', 650000],
    ['Universal Testing Machine', 'Lab Equipment', 920000],
    ['Total Station', 'Survey Equipment', 410000],
    ['Network Switch (48 port)', 'IT Equipment', 95000],
    ['Air Conditioner 2T', 'Electrical', 58000],
    ['Diesel Generator 125kVA', 'Electrical', 1250000],
    ['Steel Almirah', 'Furniture', 14000],
    ['Classroom Bench Set', 'Furniture', 6500],
  ];
  db.assets = Array.from({ length: 64 }, (_, i) => {
    const [n, c, cost] = ASSETS[i % ASSETS.length];
    const d = departments[i % 6];
    return {
      ...base('ast_' + i),
      assetId: `KV/${c.split(' ')[0].toUpperCase().slice(0, 3)}/${String(2000 + i)}`,
      name: n,
      category: c,
      location: `${d.block}, ${rooms[(i % 6) * 5 + (i % 5)].code}`,
      departmentId: d.id,
      purchaseDate: `${r.int(2016, 2026)}-${String(r.int(1, 12)).padStart(2, '0')}-15`,
      cost,
      vendor: r.pick(['Dell India', 'HP India', 'Tektronix', 'Keysight', 'Godrej', 'Voltas', 'Kirloskar', 'Local Vendor']),
      status: r.pick(['In Use', 'In Use', 'In Use', 'In Store', 'Under Repair']),
    };
  });
  // ---------- placements ----------
  const COMP = [
    ['TCS', 'IT Services', 'Regular'],
    ['Infosys', 'IT Services', 'Regular'],
    ['Wipro', 'IT Services', 'Regular'],
    ['Accenture', 'Consulting', 'Regular'],
    ['Cognizant', 'IT Services', 'Regular'],
    ['Capgemini', 'IT Services', 'Regular'],
    ['Deloitte', 'Consulting', 'Super Dream'],
    ['Amazon', 'Product', 'Dream'],
    ['Microsoft', 'Product', 'Dream'],
    ['Texas Instruments', 'Semiconductors', 'Dream'],
    ['L&T Construction', 'Infrastructure', 'Super Dream'],
    ['Tata Power', 'Energy', 'Super Dream'],
    ['Bosch', 'Automotive', 'Super Dream'],
    ['Zoho', 'Product', 'Super Dream'],
    ['HCLTech', 'IT Services', 'Regular'],
  ];
  db.companies = COMP.map(([n, s, t], i) => ({
    ...base('cmp_' + i),
    name: n,
    sector: s,
    website: `https://www.${n.toLowerCase().replace(/[^a-z]/g, '')}.com`,
    contactPerson: name(r.chance(0.5) ? 'Male' : 'Female'),
    contactEmail: `campus@${n.toLowerCase().replace(/[^a-z]/g, '')}.example`,
    tier: t,
  }));
  const allDepts = departments.map((d) => d.id);
  const DRV = [
    [0, 'Assistant System Engineer', 3.6, 6.0, allDepts, 'Completed', '2026-08-12'],
    [1, 'Systems Engineer', 3.6, 6.0, allDepts, 'Completed', '2026-08-26'],
    [3, 'Associate Software Engineer', 4.5, 6.5, allDepts, 'Completed', '2026-09-09'],
    [6, 'Analyst', 7.6, 7.0, ['dep_cse', 'dep_it', 'dep_ece'], 'Completed', '2026-09-23'],
    [13, 'Member Technical Staff', 8.4, 7.5, ['dep_cse', 'dep_it'], 'Ongoing', '2026-10-14'],
    [9, 'Analog Design Engineer', 18, 8.0, ['dep_ece', 'dep_eee'], 'Upcoming', '2026-10-28'],
    [10, 'Graduate Engineer Trainee', 6.5, 6.5, ['dep_civil', 'dep_mech'], 'Upcoming', '2026-11-04'],
    [7, 'SDE I', 32, 8.0, ['dep_cse', 'dep_it'], 'Upcoming', '2026-11-18'],
    [12, 'Associate Engineer', 7.2, 7.0, ['dep_mech', 'dep_eee', 'dep_ece'], 'Upcoming', '2026-11-25'],
    [11, 'Engineer Trainee', 6.8, 6.5, ['dep_eee'], 'Completed', '2026-09-30'],
  ];
  db.drives = DRV.map(([c, role, ctc, cg, deps, st, date], i) => ({
    ...base('drv_' + i),
    companyId: 'cmp_' + c,
    role,
    ctcLpa: ctc,
    date,
    minCgpa: cg,
    eligibleDepartmentIds: deps,
    maxBacklogs: cg >= 8 ? 0 : 1,
    status: st,
    academicYearId: CURRENT_AY,
  }));
  const papps = [];
  const finalYears = students.filter((s) => s.semesterNo === 7);
  const selected = new Set();
  db.drives.forEach((d) => {
    finalYears
      .filter((s) => d.eligibleDepartmentIds.includes(s.departmentId) && (s.cgpa ?? 0) >= d.minCgpa)
      .forEach((s) => {
        if (r.chance(0.25)) return;
        let st = 'Applied';
        if (d.status === 'Completed')
          st = !selected.has(s.id) && r.chance(0.3 + ability[s.id] * 0.3) ? 'Selected' : r.chance(0.3) ? 'Shortlisted' : 'Rejected';
        else if (d.status === 'Ongoing') st = r.chance(0.4) ? 'Shortlisted' : 'Applied';
        if (st === 'Selected') selected.add(s.id);
        papps.push({ ...base(`pa_${d.id}_${s.id}`), driveId: d.id, studentId: s.id, status: st, appliedOn: addDays(d.date, -7) });
      });
  });
  db.placementApplications = papps;
  // ---------- alumni ----------
  db.alumni = Array.from({ length: 60 }, (_, i) => {
    const d = departments[i % 6];
    const g = r.chance(0.4) ? 'Female' : 'Male';
    const nm = name(g);
    return {
      ...base('alm_' + i),
      name: nm,
      email: nm.toLowerCase().replace(/\s+/g, '.') + '@alumni.' + DEMO_DOMAIN,
      departmentId: d.id,
      programId: 'prg_' + d.code.toLowerCase(),
      graduationYear: r.int(2012, 2026),
      company: r.pick(COMP)[0],
      designation: r.pick([
        'Software Engineer',
        'Senior Engineer',
        'Project Manager',
        'Design Engineer',
        'Consultant',
        'Team Lead',
        'Founder',
        'Graduate Student',
      ]),
      location: r.pick(['Hyderabad', 'Bengaluru', 'Chennai', 'Pune', 'USA', 'Germany', 'Vijayawada']),
      engagement: r.pick(['Guest Lecture', 'Mentor', 'Recruiter', 'Donor', 'None', 'None']),
    };
  });
  // ---------- communication ----------
  db.announcements = [
    {
      title: 'CIA-2 examinations from 26 October',
      body: 'Second continuous internal assessment for all UG programs will commence on 26 Oct 2026. Hall tickets will be issued by the respective departments.',
      audienceRoles: ['student', 'faculty', 'hod', 'parent', 'exam-cell'],
      priority: 'Important',
      publishDate: '2026-10-12',
    },
    {
      title: 'Fee payment reminder – Term 1',
      body: 'Students with outstanding fee balance are requested to clear dues before 31 Oct 2026 to avoid late fee.',
      audienceRoles: ['student', 'parent', 'finance'],
      priority: 'Urgent',
      publishDate: '2026-10-10',
    },
    {
      title: 'NBA Pre-visit preparation meeting',
      body: 'All HODs, program coordinators and IQAC members are requested to attend the NBA pre-visit review on 22 Oct 2026 at 3 PM in Seminar Hall.',
      audienceRoles: ['hod', 'program-coordinator', 'iqac', 'accreditation', 'principal', 'dean'],
      priority: 'Important',
      publishDate: '2026-10-14',
    },
    {
      title: 'Zoho campus drive – registrations open',
      body: 'Eligible final-year CSE and IT students must register on the placement portal by 20 Oct 2026.',
      audienceRoles: ['student', 'placement', 'hod'],
      departmentId: undefined,
      semesterNo: 7,
      priority: 'Normal',
      publishDate: '2026-10-09',
    },
    {
      title: 'Faculty Development Programme on Generative AI in Education',
      body: 'A 5-day FDP will be conducted from 3 Nov 2026. Interested faculty may register with the IQAC office.',
      audienceRoles: ['faculty', 'hod', 'course-champion', 'mentor', 'iqac'],
      priority: 'Normal',
      publishDate: '2026-10-07',
    },
    {
      title: 'Library – new arrivals',
      body: '120 new titles in AI, VLSI and Structural Engineering have been added. Visit the library catalogue.',
      audienceRoles: ['student', 'faculty', 'library'],
      priority: 'Normal',
      publishDate: '2026-10-03',
    },
    {
      title: 'Dussehra holidays',
      body: 'The college will remain closed from 19 Oct to 21 Oct 2026 on account of Dussehra.',
      audienceRoles: [
        'management',
        'principal',
        'dean',
        'hod',
        'program-coordinator',
        'course-champion',
        'faculty',
        'mentor',
        'exam-cell',
        'iqac',
        'accreditation',
        'student',
        'parent',
        'hr',
        'finance',
        'placement',
        'library',
        'it-admin',
      ],
      priority: 'Important',
      publishDate: '2026-10-11',
    },
  ].map((a, i) => ({
    ...base('ann_' + i),
    ...a,
    expiryDate: '2026-11-30',
    authorName: i === 1 ? staffMap['Finance Officer'].name : staffMap['Principal'].name,
  }));
  db.feedbackForms = [
    {
      ...base('ff_0'),
      title: 'Mid-semester course feedback – Odd 2026',
      type: 'Course',
      academicYearId: CURRENT_AY,
      questions: [
        'Clarity of explanation',
        'Pace of teaching',
        'Use of examples & applications',
        'Availability for doubts',
        'Overall satisfaction',
      ],
      status: 'Open',
      closesOn: '2026-10-31',
    },
    {
      ...base('ff_1'),
      title: 'Library & infrastructure feedback',
      type: 'Facility',
      academicYearId: CURRENT_AY,
      questions: ['Availability of books', 'Reading room ambience', 'Internet & e-resources', 'Staff helpfulness'],
      status: 'Open',
      closesOn: '2026-11-15',
    },
    {
      ...base('ff_2'),
      title: 'Exit survey – Batch 2022-26',
      type: 'Exit',
      academicYearId: PREV_AY,
      questions: ['Curriculum relevance', 'Placement support', 'Faculty quality', 'Campus facilities', 'Would recommend the college'],
      status: 'Closed',
      closesOn: '2026-06-15',
    },
  ];
  const fbr = [];
  db.feedbackForms.forEach((f) => {
    for (let i = 0; i < 40; i++)
      fbr.push({
        ...base(`fr_${f.id}_${i}`),
        formId: f.id,
        respondentId: students[(i * 7) % students.length].id,
        ratings: f.questions.map(() => clamp(Math.round(r.normal(3.9, 0.8)), 1, 5)),
        comment: r.pick([
          '',
          '',
          'Good overall.',
          'Need more practical sessions.',
          'Excellent faculty support.',
          'Wi-Fi coverage should improve.',
          'More industry exposure please.',
        ]),
      });
  });
  db.feedbackResponses = fbr;
  const TCAT = [
    ['Academic', 'Clarification on CIA-1 marks'],
    ['Hostel', 'Water supply issue on 2nd floor'],
    ['Transport', 'Bus delay on Guntur route'],
    ['Fees', 'Scholarship amount not reflected'],
    ['IT / Wi-Fi', 'Unable to access LMS'],
    ['Library', 'Fine waiver request'],
    ['Examination', 'Hall ticket name correction'],
    ['Certificates', 'Bonafide certificate required'],
  ];
  db.tickets = Array.from({ length: 22 }, (_, i) => {
    const s = students[(i * 13) % students.length];
    const [cat, sub] = TCAT[i % TCAT.length];
    const st = r.pick(['Open', 'Open', 'In Progress', 'Resolved', 'Closed']);
    return {
      ...base('tkt_' + i),
      createdAt: addDays('2026-09-10', (i * 1.5) | 0) + 'T09:30:00.000Z',
      ticketNo: 'TKT-' + String(2401 + i),
      studentId: s.id,
      raisedBy: s.id,
      raisedByName: s.name,
      category: cat,
      subject: sub,
      description: `${sub}. Kindly look into this at the earliest.`,
      priority: r.pick(['Low', 'Medium', 'Medium', 'High', 'Critical']),
      assignedTo: st === 'Open' ? undefined : r.pick(['Office Superintendent', 'Hostel Warden', 'System Administrator', 'Finance Officer']),
      status: st,
      responses:
        st === 'Open'
          ? []
          : [
              {
                at: addDays('2026-09-12', i) + 'T11:00:00.000Z',
                by: 'Support Desk',
                text: 'We have received your request and are working on it.',
              },
            ],
    };
  });
  db.leaveRequests = Array.from({ length: 14 }, (_, i) => {
    const s = students[(i * 17 + 3) % students.length];
    const from = addDays('2026-09-01', i * 3);
    return {
      ...base('lr_' + i),
      studentId: s.id,
      fromDate: from,
      toDate: addDays(from, 1 + (i % 3)),
      reason: r.pick([
        'Medical – fever',
        'Family function',
        'Inter-college sports meet',
        'Hackathon participation',
        'Medical – hospitalisation',
      ]),
      status: i < 9 ? 'Approved' : 'Pending',
      approvedBy: i < 9 ? 'HOD' : undefined,
    };
  });
  db.events = [
    ['CIA-2 Examinations begin', '2026-10-26', 'Exam'],
    ['NBA Pre-visit Review', '2026-10-22', 'Meeting'],
    ['Dussehra Holidays', '2026-10-19', 'Holiday'],
    ['Texas Instruments Campus Drive', '2026-10-28', 'Placement'],
    ['FDP on Generative AI', '2026-11-03', 'Academic'],
    ['L&T Construction Drive', '2026-11-04', 'Placement'],
    ['Annual Technical Fest – TechKaveri', '2026-11-12', 'Cultural'],
    ['Amazon SDE Hiring', '2026-11-18', 'Placement'],
    ['End Semester Examinations begin', '2026-11-23', 'Exam'],
    ['Academic Council Meeting', '2026-11-06', 'Meeting'],
    ['Last Instruction Day – Odd Semester', '2026-11-20', 'Academic'],
    ['Even Semester Commencement', '2027-01-04', 'Academic'],
  ].map(([t, d, ty], i) => ({ ...base('evt_' + i), title: t, date: d, type: ty }));
  db.notifications = [
    {
      role: 'hod',
      title: 'Lesson plans delayed',
      message: '8 lesson-plan topics are behind schedule in your department.',
      link: '/academic/lesson-plans',
    },
    {
      role: 'faculty',
      title: 'CIA-2 marks entry',
      message: 'CIA-2 marks entry window opens on 27 Oct 2026.',
      link: '/academic/assessments',
    },
    { role: 'student', title: 'Fee due reminder', message: 'Please clear outstanding fee before 31 Oct 2026.', link: '/admin/finance' },
    {
      role: 'parent',
      title: 'Attendance update',
      message: 'Monthly attendance report for September is now available.',
      link: '/academic/attendance',
    },
    {
      role: 'exam-cell',
      title: 'Exam timetable',
      message: 'End-semester timetable draft ready for verification.',
      link: '/academic/examinations',
    },
    {
      role: 'principal',
      title: 'Approvals pending',
      message: 'Admissions and course-file approvals are awaiting action.',
      link: '/dashboard',
    },
    {
      role: 'it-admin',
      title: 'Backup completed',
      message: 'Nightly database backup completed successfully.',
      link: '/settings/audit-logs',
    },
    {
      role: 'finance',
      title: 'Outstanding dues',
      message: 'Outstanding balances exceed ₹1 crore across programs.',
      link: '/admin/finance',
    },
    { role: 'placement', title: 'Zoho drive ongoing', message: 'Shortlist for Zoho drive to be uploaded.', link: '/services/placements' },
    { role: 'library', title: 'Overdue books', message: 'Several books are overdue; send reminders.', link: '/admin/library' },
  ].map((n, i) => ({ ...base('ntf_' + i), createdAt: addDays('2026-10-10', i % 6) + 'T08:00:00.000Z', read: false, readBy: [], ...n }));
  db.auditLogs = [];
  db.accessRequests = [
    {
      ...base('req_1'),
      name: 'Dr. Meera Pillai',
      email: 'meera.pillai@kvce.demo',
      phone: '9876543210',
      requestedRole: 'faculty',
      departmentId: 'dep_ece',
      reference: 'EMP joining order KV/HR/2026/114',
      message: 'Joined ECE department on 1 Oct 2026. Requesting faculty access for attendance and assessments.',
      status: 'Pending',
    },
  ];
  db.settings = [
    {
      ...base('settings'),
      institutionName: import.meta.env.VITE_INSTITUTION_NAME || 'Kaveri Valley College of Engineering',
      shortName: import.meta.env.VITE_INSTITUTION_SHORT || 'KVCE',
      address: 'Kanuru, Vijayawada, Andhra Pradesh 520007',
      affiliation: 'Affiliated to JNTU Kakinada · Approved by AICTE (demo institution)',
      currentAcademicYearId: CURRENT_AY,
      minAttendance: 75,
      assessmentWeights: { 'Internal Test': 25, Assignment: 10, Quiz: 5, 'End Semester Exam': 60 },
      gradeRules: [
        { grade: 'O', min: 90, points: 10 },
        { grade: 'A+', min: 80, points: 9 },
        { grade: 'A', min: 70, points: 8 },
        { grade: 'B+', min: 60, points: 7 },
        { grade: 'B', min: 50, points: 6 },
        { grade: 'C', min: 40, points: 5 },
        { grade: 'F', min: 0, points: 0 },
      ],
      passMarks: 40,
      coTargetPercent: 60,
      attainmentLevels: { level3: 70, level2: 60, level1: 50 },
      libraryFinePerDay: 2,
      libraryLoanDays: 14,
      directWeight: 80,
    },
  ];
  // ---------- users (demo accounts; hashes filled by buildSeed) ----------
  const cseFac = deptFaculty['dep_cse'];
  const demoStudent = students.find((s) => s.departmentId === 'dep_cse' && s.semesterNo === 5);
  const mentorFac = employees.find((e) => e.id === demoStudent.mentorId);
  const facultyFac = cseFac.find((f) => f.id !== mentorFac.id && f.designation === 'Assistant Professor');
  const U = (role, nm, extra = {}) => ({ ...base('usr_' + role), email: `${role}@${DEMO_DOMAIN}`, name: nm, role, ...extra });
  db.users = [
    U('management', 'Sri ' + name('Male') + ' (Chairman)'),
    U('principal', staffMap['Principal'].name, { employeeId: staffMap['Principal'].id }),
    U('dean', staffMap['Dean - Academics'].name, { employeeId: staffMap['Dean - Academics'].id }),
    U('hod', cseFac[0].name, { employeeId: cseFac[0].id, departmentId: 'dep_cse' }),
    U('program-coordinator', cseFac[1].name, { employeeId: cseFac[1].id, departmentId: 'dep_cse' }),
    U('course-champion', cseFac[2].name, { employeeId: cseFac[2].id, departmentId: 'dep_cse' }),
    U('faculty', facultyFac.name, { employeeId: facultyFac.id, departmentId: 'dep_cse' }),
    U('mentor', mentorFac.name, { employeeId: mentorFac.id, departmentId: 'dep_cse' }),
    U('exam-cell', staffMap['Controller of Examinations'].name, { employeeId: staffMap['Controller of Examinations'].id }),
    U('iqac', staffMap['IQAC Coordinator'].name, { employeeId: staffMap['IQAC Coordinator'].id }),
    U('accreditation', 'Dr. ' + name('Female') + ' (NBA Coordinator)'),
    U('student', demoStudent.name, { studentId: demoStudent.id, departmentId: 'dep_cse', linkedStudentIds: [demoStudent.id] }),
    U('parent', demoStudent.parentName, { linkedStudentIds: [demoStudent.id], phone: demoStudent.parentPhone }),
    U('hr', staffMap['HR Manager'].name, { employeeId: staffMap['HR Manager'].id }),
    U('finance', staffMap['Finance Officer'].name, { employeeId: staffMap['Finance Officer'].id }),
    U('placement', staffMap['Training & Placement Officer'].name, { employeeId: staffMap['Training & Placement Officer'].id }),
    U('library', staffMap['Librarian'].name, { employeeId: staffMap['Librarian'].id }),
    U('it-admin', staffMap['System Administrator'].name, { employeeId: staffMap['System Administrator'].id }),
  ];
  return db;
}
const DEPT_DOMAIN = DEMO_DOMAIN;
/** Full seed including PBKDF2 password hashes for demo users. */
export async function buildSeed() {
  const db = generateSeed();
  for (const u of db.users) {
    u.salt = u.id + '.kvce';
    u.passwordHash = await hashPassword(DEMO_PASSWORD, u.salt);
  }
  return db;
}
