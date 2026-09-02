"use client";

import {
  Extension,
  mergeAttributes,
  Node,
  type Editor,
  type JSONContent,
} from "@tiptap/core";
import CharacterCount from "@tiptap/extension-character-count";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import UniqueID from "@tiptap/extension-unique-id";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
  useEditorState,
  type ReactNodeViewProps,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type {
  AdminMediaDto,
  MediaKind,
  NewsContentBlock,
  NewsInlineContent,
  NewsTextMark,
} from "@maglive/contracts";
import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { getMedia } from "../media/api";
import { MediaPreview } from "../media/MediaPreview";
import { SelectedMediaSummary } from "../media/SelectedMediaSummary";

type NewsWriterProps = {
  blocks: NewsContentBlock[];
  locale: string;
  onChange: (blocks: NewsContentBlock[]) => void;
  onChooseMedia: (
    kind: MediaKind,
    onSelect: (media: AdminMediaDto) => void,
  ) => void;
};

type EmbedAttributes = {
  blockId?: string | null;
  embedType: "image" | "video" | "document" | "link";
  mediaId?: string | null;
  label?: string | null;
  description?: string | null;
  alt?: string | null;
  caption?: string | null;
  url?: string | null;
  newWindow?: boolean;
  previewUrl?: string | null;
};

const identifiedNodes = [
  "paragraph",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "horizontalRule",
  "newsEmbed",
];

const NewsBlockAttributes = Extension.create({
  name: "newsBlockAttributes",
  addGlobalAttributes() {
    return [
      {
        types: ["blockquote"],
        attributes: {
          attribution: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-attribution"),
            renderHTML: (attributes) =>
              attributes.attribution
                ? { "data-attribution": String(attributes.attribution) }
                : {},
          },
        },
      },
    ];
  },
});

function NewsEmbedNodeView({ node }: ReactNodeViewProps) {
  const attributes = node.attrs as EmbedAttributes;
  const mediaId = attributes.mediaId ?? undefined;
  const [loaded, setLoaded] = useState<{
    id: string;
    media: AdminMediaDto | null;
  }>();
  const media = loaded !== undefined && loaded.id === mediaId ? loaded.media : null;
  const mediaLoading = mediaId !== undefined && loaded?.id !== mediaId;

  useEffect(() => {
    if (mediaId === undefined) return;
    let active = true;
    void getMedia(mediaId)
      .then((next) => {
        if (active) setLoaded({ id: mediaId, media: next });
      })
      .catch(() => {
        if (active) setLoaded({ id: mediaId, media: null });
      });
    return () => {
      active = false;
    };
  }, [mediaId]);

  const type = attributes.embedType;
  const isLibraryMedia = type === "image" || type === "video" || type === "document";
  const filename = media?.originalName ?? attributes.label ?? `${type[0]!.toUpperCase()}${type.slice(1)}`;
  const detail =
    attributes.caption ??
    attributes.description ??
    media?.defaultTranslations.en?.title ??
    (mediaLoading ? "Loading media preview…" : isLibraryMedia ? `${type} from media library` : attributes.url);

  let preview: ReactNode;
  if (media !== null) {
    preview = <MediaPreview compact media={media} />;
  } else if (type === "image" && attributes.previewUrl) {
    preview = (
      <Image
        alt={attributes.alt ?? ""}
        draggable={false}
        height={800}
        src={attributes.previewUrl}
        unoptimized
        width={1200}
      />
    );
  } else if (type === "video" && attributes.previewUrl) {
    preview = (
      <video aria-label={attributes.alt ?? filename} muted preload="metadata">
        <source src={attributes.previewUrl} />
      </video>
    );
  } else {
    preview = (
      <span className="news-writer-embed__badge" aria-hidden="true">
        {type === "document" ? "PDF" : type.toUpperCase()}
      </span>
    );
  }

  return (
    <NodeViewWrapper
      className={`news-writer-embed news-writer-embed--${type}`}
      contentEditable={false}
      data-news-embed={type}
    >
      {type === "image" || type === "video" ? (
        <div className="news-writer-embed__preview">{preview}</div>
      ) : (
        preview
      )}
      <div className="news-writer-embed__copy">
        <strong title={filename}>{filename}</strong>
        <small>{detail ?? "Embedded content"}</small>
      </div>
      <span className="news-writer-embed__action">Select to edit</span>
    </NodeViewWrapper>
  );
}

