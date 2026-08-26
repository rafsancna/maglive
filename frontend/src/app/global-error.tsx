"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="state-page">
          <div className="container">
            <p className="eyebrow">Error · 错误</p>
            <h1 className="heading heading--display">Something went wrong</h1>
            <p className="lede">Please try again. 请重试。</p>
            <button className="button button--primary" onClick={reset} type="button">
              Try again · 重试
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
