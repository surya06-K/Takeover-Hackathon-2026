import Link from 'next/link';

export default function LandingPage() {
  return (
    <>
      <section className="hero">
        <div className="container">
          <span className="hero-eyebrow">KaagazAI · कागज़ से डिजिटल</span>
          <h1>
            Your paper register, <span className="accent">digital</span> in one photo.
          </h1>
          <p className="hero-sub">
            Udhaar khata, bill book or stock register — snap a page, check what the AI read,
            and get a clean digital ledger with balances, flags and exports.
          </p>
          <Link href="/digitize" className="btn btn-primary btn-lg">
            Digitize a page →
          </Link>
          <div className="hero-langs">
            <span className="chip">हिन्दी</span>
            <span className="chip">తెలుగు</span>
            <span className="chip">English</span>
            <span className="chip">Hinglish</span>
            <span className="chip">✏️ Messy handwriting welcome</span>
          </div>
        </div>
      </section>

      <section className="container steps">
        <div className="step-card">
          <span className="step-num">1</span>
          <h3>Snap the page</h3>
          <p>Hold your phone over the register. We shrink the photo on your phone so it uploads fast, even on 3G.</p>
        </div>
        <div className="step-card">
          <span className="step-num">2</span>
          <h3>You stay in charge</h3>
          <p>Every row the AI reads lands in an editable table. Unsure entries glow amber — fix them in a tap.</p>
        </div>
        <div className="step-card">
          <span className="step-num">3</span>
          <h3>One digital book</h3>
          <p>Pages merge into a single ledger: party balances, ₹5,000+ alerts, and JSON/CSV export for your accountant.</p>
        </div>
      </section>
    </>
  );
}