const NewsEmbed = Node.create({
  name: "newsEmbed",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      embedType: { default: "image", rendered: false },
      mediaId: { default: null, rendered: false },
      label: { default: null, rendered: false },
      description: { default: null, rendered: false },
      alt: { default: null, rendered: false },
      caption: { default: null, rendered: false },
      url: { default: null, rendered: false },
      newWindow: { default: false, rendered: false },
      previewUrl: { default: null, rendered: false },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-news-embed]" }];
  },
  addNodeView() {
    return ReactNodeViewRenderer(NewsEmbedNodeView);
  },
  renderHTML({ node, HTMLAttributes }) {
    const attributes = node.attrs as EmbedAttributes;
    const type = attributes.embedType;
    const label =
      attributes.label ||
      attributes.alt ||
      `${type[0]!.toUpperCase()}${type.slice(1)} from media library`;
    const detail =
      attributes.caption ||
      attributes.description ||
      attributes.url ||
      (attributes.mediaId ? "Media library asset" : "Embedded content");
    const preview =
      type === "image" && attributes.previewUrl
        ? ["img", { alt: "", draggable: "false", src: attributes.previewUrl }]
        : [
            "span",
            { class: "news-writer-embed__badge" },
            type === "document" ? "PDF" : type.toUpperCase(),
          ];
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: "news-writer-embed",
        "data-news-embed": type,
      }),
      preview,
      [
        "div",
        { class: "news-writer-embed__copy" },
        ["strong", {}, label],
        ["small", {}, detail],
      ],
      ["span", { class: "news-writer-embed__action" }, "Select to edit"],
    ];
  },
});

function textMarkToJson(mark: NewsTextMark): {
  type: string;
  attrs: Record<string, unknown>;
} {
  if (mark.type !== "link") return { type: mark.type, attrs: {} };
  return {
    type: "link",
    attrs: {
      href: mark.href,
      target: mark.newWindow ? "_blank" : null,
      rel: mark.newWindow ? "noopener noreferrer" : null,
    },
  };
}

function inlineToJson(
  content: NewsInlineContent | undefined,
  fallback: string,
): JSONContent[] {
  if (content === undefined)
    return fallback === "" ? [] : [{ type: "text", text: fallback }];
  return content.map((node): JSONContent => {
    if (node.type === "hardBreak") return { type: "hardBreak" };
    const textNode: JSONContent = { type: "text", text: node.text };
    if (node.marks !== undefined)
      textNode.marks = node.marks.map(textMarkToJson);
    return textNode;
  });
}

function embedNode(
  block: Extract<
    NewsContentBlock,
    { type: "image" | "video" | "document" | "link" }
  >,
): JSONContent {
  if (block.type === "link") {
    return {
      type: "newsEmbed",
      attrs: {
        blockId: block.id,
        embedType: "link",
        label: block.label,
        url: block.url,
        description: block.description ?? null,
        newWindow: block.newWindow,
      },
    };
  }
  if (block.type === "document") {
    return {
      type: "newsEmbed",
      attrs: {
        blockId: block.id,
        embedType: "document",
        mediaId: block.mediaId,
        label: block.label,
        description: block.description ?? null,
      },
    };
  }
  return {
    type: "newsEmbed",
    attrs: {
      blockId: block.id,
      embedType: block.type,
      mediaId: block.mediaId,
      alt: block.alt ?? null,
      caption: block.caption ?? null,
    },
  };
}

