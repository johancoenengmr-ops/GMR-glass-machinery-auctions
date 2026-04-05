import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const panelRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get('/api/notifications', { params: { limit: 10 } });
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unread_count || 0);
    } catch {
      // ignore
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close panel when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setShowPanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const markAllRead = async () => {
    try {
      await api.post('/api/notifications/read-all');
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // ignore
    }
  };

  const togglePanel = () => {
    setShowPanel((v) => !v);
    if (!showPanel && unreadCount > 0) {
      markAllRead();
    }
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

            {/* Notifications bell */}
            <li style={{ position: 'relative' }} ref={panelRef}>
              <button
                className="notif-bell"
                onClick={togglePanel}
                title="Notifications"
              >
                🔔
                {unreadCount > 0 && (
                  <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </button>

              {showPanel && (
                <div className="notif-panel">
                  <div className="notif-panel-header">
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                      <button className="notif-mark-read" onClick={markAllRead}>
                        Mark all read
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div className="notif-empty">No notifications yet</div>
                  ) : (
                    <ul className="notif-list">
                      {notifications.map((n) => (
                        <li
                          key={n.id}
                          className={`notif-item${n.is_read ? '' : ' unread'}`}
                          onClick={() => {
                            setShowPanel(false);
                            if (n.auction_id) navigate(`/auctions/${n.auction_id}`);
                          }}
                        >
                          <div className="notif-content">{n.content}</div>
                          <div className="notif-time">
                            {new Date(n.created_at).toLocaleString('nl-BE')}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>

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
