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
  const developmentEmail = process.env.DEVELOPMENT_ADMIN_EMAIL;
  const developmentPassword = process.env.DEVELOPMENT_ADMIN_PASSWORD;
  const credentialHint =
    process.env.NODE_ENV === "development" &&
    developmentEmail !== undefined &&
    developmentPassword !== undefined
      ? { email: developmentEmail, password: developmentPassword }
      : undefined;

  return (
    <main className="admin-login" id="admin-main">
      <section aria-labelledby="admin-login-title" className="admin-login__panel">
        <div className="admin-login__identity">
          <span aria-hidden="true" className="admin-login__mark">M</span>
          <div>
            <strong>MAGLIVE</strong>
            <span>Administration</span>
          </div>
        </div>
        <div className="admin-login__heading">
          <h1 id="admin-login-title">Sign in</h1>
          <p>Use your administrator account to continue.</p>
        </div>
        <LoginForm
          {...(credentialHint === undefined ? {} : { credentialHint })}
          returnTo={returnTo}
        />
        <p className="admin-login__security-note">
          Sessions are server-managed and may be revoked at any time.
        </p>
      </section>
      <aside aria-hidden="true" className="admin-login__visual">
        <div className="admin-login__visual-brand">
          <span className="admin-login__mark admin-login__mark--inverted">M</span>
          <strong>MAGLIVE</strong>
        </div>
        <p className="admin-login__visual-line" />
        <p className="admin-login__visual-copy">
          Multilingual publishing for products, news, and media — from one
          controlled workspace.
        </p>
      </aside>
    </main>
  );
}
