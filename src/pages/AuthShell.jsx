import { CollegeLogo } from '../components/CollegeLogo';
import { CampusSkyline, CapIllustration } from './AuthArt';

export const APP_NAME = 'EduERP';

/** Shared layout for Sign In / Register / Forgot password: blue page, dotted corners, two-panel card. */
export function AuthShell({ children }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <section className="auth-brand">
          <div className="auth-logo">
            {APP_NAME}
          </div>
          <h1>Engineering College ERP</h1>
          <p className="auth-lead">Fees and accounts, admissions, certificates and hostel — in one secure platform.</p>
          <div className="auth-cap">
            <CapIllustration />
          </div>
          <div className="auth-chips">
            <span>Accounts &amp; Finance</span>
            <span>Admissions</span>
            <span>Certificates</span>
            <span>Hostel</span>
          </div>
          <div className="auth-building dark">
            <CampusSkyline />
          </div>
        </section>
        <section className="auth-form-side">
          <CollegeLogo className="auth-form-logo" />
          {children}
          <div className="auth-building light">
            <CampusSkyline />
          </div>
        </section>
      </div>
    </div>
  );
}
