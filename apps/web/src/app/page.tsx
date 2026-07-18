import Link from "next/link";

import { LandingVideo } from "@/components/landing-video";

export default function HomePage() {
  const poster = "/media/aptor-work-poster.jpg";
  const hlsSource =
    process.env.NEXT_PUBLIC_APTOR_HLS_URL ?? "/media/aptor-loop.m3u8";

  return (
    <main className="landing-stage" id="main-content">
      <link as="image" fetchPriority="high" href={poster} rel="preload" />
      <LandingVideo poster={poster} source={hlsSource} />

      <header className="landing-header">
        <Link aria-label="Aptor home" className="landing-brand" href="/">
          <span aria-hidden="true">A</span>
          <strong>Aptor</strong>
        </Link>

        <nav aria-label="Enter an Aptor workspace" className="landing-nav">
          <Link href="/issuer">Issuer</Link>
          <Link href="/professional">Professional</Link>
          <Link href="/verifier">Verifier</Link>
        </nav>

        <p className="landing-foundation">
          <span aria-hidden="true" />
          Browser MVP
        </p>
      </header>

      <div className="landing-composition">
        <section className="landing-hero" aria-labelledby="landing-title">
          <p className="landing-hero__state">
            Private work credentials · Vol. 01
          </p>
          <h1 id="landing-title">
            Your work can speak.
            <span>Without telling everything.</span>
          </h1>
          <span aria-hidden="true" className="landing-redaction">
            <i />
            <i />
          </span>
          <p className="landing-hero__lede">
            Carry private credentials. Answer proof requests. Reveal only what
            was asked.
          </p>
          <div className="landing-actions">
            <Link
              className="landing-action landing-action--primary"
              href="/professional"
            >
              Open my vault
              <span aria-hidden="true">→</span>
            </Link>
            <Link
              className="landing-action landing-action--secondary"
              href="/verifier"
            >
              Verify a proof
              <span aria-hidden="true">→</span>
            </Link>
          </div>
          <p aria-hidden="true" className="landing-private-word">
            Private
          </p>
        </section>

        <nav aria-label="Aptor trust path" className="landing-role-rail">
          <Link href="/issuer">
            <span>01</span>
            <strong>Issue</strong>
            <i aria-hidden="true">→</i>
          </Link>
          <Link href="/professional">
            <span>02</span>
            <strong>Hold</strong>
            <i aria-hidden="true">→</i>
          </Link>
          <Link href="/verifier">
            <span>03</span>
            <strong>Verify</strong>
            <i aria-hidden="true">→</i>
          </Link>
        </nav>
      </div>

      <footer className="landing-footer">
        <p>Proof reveals the answer, not the underlying work.</p>
        <p>Aptor · Midnight foundation</p>
      </footer>
    </main>
  );
}
