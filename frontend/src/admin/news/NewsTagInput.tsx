"use client";

import { NEWS_LIMITS } from "@maglive/contracts";
import { useState, type ChangeEvent, type KeyboardEvent } from "react";

function normalizedTags(current: readonly string[], candidates: readonly string[]) {
  const next = [...current];
  const known = new Set(current.map((tag) => tag.toLocaleLowerCase()));
  for (const candidate of candidates) {
    const tag = candidate.trim().slice(0, NEWS_LIMITS.tag);
    const key = tag.toLocaleLowerCase();
    if (tag === "" || known.has(key) || next.length >= NEWS_LIMITS.tags) continue;
    next.push(tag);
    known.add(key);
  }
  return next;
}

export function NewsTagInput({
  tags,
  onChange,
}: {
  tags: readonly string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const commit = (value = input) => {
    const next = normalizedTags(tags, value.split(","));
    if (next.length !== tags.length) onChange(next);
    setInput("");
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (!value.includes(",")) {
      setInput(value);
      return;
    }
    const segments = value.split(",");
    const remainder = segments.pop() ?? "";
    const next = normalizedTags(tags, segments);
    if (next.length !== tags.length) onChange(next);
    setInput(remainder.trimStart());
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit();
      return;
    }
    if (event.key === "Backspace" && input === "" && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div className="news-tag-editor">
      <div className="news-tag-editor__heading">
        <div>
          <span className="admin-kicker">Story topics</span>
          <strong>Tags</strong>
        </div>
        <small>
          {tags.length}/{NEWS_LIMITS.tags}
        </small>
      </div>
      <div
        className="news-tag-editor__input"
        onClick={(event) => event.currentTarget.querySelector("input")?.focus()}
      >
        {tags.map((tag) => (
          <span className="news-tag-editor__chip" key={tag.toLocaleLowerCase()}>
            {tag}
            <button
              aria-label={`Remove tag ${tag}`}
              onClick={() => onChange(tags.filter((candidate) => candidate !== tag))}
              type="button"
            >
              ×
            </button>
          </span>
        ))}
        <input
          aria-label="Add news tag"
          disabled={tags.length >= NEWS_LIMITS.tags}
          maxLength={NEWS_LIMITS.tag}
          onBlur={() => {
            if (input.trim() !== "") commit();
          }}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? "Type a tag, then press comma or Enter" : "Add another tag"}
          value={input}
        />
      </div>
      <p>Press comma or Enter to create a tag. Backspace removes the last tag.</p>
    </div>
  );
}
