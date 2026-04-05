import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        🏭 GMR <span>Glass Machinery Auctions</span>
      </Link>
      <ul className="navbar-links">
        <li><Link to="/">Auctions</Link></li>
        {user ? (
          <>
            <li><Link to="/dashboard">My Dashboard</Link></li>
            {user.is_admin && <li><Link to="/admin">Admin</Link></li>}
            <li>
              <button onClick={handleLogout}>Logout ({user.name})</button>
            </li>
          </>
        ) : (
          <>
            <li><Link to="/login">Login</Link></li>
            <li><Link to="/register" className="nav-btn">Register</Link></li>
          </>
        )}
      </ul>
    </nav>
  );
}
