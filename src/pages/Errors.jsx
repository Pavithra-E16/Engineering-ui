import { Link } from 'react-router-dom';
import { Compass, ShieldAlert } from 'lucide-react';
import { Button } from '../components/ui';

export function ForbiddenPage() {
  return (
    <div className="error-page">
      <span className="icon tone-red">
        <ShieldAlert />
      </span>
      <h1>Access denied</h1>
      <p>Your role does not have permission to view this page. If you believe this is a mistake, contact the IT Administrator.</p>
      <Link to="/dashboard">
        <Button>Go to Dashboard</Button>
      </Link>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="error-page">
      <span className="icon tone-slate">
        <Compass />
      </span>
      <h1>Page not found</h1>
      <p>The page you're looking for doesn't exist or has moved.</p>
      <Link to="/dashboard">
        <Button>Go to Dashboard</Button>
      </Link>
    </div>
  );
}
