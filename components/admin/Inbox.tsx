"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Arrow } from "@/components/ui/Arrow";
import {
  deleteMessage,
  listMessages,
  type MessageFilter,
  setMessageRead,
} from "@/lib/admin/actions";
import { confirmDialog, toast } from "@/lib/admin/store";
import { SearchBox } from "./media";
import { Pager } from "./Pager";
import { Btn, PageHead, Status, timeAgo } from "./ui";

type Page = Awaited<ReturnType<typeof listMessages>>;
type Msg = Page["items"][number];
const TOPIC: Record<string, string> = {
  role: "A full-time role",
  freelance: "Freelance work",
  collab: "Collaboration",
  hi: "Just saying hi",
};
const PAGE_SIZE = 25;

/** Contact-form inbox: server-side pages of 25, All/Unread filter. TanStack Query polls every minute. */
export function Inbox({ initial, retention }: { initial: Page; retention: number }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<MessageFilter>("all");
  const [q, setQ] = useState("");
  const isFirst = page === 0 && filter === "all" && !q;
  const { data = initial, isFetching } = useQuery({
    queryKey: ["messages", filter, page, q],
    queryFn: () => listMessages({ page, filter, pageSize: PAGE_SIZE, q }),
    initialData: isFirst ? initial : undefined,
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
  const [sel, setSel] = useState<number | null>(initial.items[0]?.id ?? null);
  const [selected, setSelected] = useState<Msg | null>(initial.items[0] ?? null);
  // Keep the open message in sync with fresh data; it stays open even when you change page.
  const m = data.items.find((x) => x.id === sel) ?? (selected?.id === sel ? selected : null);

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["messages"] });
    await qc.invalidateQueries({ queryKey: ["unread"] });
  };
  const open = async (x: Msg) => {
    setSel(x.id);
    setSelected(x);
    if (!x.read) {
      await setMessageRead(x.id, true);
      await refresh();
    }
  };
  const go = (p: number) => {
    setPage(p);
    document.querySelector(".msg-list")?.scrollTo({ top: 0 });
  };

  return (
    <>
      <PageHead
        title="Messages"
        desc={`Contact-form submissions. Stored for ${retention} months, then deleted automatically.`}
      />
      <div className="toolbar">
        <SearchBox
          placeholder="Search name, email or message…"
          label="Search messages"
          onSearch={(v) => {
            setQ(v.trim());
            setPage(0);
          }}
        />
        <div className="chips" role="radiogroup" aria-label="Filter messages">
          {(
            [
              ["all", "All"],
              ["unread", "Unread"],
            ] as const
          ).map(([v, label]) => (
            <label key={v}>
              <input
                type="radio"
                name="mf"
                value={v}
                checked={filter === v}
                onChange={() => {
                  setFilter(v);
                  setPage(0);
                }}
              />
              <span>
                {label} · {v === "unread" && !q ? data.unread : filter === v ? data.total : "…"}
              </span>
            </label>
          ))}
        </div>
      </div>
      <div className="card inbox" aria-busy={isFetching}>
        <ul className="msg-list">
          {data.items.length === 0 ? (
            <li className="msg">
              {q
                ? "No messages match."
                : filter === "unread"
                  ? "All caught up."
                  : "No messages yet."}
            </li>
          ) : null}
          {data.items.map((x) => (
            <li key={x.id}>
              <button
                type="button"
                className={`msg${x.read ? "" : " unread"}${x.id === sel ? " is-active" : ""}`}
                onClick={() => open(x)}
              >
                <span className="top">
                  <b>{x.name}</b>
                  <span className="mono subtle">{timeAgo(x.createdAt)}</span>
                </span>
                <p>{x.message}</p>
                <Status tone={x.topic === "role" ? "wip" : undefined}>
                  {TOPIC[x.topic] ?? x.topic}
                </Status>
              </button>
            </li>
          ))}
        </ul>
        <div className="msg-read">
          {m ? (
            <>
              <h2>{TOPIC[m.topic] ?? m.topic}</h2>
              <div className="from">
                <span className="avatar">{m.name.slice(0, 2).toUpperCase()}</span>
                <div>
                  <b>{m.name}</b>
                  <div className="muted" style={{ fontSize: ".85rem" }}>
                    {m.email} ·{" "}
                    {new Date(m.createdAt).toLocaleString("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </div>
                </div>
              </div>
              <p className="body" style={{ whiteSpace: "pre-wrap" }}>
                {m.message}
              </p>
              <div className="acts">
                <Btn
                  primary
                  href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${TOPIC[m.topic] ?? "your message"}`)}`}
                  external
                >
                  Reply by email <Arrow dir="out" />
                </Btn>
                <Btn
                  onClick={async () => {
                    await setMessageRead(m.id, false);
                    setSelected({ ...m, read: false });
                    await refresh();
                  }}
                >
                  Mark unread
                </Btn>
                <Btn
                  onClick={async () => {
                    if (
                      !(await confirmDialog({
                        title: `Delete the message from ${m.name}?`,
                        body: "It’s removed for good.",
                        confirmLabel: "Delete",
                        tone: "danger",
                      }))
                    )
                      return;
                    const r = await deleteMessage(m.id);
                    if (r.ok) {
                      setSel(null);
                      setSelected(null);
                      toast("Deleted.");
                      await refresh();
                    }
                  }}
                >
                  Delete
                </Btn>
              </div>
            </>
          ) : (
            <p className="muted">Select a message.</p>
          )}
        </div>
      </div>
      <Pager
        label="Message pages"
        page={data.page}
        pageCount={data.pageCount}
        total={data.total}
        pageSize={data.pageSize}
        onPage={go}
      />
    </>
  );
}