export function blocksToWriterDocument(
  blocks: NewsContentBlock[],
): JSONContent {
  const content: JSONContent[] = blocks.map((block) => {
    if (block.type === "paragraph")
      return {
        type: "paragraph",
        attrs: { blockId: block.id, textAlign: block.alignment ?? "left" },
        content: inlineToJson(block.richText, block.text),
      };
    if (block.type === "heading")
      return {
        type: "heading",
        attrs: {
          blockId: block.id,
          level: block.level,
          textAlign: block.alignment ?? "left",
        },
        content: inlineToJson(block.richText, block.text),
      };
    if (block.type === "quote")
      return {
        type: "blockquote",
        attrs: { blockId: block.id, attribution: block.attribution ?? null },
        content: [
          {
            type: "paragraph",
            content: inlineToJson(block.richText, block.text),
          },
        ],
      };
    if (block.type === "list") {
      return {
        type: block.style === "numbered" ? "orderedList" : "bulletList",
        attrs: { blockId: block.id },
        content: block.items.map((item, index) => ({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: inlineToJson(block.richItems?.[index], item),
            },
          ],
        })),
      };
    }
    if (block.type === "divider")
      return { type: "horizontalRule", attrs: { blockId: block.id } };
    return embedNode(block);
  });
  return {
    type: "doc",
    content: content.length === 0 ? [{ type: "paragraph" }] : content,
  };
}

function markFromJson(mark: JSONContent): NewsTextMark | null {
  if (
    ["bold", "italic", "underline", "strike", "code"].includes(mark.type ?? "")
  ) {
    return {
      type: mark.type as "bold" | "italic" | "underline" | "strike" | "code",
    };
  }
  if (mark.type !== "link" || typeof mark.attrs?.href !== "string") return null;
  return {
    type: "link",
    href: mark.attrs.href,
    ...(mark.attrs.target === "_blank" ? { newWindow: true } : {}),
  };
}

function inlineFromJson(content: JSONContent[] | undefined): NewsInlineContent {
  const result: NewsInlineContent = [];
  for (const node of content ?? []) {
    if (node.type === "hardBreak") {
      result.push({ type: "hardBreak" });
      continue;
    }
    if (node.type !== "text" || !node.text) continue;
    const marks = (node.marks ?? [])
      .map(markFromJson)
      .filter((mark): mark is NewsTextMark => mark !== null);
    result.push({
      type: "text",
      text: node.text,
      ...(marks.length === 0 ? {} : { marks }),
    });
  }
  return result;
}

function hasRichFormatting(content: NewsInlineContent): boolean {
  return content.some(
    (node) => node.type === "hardBreak" || (node.marks?.length ?? 0) > 0,
  );
}

function blockId(node: JSONContent): string {
  return typeof node.attrs?.blockId === "string"
    ? node.attrs.blockId
    : crypto.randomUUID();
}

function textAlignment(
  node: JSONContent,
): "left" | "center" | "right" | undefined {
  return node.attrs?.textAlign === "center" || node.attrs?.textAlign === "right"
    ? node.attrs.textAlign
    : undefined;
}

function listItems(node: JSONContent): {
  items: string[];
  richItems?: NewsInlineContent[];
} {
  const items: string[] = [];
  const richItems: NewsInlineContent[] = [];
  let formatted = false;
  for (const item of node.content ?? []) {
    const paragraph = item.content?.find((child) => child.type === "paragraph");
    const rich = inlineFromJson(paragraph?.content);
    const text = rich
      .map((child) => (child.type === "text" ? child.text : "\n"))
      .join("")
      .trim();
    if (text === "") continue;
    items.push(text);
    richItems.push(rich);
    formatted ||= hasRichFormatting(rich);
  }
  return { items, ...(formatted ? { richItems } : {}) };
}

