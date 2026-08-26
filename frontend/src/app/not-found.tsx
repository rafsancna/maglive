import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";

export default function GlobalNotFound() {
  return (
    <main className="state-page">
      <Container>
        <p className="eyebrow">404</p>
        <Heading as="h1" size="display">
          Page not found · 页面未找到
        </Heading>
        <p className="lede">The requested route is unavailable. 请求的页面不可用。</p>
        <Link className="button button--primary" href="/en">
          Return home
        </Link>
      </Container>
    </main>
  );
}
