import Link from "next/link";

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <div className="site-header__inner">
          <Link className="brand" href="/" aria-label="Cordon home">
            <span className="brand__mark" aria-hidden="true">
              C/
            </span>
            <span className="brand__wording">
              <strong>Cordon</strong>
              <small>Repository inspection</small>
            </span>
          </Link>
          <Link className="header-action" href="/">
            New scan
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </header>
      <main className="main" id="main-content">
        {children}
      </main>
      <footer className="site-footer">
        <p>Cordon identifies suspicious patterns and execution risks. A low-risk result is not a guarantee that a repository is safe.</p>
        <p>Cordon 0.1 · Static analysis only</p>
      </footer>
    </div>
  );
}
