"use client";
export default function LocaleError({ reset }: { reset: () => void }) {
  return <section className="route-state" role="alert"><h1>Something went wrong</h1><p>The page could not be loaded. Please try again.</p><button className="admin-button admin-button--primary" onClick={reset} type="button">Try again</button></section>;
}

