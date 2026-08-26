import type { PageCopy } from "@/i18n/dictionary";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";

export function ContentPage({ copy }: { copy: PageCopy }) {
  return (
    <div className="content-page">
      <Container>
        <div className="content-page__hero">
          <p className="eyebrow">{copy.eyebrow}</p>
          <Heading as="h1" size="display">
            {copy.title}
          </Heading>
          <p className="lede">{copy.intro}</p>
        </div>
        <div className="content-page__body">
          <div className="content-page__rule" aria-hidden="true" />
          <div>
            {copy.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {copy.note ? <p className="status-note">{copy.note}</p> : null}
          </div>
        </div>
      </Container>
    </div>
  );
}
