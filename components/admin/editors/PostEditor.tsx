"use client";

import { useStore } from "@tanstack/react-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Arrow } from "@/components/ui/Arrow";
import { listAuthors, unpublishEntryAction } from "@/lib/admin/actions";
import { confirmDialog, toast, useAdmin } from "@/lib/admin/store";
import { readingMinutes } from "@/lib/content/rich";
import { isScheduled, liveAt } from "@/lib/content/schedule";
import type { PostData, RichDoc } from "@/lib/content/schema";
import { DatePicker, localTzLabel } from "../DatePicker";
import { EditorChrome } from "../EditorChrome";
import { MediaField, Modal } from "../media";
import { Repeater, RepItem } from "../Repeater";
import { RichEditor } from "../rich/RichEditor";
import { Btn, Card, Seg } from "../ui";
import { useEntryForm } from "../useDocForm";

type Vals = Omit<PostData, "content"> & { content?: unknown };

function Autosize({
  value,
  onChange,
  className,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  className: string;
  placeholder: string;
  label: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = () => {
    const t = ref.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${t.scrollHeight}px`;
  };
  return (
    <textarea
      ref={(el) => {
        ref.current = el;
        if (el) requestAnimationFrame(fit);
      }}
      className={className}
      rows={1}
      aria-label={label}
      placeholder={placeholder}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        fit();
      }}
    />
  );
}

export function PostEditor({
  id,
  initial,
  published,
  hasDraft,
  siteUrl,
  categories,
  titleTemplate = "%s",
  canPublish = false,
}: {
  id: number;
  initial: PostData;
  published: boolean;
  hasDraft: boolean;
  siteUrl: string;
  categories: string[];
  /** Settings → SEO title template, for the search preview. */
  titleTemplate?: string;
  /**
   * Editors and admins (posts.manage): publish, schedule, unpublish and pick the author.
   * Authors write drafts as themselves; the server enforces both.
   */
  canPublish?: boolean;
}) {
  const { form, ...doc } = useEntryForm<Vals>(id, initial);
  // Preview shows unpublished changes; with nothing unpublished it would match the live page.
  const saveState = useAdmin((st) => st.save);
  const canPreview =
    !published || Boolean(doc.draft ?? hasDraft) || saveState === "dirty" || saveState === "saving";
  const authors = useQuery({ queryKey: ["authors"], queryFn: () => listAuthors() });
  const authorOptions = [
    { value: "", label: "Site owner" },
    ...(authors.data ?? []).map((a) => ({
      value: a.id,
      label: a.name,
    })),
  ];
  const v = useStore(form.store, (s) => s.values) as Vals;
  const host = siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const metaTitle = v.meta?.title || titleTemplate.replace("%s", v.title);
  const metaDesc = v.meta?.description || v.excerpt;
  const minutes = v.readOverride || readingMinutes(v.content as RichDoc);
  // Local-time labels depend on the browser's timezone: render them after mount so the
  // server HTML (UTC) and the first client render agree.
  const [tz, setTz] = useState("");
  useEffect(() => setTz(localTzLabel()), []);
  const scheduled = isScheduled(v);
  const fmtWhen = (iso: string | null | undefined) =>
    iso && tz
      ? new Date(liveAt({ publishedAt: iso }) ?? 0).toLocaleString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "numeric",
          hour12: true,
          minute: "2-digit",
        })
      : "";
  const when = scheduled ? fmtWhen(v.publishedAt) : "";
  const router = useRouter();
  const qc = useQueryClient();

  // Publish = live now. A post scheduled for later is published immediately instead.
  const publishNow = async () => {
    const cur = form.state.values as Vals;
    if (isScheduled(cur) || (cur.stage === "published" && !cur.publishedAt))
      form.setFieldValue("publishedAt", new Date().toISOString());
    return doc.publish();
  };

  // Schedule dialog: pick a future date and time; confirming publishes with that time.
  const [schedOpen, setSchedOpen] = useState(false);
  const [schedAt, setSchedAt] = useState<string | null>(null);
  const [schedBusy, setSchedBusy] = useState(false);
  const openSchedule = () => {
    const nextHour = new Date(Math.ceil((Date.now() + 3_600_000) / 900_000) * 900_000);
    setSchedAt(scheduled && v.publishedAt ? v.publishedAt : nextHour.toISOString());
    setSchedOpen(true);
  };
  const schedFuture = Boolean(schedAt && Date.parse(schedAt) > Date.now() + 60_000);
  const confirmSchedule = async () => {
    if (!schedAt || !schedFuture) return;
    setSchedBusy(true);
    await doc.flush();
    form.setFieldValue("stage", "published");
    form.setFieldValue("publishedAt", schedAt);
    const r = await doc.publish();
    setSchedBusy(false);
    if (!r.ok) return toast(r.error, "error");
    setSchedOpen(false);
    toast(`Scheduled for ${fmtWhen(schedAt)}.`);
    void qc.invalidateQueries();
    router.refresh();
  };
  const unschedule = () =>
    confirmDialog({
      title: "Unschedule this post?",
      body: "It won’t go live at the scheduled time. It stays here as an unpublished draft, so you can publish or schedule it again later.",
      confirmLabel: "Unschedule",
      busyLabel: "Unscheduling…",
      action: async () => {
        form.setFieldValue("publishedAt", null);
        await doc.flush();
        const r = await unpublishEntryAction(id);
        if (!r.ok) throw new Error(r.error);
        toast("Unscheduled. It’s a draft again.");
        void qc.invalidateQueries();
        router.refresh();
      },
    });

  return (
    <>
      <EditorChrome
        title="Edit"
        accent="post"
        desc={`/blog/${v.slug}`}
        published={published}
        hasDraft={hasDraft}
        {...doc}
        publish={publishNow}
        onRestored={doc.restore}
        publishLabel={scheduled ? "Publish now" : "Publish post"}
        alwaysPublishable={scheduled}
        canPublish={canPublish}
        publishNote="An editor will publish this post."
      >
        {canPublish ? (
          <Btn onClick={openSchedule}>{scheduled ? "Reschedule" : "Schedule"}</Btn>
        ) : null}
        {published && v.stage === "published" && !scheduled ? (
          <Btn href={`/blog/${v.slug}`} external>
            View <Arrow dir="out" />
          </Btn>
        ) : null}
        {/* Draft preview shows every draft on the site, so it's for roles that can publish. */}
        {canPublish ? (
          <Btn
            href={`/api/preview?path=${encodeURIComponent(`/blog/${v.slug}`)}`}
            external
            disabled={!canPreview}
            title={canPreview ? undefined : "No unpublished changes to preview"}
          >
            Preview draft <Arrow dir="out" />
          </Btn>
        ) : null}
      </EditorChrome>
      <div className="editor">
        <div className="card doc">
          <form.Field name="title">
            {(f) => (
              <Autosize
                className="doc-title"
                label="Title"
                placeholder="Post title"
                value={f.state.value}
                onChange={f.handleChange}
              />
            )}
          </form.Field>
          <form.Field name="excerpt">
            {(f) => (
              <Autosize
                className="doc-dek"
                label="Summary"
                placeholder="One or two sentences. Used on cards and in search results."
                value={f.state.value}
                onChange={f.handleChange}
              />
            )}
          </form.Field>
          <form.Field name="content">
            {(f) => (
              <RichEditor
                value={f.state.value as RichDoc | null}
                onChange={(d) => f.handleChange(d)}
              />
            )}
          </form.Field>
        </div>
        <div className="panel-stack">
          <Card title="Publishing">
            <div className="fields">
              <form.Field name="stage">
                {(f) => (
                  <Seg
                    label="Stage"
                    value={f.state.value}
                    onChange={(x) => f.handleChange(x)}
                    options={[
                      { value: "draft", label: "Draft" },
                      { value: "writing", label: "Writing" },
                      { value: "published", label: "Published" },
                    ]}
                  />
                )}
              </form.Field>
              <p className="hint">
                Draft and Writing posts appear on the site as “Coming soon” once published.
              </p>
              {scheduled ? (
                <div className="sched-note">
                  <span className="status sched">
                    <i />
                    Scheduled
                  </span>
                  <span>Goes live {when}.</span>
                  {canPublish ? <Btn onClick={openSchedule}>Change</Btn> : null}
                  {canPublish && published ? <Btn onClick={unschedule}>Unschedule</Btn> : null}
                </div>
              ) : published && v.publishedAt ? (
                <form.AppField name="publishedAt">
                  {(f) => (
                    <f.DateInput
                      label="Publish date"
                      time
                      hint={`Shown on the post${tz ? ` (your timezone, ${tz})` : ""}. To publish later, use Schedule.`}
                    />
                  )}
                </form.AppField>
              ) : canPublish ? (
                <p className="hint">
                  <b>Publish post</b> makes it live now. <b>Schedule</b> picks a later date and
                  time.
                </p>
              ) : (
                <p className="hint">
                  Your changes save as a draft. An editor will publish this post.
                </p>
              )}
              <div className="row2">
                <form.AppField name="readOverride">
                  {(f) => (
                    <f.NumberInput
                      label={`Read time · auto ${readingMinutes(v.content as RichDoc)} min`}
                      hint="Leave empty for auto."
                      min={1}
                    />
                  )}
                </form.AppField>
                <form.AppField name="slug">
                  {(f) => <f.Text label="Slug" mono hint={`${minutes} min read`} />}
                </form.AppField>
              </div>
              <div className="row2">
                <form.AppField name="category">
                  {(f) => (
                    <f.SelectInput
                      label="Category"
                      options={
                        v.category && !categories.includes(v.category)
                          ? [...categories, v.category]
                          : categories
                      }
                      hint="Add or rename categories in Blog settings."
                    />
                  )}
                </form.AppField>
                {canPublish ? (
                  <form.AppField name="authorId">
                    {(f) => (
                      <f.SelectInput
                        label="Author"
                        options={authorOptions}
                        hint="Byline and bio come from the author’s profile (Settings → Users)."
                      />
                    )}
                  </form.AppField>
                ) : (
                  <div className="field">
                    <label htmlFor={`author-${id}`}>Author</label>
                    <input
                      id={`author-${id}`}
                      className="inp"
                      readOnly
                      disabled
                      value={
                        authorOptions.find((o) => o.value === (v.authorId ?? ""))?.label ?? "You"
                      }
                    />
                    <p className="hint">Your posts are always credited to you.</p>
                  </div>
                )}
              </div>
              <form.AppField name="tags">
                {(f) => <f.Tags label="Tags" placeholder="Add tag, press Enter" />}
              </form.AppField>
            </div>
          </Card>
          <Card title="Cover" aside="Contour card">
            <div className="fields">
              <form.Field name="coverLines" mode="array">
                {(arr) => (
                  <Repeater
                    label="Terminal lines"
                    count={arr.state.value.length}
                    max={4}
                    onAdd={() => arr.pushValue({ kind: "ok", text: "" })}
                  >
                    {arr.state.value.map((l, i) => (
                      <RepItem
                        key={`cl-${i}`}
                        index={i}
                        total={arr.state.value.length}
                        title={`${l.kind === "cmd" ? "$" : l.kind === "ok" ? "✓" : ""} ${l.text}`}
                        onMove={(to) => arr.moveValue(i, to)}
                        onRemove={() => arr.removeValue(i)}
                      >
                        <div className="row2">
                          <form.AppField name={`coverLines[${i}].kind` as const}>
                            {(f) => (
                              <f.SelectInput
                                label="Prefix"
                                options={[
                                  { value: "cmd", label: "$ command" },
                                  { value: "ok", label: "✓ success" },
                                  { value: "plain", label: "plain" },
                                ]}
                              />
                            )}
                          </form.AppField>
                          <form.AppField name={`coverLines[${i}].text` as const}>
                            {(f) => <f.Text label="Text" mono />}
                          </form.AppField>
                        </div>
                      </RepItem>
                    ))}
                  </Repeater>
                )}
              </form.Field>
              <form.AppField name="coverImage">
                {() => (
                  <MediaField
                    label="Cover image (optional)"
                    accept="image"
                    hint="Best at 2100 × 800 px (21:8), JPG or WebP under 400 KB. Phones crop it to 4:3 and cards to about 2:1, so keep text and faces in the middle 1050 × 800. Without an image, the contour art is used."
                  />
                )}
              </form.AppField>
            </div>
          </Card>
          <Card title="SEO" aside="Search preview">
            <div className="fields">
              <div className="serp">
                <small>
                  {host} › blog › {v.slug}
                </small>
                <b>{metaTitle}</b>
                <p>{metaDesc}</p>
              </div>
              <form.AppField name="meta.title">
                {(f) => (
                  <f.Text
                    label="Meta title"
                    placeholder="Defaults to the post title"
                    maxLength={70}
                  />
                )}
              </form.AppField>
              <form.AppField name="meta.description">
                {(f) => (
                  <f.Area
                    label="Meta description"
                    placeholder="Defaults to the summary"
                    maxLength={160}
                  />
                )}
              </form.AppField>
              <form.AppField name="meta.noindex">
                {(f) => <f.Toggle title="Hide from search engines" desc="For unlisted posts" />}
              </form.AppField>
            </div>
          </Card>
        </div>
      </div>
      <Modal open={schedOpen} onClose={() => setSchedOpen(false)} title="Schedule post">
        <div className="sched-dialog">
          <DatePicker
            inline
            mode="datetime"
            label="Publish date and time"
            value={schedAt}
            onChange={(x) => setSchedAt(x)}
            min={new Date().toISOString().slice(0, 10)}
            clearable={false}
          />
          <p className="sched-when">
            {schedFuture ? (
              <>
                Goes live <b>{fmtWhen(schedAt)}</b>
                {tz ? ` (${tz})` : ""}. Until then it’s hidden from the site, sitemap and llms.txt.
              </>
            ) : (
              <span className="hint err">Pick a time in the future.</span>
            )}
          </p>
          <div className="sched-actions">
            <Btn onClick={() => setSchedOpen(false)}>Cancel</Btn>
            <Btn primary disabled={!schedFuture || schedBusy} onClick={confirmSchedule}>
              {schedBusy ? "Scheduling…" : scheduled ? "Update schedule" : "Schedule post"}
            </Btn>
          </div>
        </div>
      </Modal>
    </>
  );
}
