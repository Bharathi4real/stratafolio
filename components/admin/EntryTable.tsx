"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createColumnHelper,
  createPaginatedRowModel,
  rowPaginationFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Arrow } from "@/components/ui/Arrow";
import {
  createEntryAction,
  deleteEntryAction,
  reorderEntriesAction,
  searchEntriesAction,
  unpublishEntryAction,
} from "@/lib/admin/actions";
import type { Row } from "@/lib/admin/rows";
import { confirmDialog, toast } from "@/lib/admin/store";
import type { CollectionKey } from "@/lib/content/schema";
import { useDebouncedCallback } from "@/lib/pacer";
import { MarkdownImport } from "./MarkdownImport";
import { Pager } from "./Pager";
import { Select } from "./Select";
import { Btn, PageHead, Status, timeAgo } from "./ui";

const features = tableFeatures({
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});
const helper = createColumnHelper<typeof features, Row>();

type SortKey = "site" | "updated" | "oldest" | "title" | "published";

const STAGE: Record<string, { label: string; tone?: "pub" | "wip" }> = {
  published: { label: "Published", tone: "pub" },
  writing: { label: "Writing", tone: "wip" },
  draft: { label: "Draft" },
};

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    hour12: true,
    minute: "2-digit",
  });

function StateCell({ r }: { r: Row }) {
  if (r.state === "unpublished") return <Status>Not published</Status>;
  const s = r.stage ? STAGE[r.stage] : { label: "Published", tone: "pub" as const };
  return (
    <span className="cell-stack">
      {r.scheduledFor ? (
        <Status tone="sched">Scheduled · {fmtWhen(r.scheduledFor)}</Status>
      ) : (
        <Status tone={s.tone}>{s.label}</Status>
      )}
      {r.state === "changed" ? <Status tone="changed">Draft changes</Status> : null}
    </span>
  );
}

