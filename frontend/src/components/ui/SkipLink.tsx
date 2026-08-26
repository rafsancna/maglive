export function SkipLink({ label }: { label: string }) {
  return (
    <a className="skip-link" href="#main-content">
      {label}
    </a>
  );
}
