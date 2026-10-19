import { addDays, hashPassword, rng } from '../lib/utils';
import { canonical, sha256 } from '../lib/signature';
import {
  ADMISSION_SOURCES,
  DISCOUNT_REASONS,
  PROVISIONS,
  REFERENCE_TYPES,
  invNet,
  invStatus,
} from '../lib/domain';
export const DEMO_PASSWORD = 'Demo@123';
export const DEMO_DOMAIN = 'kvce.demo';
export const CURRENT_AY = 'ay_2026';
export const PREV_AY = 'ay_2025';
/** "Today" in the synthetic dataset; demo receipts, leaves and SMS cluster around it. */
export const SEED_TODAY = '2026-10-19';
const TS = '2026-07-01T09:00:00.000Z';
const base = (id, createdAt = TS) => ({ id, createdAt, updatedAt: createdAt, active: true });
const FIRST_M = ['Aarav', 'Vihaan', 'Arjun', 'Sai', 'Rohan', 'Karthik', 'Rahul', 'Aditya', 'Nikhil', 'Pranav', 'Harsha', 'Varun',
  'Siddharth', 'Manoj', 'Kiran', 'Abhishek', 'Teja', 'Akash', 'Vivek', 'Naveen', 'Ravi', 'Surya', 'Ganesh', 'Charan', 'Mahesh'];
const FIRST_F = ['Ananya', 'Diya', 'Priya', 'Sneha', 'Kavya', 'Meghana', 'Divya', 'Pooja', 'Lakshmi', 'Swathi', 'Harini', 'Nandini',
  'Bhavana', 'Keerthi', 'Sravani', 'Aishwarya', 'Riya', 'Tanvi', 'Sahithi', 'Navya', 'Deepika', 'Sindhu', 'Pallavi', 'Shreya'];
const LAST = ['Reddy', 'Sharma', 'Rao', 'Naidu', 'Iyer', 'Patel', 'Kumar', 'Gupta', 'Varma', 'Chowdary', 'Nair', 'Menon', 'Krishnan',
  'Joshi', 'Bhat', 'Pillai', 'Das', 'Murthy', 'Shetty', 'Prasad'];
const DEPTS = [
  ['CSE', 'Computer Science & Engineering'],
  ['ECE', 'Electronics & Communication Engineering'],
  ['EEE', 'Electrical & Electronics Engineering'],
  ['MECH', 'Mechanical Engineering'],
  ['CIVIL', 'Civil Engineering'],
  ['IT', 'Information Technology'],
];
const CITIES = ['Vijayawada', 'Guntur', 'Eluru', 'Machilipatnam', 'Tenali', 'Ongole', 'Rajahmundry', 'Nellore', 'Kakinada', 'Bhimavaram'];
const pad = (n, w = 2) => String(n).padStart(w, '0');