/** Admin list (TanStack Table): search, stage filter for posts, reorder for ordered collections. */
export function EntryTable({
  collection,
  rows,
  title,
  accent,
  desc,
  newLabel,
  publicPath,
  canManage = true,
}: {
  collection: CollectionKey;
  rows: Row[];
  title: string;
  accent: string;
  desc: string;
  newLabel: string;
  publicPath?: (r: Row) => string | null;
  /**
   * Unpublish and delete live entries (authors: false, they can only delete their own
   * never-published drafts). UI only; the server checks the same.
   */
  canManage?: boolean;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("all");
  const isPosts = collection === "posts";
  const ordered = collection !== "posts";
  const [author, setAuthor] = useState("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortKey>(ordered ? "site" : "updated");
  const [order, setOrder] = useState(rows);
  // The server sends fresh rows after create / cancel / delete / publish (router.refresh):
  // follow them, or the table keeps showing the list it first loaded.
  useEffect(() => setOrder(rows), [rows]);
  const setDebounced = useDebouncedCallback((v: string) => setQuery(v), { wait: 150 });

  const authors = useMemo(
    () => [...new Set(rows.map((r) => r.author).filter(Boolean) as string[])].sort(),
    [rows],
  );
  const categories = useMemo(
    () => [...new Set(rows.map((r) => r.category).filter(Boolean) as string[])].sort(),
    [rows],
  );
  const filtered =
    Boolean(query.trim()) || stage !== "all" || author !== "all" || category !== "all";
  const canReorder = ordered && sort === "site" && !filtered;
  const clearFilters = () => {
    setQ("");
    setQuery("");
    setStage("all");
    setAuthor("all");
    setCategory("all");
    setSort(ordered ? "site" : "updated");
  };

  // Search runs in the database (titles, summaries, tags, categories and post body text) across
  // the whole collection; the local match fills in instantly while the server answers.
  const term = query.trim();
  const hits = useQuery({
    queryKey: ["entry-search", collection, term],
    queryFn: () => searchEntriesAction(collection, term),
    enabled: term.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const hitIds = useMemo(() => new Set(hits.data ?? []), [hits.data]);

  const data = useMemo(() => {
    const s = term.toLowerCase();
    const list = order.filter(
      (r) =>
        (stage === "all" ||
          (stage === "scheduled"
            ? Boolean(r.scheduledFor)
            : r.stage === stage && !(stage === "published" && r.scheduledFor))) &&
        (author === "all" || r.author === author) &&
        (category === "all" || r.category === category) &&
        (!s ||
          hitIds.has(r.id) ||
          `${r.title} ${r.sub} ${r.category ?? ""} ${r.author ?? ""}`.toLowerCase().includes(s)),
    );
    const by: Record<SortKey, ((a: Row, b: Row) => number) | null> = {
      site: null,
      updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      oldest: (a, b) => a.updatedAt.localeCompare(b.updatedAt),
      title: (a, b) => a.title.localeCompare(b.title),
      // Undated (never published) posts go last.
      published: (a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
    };
    // While searching with the default sort, show the best matches first (Postgres ranking).
    if (s && hits.data && sort === (ordered ? "site" : "updated")) {
      const rank = new Map(hits.data.map((id, i) => [id, i]));
      return [...list].sort(
        (a, b) =>
          (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
      );
    }
    const cmp = by[sort];
    return cmp ? [...list].sort(cmp) : list;
  }, [order, term, hitIds, hits.data, stage, author, category, sort, ordered]);

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("title", {
          header: "Title",
          cell: (c) => (
            <>
              <Link className="t-title" href={`/admin/${collection}/${c.row.original.id}`}>
                {c.row.original.title}
              </Link>
              <span className="t-sub">{c.row.original.sub}</span>
            </>
          ),
        }),
        helper.accessor("state", {
          header: "Status",
          cell: (c) => <StateCell r={c.row.original} />,
        }),
        helper.accessor("category", {
          header: isPosts ? "Category" : "Type",
          cell: (c) => (c.getValue() ? <span className="tagc">{c.getValue()}</span> : null),
        }),
        ...(isPosts
          ? [
              helper.accessor("author", {
                header: "Author",
                cell: (c) => <span className="subtle">{c.getValue()}</span>,
              }),
            ]
          : []),
        helper.accessor("updatedAt", {
          header: "Updated",
          cell: (c) => <span className="mono subtle">{timeAgo(c.getValue())}</span>,
        }),
      ]),
    [isPosts, collection],
  );
  const table = useTable(
    {
      features,
      columns,
      data,
      // Reordering changes `data`; stay on the current page instead of jumping back to page 1.
      autoResetPageIndex: false,
      initialState: { pagination: { pageIndex: 0, pageSize: 20 } },
    },
    (state) => ({ pagination: state.pagination }),
  );
  const { pageIndex, pageSize } = table.state.pagination;
  const pageCount = Math.max(1, table.getPageCount());
  // Filters shrink the list: go back to page 1, and never sit past the last page.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on filter change only
  useEffect(() => table.setPageIndex(0), [query, stage]);
  useEffect(() => {
    if (pageIndex > pageCount - 1) table.setPageIndex(pageCount - 1);
  }, [pageIndex, pageCount, table]);

  const move = useDebouncedCallback(
    async (ids: number[]) => {
      const r = await reorderEntriesAction(collection, ids);
      if (r.ok) toast("Order saved and live.");
      else toast(r.error, "error");
    },
    { wait: 600 },
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) {
      const k = r.scheduledFor ? "scheduled" : r.stage;
      if (k) c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [rows]);

  return (
    <>
      <PageHead title={title} accent={accent} desc={desc}>
        <Btn
          primary
          onClick={async () => {
            const r = await createEntryAction(collection);
            if (r.ok && r.data) {
              void qc.invalidateQueries({ queryKey: ["pending"] });
              router.push(`/admin/${collection}/${r.data.id}`);
            } else if (!r.ok) toast(r.error, "error");
          }}
        >
          {newLabel}
        </Btn>
        {isPosts ? <MarkdownImport /> : null}
      </PageHead>
      <div className="toolbar">
        <input
          className="inp search-inp"
          type="search"
          placeholder={`Search ${title.toLowerCase()}…`}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setDebounced(e.target.value);
          }}
          aria-label="Search"
        />
        {isPosts ? (
          <div className="chips" role="radiogroup" aria-label="Filter by status">
            {(["all", "published", "scheduled", "writing", "draft"] as const)
              .filter((s) => s !== "scheduled" || counts.scheduled)
              .map((s) => (
                <label key={s}>
                  <input
                    type="radio"
                    name="pf"
                    value={s}
                    checked={stage === s}
                    onChange={() => setStage(s)}
                  />
                  <span>
                    {s === "all" ? "All" : s === "scheduled" ? "Scheduled" : STAGE[s].label} ·{" "}
                    {counts[s] ?? 0}
                  </span>
                </label>
              ))}
          </div>
        ) : null}
      </div>
      <div className="toolbar toolbar-filters">
        {categories.length > 1 ? (
          <Select
            size="sm"
            label={isPosts ? "Category" : "Type"}
            value={category}
            onChange={setCategory}
            options={[
              { value: "all", label: isPosts ? "All categories" : "All types" },
              ...categories.map((c) => ({ value: c, label: c })),
            ]}
          />
        ) : null}
        {isPosts && authors.length > 1 ? (
          <Select
            size="sm"
            label="Author"
            value={author}
            onChange={setAuthor}
            options={[
              { value: "all", label: "All authors" },
              ...authors.map((a) => ({ value: a, label: a })),
            ]}
          />
        ) : null}
        <Select
          size="sm"
          label="Sort"
          value={sort}
          onChange={(v) => setSort(v as SortKey)}
          options={[
            ...(ordered
              ? [{ value: "site" as const, label: "Site order", hint: "Use the arrows to reorder" }]
              : []),
            { value: "updated" as const, label: "Recently updated" },
            { value: "oldest" as const, label: "Least recently updated" },
            ...(isPosts ? [{ value: "published" as const, label: "Publish date" }] : []),
            { value: "title" as const, label: "Title A–Z" },
          ]}
        />
        <span className="toolbar-count mono subtle">
          {data.length === rows.length
            ? `${rows.length} total`
            : `${data.length} of ${rows.length}`}
        </span>
        {filtered || sort !== (ordered ? "site" : "updated") ? (
          <Btn onClick={clearFilters}>Clear filters</Btn>
        ) : null}
      </div>
      <div className="card">
        <table>
          <thead>
            {table.getHeaderGroups().map((g) => (
              <tr key={g.id}>
                {ordered ? (
                  <th style={{ width: "4.5rem" }} className="mono">
                    Order
                  </th>
                ) : null}
                {g.headers.map((h) => (
                  <th key={h.id} className="mono">
                    <table.FlexRender header={h} />
                  </th>
                ))}
                <th />
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const r = row.original;
              const idx = order.findIndex((x) => x.id === r.id);
              const href = publicPath?.(r);
              return (
                <tr
                  key={row.id}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("a,button,input")) return;
                    router.push(`/admin/${collection}/${r.id}`);
                  }}
                >
                  {ordered ? (
                    <td>
                      <span className="order-btns">
                        {[-1, 1].map((d) => (
                          <button
                            key={d}
                            className="icon-btn"
                            type="button"
                            aria-label={d < 0 ? "Move up" : "Move down"}
                            disabled={!canReorder || idx + d < 0 || idx + d >= order.length}
                            title={
                              canReorder
                                ? undefined
                                : "Switch to Site order with no filters to reorder"
                            }
                            onClick={() => {
                              const next = [...order];
                              const [m] = next.splice(idx, 1);
                              next.splice(idx + d, 0, m);
                              setOrder(next);
                              move(next.map((x) => x.id));
                            }}
                          >
                            <Arrow dir={d < 0 ? "up" : "down"} />
                          </button>
                        ))}
                      </span>
                    </td>
                  ) : null}
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {href && r.state !== "unpublished" ? (
                      <a
                        className="icon-btn inline"
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="View on site"
                      >
                        <Arrow dir="out" />
                      </a>
                    ) : null}
                    <RowMenu collection={collection} r={r} canManage={canManage} />
                  </td>
                </tr>
              );
            })}
            {data.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">
                  {rows.length ? (
                    <>
                      No matches.{" "}
                      <button type="button" className="link-btn" onClick={clearFilters}>
                        Clear filters
                      </button>
                    </>
                  ) : (
                    "Nothing here yet."
                  )}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <Pager
        label={`${title} pages`}
        page={pageIndex}
        pageCount={pageCount}
        total={data.length}
        pageSize={pageSize}
        onPage={(p) => table.setPageIndex(p)}
        onPageSize={(n) => table.setPagination({ pageIndex: 0, pageSize: n })}
      />
    </>
  );
}

