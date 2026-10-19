import logo from '../assets/pragathi.png';

/** College logo (src/assets/pragathi.png) used in the sidebar, sign-in and verification pages. */
export const LOGO_SRC = logo;
export function CollegeLogo({ className = 'brand-logo' }) {
  return <img src={logo} alt="Pragathi Jr. Degree & PG College logo" className={className} />;
}