export function generateSeed() {
  const r = rng(20261019);
  const name = (g) => `${r.pick(g === 'Male' ? FIRST_M : FIRST_F)} ${r.pick(LAST)}`;
  const phone = () => '9' + String(r.int(100000000, 999999999));
  const dateIn = (from, to) => addDays(from, r.int(0, Math.max(0, Math.round((+new Date(to) - +new Date(from)) / 864e5))));
  const db = {};

  // ---------- structure ----------
  db.academicYears = [
    { ...base(PREV_AY), name: '2025-26', startDate: '2025-07-01', endDate: '2026-06-30', current: false },
    { ...base(CURRENT_AY), name: '2026-27', startDate: '2026-07-01', endDate: '2027-06-30', current: true },
  ];
  db.departments = DEPTS.map(([code, nm]) => ({ ...base('dep_' + code.toLowerCase()), code, name: nm }));
  db.programs = db.departments.map((d) => ({
    ...base('prg_' + d.code.toLowerCase()),
    code: 'BT-' + d.code,
    name: 'B.Tech ' + d.name,
    departmentId: d.id,
    durationYears: 4,
    intake: 120,
  }));

  // ---------- employees ----------
  const employees = [];
  const emp = (designation, category, salary, departmentId, gender = r.chance(0.4) ? 'Female' : 'Male') => {
    const e = {
      ...base('emp_' + pad(employees.length + 1, 3)),
      empNo: 'KV' + pad(employees.length + 101, 4),
      name: (category === 'Teaching' ? 'Dr. ' : gender === 'Female' ? 'Mrs. ' : 'Mr. ') + name(gender),
      gender,
      designation,
      category,
      departmentId,
      phone: phone(),
      monthlySalary: salary,
      joiningDate: dateIn('2008-06-01', '2024-06-30'),
      status: 'Active',
    };
    employees.push(e);
    return e;
  };
  const principal = emp('Principal', 'Teaching', 185000);
  const adminOfficer = emp('Administrative Officer', 'Non-Teaching', 62000);
  const accountsOfficer = emp('Accounts Officer', 'Non-Teaching', 58000);
  emp('Accountant', 'Non-Teaching', 38000);
  emp('Cashier', 'Non-Teaching', 30000);
  const admissionOfficer = emp('Admission & Publicity Officer', 'Non-Teaching', 45000);
  emp('Publicity Coordinator', 'Non-Teaching', 32000);
  const boysWarden = emp('Hostel Warden (Boys)', 'Non-Teaching', 36000, undefined, 'Male');
  const girlsWarden = emp('Hostel Warden (Girls)', 'Non-Teaching', 36000, undefined, 'Female');
  const officeStaff = emp('Office Assistant', 'Non-Teaching', 24000);
  db.departments.forEach((d) => {
    emp('Professor & HOD', 'Teaching', 145000, d.id);
    emp('Associate Professor', 'Teaching', 98000, d.id);
    emp('Assistant Professor', 'Teaching', 72000, d.id);
    emp('Lab Assistant', 'Non-Teaching', 26000, d.id);
  });
  db.employees = employees;

  // ---------- fee heads & structures ----------
  db.feeHeads = [
    ['tuition', 'TUI', 'Tuition Fee', 'Internal'],
    ['admission', 'ADM', 'Admission Fee', 'Internal', { oneTime: true }],
    ['library', 'LIB', 'Library Fee', 'Internal'],
    ['stationery', 'STN', 'Stationery Fee', 'Internal'],
    ['lab', 'LAB', 'Laboratory Fee', 'Internal'],
    ['hostel', 'HST', 'Hostel Fee', 'Internal', { hostelOnly: true }],
    ['university', 'UNI', 'University Fee', 'External', { remitTo: 'JNTU Kakinada' }],
    ['exam', 'EXM', 'Examination Fee', 'External', { remitTo: 'JNTU Kakinada – Examination Branch' }],
  ].map(([id, code, nm, category, extra = {}]) => ({ ...base('fh_' + id), code, name: nm, category, ...extra }));
  const FH = Object.fromEntries(db.feeHeads.map((h) => [h.id.slice(3), h]));
  db.feeStructures = db.programs.map((p) => {
    const tuition = p.code.includes('CSE') || p.code.includes('IT') ? 85000 : 70000;
    return {
      ...base('fs_' + p.id),
      academicYearId: CURRENT_AY,
      programId: p.id,
      name: `${p.code} Fee 2026-27`,
      items: [
        { feeHeadId: FH.tuition.id, amount: tuition },
        { feeHeadId: FH.admission.id, amount: 5000 },
        { feeHeadId: FH.library.id, amount: 3000 },
        { feeHeadId: FH.stationery.id, amount: 2500 },
        { feeHeadId: FH.lab.id, amount: 6000 },
        { feeHeadId: FH.university.id, amount: 4500 },
        { feeHeadId: FH.exam.id, amount: 3200 },
      ],
    };
  });
  const DUE = {
    tuition: '2026-08-31',
    admission: '2026-07-31',
    library: '2026-08-31',
    stationery: '2026-08-31',
    lab: '2026-09-30',
    hostel: '2026-08-15',
    university: '2026-09-30',
    exam: '2026-10-30',
  };

  // ---------- students ----------
  const students = [];
  let sN = 1;
  const addStudent = (d, di, year, k, extra = {}) => {
    const g = r.chance(0.42) ? 'Female' : 'Male';
    const nm = name(g);
    const admYear = 2027 - year;
    const id = 'stu_' + pad(sN, 4);
    const category = r.pick(['OC', 'OC', 'BC-A', 'BC-B', 'BC-D', 'SC', 'ST', 'EWS']);
    const quota = r.chance(0.7) ? 'Convener' : r.chance(0.85) ? 'Management' : 'NRI';
    const source = r.pick(ADMISSION_SOURCES.slice(0, 10));
    const scholarship =
      quota === 'Convener' && (category === 'SC' || category === 'ST')
        ? 'Post-Matric Scholarship (SC/ST)'
        : quota === 'Convener' && r.chance(0.35)
          ? 'Vidya Deevena (Govt. RTF)'
          : r.chance(0.04)
            ? 'Merit Scholarship (College)'
            : undefined;
    const discountReason = !scholarship && r.chance(0.09) ? r.pick(DISCOUNT_REASONS) : undefined;
    const s = {
      ...base(id),
      rollNo: `${String(admYear).slice(2)}KV1A${pad(di + 1)}${pad(k + 1)}`,
      admissionNo: `ADM${admYear}${pad(sN, 4)}`,
      name: nm,
      gender: g,
      dob: `${admYear - 18}-${pad(r.int(1, 12))}-${pad(r.int(1, 28))}`,
      email: nm.toLowerCase().replace(/\s+/g, '.') + sN + '@student.' + DEMO_DOMAIN,
      phone: phone(),
      parentName: `${r.pick(FIRST_M)} ${nm.split(' ')[1]}`,
      parentRelation: 'Father',
      parentPhone: phone(),
      address: `${r.int(1, 99)}-${r.int(1, 40)}, ${r.pick(CITIES)}, Andhra Pradesh`,
      departmentId: d.id,
      programId: 'prg_' + d.code.toLowerCase(),
      year,
      batch: `${admYear}-${admYear + 4}`,
      admissionYear: admYear,
      admissionDate: `${admYear}-${pad(r.int(7, 9))}-${pad(r.int(1, 28))}`,
      category,
      quota,
      admissionSource: source,
      referenceBy: source === 'Reference' ? `${r.pick(FIRST_M)} ${r.pick(LAST)}` : undefined,
      referenceType: source === 'Reference' ? r.pick(REFERENCE_TYPES) : undefined,
      scholarshipScheme: scholarship,
      discountReason,
      hosteller: r.chance(0.36),
      status: 'Active',
      ...extra,
    };
    students.push(s);
    sN++;
    return s;
  };
  db.departments.forEach((d, di) => {
    [1, 2, 3, 4].forEach((year) => {
      for (let k = 0; k < 10; k++) addStudent(d, di, year, k);
    });
  });
  // Relieved / discontinued students (mid-course) and last year's graduating batch.
  students
    .filter((s) => s.year >= 2)
    .filter(() => r.chance(0.025))
    .forEach((s) => {
      s.status = r.chance(0.5) ? 'Relieved' : 'Discontinued';
      s.relievedOn = dateIn('2026-07-15', '2026-10-05');
      s.relievingReason = s.status === 'Relieved' ? 'Transfer to another college' : 'Discontinued – personal reasons';
      s.hosteller = false;
    });
  [0, 1].forEach((di) => {
    for (let k = 0; k < 6; k++)
      addStudent(db.departments[di], di, 5, 40 + k, {
        status: 'Course Completed',
        year: 4,
        batch: '2022-2026',
        admissionYear: 2022,
        rollNo: `22KV1A${pad(di + 1)}${pad(60 + k)}`,
        relievedOn: '2026-06-30',
        relievingReason: 'Course completed',
        hosteller: false,
      });
  });
  // Demo student: a 3rd-year CSE hosteller with fee dues.
  const demoStudent = students.find((s) => s.departmentId === 'dep_cse' && s.year === 3 && s.status === 'Active' && s.gender === 'Male');
  Object.assign(demoStudent, { hosteller: true, scholarshipScheme: undefined, discountReason: 'Sibling Concession' });
  db.students = students;

  // ---------- hostel ----------
  db.hostels = [
    { ...base('hos_boys'), name: 'Krishna Boys Hostel', type: 'Boys', warden: boysWarden.name, wardenEmployeeId: boysWarden.id, floors: 3, capacityNote: '' },
    { ...base('hos_girls'), name: 'Godavari Girls Hostel', type: 'Girls', warden: girlsWarden.name, wardenEmployeeId: girlsWarden.id, floors: 3 },
  ];
  const hRooms = [];
  db.hostels.forEach((h) => {
    for (let f = 1; f <= 3; f++)
      for (let k = 1; k <= 10; k++)
        hRooms.push({
          ...base(`hr_${h.id}_${f}${pad(k)}`),
          hostelId: h.id,
          roomNo: `${f}${pad(k)}`,
          capacity: k <= 2 ? 2 : 3,
          type: k <= 2 ? 'Double (AC)' : 'Triple',
          fee: k <= 2 ? 95000 : 72000,
        });
  });
  db.hostelRooms = hRooms;
  const hAlloc = [];
  const occ = {};
  students
    .filter((s) => s.hosteller && s.status === 'Active')
    .forEach((s) => {
      const h = s.gender === 'Male' ? 'hos_boys' : 'hos_girls';
      const room = hRooms.find((x) => x.hostelId === h && (occ[x.id] ?? 0) < x.capacity);
      if (!room) {
        s.hosteller = false;
        return;
      }
      occ[room.id] = (occ[room.id] ?? 0) + 1;
      hAlloc.push({
        ...base('ha_' + s.id),
        roomId: room.id,
        hostelId: h,
        studentId: s.id,
        bedNo: occ[room.id],
        fromDate: s.year === 1 ? '2026-08-10' : '2026-07-10',
        status: 'Allocated',
        provisions: PROVISIONS.filter((p) => p !== 'ID Card' || r.chance(0.8)),
        guardianName: s.parentName,
        guardianPhone: s.parentPhone,
        emergencyContact: phone(),
      });
    });
  db.hostelAllocations = hAlloc;

  // ---------- fee demands & receipts ----------
  const invoices = [];
  const payments = [];
  const orders = [];
  let invN = 1;
  let rcpt = 1;
  const profile = {};
  students
    .filter((s) => s.status === 'Active')
    .forEach((s) => {
      const fs = db.feeStructures.find((f) => f.programId === s.programId);
      const roll = r.next();
      profile[s.id] = s.id === demoStudent.id ? 'partial' : roll < 0.58 ? 'good' : roll < 0.84 ? 'partial' : 'defaulter';
      const items = fs.items.filter((it) => it.feeHeadId !== FH.admission.id || s.year === 1);
      const room = s.hosteller ? hRooms.find((x) => x.id === hAlloc.find((a) => a.studentId === s.id)?.roomId) : null;
      if (room) items.push({ feeHeadId: FH.hostel.id, amount: room.fee });
      items.forEach((it) => {
        const key = it.feeHeadId.slice(3);
        const inv = {
          ...base('inv_' + pad(invN, 5)),
          invoiceNo: 'FD26-' + pad(invN, 5),
          studentId: s.id,
          academicYearId: CURRENT_AY,
          feeStructureId: fs.id,
          feeHeadId: it.feeHeadId,
          description: `${FH[key].name} 2026-27`,
          amount: it.amount,
          discount: 0,
          scholarship: 0,
          dueDate: DUE[key],
          paid: 0,
        };
        if (key === 'tuition') {
          if (s.scholarshipScheme === 'Post-Matric Scholarship (SC/ST)' || s.scholarshipScheme === 'Vidya Deevena (Govt. RTF)')
            inv.scholarship = it.amount;
          else if (s.scholarshipScheme === 'Merit Scholarship (College)') inv.scholarship = 25000;
          if (s.discountReason) inv.discount = s.discountReason === 'Staff Ward' ? 20000 : r.pick([5000, 7500, 10000]);
          inv.concessionNote = [s.scholarshipScheme, s.discountReason].filter(Boolean).join(' · ') || undefined;
          if (inv.scholarship) s.scholarshipAmount = inv.scholarship;
          if (inv.discount) s.discountAmount = inv.discount;
        }
        invN++;
        const net = invNet(inv);
        const p = profile[s.id];
        let pay = 0;
        if (net > 0) {
          if (key === 'exam') pay = r.chance(p === 'good' ? 0.55 : 0.2) ? net : 0;
          else if (p === 'good') pay = net;
          else if (p === 'partial')
            pay = key === 'tuition' || key === 'hostel' ? Math.round((net * r.int(30, 70)) / 100 / 500) * 500 : r.chance(0.6) ? net : 0;
          else pay = key === 'admission' ? net : 0;
        }
        if (pay > 0) {
          const online = r.chance(0.27);
          const date = r.chance(0.04) ? SEED_TODAY : r.chance(0.04) ? '2026-10-18' : dateIn('2026-07-04', inv.dueDate < SEED_TODAY ? inv.dueDate : SEED_TODAY);
          const mode = online ? 'Online Gateway' : r.pick(['Cash', 'Cash', 'UPI', 'UPI', 'Bank Transfer', 'Card', 'DD / Cheque']);
          const pid = 'pay_' + pad(rcpt, 5);
          let orderId;
          if (online) {
            orderId = 'order_' + r.int(10 ** 9, 10 ** 10 - 1).toString(36).toUpperCase();
            orders.push({
              ...base('po_' + pad(rcpt, 5), date + 'T10:15:00.000Z'),
              orderId,
              gateway: 'Razorpay',
              studentId: s.id,
              invoiceIds: [inv.id],
              amount: pay,
              status: 'Success',
              gatewayPaymentId: 'pay_' + r.int(10 ** 9, 10 ** 10 - 1).toString(36).toUpperCase(),
              method: r.pick(['UPI', 'Card', 'Netbanking']),
              initiatedAt: date + 'T10:15:00.000Z',
              settledAt: date + 'T10:16:12.000Z',
              receiptId: pid,
            });
          }
          payments.push({
            ...base(pid, date + 'T11:00:00.000Z'),
            receiptNo: 'RC26-' + pad(rcpt, 5),
            invoiceId: inv.id,
            studentId: s.id,
            feeHeadId: inv.feeHeadId,
            amount: pay,
            date,
            mode,
            channel: online ? 'Online' : 'Counter',
            reference: mode === 'Cash' ? 'CASH' : online ? orderId : 'TXN' + r.int(10000000, 99999999),
            gatewayOrderId: orderId,
            recordedBy: online ? 'Payment gateway' : accountsOfficer.name,
          });
          rcpt++;
          inv.paid = pay;
        }
        inv.status = invStatus(inv);
        invoices.push(inv);
      });
    });
  // Unsuccessful / abandoned online attempts for status tracking.
  for (let i = 0; i < 9; i++) {
    const inv = r.pick(invoices.filter((x) => x.status !== 'Paid'));
    const st = r.pick(['Failed', 'Failed', 'Pending', 'Created']);
    const date = dateIn('2026-09-20', SEED_TODAY);
    orders.push({
      ...base('po_x' + i, date + 'T19:30:00.000Z'),
      orderId: 'order_' + r.int(10 ** 9, 10 ** 10 - 1).toString(36).toUpperCase(),
      gateway: 'Razorpay',
      studentId: inv.studentId,
      invoiceIds: [inv.id],
      amount: invNet(inv) - inv.paid,
      status: st,
      method: r.pick(['UPI', 'Card', 'Netbanking']),
      failureReason: st === 'Failed' ? r.pick(['Payment declined by bank', 'UPI request expired', 'Insufficient funds']) : undefined,
      initiatedAt: date + 'T19:30:00.000Z',
    });
  }
  db.invoices = invoices;
  db.payments = payments;
  db.paymentOrders = orders;

  // ---------- expenditure ----------
  const expenses = [];
  let vN = 1;
  const exp = (e) => expenses.push({ ...base('exp_' + pad(vN, 4), e.date + 'T12:00:00.000Z'), voucherNo: 'PV26-' + pad(vN++, 4), status: 'Paid', ...e });
  ['2026-07', '2026-08', '2026-09'].forEach((m) => {
    const payDate = addDays(m + '-28', 4);
    employees.forEach((e) =>
      exp({
        date: payDate,
        category: 'Employee Salary',
        employeeId: e.id,
        payee: e.name,
        salaryMonth: m,
        description: `Salary for ${m}`,
        amount: e.monthlySalary,
        mode: 'Bank Transfer',
        reference: 'NEFT' + r.int(1000000, 9999999),
      }),
    );
    db.hostels.forEach((h) => {
      exp({
        date: addDays(m + '-05', r.int(0, 10)),
        category: 'Hostel Expense',
        hostelId: h.id,
        payee: r.pick(['Sri Lakshmi Provisions', 'Annapurna Wholesale Traders', 'Fresh Farm Vegetables']),
        description: 'Mess provisions',
        vendorInvoiceNo: 'SLP/' + r.int(1000, 9999),
        amount: r.int(180, 260) * 1000,
        mode: 'Bank Transfer',
        reference: 'NEFT' + r.int(1000000, 9999999),
      });
      exp({
        date: addDays(m + '-12', r.int(0, 10)),
        category: 'Hostel Expense',
        hostelId: h.id,
        payee: r.pick(['Sai Electricals', 'Ravi Plumbing Works', 'CleanPro Housekeeping']),
        description: r.pick(['Electrical repairs', 'Plumbing maintenance', 'Housekeeping services']),
        vendorInvoiceNo: 'INV-' + r.int(100, 999),
        amount: r.int(15, 60) * 1000,
        mode: r.chance(0.3) ? 'Cash' : 'Bank Transfer',
        reference: 'NEFT' + r.int(1000000, 9999999),
      });
    });
    exp({
      date: addDays(m + '-10', 2),
      category: 'Utilities',
      payee: 'APCPDCL',
      description: 'Electricity charges',
      vendorInvoiceNo: 'EB' + r.int(100000, 999999),
      amount: r.int(380, 460) * 1000,
      mode: 'Bank Transfer',
      reference: 'NEFT' + r.int(1000000, 9999999),
    });
  });
  [
    ['2026-07-14', 'Vendor Invoice', 'Vijaya Stationery Mart', 'Stationery kits for students', 168000],
    ['2026-07-22', 'Vendor Invoice', 'TechServe Systems', 'Computer lab systems (20 nos.)', 940000],
    ['2026-08-03', 'Vendor Invoice', 'Book World Distributors', 'Library books and journals', 312000],
    ['2026-08-18', 'Maintenance', 'Green Campus Services', 'Garden and campus upkeep', 46000],
    ['2026-09-02', 'Vendor Invoice', 'Lab Instruments Co.', 'ECE lab oscilloscopes', 285000],
    ['2026-09-21', 'Other', 'Andhra Jyothi', 'Admission advertisement', 75000],
    ['2026-10-06', 'Maintenance', 'Sai Constructions', 'Classroom painting – B Block', 128000],
    ['2026-10-15', 'Vendor Invoice', 'Vijaya Stationery Mart', 'Answer booklets', 54000],
    [SEED_TODAY, 'Other', 'Petty cash', 'Office refreshments and courier', 3800],
  ].forEach(([date, category, payee, description, amount]) =>
    exp({
      date,
      category,
      payee,
      description,
      amount,
      vendorInvoiceNo: category === 'Vendor Invoice' ? 'VI/' + r.int(1000, 9999) : undefined,
      mode: amount < 10000 ? 'Cash' : 'Bank Transfer',
      reference: amount < 10000 ? 'CASH' : 'NEFT' + r.int(1000000, 9999999),
    }),
  );
  exp({
    date: '2026-10-25',
    category: 'Vendor Invoice',
    payee: 'TechServe Systems',
    description: 'Network switches (pending approval)',
    vendorInvoiceNo: 'VI/7781',
    amount: 186000,
    mode: 'Bank Transfer',
    status: 'Pending',
  });
  // External remittances: part of the university and examination fee collected is paid to the university.
  const collectedBy = (head, upto) => payments.filter((p) => p.feeHeadId === head && p.date <= upto).reduce((a, p) => a + p.amount, 0);
  const uni1 = collectedBy(FH.university.id, '2026-08-31');
  exp({
    date: '2026-09-05',
    category: 'University Fee Remittance',
    payee: 'JNTU Kakinada',
    description: 'Affiliation & registration fee – collected till 31 Aug',
    amount: uni1,
    externalHeadId: FH.university.id,
    mode: 'Bank Transfer',
    reference: 'RTGS' + r.int(1000000, 9999999),
  });
  exp({
    date: '2026-10-10',
    category: 'Examination Fee Remittance',
    payee: 'JNTU Kakinada – Examination Branch',
    description: 'Examination fee – first batch',
    amount: Math.round(collectedBy(FH.exam.id, '2026-10-05') * 0.8),
    externalHeadId: FH.exam.id,
    mode: 'Bank Transfer',
    reference: 'RTGS' + r.int(1000000, 9999999),
  });
  db.expenses = expenses;

  db.cashBook = [
    ['2026-07-15', 'Receipt', 'Bank', 'Bank interest', 'Interest credited – Q1', 18450],
    ['2026-07-28', 'Receipt', 'Cash', 'Application forms', 'Sale of application forms', 42000],
    ['2026-08-20', 'Receipt', 'Bank', 'Donation', 'Alumni association – lab fund', 250000],
    ['2026-09-01', 'Payment', 'Cash', 'Contra', 'Cash deposited into SBI current a/c', 900000],
    ['2026-09-01', 'Receipt', 'Bank', 'Contra', 'Cash deposited from cash counter', 900000],
    ['2026-09-30', 'Receipt', 'Cash', 'Scrap sale', 'Sale of old furniture', 12500],
    ['2026-10-12', 'Payment', 'Cash', 'Contra', 'Cash deposited into SBI current a/c', 600000],
    ['2026-10-12', 'Receipt', 'Bank', 'Contra', 'Cash deposited from cash counter', 600000],
  ].map(([date, type, account, head, particulars, amount], i) => ({
    ...base('cb_' + i, date + 'T13:00:00.000Z'),
    voucherNo: (type === 'Receipt' ? 'RV26-' : 'CV26-') + pad(i + 1, 3),
    date,
    type,
    account,
    head,
    particulars,
    amount,
  }));

  // ---------- enquiries & admissions ----------
  const enquiries = [];
  const counsellors = [admissionOfficer.name, officeStaff.name, employees[6].name];
  students
    .filter((s) => s.year === 1)
    .forEach((s, i) => {
      const enq = addDays(s.admissionDate, -r.int(20, 80));
      enquiries.push({
        ...base('enq_' + pad(i + 1, 3), enq + 'T10:00:00.000Z'),
        enquiryNo: 'ENQ26-' + pad(i + 1, 4),
        date: enq,
        name: s.name,
        gender: s.gender,
        phone: s.phone,
        parentName: s.parentName,
        parentPhone: s.parentPhone,
        programId: s.programId,
        source: s.admissionSource,
        referenceBy: s.referenceBy,
        referenceType: s.referenceType,
        counsellor: r.pick(counsellors),
        entranceExam: s.quota === 'Convener' ? 'EAPCET' : 'Management Quota',
        rank: s.quota === 'Convener' ? r.int(2000, 60000) : undefined,
        qualifyingPercent: r.int(62, 97),
        category: s.category,
        stage: 'Admitted',
        registrationNo: 'REG26-' + pad(i + 1, 4),
        registeredOn: addDays(enq, r.int(3, 15)),
        registrationFee: 1000,
        studentId: s.id,
      });
    });
  for (let i = 0; i < 48; i++) {
    const g = r.chance(0.45) ? 'Female' : 'Male';
    const nm = name(g);
    const stage = r.pick(['Enquiry', 'Enquiry', 'Follow-up', 'Follow-up', 'Registered', 'Not Interested']);
    const date = dateIn('2026-08-20', SEED_TODAY);
    const source = r.pick(ADMISSION_SOURCES.slice(0, 10));
    const n = enquiries.length + 1;
    enquiries.push({
      ...base('enq_' + pad(n, 3), date + 'T10:00:00.000Z'),
      enquiryNo: 'ENQ26-' + pad(n, 4),
      date,
      name: nm,
      gender: g,
      phone: phone(),
      parentName: `${r.pick(FIRST_M)} ${nm.split(' ')[1]}`,
      parentPhone: phone(),
      programId: r.pick(db.programs).id,
      source,
      referenceBy: source === 'Reference' ? `${r.pick(FIRST_M)} ${r.pick(LAST)}` : undefined,
      referenceType: source === 'Reference' ? r.pick(REFERENCE_TYPES) : undefined,
      counsellor: r.pick(counsellors),
      entranceExam: r.pick(['EAPCET', 'ECET (Lateral Entry)', 'Management Quota']),
      qualifyingPercent: r.int(58, 96),
      category: r.pick(['OC', 'BC-A', 'BC-B', 'SC', 'EWS']),
      followUpDate: stage === 'Enquiry' || stage === 'Follow-up' ? addDays(SEED_TODAY, r.int(-3, 10)) : undefined,
      stage,
      notes: stage === 'Not Interested' ? 'Joined another college' : r.pick(['Asked about hostel fee', 'Wants scholarship details', 'Visit planned with parents', '']),
      registrationNo: stage === 'Registered' ? 'REG26-' + pad(n, 4) : undefined,
      registeredOn: stage === 'Registered' ? addDays(date, 2) : undefined,
      registrationFee: stage === 'Registered' ? 1000 : undefined,
    });
  }
  db.enquiries = enquiries;

  // ---------- student activities ----------
  const ACT = [
    ['Achievement', 'Won 1st prize in state-level hackathon'],
    ['Event Participation', 'Presented paper at National Tech Symposium'],
    ['Sports', 'Represented college in inter-university cricket'],
    ['Internship', 'Summer internship completed at Infosys'],
    ['Counselling', 'Academic counselling – attendance shortage'],
    ['Disciplinary', 'Warning issued – hostel curfew violation'],
    ['Achievement', 'NPTEL Elite certificate – Data Structures'],
  ];
  db.studentActivities = Array.from({ length: 46 }, (_, i) => {
    const s = i === 0 ? demoStudent : r.pick(students.filter((x) => x.status === 'Active'));
    const [type, title] = i === 0 ? ACT[0] : r.pick(ACT);
    const date = dateIn('2026-07-15', SEED_TODAY);
    return { ...base('act_' + i, date + 'T09:00:00.000Z'), studentId: s.id, type, title, date, smsSent: type !== 'Counselling' };
  });

  // ---------- certificates ----------
  const certs = [];
  const verifs = [];
  const downloads = [];
  const signer = { name: principal.name, designation: 'Principal' };
  const certStudents = [
    demoStudent,
    ...students.filter((s) => s.status === 'Course Completed'),
    ...students.filter((s) => s.status === 'Relieved'),
    ...students.filter((s) => s.status === 'Active' && s.id !== demoStudent.id).slice(0, 60).filter(() => r.chance(0.25)),
  ];
  certStudents.forEach((s, i) => {
    const type =
      s.status === 'Course Completed'
        ? r.pick(['Course Completion Certificate', 'Provisional Certificate', 'Transfer Certificate'])
        : s.status === 'Relieved'
          ? 'Transfer Certificate'
          : r.pick(['Bonafide Certificate', 'Study & Conduct Certificate', 'Fee Paid Certificate']);
    const requestedOn = dateIn('2026-08-01', SEED_TODAY);
    const st = s === demoStudent ? 'Approved' : r.chance(0.18) ? 'Pending' : r.chance(0.08) ? 'Rejected' : 'Approved';
    const c = {
      ...base('crt_' + pad(i + 1, 3), requestedOn + 'T09:30:00.000Z'),
      requestNo: 'CR26-' + pad(i + 1, 4),
      studentId: s.id,
      rollNo: s.rollNo,
      type: s === demoStudent ? 'Bonafide Certificate' : type,
      purpose: r.pick(['Bank education loan', 'Passport application', 'Scholarship renewal', 'Higher studies', 'Internship', 'Income tax']),
      requestedOn,
      status: st,
    };
    if (st !== 'Pending') {
      c.reviewedBy = 'Administrator';
      c.reviewedByName = st === 'Approved' ? principal.name : adminOfficer.name;
      c.reviewedAt = addDays(requestedOn, r.int(0, 3)) + 'T15:00:00.000Z';
    }
    if (st === 'Rejected') c.remarks = 'Roll number details do not match the request. Please re-apply.';
    if (st === 'Approved') {
      c.certificateNo = 'KVCE/CERT/2026/' + pad(i + 1, 4);
      c.verificationId = 'KV' + r.int(10 ** 9, 10 ** 10 - 1).toString(36).toUpperCase().padStart(7, '0');
      c.issuedOn = c.reviewedAt.slice(0, 10);
      c.signatoryName = signer.name;
      c.signatoryDesignation = signer.designation;
      // Seed signatures are placeholders; certificates approved in the app get a real SHA-256 / server signature.
      c.signature = 'seed-' + c.verificationId.toLowerCase();
      verifs.push({
        ...base(c.verificationId, c.reviewedAt),
        certificateId: c.id,
        certificateNo: c.certificateNo,
        studentId: s.id,
        studentName: s.name,
        rollNo: s.rollNo,
        program: 'B.Tech ' + db.departments.find((d) => d.id === s.departmentId).name,
        type: c.type,
        issuedOn: c.issuedOn,
        signatoryName: signer.name,
        signatoryDesignation: signer.designation,
        signature: c.signature,
        status: 'Valid',
      });
      const n = r.int(0, 3);
      for (let k = 0; k < n; k++) {
        const at = addDays(c.issuedOn, r.int(0, 10)) + `T${pad(r.int(9, 21))}:${pad(r.int(0, 59))}:00.000Z`;
        downloads.push({
          ...base(`dl_${c.id}_${k}`, at),
          certificateId: c.id,
          studentId: s.id,
          userId: s === demoStudent ? 'usr_student' : 'usr_' + s.id,
          userName: s.name,
          role: 'student',
          at,
        });
      }
    }
    certs.push(c);
  });
  db.certificates = certs;
  db.certificateVerifications = verifs;
  db.certificateDownloads = downloads;

  // ---------- hostel leave & out-pass ----------
  const REL = ['Father', 'Father', 'Mother', 'Brother', 'Sister', 'Guardian', 'Self (no pick-up)'];
  db.hostelLeaves = Array.from({ length: 34 }, (_, i) => {
    const a = i === 0 ? hAlloc.find((x) => x.studentId === demoStudent.id) : r.pick(hAlloc);
    const s = students.find((x) => x.id === a.studentId);
    const h = db.hostels.find((x) => x.id === a.hostelId);
    const from = i < 4 ? addDays(SEED_TODAY, r.int(1, 6)) : dateIn('2026-08-01', SEED_TODAY);
    const days = r.int(0, 4);
    const status = i < 4 ? 'Pending' : from > addDays(SEED_TODAY, -3) ? r.pick(['Approved', 'Checked Out']) : r.chance(0.08) ? 'Rejected' : 'Returned';
    const rel = r.pick(REL);
    const warden = employees.find((e) => e.id === h.wardenEmployeeId);
    const rec = {
      ...base('lv_' + pad(i + 1, 3), addDays(from, -1) + 'T18:00:00.000Z'),
      passNo: 'OP26-' + pad(i + 1, 4),
      studentId: s.id,
      hostelId: h.id,
      leaveType: days === 0 ? 'Outing' : r.pick(['Home Visit', 'Home Visit', 'Medical', 'Festival Holidays', 'Emergency']),
      reason: r.pick(['Going home for weekend', 'Family function', 'Medical check-up', 'Dasara holidays', 'Personal work in town']),
      destination: s.address.split(',')[1]?.trim(),
      fromAt: from + 'T16:00',
      toAt: addDays(from, days) + 'T19:00',
      status,
      pickupName: rel.startsWith('Self') ? undefined : rel === 'Father' ? s.parentName : name(rel === 'Mother' || rel === 'Sister' ? 'Female' : 'Male'),
      pickupRelation: rel,
      pickupPhone: rel.startsWith('Self') ? undefined : rel === 'Father' ? s.parentPhone : phone(),
      pickupIdProof: rel.startsWith('Self') ? undefined : 'Aadhaar XXXX-' + r.int(1000, 9999),
    };
    if (status !== 'Pending') {
      rec.approvedById = warden.id;
      rec.approvedByName = warden.name;
      rec.approvedByDesignation = warden.designation;
      rec.approvedAt = addDays(from, -1) + 'T19:10:00.000Z';
      rec.parentNotified = status !== 'Rejected';
    }
    if (status === 'Rejected') rec.wardenRemarks = 'Parent confirmation not received';
    if (status === 'Checked Out' || status === 'Returned') rec.checkedOutAt = from + 'T16:20:00.000Z';
    if (status === 'Returned') {
      rec.returnedAt = addDays(from, days) + `T${r.chance(0.15) ? '20:40' : '18:30'}:00.000Z`;
      rec.lateReturn = rec.returnedAt.slice(11, 16) > '19:00';
    }
    return rec;
  });

  // ---------- SMS log ----------
  const sms = [];
  const addSms = (s, type, message, at) =>
    sms.push({
      ...base('sms_' + pad(sms.length + 1, 4), at),
      studentId: s.id,
      to: s.parentPhone,
      recipientName: s.parentName,
      type,
      message,
      status: r.chance(0.94) ? 'Delivered' : 'Failed',
      sentAt: at,
      sentBy: type === 'Fee Due' ? accountsOfficer.name : 'System',
      simulated: true,
    });
  invoices
    .filter((i) => i.status !== 'Paid' && i.dueDate <= '2026-09-30')
    .slice(0, 40)
    .forEach((inv) => {
      const s = students.find((x) => x.id === inv.studentId);
      addSms(
        s,
        'Fee Due',
        `Dear Parent, ${inv.description} of Rs.${invNet(inv) - inv.paid} for ${s.name} (${s.rollNo}) is due. Payment cut-off date: ${inv.dueDate}. -KVCE`,
        '2026-10-01T10:00:00.000Z',
      );
    });
  payments.slice(-12).forEach((p) => {
    const s = students.find((x) => x.id === p.studentId);
    addSms(s, 'Fee Receipt', `Dear Parent, Rs.${p.amount} received towards fees of ${s.name}. Receipt ${p.receiptNo}. Thank you. -KVCE`, p.date + 'T11:05:00.000Z');
  });
  db.hostelLeaves
    .filter((l) => l.parentNotified)
    .slice(0, 10)
    .forEach((l) => {
      const s = students.find((x) => x.id === l.studentId);
      addSms(s, 'Hostel Leave', `Dear Parent, leave for ${s.name} approved from ${l.fromAt.replace('T', ' ')} to ${l.toAt.replace('T', ' ')}. Pick-up: ${l.pickupRelation}. -KVCE Hostel`, l.approvedAt);
    });
  db.smsLogs = sms;

  // ---------- notifications, settings, requests ----------
  db.notifications = [
    { role: 'finance', title: 'Exam fee cut-off approaching', message: 'Examination fee cut-off is 30 Oct 2026. Send due alerts to parents.', link: '/finance/fee-reminders' },
    { role: 'finance', title: 'Vendor invoice pending', message: 'TechServe Systems invoice VI/7781 awaits payment.', link: '/finance/expenses' },
    { role: 'principal', title: 'Certificate approvals', message: 'Certificate requests are awaiting your authorisation.', link: '/certificates' },
    { role: 'admin', title: 'Certificate approvals', message: 'Certificate requests are awaiting authorisation.', link: '/certificates' },
    { role: 'warden', title: 'Leave requests', message: 'New hostel leave requests need approval.', link: '/hostel/leave' },
    { role: 'admission', title: 'Follow-ups due', message: 'Several enquiries have follow-ups due this week.', link: '/admissions' },
    { role: 'student', title: 'Fee due reminder', message: 'Please clear your outstanding fee before the cut-off date.', link: '/finance/fees' },
  ].map((n, i) => ({ ...base('ntf_' + i, addDays('2026-10-14', i % 5) + 'T08:00:00.000Z'), read: false, readBy: [], ...n }));
  db.auditLogs = [];
  db.accessRequests = [
    {
      ...base('req_1'),
      name: 'Mr. Suresh Babu',
      email: 'suresh.babu@kvce.demo',
      phone: '9876543210',
      requestedRole: 'staff',
      reference: 'Joining order KV/ADM/2026/114',
      message: 'Joined the examination section on 1 Oct 2026. Requesting staff access.',
      status: 'Pending',
    },
  ];
  db.settings = [
    {
      ...base('settings'),
      institutionName: import.meta.env?.VITE_INSTITUTION_NAME || 'Kaveri Valley College of Engineering',
      shortName: import.meta.env?.VITE_INSTITUTION_SHORT || 'KVCE',
      address: 'Kanuru, Vijayawada, Andhra Pradesh 520007',
      affiliation: 'Affiliated to JNTU Kakinada · Approved by AICTE (demo institution)',
      universityName: 'JNTU Kakinada',
      currentAcademicYearId: CURRENT_AY,
      openingCash: 350000,
      openingBank: 4200000,
      openingDate: '2026-07-01',
      smsSenderId: 'KVCENG',
      reminderDaysBefore: 7,
      paymentGateway: 'Razorpay',
      gatewayEnabled: true,
      signatoryName: principal.name,
      signatoryDesignation: 'Principal',
      hostelReturnTime: '19:00',
    },
  ];

  // ---------- users (demo accounts; hashes filled by buildSeed) ----------
  const U = (role, nm, extra = {}) => ({ ...base('usr_' + role), email: `${role}@${DEMO_DOMAIN}`, name: nm, role, ...extra });
  db.users = [
    U('principal', principal.name, { employeeId: principal.id, designation: principal.designation }),
    U('admin', adminOfficer.name, { employeeId: adminOfficer.id, designation: adminOfficer.designation }),
    U('finance', accountsOfficer.name, { employeeId: accountsOfficer.id, designation: accountsOfficer.designation }),
    U('admission', admissionOfficer.name, { employeeId: admissionOfficer.id, designation: admissionOfficer.designation }),
    U('staff', officeStaff.name, { employeeId: officeStaff.id, designation: officeStaff.designation }),
    U('warden', boysWarden.name, { employeeId: boysWarden.id, designation: boysWarden.designation, hostelId: 'hos_boys' }),
    { ...U('warden', girlsWarden.name, { employeeId: girlsWarden.id, designation: girlsWarden.designation, hostelId: 'hos_girls' }), id: 'usr_warden_girls', email: `warden.girls@${DEMO_DOMAIN}` },
    U('student', demoStudent.name, { studentId: demoStudent.id, linkedStudentIds: [demoStudent.id], phone: demoStudent.phone }),
  ];
  return db;
}
/** Full seed including PBKDF2 password hashes for demo users and SHA-256 certificate signatures. */
export async function buildSeed() {
  const db = generateSeed();
  for (const u of db.users) {
    u.salt = u.id + '.kvce';
    u.passwordHash = await hashPassword(DEMO_PASSWORD, u.salt);
  }
  for (const v of db.certificateVerifications) {
    v.signature = await sha256(canonical({ ...v, verificationId: v.id }));
    const c = db.certificates.find((x) => x.id === v.certificateId);
    if (c) c.signature = v.signature;
  }
  return db;
}
