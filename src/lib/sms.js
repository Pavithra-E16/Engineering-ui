/**
 * SMS alerts to parents. Every message is written to the `smsLogs` collection:
 *  - demo mode: marked Delivered immediately (simulated; nothing is sent);
 *  - Firebase mode: stored as Queued and sent by the `sendQueuedSms` Cloud
 *    Function through the configured SMS provider (DLT-registered sender id).
 */
import { useAuth } from '../auth/AuthProvider';
import { useData } from '../data/store';
import { fmtDate, fmtMoney, nowISO } from './utils';

const sig = (s) => ` -${s?.smsSenderId || s?.shortName || 'COLLEGE'}`;
export const SMS_TEMPLATES = {
  feeDue: ({ st, amount, head, cutoff }, s) =>
    `Dear Parent, ${head} of ${fmtMoney(amount)} for ${st.name} (${st.rollNo}) is due. Payment cut-off date: ${fmtDate(cutoff)}. Pay online or at the accounts office.${sig(s)}`,
  receipt: ({ st, amount, receiptNo }, s) =>
    `Dear Parent, ${fmtMoney(amount)} received towards the fees of ${st.name} (${st.rollNo}). Receipt no ${receiptNo}. Thank you.${sig(s)}`,
  enquiry: ({ name, program }, s) =>
    `Dear ${name}, thank you for your enquiry about ${program}. Our admissions team will contact you shortly.${sig(s)}`,
  registered: ({ name, regNo }, s) =>
    `Dear ${name}, your registration ${regNo} is confirmed. Please complete admission formalities at the college office.${sig(s)}`,
  admitted: ({ st, program }, s) =>
    `Dear Parent, ${st.name} has been admitted to ${program}. Roll no ${st.rollNo}, Admission no ${st.admissionNo}. Welcome!${sig(s)}`,
  activity: ({ st, title }, s) => `Dear Parent, update on ${st.name} (${st.rollNo}): ${title}.${sig(s)}`,
  relieved: ({ st, date }, s) => `Dear Parent, ${st.name} (${st.rollNo}) has been relieved from the college on ${fmtDate(date)}.${sig(s)}`,
  leaveApproved: ({ st, from, to }, s) =>
    `Dear Parent, hostel leave for ${st.name} is approved from ${from.replace('T', ' ')} to ${to.replace('T', ' ')}.${sig(s)} Hostel`,
  leaveOut: ({ st, by, rel }, s) => `Dear Parent, ${st.name} left the hostel with ${by} (${rel}) at ${new Date().toLocaleString('en-IN')}.${sig(s)} Hostel`,
  leaveReturned: ({ st }, s) => `Dear Parent, ${st.name} has returned to the hostel at ${new Date().toLocaleString('en-IN')}.${sig(s)} Hostel`,
  certificate: ({ st, type }, s) => `Dear ${st.name}, your ${type} has been approved and is ready to download from the student portal.${sig(s)}`,
};
export const SMS_TYPES = ['Fee Due', 'Fee Receipt', 'Admission', 'Student Activity', 'Hostel Leave', 'Certificate', 'General'];

/** Returns send(list) → number queued. Each item: { to, recipientName, studentId?, type, message }. */
export function useSms() {
  const { create, mode } = useData();
  const { user } = useAuth();
  return async (list, opts = {}) => {
    let n = 0;
    for (const m of list) {
      if (!m.to) continue;
      await create(
        'smsLogs',
        {
          ...m,
          status: mode === 'demo' ? 'Delivered' : 'Queued',
          simulated: mode === 'demo',
          sentAt: nowISO(),
          sentBy: user?.name ?? 'System',
        },
        { audit: false, server: opts.server },
      );
      n++;
    }
    return n;
  };
}
/** Parent message for a student record. */
export const toParent = (st, type, message) => ({ to: st.parentPhone, recipientName: st.parentName, studentId: st.id, type, message });
/** Masks a phone number for roles that do not need full contact details (data privacy). */
export const maskPhone = (p) => (p && p.length >= 6 ? p.slice(0, 2) + 'X'.repeat(p.length - 4) + p.slice(-2) : p);