function RowMenu({
  collection,
  r,
  canManage,
}: {
  collection: CollectionKey;
  r: Row;
  canManage: boolean;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  return (
    <span className="row-menu">
      <button
        className="icon-btn inline"
        type="button"
        aria-label="More"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>
      {open ? (
        <span className="row-menu-pop" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => router.push(`/admin/${collection}/${r.id}`)}
          >
            Edit
          </button>
          {canManage && r.state !== "unpublished" ? (
            <button
              type="button"
              role="menuitem"
              onClick={async () => {
                setOpen(false);
                const x = await unpublishEntryAction(r.id);
                if (x.ok) {
                  toast("Unpublished.");
                  void qc.invalidateQueries();
                  router.refresh();
                } else toast(x.error, "error");
              }}
            >
              Unpublish
            </button>
          ) : null}
          {canManage || r.state === "unpublished" ? (
            <button
              type="button"
              role="menuitem"
              className="danger"
              onClick={async () => {
                setOpen(false);
                if (
                  !(await confirmDialog({
                    title: `Delete “${r.title}”?`,
                    body: "It disappears from the site and the admin, with its version history. This can’t be undone.",
                    confirmLabel: "Delete",
                    tone: "danger",
                  }))
                )
                  return;
                const x = await deleteEntryAction(r.id);
                if (x.ok) {
                  toast("Deleted.");
                  void qc.invalidateQueries();
                  router.refresh();
                } else toast(x.error, "error");
              }}
            >
              Delete
            </button>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
