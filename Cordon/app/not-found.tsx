import Link from "next/link";

export default function NotFound() {
  return (
    <section className="not-found">
      <span className="mono">404 / REPORT</span>
      <h1>That scan report is unavailable.</h1>
      <p>The in-memory development store clears on restart. Configure PostgreSQL to retain reports between sessions.</p>
      <Link className="primary-button" href="/">Start a new scan <span aria-hidden="true">→</span></Link>
    </section>
  );
}
