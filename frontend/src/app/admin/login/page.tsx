import { LoginForm } from "@/admin/auth/LoginForm";
import { getSafeAdminReturnPath } from "@/admin/auth/return-path";

export default async function AdminLoginPage({
  searchParams
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawReturnPath = typeof params.returnTo === "string" ? params.returnTo : undefined;
  const returnTo = getSafeAdminReturnPath(rawReturnPath);

  return (
    <main className="admin-login" id="admin-main">
      <section aria-labelledby="admin-login-title" className="admin-login__panel">
        <div className="admin-login__identity">
          <span aria-hidden="true" className="admin-login__mark">M</span>
          <div>
            <strong>MAGLIVE</strong>
            <span>Secure content operations</span>
          </div>
        </div>
        <div className="admin-login__heading">
          <span className="admin-kicker">Administrator access</span>
          <h1 id="admin-login-title">Welcome back.</h1>
          <p>Sign in to manage product content, categories, and media.</p>
        </div>
        <LoginForm returnTo={returnTo} />
        <p className="admin-login__security-note">
          Access is restricted. Sessions are server-managed and may be revoked at any time.
        </p>
      </section>
      <aside aria-hidden="true" className="admin-login__visual">
        <span>Structured content</span>
        <strong>Precise publishing.</strong>
        <div className="admin-login__orb" />
      </aside>
    </main>
  );
}
