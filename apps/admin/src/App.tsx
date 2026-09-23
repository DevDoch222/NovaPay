import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { getToken, setToken, setUnauthorizedHandler, type AdminUser, api } from './api';
import { LoginPage } from './pages/LoginPage';
import { CustomersPage } from './pages/CustomersPage';
import { CustomerDetailPage } from './pages/CustomerDetailPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { TransactionDetailPage } from './pages/TransactionDetailPage';
import { TicketsPage } from './pages/TicketsPage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { AlertsPage } from './pages/AlertsPage';
import { ReconPage } from './pages/ReconPage';
import { KycPage } from './pages/KycPage';
import { DisputesPage } from './pages/DisputesPage';

function Shell({
  user,
  onLogout,
  children,
}: {
  user: AdminUser;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const loc = useLocation();
  const links = [
    ['/', 'Customers', (p: string) => p === '/' || p.startsWith('/customers')],
    ['/kyc', 'KYC review', (p: string) => p === '/kyc' || p.startsWith('/kyc/')],
    [
      '/transactions',
      'Transactions',
      (p: string) => p === '/transactions' || p.startsWith('/transactions/'),
    ],
    ['/tickets', 'Support', (p: string) => p === '/tickets' || p.startsWith('/tickets/')],
    ['/alerts', 'AML alerts', (p: string) => p === '/alerts'],
    ['/disputes', 'Disputes', (p: string) => p === '/disputes'],
    ['/recon', 'Reconciliation', (p: string) => p === '/recon'],
  ] as const;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand">
            Nova<span>Pay</span> Ops
          </div>
          <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: 4 }}>
            {user.phone} · {user.platformRole}
          </div>
        </div>
        <nav className="nav">
          {links.map(([to, label, isActive]) => (
            <Link
              key={to}
              to={to}
              className={isActive(loc.pathname) ? 'active' : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <button className="secondary" type="button" onClick={onLogout}>
          Sign out
        </button>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

export function App() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setBooting(false);
      return;
    }
    api<{
      id: string;
      phone: string;
      platformRole: string;
      status: string;
      kycTier: string;
      tag?: string | null;
    }>('/v1/auth/me')
      .then((me) => {
        if (me.platformRole !== 'admin' && me.platformRole !== 'support') {
          setToken(null);
          setUser(null);
        } else {
          setUser(me);
        }
      })
      .catch(() => {
        setToken(null);
        setUser(null);
      })
      .finally(() => setBooting(false));
  }, []);

  if (booting) {
    return (
      <div className="login-page">
        <p className="sub">Loading session…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginPage
        onAuthed={(next) => {
          setUser(next);
        }}
      />
    );
  }

  return (
    <Shell
      user={user}
      onLogout={() => {
        setToken(null);
        setUser(null);
      }}
    >
      <Routes>
        <Route path="/" element={<CustomersPage />} />
        <Route path="/kyc" element={<KycPage />} />
        <Route path="/customers/:id" element={<CustomerDetailPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/transactions/:id" element={<TransactionDetailPage />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/tickets/:id" element={<TicketDetailPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/disputes" element={<DisputesPage />} />
        <Route path="/recon" element={<ReconPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
