"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  user_id: string;
  slug: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
};

type LinkItem = {
  id: string;
  profile_id: string;
  title: string;
  url: string;
  position: number;
  created_at: string;
};

export default function LinksPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [items, setItems] = useState<LinkItem[]>([]);

  // profile form state
  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);

  // new item form state
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);

  // inline edit state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [savingItem, setSavingItem] = useState(false);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        setLoading(false);
        return;
      }
      if (cancelled) return;
      setUser(authUser);

      // links_profiles carries a public select policy alongside the owner
      // policy, so the user_id filter is what keeps this to our own row.
      const { data: profileRows, error: profileErr } = await supabase
        .from("links_profiles")
        .select("*")
        .eq("user_id", authUser.id)
        .order("created_at", { ascending: true })
        .limit(1);

      if (cancelled) return;

      if (profileErr) {
        setProfileError(profileErr.message);
        setLoading(false);
        return;
      }

      const profileRow = (profileRows?.[0] ?? null) as Profile | null;

      if (profileRow) {
        setProfile(profileRow);
        setSlug(profileRow.slug);
        setDisplayName(profileRow.display_name ?? "");
        setBio(profileRow.bio ?? "");
        setAvatarUrl(profileRow.avatar_url ?? "");

        const { data: itemRows, error: itemsErr } = await supabase
          .from("links_items")
          .select("*")
          .eq("profile_id", profileRow.id)
          .order("position", { ascending: true })
          .order("created_at", { ascending: true });

        if (cancelled) return;
        if (itemsErr) setItemError(itemsErr.message);
        else if (itemRows) setItems(itemRows as LinkItem[]);
      }

      if (!cancelled) setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  function slugify(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    if (!user) {
      setProfileError("You need to be signed in to save your profile.");
      return;
    }

    const cleanSlug = slugify(slug);
    if (!cleanSlug) {
      setProfileError("Please enter a valid slug (letters, numbers, dashes).");
      return;
    }

    // display_name and bio are `not null default ''` — send "" never null.
    const fields = {
      slug: cleanSlug,
      display_name: displayName.trim(),
      bio: bio.trim(),
      avatar_url: avatarUrl.trim() || null,
    };

    setSavingProfile(true);
    try {
      if (profile) {
        const { data, error } = await supabase
          .from("links_profiles")
          .update(fields)
          .eq("id", profile.id)
          .select()
          .single();

        if (error) {
          setProfileError(
            error.code === "23505"
              ? "That URL is already taken. Try another one."
              : error.message,
          );
          return;
        }
        setProfile(data as Profile);
        setEditingProfile(false);
      } else {
        const { data, error } = await supabase
          .from("links_profiles")
          .insert({ user_id: user.id, ...fields })
          .select()
          .single();

        if (error) {
          setProfileError(
            error.code === "23505"
              ? "That URL is already taken. Try another one."
              : error.message,
          );
          return;
        }
        setProfile(data as Profile);
      }
      setSlug(cleanSlug);
    } finally {
      setSavingProfile(false);
    }
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setItemError(null);

    const title = newTitle.trim();
    let url = newUrl.trim();
    if (!title || !url) {
      setItemError("Title and URL are required.");
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }

    setAddingItem(true);
    try {
      const nextPosition =
        items.length > 0 ? Math.max(...items.map((i) => i.position)) + 1 : 0;

      const { data, error } = await supabase
        .from("links_items")
        .insert({
          profile_id: profile.id,
          title,
          url,
          position: nextPosition,
        })
        .select()
        .single();

      if (error) {
        setItemError(error.message);
        return;
      }

      setItems((prev) => [...prev, data as LinkItem]);
      setNewTitle("");
      setNewUrl("");
    } finally {
      setAddingItem(false);
    }
  }

  async function deleteItem(id: string) {
    const prev = items;
    setItemError(null);
    setItems((cur) => cur.filter((i) => i.id !== id));
    const { error } = await supabase.from("links_items").delete().eq("id", id);
    if (error) {
      setItems(prev);
      setItemError(error.message);
    }
  }

  function startEditItem(item: LinkItem) {
    setEditingItemId(item.id);
    setEditTitle(item.title);
    setEditUrl(item.url);
    setItemError(null);
  }

  async function saveItem(e: React.FormEvent) {
    e.preventDefault();
    if (!editingItemId) return;
    setItemError(null);

    const title = editTitle.trim();
    let url = editUrl.trim();
    if (!title || !url) {
      setItemError("Title and URL are required.");
      return;
    }
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

    setSavingItem(true);
    const { error } = await supabase
      .from("links_items")
      .update({ title, url })
      .eq("id", editingItemId);
    setSavingItem(false);

    if (error) {
      setItemError(error.message);
      return;
    }
    setItems((cur) =>
      cur.map((i) => (i.id === editingItemId ? { ...i, title, url } : i)),
    );
    setEditingItemId(null);
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;

    const prev = items;
    const swapped = [...items];
    [swapped[index], swapped[target]] = [swapped[target], swapped[index]];

    // Re-derive positions from array order. Swapping the stored values breaks
    // silently whenever two rows share a position (e.g. both 0), so write the
    // index instead and persist every row whose position actually moved.
    const next = swapped.map((item, i) => ({ ...item, position: i }));
    setItems(next);
    setItemError(null);

    const changed = next.filter(
      (item) => prev.find((p) => p.id === item.id)?.position !== item.position,
    );

    const results = await Promise.all(
      changed.map((item) =>
        supabase
          .from("links_items")
          .update({ position: item.position })
          .eq("id", item.id),
      ),
    );

    const failed = results.find((r) => r.error);
    if (failed?.error) {
      setItems(prev);
      setItemError(failed.error.message);
    }
  }

  function copyPublicUrl() {
    if (!profile) return;
    const publicUrl = `${window.location.origin}/u/${profile.slug}`;
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (loading) {
    return (
      <div className="p-6 md:p-8">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in p-6 md:p-8">
      <h1 className="text-lg font-semibold">Link in Bio</h1>
      <p className="mt-1 text-sm text-muted">
        One public page for all your links.
      </p>

      {!profile || editingProfile ? (
        <div className="card mt-6 max-w-lg p-4">
          <h2 className="text-sm font-medium">
            {profile ? "Edit profile" : "Create your profile"}
          </h2>
          <form onSubmit={saveProfile} className="mt-3 flex flex-col gap-3">
            <div>
              <label className="text-xs text-muted">Slug (your public URL)</label>
              <div className="mt-1 flex items-center gap-1">
                <span className="text-xs text-muted">/u/</span>
                <input
                  className="input flex-1"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="yourname"
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted">Display name</label>
              <input
                className="input mt-1 w-full"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your Name"
              />
            </div>
            <div>
              <label className="text-xs text-muted">Bio</label>
              <textarea
                className="input mt-1 w-full resize-none"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A short line about you"
              />
            </div>
            <div>
              <label className="text-xs text-muted">Avatar image URL</label>
              <input
                className="input mt-1 w-full"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://…/photo.jpg"
              />
              <p className="mt-1 text-xs text-muted">
                Paste a link to an image you already host — there is no upload here.
              </p>
            </div>
            {profileError && <p className="text-sm text-danger">{profileError}</p>}
            <div className="flex items-center gap-2">
              <button type="submit" disabled={savingProfile} className="btn btn-primary">
                {savingProfile ? "Saving…" : profile ? "Save changes" : "Create profile"}
              </button>
              {profile && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setEditingProfile(false);
                    setSlug(profile.slug);
                    setDisplayName(profile.display_name ?? "");
                    setBio(profile.bio ?? "");
                    setAvatarUrl(profile.avatar_url ?? "");
                    setProfileError(null);
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      ) : (
        <div className="card animate-fade-in mt-6 max-w-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {profile.display_name || profile.slug}
              </p>
              {profile.bio && (
                <p className="mt-0.5 truncate text-xs text-muted">{profile.bio}</p>
              )}
            </div>
            <button
              className="btn btn-secondary shrink-0 text-xs"
              onClick={() => setEditingProfile(true)}
            >
              Edit
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5">
            <span className="flex-1 truncate text-xs text-muted">
              {typeof window !== "undefined" ? window.location.origin : ""}/u/{profile.slug}
            </span>
            <button className="btn btn-secondary text-xs" onClick={copyPublicUrl}>
              {copied ? "Copied!" : "Copy"}
            </button>
            <a
              href={`/u/${profile.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary text-xs"
            >
              View
            </a>
          </div>
        </div>
      )}

      {profile && (
        <div className="mt-8 max-w-lg">
          <h2 className="text-sm font-medium">Links</h2>

          <form onSubmit={addItem} className="card mt-3 flex flex-col gap-2 p-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className="input flex-1"
                placeholder="Title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <input
                className="input flex-1"
                placeholder="https://example.com"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
            </div>
            {itemError && <p className="text-sm text-danger">{itemError}</p>}
            <button type="submit" disabled={addingItem} className="btn btn-primary self-start">
              {addingItem ? "Adding…" : "Add link"}
            </button>
          </form>

          <div className="mt-4 flex flex-col gap-2">
            {items.length === 0 ? (
              <p className="text-sm text-muted">
                No links yet. Add your first one above — it shows up on your
                public page straight away.
              </p>
            ) : (
              items.map((item, index) =>
                editingItemId === item.id ? (
                  <form
                    key={item.id}
                    onSubmit={saveItem}
                    className="card flex flex-col gap-2 p-3"
                  >
                    <input
                      className="input"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Title"
                    />
                    <input
                      className="input"
                      value={editUrl}
                      onChange={(e) => setEditUrl(e.target.value)}
                      placeholder="https://example.com"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={savingItem}
                        className="btn btn-primary text-xs"
                      >
                        {savingItem ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary text-xs"
                        onClick={() => setEditingItemId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div
                    key={item.id}
                    className="card animate-fade-in flex items-center gap-3 p-3"
                  >
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        className="rounded text-muted transition-colors hover:text-foreground disabled:opacity-30"
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                        aria-label="Move up"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M6 15l6-6 6 6" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="rounded text-muted transition-colors hover:text-foreground disabled:opacity-30"
                        disabled={index === items.length - 1}
                        onClick={() => move(index, 1)}
                        aria-label="Move down"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="truncate text-xs text-muted">{item.url}</p>
                    </div>
                    <button
                      className="btn btn-secondary text-xs"
                      onClick={() => startEditItem(item)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-secondary text-xs text-danger"
                      onClick={() => deleteItem(item.id)}
                    >
                      Delete
                    </button>
                  </div>
                ),
              )
            )}
          </div>
          <p className="mt-3 text-xs text-muted">
            Use the arrows to reorder. The order here is the order on your public
            page.
          </p>
        </div>
      )}
    </div>
  );
}