function embedBlock(node: JSONContent): NewsContentBlock | null {
  const attrs = (node.attrs ?? {}) as EmbedAttributes;
  const id = blockId(node);
  if (attrs.embedType === "link") {
    if (!attrs.url || !attrs.label) return null;
    return {
      id,
      type: "link",
      label: attrs.label,
      url: attrs.url,
      newWindow: attrs.newWindow === true,
      ...(attrs.description ? { description: attrs.description } : {}),
    };
  }
  if (!attrs.mediaId) return null;
  if (attrs.embedType === "document")
    return {
      id,
      type: "document",
      mediaId: attrs.mediaId,
      label: attrs.label || "View document",
      ...(attrs.description ? { description: attrs.description } : {}),
    };
  if (attrs.embedType === "image" || attrs.embedType === "video")
    return {
      id,
      type: attrs.embedType,
      mediaId: attrs.mediaId,
      ...(attrs.alt ? { alt: attrs.alt } : {}),
      ...(attrs.caption ? { caption: attrs.caption } : {}),
    };
  return null;
}

export function writerDocumentToBlocks(
  document: JSONContent,
): NewsContentBlock[] {
  const blocks: NewsContentBlock[] = [];
  for (const node of document.content ?? []) {
    if (node.type === "paragraph" || node.type === "heading") {
      const richText = inlineFromJson(node.content);
      const text = richText
        .map((child) => (child.type === "text" ? child.text : "\n"))
        .join("")
        .trim();
      if (text === "") continue;
      const rich = hasRichFormatting(richText) ? { richText } : {};
      const alignment = textAlignment(node);
      if (node.type === "heading")
        blocks.push({
          id: blockId(node),
          type: "heading",
          level: node.attrs?.level === 3 ? 3 : 2,
          text,
          ...rich,
          ...(alignment ? { alignment } : {}),
        });
      else
        blocks.push({
          id: blockId(node),
          type: "paragraph",
          text,
          ...rich,
          ...(alignment ? { alignment } : {}),
        });
      continue;
    }
    if (node.type === "blockquote") {
      const paragraph = node.content?.find(
        (child) => child.type === "paragraph",
      );
      const richText = inlineFromJson(paragraph?.content);
      const text = richText
        .map((child) => (child.type === "text" ? child.text : "\n"))
        .join("")
        .trim();
      if (text !== "")
        blocks.push({
          id: blockId(node),
          type: "quote",
          text,
          ...(hasRichFormatting(richText) ? { richText } : {}),
          ...(typeof node.attrs?.attribution === "string" &&
          node.attrs.attribution.trim()
            ? { attribution: node.attrs.attribution.trim() }
            : {}),
        });
      continue;
    }
    if (node.type === "bulletList" || node.type === "orderedList") {
      const result = listItems(node);
      if (result.items.length > 0)
        blocks.push({
          id: blockId(node),
          type: "list",
          style: node.type === "orderedList" ? "numbered" : "bulleted",
          ...result,
        });
      continue;
    }
    if (node.type === "horizontalRule") {
      blocks.push({ id: blockId(node), type: "divider" });
      continue;
    }
    if (node.type === "newsEmbed") {
      const embed = embedBlock(node);
      if (embed !== null) blocks.push(embed);
    }
  }
  return blocks;
}

