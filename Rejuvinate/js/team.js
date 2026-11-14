const $ = (id) => document.getElementById(id);
const listEl = $("postList");
const viewer = $("viewer");

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
const fmt = (ts) => new Date(ts).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
const kind = (p) => (p.mode === "fix" ? "Fixed" : "Converted");

function showEmpty() {
  listEl.replaceChildren(el("div", "empty", "No posts yet."));
  viewer.replaceChildren();
  const box = el("div", "empty", "Nothing posted yet. Generate some code, then click ");
  box.append(el("strong", "", "Post to Team"), " to share it here. ");
  const a = el("a", "", "Open the converter");
  a.href = "index.html";
  box.append(a, ".");
  viewer.append(box);
}

function select(id) {
  const post = TeamStore.all().find((p) => p.id === id);
  if (!post) return;
  listEl.querySelectorAll(".post-item").forEach((b) => b.classList.toggle("active", b.dataset.id === id));

  const head = el("div", "panel-head");
  const left = el("div");
  left.append(el("h3", "viewer-title", post.title));
  const meta = el("div", "post-meta");
  meta.append(el("span", "tag", post.language), el("span", "", `${kind(post)} · ${fmt(post.createdAt)}`));
  left.append(meta);

  const actions = el("div", "head-actions");
  const copy = el("button", "btn small", "Copy");
  copy.type = "button";
  copy.onclick = async () => {
    try { await navigator.clipboard.writeText(post.code); copy.textContent = "Copied!"; }
    catch { copy.textContent = "Press Ctrl+C"; }
    setTimeout(() => (copy.textContent = "Copy"), 1500);
  };
  const del = el("button", "btn small ghost", "Delete");
  del.type = "button";
  del.onclick = () => {
    if (!confirm("Delete this post?")) return;
    TeamStore.remove(id);
    history.replaceState(null, "", location.pathname);
    render();
  };
  actions.append(copy, del);
  head.append(left, actions);

  const pre = el("pre", "output");
  pre.append(el("code", "", post.code));

  viewer.replaceChildren(head, pre);
  if (post.notes) viewer.append(el("div", "notes", post.notes));
}

function render() {
  const posts = TeamStore.all();
  $("postCount").textContent = `${posts.length} post${posts.length === 1 ? "" : "s"}`;
  if (!posts.length) return showEmpty();

  listEl.replaceChildren(...posts.map((p) => {
    const b = el("button", "post-item");
    b.type = "button";
    b.dataset.id = p.id;
    const meta = el("div", "post-meta");
    meta.append(el("span", "tag", p.language), el("span", "", fmt(p.createdAt)));
    b.append(el("span", "post-title", p.title), meta);
    b.onclick = () => { location.hash = p.id; };
    return b;
  }));

  const wanted = location.hash.slice(1);
  select(posts.some((p) => p.id === wanted) ? wanted : posts[0].id);
}

window.addEventListener("hashchange", () => select(location.hash.slice(1)));
render();
