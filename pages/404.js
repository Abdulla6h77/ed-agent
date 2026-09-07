import Link from "next/link";

export default function Custom404() {
  return (
    <div className="error-404">
      <div className="error-404-code">404</div>
      <div className="error-404-card">
        <h1>Page not found</h1>
        <p>This page doesn&apos;t exist — it might have been moved or the address was typed incorrectly.</p>
        <Link href="/" className="btn">Back to Ed Agent</Link>
      </div>
    </div>
  );
}
