// Shared "team posts" storage (demo: lives in this browser's localStorage)
const TeamStore = (() => {
  const KEY = "rejuvinate_team_posts";
  const all = () => {
    try { const d = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(d) ? d : []; }
    catch { return []; }
  };
  const save = (list) => localStorage.setItem(KEY, JSON.stringify(list)); // may throw if full
  return {
    all,
    add(post) {
      const full = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), createdAt: Date.now(), ...post };
      save([full, ...all()]);
      return full;
    },
    remove(id) { save(all().filter((p) => p.id !== id)); }
  };
})();
