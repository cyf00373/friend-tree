/* 朋友關係樹 v1 — 資料只存在這支手機（localStorage），可匯出／匯入備份 */
(() => {
  "use strict";
  const APP_VERSION = "1.0.0";
  const LS_KEY = "friend-tree-v1";
  const LS_BACKUP = "friend-tree-last-backup";

  const ZODIAC = ["牡羊座","金牛座","雙子座","巨蟹座","獅子座","處女座","天秤座","天蠍座","射手座","摩羯座","水瓶座","雙魚座"];
  const FIELDS = [["birthday","生日"],["zodiac","星座"],["interests","興趣"],["hometown","哪裡人"],["residence","住哪邊"],["referrerId","誰帶來的"],["upline","上手白金"],["distributorId","直銷商編號"]];
  const KEYS = ["name","birthday","zodiac","interests","hometown","residence","referrerId","upline","distributorId"];

  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  /* ---------- storage ---------- */
  let friends = [];
  try { const v = JSON.parse(localStorage.getItem(LS_KEY) || "[]"); if (Array.isArray(v)) friends = v; } catch (e) {}
  function persist() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(friends)); return true; }
    catch (e) { toast("儲存失敗：手機空間不足或瀏覽器封鎖了儲存"); return false; }
  }
  // 請瀏覽器不要自動清掉資料（Android Chrome、iOS 主畫面 App 支援）
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  let editingId = null, zodiacTouched = false, zoom = 1, openDetailId = null;
  const byId = id => friends.find(f => f.id === id);
  const newId = () => "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function zodiacOf(s) {
    if (!s) return "";
    const [, m, d] = s.split("-").map(Number); if (!m || !d) return "";
    const md = m * 100 + d;
    if (md >= 321 && md <= 419) return "牡羊座"; if (md >= 420 && md <= 520) return "金牛座";
    if (md >= 521 && md <= 620) return "雙子座"; if (md >= 621 && md <= 722) return "巨蟹座";
    if (md >= 723 && md <= 822) return "獅子座"; if (md >= 823 && md <= 922) return "處女座";
    if (md >= 923 && md <= 1022) return "天秤座"; if (md >= 1023 && md <= 1121) return "天蠍座";
    if (md >= 1122 && md <= 1221) return "射手座"; if (md >= 1222 || md <= 119) return "摩羯座";
    if (md >= 120 && md <= 218) return "水瓶座"; return "雙魚座";
  }
  function ageOf(s) {
    if (!s) return null;
    const b = new Date(s + "T00:00:00"); if (isNaN(b)) return null;
    const n = new Date(); let a = n.getFullYear() - b.getFullYear();
    if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
    return a >= 0 ? a : null;
  }
  const fmtDate = s => { const [y, m, d] = s.split("-"); return `${y} 年 ${+m} 月 ${+d} 日`; };
  const childrenOf = id => friends.filter(f => (f.referrerId || "") === (id || "") && f.id !== id).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  function descendants(id) {
    const out = new Set(), stack = [id];
    while (stack.length) { const cur = stack.pop(); for (const c of childrenOf(cur)) if (!out.has(c.id)) { out.add(c.id); stack.push(c.id); } }
    return out;
  }
  const isRoot = f => !f.referrerId || !byId(f.referrerId) || f.referrerId === f.id;
  function treeOrder() {
    const out = [], seen = new Set();
    const walk = (f, depth) => { if (seen.has(f.id)) return; seen.add(f.id); out.push({ f, depth }); childrenOf(f.id).forEach(c => walk(c, depth + 1)); };
    friends.filter(isRoot).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).forEach(r => walk(r, 0));
    friends.forEach(f => { if (!seen.has(f.id)) walk(f, 0); });
    return out;
  }
  const clean = f => { const o = { id: f.id }; for (const k of KEYS) if (f[k]) o[k] = String(f[k]); o.createdAt = f.createdAt || Date.now(); o.updatedAt = f.updatedAt || Date.now(); return o; };

  /* ---------- tabs ---------- */
  function showTab(name) {
    document.querySelectorAll("nav.tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === name ? "true" : "false"));
    ["add", "list", "tree"].forEach(t => $("#tab-" + t).hidden = t !== name);
    window.scrollTo({ top: 0 });
  }
  document.querySelectorAll("nav.tabs button").forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));

  /* ---------- form ---------- */
  const form = $("#form");
  $("#f-zodiac").innerHTML = `<option value="">（依生日自動帶入）</option>` + ZODIAC.map(z => `<option>${z}</option>`).join("");
  $("#f-birthday").addEventListener("change", e => { if (!zodiacTouched) $("#f-zodiac").value = zodiacOf(e.target.value); });
  $("#f-zodiac").addEventListener("change", () => { zodiacTouched = true; });

  function fillReferrerOptions() {
    const blocked = editingId ? descendants(editingId) : new Set();
    if (editingId) blocked.add(editingId);
    const sel = $("#f-referrer"), cur = sel.value;
    sel.innerHTML = `<option value="">我直接認識的</option>` + treeOrder().filter(({ f }) => !blocked.has(f.id))
      .map(({ f, depth }) => `<option value="${esc(f.id)}">${"　".repeat(depth)}${esc(f.name)}</option>`).join("");
    if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
    $("#friendNames").innerHTML = friends.map(f => `<option value="${esc(f.name)}"></option>`).join("");
  }
  function startEdit(id) {
    const f = byId(id); if (!f) return;
    editingId = id; closeSheet(); fillReferrerOptions();
    for (const k of KEYS) if (form.elements[k]) form.elements[k].value = f[k] || "";
    form.elements.referrerId.value = byId(f.referrerId) ? f.referrerId : "";
    zodiacTouched = !!f.zodiac && f.zodiac !== zodiacOf(f.birthday);
    $("#editingBar").hidden = false; $("#editingName").textContent = f.name;
    $("#formTitle").textContent = "編輯朋友資料"; $("#saveBtn").textContent = "儲存修改";
    showTab("add");
  }
  function endEdit() {
    editingId = null; zodiacTouched = false; form.reset();
    $("#editingBar").hidden = true; $("#formTitle").textContent = "新增朋友"; $("#saveBtn").textContent = "新增朋友";
    fillReferrerOptions();
  }
  $("#cancelEdit").addEventListener("click", endEdit);
  form.addEventListener("reset", () => setTimeout(() => { zodiacTouched = false; if (!editingId) fillReferrerOptions(); }));
  form.addEventListener("submit", e => {
    e.preventDefault();
    const name = form.elements.name.value.trim();
    if (!name) { form.elements.name.focus(); toast("請先輸入名字"); return; }
    const data = {};
    for (const k of KEYS) { const v = (form.elements[k].value || "").trim(); if (v) data[k] = v; }
    if (!data.zodiac && data.birthday) data.zodiac = zodiacOf(data.birthday);
    const prev = editingId ? byId(editingId) : null;
    const f = clean({ id: editingId || newId(), ...data, createdAt: prev?.createdAt, updatedAt: Date.now() });
    if (prev) friends[friends.indexOf(prev)] = f; else friends.push(f);
    if (!persist()) return;
    toast(prev ? `已更新 ${name}` : `已新增 ${name}`);
    endEdit(); renderAll();
    if (prev) { showTab("list"); setTimeout(() => flashCard(f.id), 80); } else form.elements.name.focus();
  });

  /* ---------- cards ---------- */
  function cardHTML(f, depth) {
    const age = ageOf(f.birthday), ref = byId(f.referrerId), kids = childrenOf(f.id), lines = [];
    if (f.residence) lines.push(`<span>住 <b>${esc(f.residence)}</b></span>`);
    if (ref) lines.push(`<span>介紹人：<b>${esc(ref.name)}</b></span>`);
    if (kids.length) lines.push(`<span>帶來的朋友：<b>${kids.map(k => esc(k.name)).join("、")}</b></span>`);
    return `<button class="card" data-id="${esc(f.id)}">
      ${depth > 0 ? `<span class="depth">第 ${depth + 1} 層</span>` : ""}
      <span class="name">${esc(f.name)}${age !== null ? `<span class="chip">${age} 歲</span>` : ""}</span>
      ${lines.length ? `<span class="meta">${lines.join("")}</span>` : ""}
      <span class="chev" aria-hidden="true">›</span></button>`;
  }
  function renderCards() {
    const q = $("#search").value.trim().toLowerCase();
    $("#listTitle").textContent = `朋友清單 · ${friends.length} 位`;
    renderBackupBanner();
    if (!friends.length) {
      $("#cards").innerHTML = `<div class="empty"><strong>還沒有朋友資料</strong>到「新增朋友」輸入第一位朋友，卡片會依照介紹關係由上而下排列在這裡。<button class="btn primary" style="flex:none" data-go="add">新增第一位朋友</button></div>`;
      return;
    }
    const rows = treeOrder().filter(({ f }) => !q || [f.name, f.residence, f.hometown, f.interests, f.zodiac, f.upline, f.distributorId].some(v => (v || "").toLowerCase().includes(q)));
    $("#cards").innerHTML = rows.length ? rows.map(({ f, depth }) => cardHTML(f, depth)).join("") : `<div class="empty">找不到符合「${esc(q)}」的朋友</div>`;
  }
  $("#search").addEventListener("input", renderCards);
  $("#cards").addEventListener("click", e => {
    const go = e.target.closest("[data-go]"); if (go) { showTab(go.dataset.go); return; }
    const c = e.target.closest(".card"); if (c) openDetail(c.dataset.id);
  });
  function flashCard(id) {
    const el = document.querySelector(`.card[data-id="${CSS.escape(id)}"]`); if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
  }

  /* ---------- backup reminder ---------- */
  function lastBackup() { try { return Number(localStorage.getItem(LS_BACKUP)) || 0; } catch (e) { return 0; } }
  function renderBackupBanner() {
    const last = lastBackup(), days = last ? Math.floor((Date.now() - last) / 864e5) : null;
    const show = friends.length >= 3 && (days === null || days >= 30);
    $("#backupBanner").hidden = !show;
    if (show) $("#backupMsg").textContent = days === null ? "資料只存在這支手機，建議先備份一次" : `已經 ${days} 天沒有備份了`;
  }
  $("#backupNow").addEventListener("click", exportBackup);

  /* ---------- sheets ---------- */
  function sheet(html) { $("#sheetHost").innerHTML = `<div class="scrim" id="scrim"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div></div>`; }
  function closeSheet() { $("#sheetHost").innerHTML = ""; openDetailId = null; }

  function openDetail(id, confirming) {
    const f = byId(id); if (!f) return;
    openDetailId = id;
    const age = ageOf(f.birthday), rows = [];
    for (const [k, label] of FIELDS) {
      const v = f[k]; if (!v) continue;
      if (k === "birthday") rows.push([label, esc(fmtDate(v)) + (age !== null ? `（${age} 歲）` : "")]);
      else if (k === "referrerId") { const r = byId(v); if (r) rows.push([label, `<button class="link" data-open="${esc(r.id)}">${esc(r.name)}</button>`]); }
      else rows.push([label, esc(v).replace(/\n/g, "<br>")]);
    }
    const kids = childrenOf(f.id);
    if (kids.length) rows.push(["帶來的朋友", kids.map(k => `<button class="link" data-open="${esc(k.id)}">${esc(k.name)}</button>`).join("、")]);
    const parent = byId(f.referrerId);
    sheet(`<h3>${esc(f.name)}</h3>
      ${rows.length ? `<dl class="dl">${rows.map(([l, v]) => `<dt>${l}</dt><dd>${v}</dd>`).join("")}</dl>` : `<p class="hint" style="margin:14px 0">目前只有名字，按「編輯」補上更多資料。</p>`}
      ${confirming ? `<div class="confirm"><span>確定要刪除 <b>${esc(f.name)}</b>？${kids.length ? `他帶來的 ${kids.length} 位朋友會改接到${parent ? `「${esc(parent.name)}」` : "你"}底下。` : ""}這個動作無法復原。</span>
        <div class="actions"><button class="btn danger solid" data-act="del-yes">刪除</button><button class="btn" data-act="del-no">先不要</button></div></div>`
      : `<div class="actions"><button class="btn primary" data-act="edit">編輯</button><button class="btn" data-act="tree">在關係圖中查看</button><button class="btn danger" data-act="del">刪除</button></div>`}`);
  }

  function openMenu(confirmImport) {
    openDetailId = null;
    const last = lastBackup();
    sheet(`<h3>備份與還原</h3>
      <p class="hint" style="margin:0">資料只存在這支手機的瀏覽器裡，共 ${friends.length} 位朋友。<br>上次備份：${last ? new Date(last).toLocaleDateString("zh-TW") : "還沒備份過"}</p>
      ${confirmImport ? `<div class="confirm" style="margin-top:14px"><span>備份檔裡有 <b>${confirmImport.length}</b> 位朋友。要怎麼匯入？</span>
        <div class="actions"><button class="btn primary" data-act="imp-merge">合併（保留現有）</button><button class="btn danger" data-act="imp-replace">全部取代</button><button class="btn" data-act="imp-cancel">取消</button></div></div>`
      : `<div class="menu">
        <button class="btn block" data-act="export">匯出備份檔（.json）</button>
        <button class="btn block" data-act="import">從備份檔匯入</button>
      </div>
      <p class="hint" style="margin-top:14px">換手機前先匯出備份，把檔案存到雲端硬碟或傳給自己，新手機打開 App 後再匯入。<br>版本 ${APP_VERSION}</p>`}`);
  }
  $("#meBtn").addEventListener("click", () => openMenu());

  let pendingImport = null;
  $("#sheetHost").addEventListener("click", e => {
    if (e.target.id === "scrim") { closeSheet(); return; }
    const o = e.target.closest("[data-open]"); if (o) { openDetail(o.dataset.open); return; }
    const a = e.target.closest("[data-act]"); if (!a) return;
    const act = a.dataset.act, id = openDetailId, f = byId(id);
    if (act === "edit") startEdit(id);
    else if (act === "tree") { closeSheet(); showTab("tree"); focusNode(id); }
    else if (act === "del") openDetail(id, true);
    else if (act === "del-no") openDetail(id);
    else if (act === "del-yes") {
      const parent = byId(f.referrerId) ? f.referrerId : "";
      for (const k of childrenOf(id)) { k.referrerId = parent; k.updatedAt = Date.now(); if (!parent) delete k.referrerId; }
      friends = friends.filter(x => x.id !== id);
      persist(); closeSheet(); toast(`已刪除 ${f.name}`);
      if (editingId === id) endEdit();
      renderAll();
    }
    else if (act === "export") exportBackup();
    else if (act === "import") $("#importFile").click();
    else if (act === "imp-cancel") { pendingImport = null; openMenu(); }
    else if (act === "imp-merge" || act === "imp-replace") {
      const list = pendingImport; pendingImport = null; if (!list) return;
      if (act === "imp-replace") friends = list.map(clean);
      else { const map = new Map(friends.map(x => [x.id, x])); list.forEach(x => map.set(x.id, clean(x))); friends = [...map.values()]; }
      persist(); closeSheet(); renderAll(); toast(`已匯入 ${list.length} 位朋友`);
    }
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeSheet(); });

  /* ---------- backup ---------- */
  async function exportBackup() {
    if (!friends.length) { toast("還沒有資料可以備份"); return; }
    const data = { app: "friend-tree", version: 1, exportedAt: new Date().toISOString(), friends: friends.map(clean) };
    const d = new Date(), stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const name = `朋友關係樹備份-${stamp}.json`;
    const file = new File([JSON.stringify(data, null, 2)], name, { type: "application/json" });
    const done = () => { try { localStorage.setItem(LS_BACKUP, String(Date.now())); } catch (e) {} renderBackupBanner(); };
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); done(); closeSheet(); toast("備份完成"); return; }
    } catch (e) { if (e.name === "AbortError") return; }
    const url = URL.createObjectURL(file);
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    done(); closeSheet(); toast("備份檔已下載");
  }
  $("#importFile").addEventListener("change", async e => {
    const file = e.target.files[0]; e.target.value = "";
    if (!file) return;
    let list;
    try {
      const data = JSON.parse(await file.text());
      list = Array.isArray(data) ? data : data.friends;
      if (!Array.isArray(list)) throw 0;
      list = list.filter(f => f && typeof f.id === "string" && f.id && typeof f.name === "string" && f.name.trim());
    } catch (err) { toast("這不是朋友關係樹的備份檔"); return; }
    if (!list.length) { toast("備份檔裡沒有朋友資料"); return; }
    pendingImport = list;
    if (!friends.length) { friends = list.map(clean); pendingImport = null; persist(); closeSheet(); renderAll(); toast(`已匯入 ${list.length} 位朋友`); }
    else openMenu(list);
  });

  /* ---------- tree ---------- */
  function nodeHTML(f, seen) {
    if (seen.has(f.id)) return ""; seen.add(f.id);
    const age = ageOf(f.birthday);
    const sub = [age !== null ? age + " 歲" : "", f.residence || ""].filter(Boolean).join(" · ");
    const kids = childrenOf(f.id).map(k => nodeHTML(k, seen)).join("");
    return `<li><button class="node" data-node="${esc(f.id)}"><span class="n">${esc(f.name)}</span>${sub ? `<span class="s">${esc(sub)}</span>` : ""}</button>${kids ? `<ul>${kids}</ul>` : ""}</li>`;
  }
  function renderTree() {
    const seen = new Set();
    const roots = friends.filter(isRoot).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).map(r => nodeHTML(r, seen)).join("");
    $("#tree").innerHTML = `<ul><li><div class="node me"><span class="n">我</span><span class="s">${friends.length ? friends.length + " 位朋友" : "從這裡開始"}</span></div>${roots ? `<ul>${roots}</ul>` : ""}</li></ul>`;
    $("#tree").style.zoom = zoom;
  }
  $("#tree").addEventListener("click", e => {
    const n = e.target.closest("[data-node]"); if (!n) return;
    const id = n.dataset.node;
    $("#search").value = ""; renderCards(); showTab("list");
    setTimeout(() => { flashCard(id); openDetail(id); }, 80);
  });
  function focusNode(id) {
    setTimeout(() => {
      const el = document.querySelector(`[data-node="${CSS.escape(id)}"]`); if (!el) return;
      el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
      el.classList.add("hl"); setTimeout(() => el.classList.remove("hl"), 1800);
    }, 80);
  }
  const setZoom = z => { zoom = Math.min(1.6, Math.max(0.5, Math.round(z * 10) / 10)); $("#tree").style.zoom = zoom; $("#zoomReset").textContent = Math.round(zoom * 100) + "%"; };
  $("#zoomIn").addEventListener("click", () => setZoom(zoom + 0.1));
  $("#zoomOut").addEventListener("click", () => setZoom(zoom - 0.1));
  $("#zoomReset").addEventListener("click", () => setZoom(1));

  /* ---------- misc ---------- */
  let toastTimer;
  function toast(msg) {
    $("#toastHost").innerHTML = `<div class="toast" role="status">${esc(msg)}</div>`;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => $("#toastHost").innerHTML = "", 2600);
  }
  function renderAll() {
    fillReferrerOptions(); renderCards(); renderTree();
    if (openDetailId) { if (!byId(openDetailId)) closeSheet(); else if (!document.querySelector(".confirm")) openDetail(openDetailId); }
  }
  window.addEventListener("storage", e => { if (e.key === LS_KEY) { try { friends = JSON.parse(e.newValue || "[]"); } catch (x) {} renderAll(); } });

  renderAll();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
