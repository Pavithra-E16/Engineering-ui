import { GraduationCap } from 'lucide-react';
import { CampusSkyline, CapIllustration } from './AuthArt';

export const APP_NAME = 'EduERP';

/** Shared layout for Sign In / Register / Forgot password: blue page, dotted corners, two-panel card. */
export function AuthShell({ children }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <section className="auth-brand">
          <div className="auth-logo">
            <span>
              <GraduationCap />
            </span>
            {APP_NAME}
          </div>
          <h1>Engineering College ERP</h1>
          <p className="auth-lead">One platform for academics, administration and student services.</p>
          <div className="auth-cap">
            <CapIllustration />
          </div>
          <div className="auth-chips">
            <span>Academic</span>
            <span>Administration</span>
            <span>Student Services</span>
          </div>
          <div className="auth-building dark">
            <CampusSkyline />
          </div>
        </section>
        <section className="auth-form-side">
          {children}
          <div className="auth-building light">
            <CampusSkyline />
          </div>
        </section>
      </div>
    </div>
  );
}