function ToolbarButton({
  active = false,
  children,
  disabled = false,
  label,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active || undefined}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function selectedEmbed(editor: Editor | null): EmbedAttributes | null {
  if (!editor?.isActive("newsEmbed")) return null;
  return editor.getAttributes("newsEmbed") as EmbedAttributes;
}

export function NewsWriter({
  blocks,
  locale,
  onChange,
  onChooseMedia,
}: NewsWriterProps) {
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [insertOpen, setInsertOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkHref, setLinkHref] = useState("");
  const [linkNewWindow, setLinkNewWindow] = useState(false);
  const [initialContent] = useState(() => blocksToWriterDocument(blocks));
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    content: initialContent,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          enableClickSelection: true,
          defaultProtocol: "https",
          HTMLAttributes: { rel: "noopener noreferrer" },
        },
      }),
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === "heading"
            ? "Section heading"
            : "Start writing, or type / for commands…",
        includeChildren: true,
      }),
      CharacterCount,
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right"],
      }),
      NewsBlockAttributes,
      NewsEmbed,
      UniqueID.configure({ types: identifiedNodes, attributeName: "blockId" }),
    ],
    editorProps: {
      attributes: {
        "aria-label": "News body",
        class: "news-writer__prose",
        spellcheck: "true",
      },
      handleKeyDown: (view, event) => {
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === "k"
        ) {
          event.preventDefault();
          setLinkOpen(true);
          return true;
        }
        if (
          event.key === "/" &&
          view.state.selection.$from.parent.textContent === ""
        ) {
          event.preventDefault();
          setInsertOpen(true);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: nextEditor }) =>
      onChange(writerDocumentToBlocks(nextEditor.getJSON())),
  });

  useEffect(() => {
    if (editor === null) return;
    const current = writerDocumentToBlocks(editor.getJSON());
    if (JSON.stringify(current) !== JSON.stringify(blocks)) {
      editor.commands.setContent(blocksToWriterDocument(blocks), {
        emitUpdate: false,
      });
    }
  }, [blocks, editor]);

  useEffect(() => {
    editor?.setEditable(mode === "write");
  }, [editor, mode]);

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive("bold") ?? false,
      italic: current?.isActive("italic") ?? false,
      underline: current?.isActive("underline") ?? false,
      strike: current?.isActive("strike") ?? false,
      code: current?.isActive("code") ?? false,
      bulletList: current?.isActive("bulletList") ?? false,
      orderedList: current?.isActive("orderedList") ?? false,
      blockquote: current?.isActive("blockquote") ?? false,
      link: current?.isActive("link") ?? false,
      canUndo: current?.can().chain().focus().undo().run() ?? false,
      canRedo: current?.can().chain().focus().redo().run() ?? false,
      words: current?.storage.characterCount.words() ?? 0,
      characters: current?.storage.characterCount.characters() ?? 0,
      embed: selectedEmbed(current),
    }),
  });

  if (editor === null)
    return (
      <div className="news-writer news-writer--loading">
        Preparing newsroom editor…
      </div>
    );
  const editorState = state ?? {
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    code: false,
    bulletList: false,
    orderedList: false,
    blockquote: false,
    link: false,
    canUndo: false,
    canRedo: false,
    words: 0,
    characters: 0,
    embed: null,
  };

  const chooseMedia = (kind: MediaKind, replace = false) => {
    const insertionPoint = editor.state.selection.from;
    onChooseMedia(kind, (media) => {
      const localized = media.defaultTranslations[locale];
      const attributes: EmbedAttributes = {
        embedType: media.kind,
        mediaId: media.id,
        label: localized?.title ?? media.originalName,
        alt: localized?.alt ?? null,
        caption: localized?.caption ?? null,
        previewUrl: media.url ?? null,
      };
      if (replace)
        editor.chain().focus().updateAttributes("newsEmbed", attributes).run();
      else
        editor
          .chain()
          .focus()
          .setTextSelection(insertionPoint)
          .insertContent({ type: "newsEmbed", attrs: attributes })
          .run();
    });
  };

  const setLink = () => {
    const href = editor.getAttributes("link").href as string | undefined;
    setLinkHref(href ?? "");
    setLinkNewWindow(editor.getAttributes("link").target === "_blank");
    setLinkOpen(true);
  };
  const applyLink = () => {
    const href = linkHref.trim();
    if (href === "")
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({
          href,
          target: linkNewWindow ? "_blank" : null,
          rel: linkNewWindow ? "noopener noreferrer" : null,
        })
        .run();
    setLinkOpen(false);
  };
  const insert = (
    command:
      | "paragraph"
      | "heading2"
      | "heading3"
      | "quote"
      | "bullet"
      | "number"
      | "divider",
  ) => {
    const chain = editor.chain().focus();
    if (command === "paragraph") chain.setParagraph().run();
    if (command === "heading2") chain.toggleHeading({ level: 2 }).run();
    if (command === "heading3") chain.toggleHeading({ level: 3 }).run();
    if (command === "quote") chain.toggleBlockquote().run();
    if (command === "bullet") chain.toggleBulletList().run();
    if (command === "number") chain.toggleOrderedList().run();
    if (command === "divider") chain.setHorizontalRule().run();
    setInsertOpen(false);
  };
  const updateEmbed = (changes: Partial<EmbedAttributes>) =>
    editor.chain().focus().updateAttributes("newsEmbed", changes).run();

  return (
    <section className={`news-writer news-writer--${mode}`}>
      <header className="news-writer__header">
        <div>
          <span className="admin-kicker">Professional editor</span>
          <strong>Story body</strong>
        </div>
        <div
          className="news-writer__modes"
          role="group"
          aria-label="Editor mode"
        >
          <button
            aria-pressed={mode === "write"}
            onClick={() => setMode("write")}
            type="button"
          >
            Write
          </button>
          <button
            aria-pressed={mode === "preview"}
            onClick={() => setMode("preview")}
            type="button"
          >
            Preview
          </button>
        </div>
      </header>

      {mode === "write" ? (
        <>
          <div
            className="news-writer__toolbar"
            role="toolbar"
            aria-label="Text formatting"
          >
            <div>
              <ToolbarButton
                disabled={!editorState.canUndo}
                label="Undo"
                onClick={() => editor.chain().focus().undo().run()}
              >
                Undo
              </ToolbarButton>
              <ToolbarButton
                disabled={!editorState.canRedo}
                label="Redo"
                onClick={() => editor.chain().focus().redo().run()}
              >
                Redo
              </ToolbarButton>
            </div>
            <div>
              <select
                aria-label="Text style"
                onChange={(event) =>
                  insert(
                    event.target.value as "paragraph" | "heading2" | "heading3",
                  )
                }
                value={
                  editor.isActive("heading", { level: 2 })
                    ? "heading2"
                    : editor.isActive("heading", { level: 3 })
                      ? "heading3"
                      : "paragraph"
                }
              >
                <option value="paragraph">Paragraph</option>
                <option value="heading2">Heading 2</option>
                <option value="heading3">Heading 3</option>
              </select>
              <ToolbarButton
                active={editorState.bold}
                label="Bold"
                onClick={() => editor.chain().focus().toggleBold().run()}
              >
                <b>B</b>
              </ToolbarButton>
              <ToolbarButton
                active={editorState.italic}
                label="Italic"
                onClick={() => editor.chain().focus().toggleItalic().run()}
              >
                <i>I</i>
              </ToolbarButton>
              <ToolbarButton
                active={editorState.underline}
                label="Underline"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
              >
                <u>U</u>
              </ToolbarButton>
              <ToolbarButton
                active={editorState.strike}
                label="Strikethrough"
                onClick={() => editor.chain().focus().toggleStrike().run()}
              >
                <s>S</s>
              </ToolbarButton>
              <ToolbarButton
                active={editorState.code}
                label="Inline code"
                onClick={() => editor.chain().focus().toggleCode().run()}
              >
                Code
              </ToolbarButton>
              <ToolbarButton
                active={editorState.link}
                label="Add or edit link"
                onClick={setLink}
              >
                Link
              </ToolbarButton>
            </div>
            <div>
              <ToolbarButton
                active={editorState.bulletList}
                label="Bulleted list"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
              >
                Bullets
              </ToolbarButton>
              <ToolbarButton
                active={editorState.orderedList}
                label="Numbered list"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
              >
                Numbers
              </ToolbarButton>
              <ToolbarButton
                active={editorState.blockquote}
                label="Block quote"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
              >
                Quote
              </ToolbarButton>
              <ToolbarButton
                label="Align left"
                onClick={() =>
                  editor.chain().focus().setTextAlign("left").run()
                }
              >
                Left
              </ToolbarButton>
              <ToolbarButton
                label="Align center"
                onClick={() =>
                  editor.chain().focus().setTextAlign("center").run()
                }
              >
                Center
              </ToolbarButton>
              <ToolbarButton
                label="Align right"
                onClick={() =>
                  editor.chain().focus().setTextAlign("right").run()
                }
              >
                Right
              </ToolbarButton>
            </div>
            <div className="news-writer__insert-actions">
              <button
                aria-expanded={insertOpen}
                className="news-writer__insert-button"
                onClick={() => setInsertOpen((current) => !current)}
                type="button"
              >
                + Insert <kbd>/</kbd>
              </button>
              <button onClick={() => chooseMedia("image")} type="button">
                Image
              </button>
              <button onClick={() => chooseMedia("video")} type="button">
                Video
              </button>
              <button onClick={() => chooseMedia("document")} type="button">
                Document
              </button>
            </div>
          </div>
          {insertOpen ? (
            <div
              className="news-writer__commands"
              role="menu"
              aria-label="Insert content"
            >
              <header>
                <strong>Insert content</strong>
                <small>Type / on an empty line to open this menu</small>
              </header>
              <button
                onClick={() => insert("paragraph")}
                role="menuitem"
                type="button"
              >
                <b>P</b>
                <span>
                  <strong>Text</strong>
                  <small>Continue with a paragraph</small>
                </span>
              </button>
              <button
                onClick={() => insert("heading2")}
                role="menuitem"
                type="button"
              >
                <b>H2</b>
                <span>
                  <strong>Section heading</strong>
                  <small>Start a main section</small>
                </span>
              </button>
              <button
                onClick={() => insert("heading3")}
                role="menuitem"
                type="button"
              >
                <b>H3</b>
                <span>
                  <strong>Subheading</strong>
                  <small>Break down a section</small>
                </span>
              </button>
              <button
                onClick={() => insert("quote")}
                role="menuitem"
                type="button"
              >
                <b>“</b>
                <span>
                  <strong>Quote</strong>
                  <small>Highlight a statement</small>
                </span>
              </button>
              <button
                onClick={() => insert("bullet")}
                role="menuitem"
                type="button"
              >
                <b>•</b>
                <span>
                  <strong>Bulleted list</strong>
                  <small>Present scannable points</small>
                </span>
              </button>
              <button
                onClick={() => insert("number")}
                role="menuitem"
                type="button"
              >
                <b>1.</b>
                <span>
                  <strong>Numbered list</strong>
                  <small>Show ordered steps</small>
                </span>
              </button>
              <button
                onClick={() => insert("divider")}
                role="menuitem"
                type="button"
              >
                <b>—</b>
                <span>
                  <strong>Divider</strong>
                  <small>Separate story sections</small>
                </span>
              </button>
              <button
                onClick={() => chooseMedia("image")}
                role="menuitem"
                type="button"
              >
                <b>IMG</b>
                <span>
                  <strong>Image</strong>
                  <small>Choose from media library</small>
                </span>
              </button>
              <button
                onClick={() => chooseMedia("video")}
                role="menuitem"
                type="button"
              >
                <b>VID</b>
                <span>
                  <strong>Video</strong>
                  <small>Embed an optimized video</small>
                </span>
              </button>
              <button
                onClick={() => chooseMedia("document")}
                role="menuitem"
                type="button"
              >
                <b>PDF</b>
                <span>
                  <strong>Document</strong>
                  <small>Add a viewable download</small>
                </span>
              </button>
            </div>
          ) : null}
          <BubbleMenu editor={editor} className="news-writer__bubble">
            <ToolbarButton
              active={editorState.bold}
              label="Bold"
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <b>B</b>
            </ToolbarButton>
            <ToolbarButton
              active={editorState.italic}
              label="Italic"
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <i>I</i>
            </ToolbarButton>
            <ToolbarButton
              active={editorState.underline}
              label="Underline"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
              <u>U</u>
            </ToolbarButton>
            <ToolbarButton
              active={editorState.link}
              label="Add or edit link"
              onClick={setLink}
            >
              Link
            </ToolbarButton>
          </BubbleMenu>
          <DragHandle className="news-writer__drag-handle" editor={editor}>
            <span aria-hidden="true">⋮⋮</span>
          </DragHandle>
        </>
      ) : null}

      {linkOpen ? (
        <form
          className="news-writer__link-panel"
          onSubmit={(event) => {
            event.preventDefault();
            applyLink();
          }}
        >
          <label>
            <span>Link destination</span>
            <input
              autoFocus
              onChange={(event) => setLinkHref(event.target.value)}
              placeholder="https://example.com or /internal-page"
              type="text"
              value={linkHref}
            />
          </label>
          <label className="admin-check">
            <input
              checked={linkNewWindow}
              onChange={(event) => setLinkNewWindow(event.target.checked)}
              type="checkbox"
            />{" "}
            Open in a new window
          </label>
          <div>
            <button type="submit">Apply link</button>
            <button
              onClick={() => {
                editor.chain().focus().unsetLink().run();
                setLinkOpen(false);
              }}
              type="button"
            >
              Remove link
            </button>
            <button onClick={() => setLinkOpen(false)} type="button">
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="news-writer__canvas">
        <EditorContent editor={editor} />
      </div>

      {mode === "write" && editorState.embed ? (
        <aside className="news-writer__embed-inspector">
          <header>
            <div>
              <span className="admin-kicker">Selected embed</span>
              <strong>
                {editorState.embed.embedType === "document"
                  ? "Document"
                  : editorState.embed.embedType === "video"
                    ? "Video"
                    : editorState.embed.embedType === "link"
                      ? "Link card"
                      : "Image"}
              </strong>
            </div>
            <button
              onClick={() => editor.chain().focus().deleteSelection().run()}
              type="button"
            >
              Remove
            </button>
          </header>
          {editorState.embed.mediaId &&
          (editorState.embed.embedType === "image" ||
            editorState.embed.embedType === "video" ||
            editorState.embed.embedType === "document") ? (
            <SelectedMediaSummary mediaId={editorState.embed.mediaId} />
          ) : null}
          {editorState.embed.embedType === "image" ||
          editorState.embed.embedType === "video" ? (
            <div className="news-writer__embed-fields">
              <label>
                <span>
                  {editorState.embed.embedType === "image"
                    ? "Alternative text"
                    : "Accessible label"}
                </span>
                <input
                  onChange={(event) =>
                    updateEmbed({ alt: event.target.value || null })
                  }
                  value={editorState.embed.alt ?? ""}
                />
              </label>
              <label>
                <span>Caption</span>
                <input
                  onChange={(event) =>
                    updateEmbed({ caption: event.target.value || null })
                  }
                  value={editorState.embed.caption ?? ""}
                />
              </label>
              <button
                onClick={() =>
                  chooseMedia(
                    editorState.embed!.embedType as "image" | "video",
                    true,
                  )
                }
                type="button"
              >
                Replace media
              </button>
            </div>
          ) : null}
          {editorState.embed.embedType === "document" ? (
            <div className="news-writer__embed-fields">
              <label>
                <span>Document label</span>
                <input
                  onChange={(event) =>
                    updateEmbed({ label: event.target.value })
                  }
                  value={editorState.embed.label ?? ""}
                />
              </label>
              <label>
                <span>Description</span>
                <input
                  onChange={(event) =>
                    updateEmbed({ description: event.target.value || null })
                  }
                  value={editorState.embed.description ?? ""}
                />
              </label>
              <button
                onClick={() => chooseMedia("document", true)}
                type="button"
              >
                Replace document
              </button>
            </div>
          ) : null}
          {editorState.embed.embedType === "link" ? (
            <div className="news-writer__embed-fields">
              <label>
                <span>Link label</span>
                <input
                  onChange={(event) =>
                    updateEmbed({ label: event.target.value })
                  }
                  value={editorState.embed.label ?? ""}
                />
              </label>
              <label>
                <span>URL</span>
                <input
                  onChange={(event) => updateEmbed({ url: event.target.value })}
                  value={editorState.embed.url ?? ""}
                />
              </label>
            </div>
          ) : null}
        </aside>
      ) : null}

      <footer className="news-writer__footer">
        <span>{editorState.words.toLocaleString()} words</span>
        <span>{editorState.characters.toLocaleString()} characters</span>
        <span>{Math.max(1, Math.ceil(editorState.words / 220))} min read</span>
        <span>Markdown shortcuts supported</span>
      </footer>
    </section>
  );
}
