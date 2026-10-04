/* 朋友關係樹 v1.1 — 資料只存在這支手機（localStorage）
   可匯出自己的組織，上線匯入後接到他的樹上；重新匯入可覆蓋舊組織 */
(() => {
  "use strict";
  const APP_VERSION = "1.1.0";
  const LS_KEY = "friend-tree-v1";
  const LS_BACKUP = "friend-tree-last-backup";
  const LS_OWNER = "friend-tree-owner";

  const ZODIAC = ["牡羊座","金牛座","雙子座","巨蟹座","獅子座","處女座","天秤座","天蠍座","射手座","摩羯座","水瓶座","雙魚座"];
  const TEXT_KEYS = ["name","birthday","zodiac","interests","hometown","residence","referrerId","upline","distributorId","orgAnchor","orgOwner","orgImportedAt"];

  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  };

  /* ---------- storage ---------- */
  let friends = [];
  try { const v = JSON.parse(ls.get(LS_KEY, "[]")); if (Array.isArray(v)) friends = v.map(clean); } catch (e) {}
  function persist() {
    if (ls.set(LS_KEY, JSON.stringify(friends))) return true;
    toast("儲存失敗：手機空間不足或瀏覽器封鎖了儲存"); return false;
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  const ownerName = () => ls.get(LS_OWNER, "").trim();

  // 統一資料格式；舊資料有填直銷商編號的，自動視為直銷商
  function clean(f) {
    const o = { id: String(f.id) };
    for (const k of TEXT_KEYS) if (f[k] !== undefined && f[k] !== null && String(f[k]).trim() !== "") o[k] = String(f[k]).trim();
    o.isDistributor = f.isDistributor === true || f.isDistributor === "true" || (f.isDistributor === undefined && !!o.distributorId);
    if (!o.isDistributor) delete o.distributorId;
    o.createdAt = Number(f.createdAt) || Date.now();
    o.updatedAt = Number(f.updatedAt) || Date.now();
    return o;
  }

  let editingId = null, zodiacTouched = false, zoom = 1, openDetailId = null, pending = null;
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
  const fmtDay = t => new Date(Number(t)).toLocaleDateString("zh-TW");
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

  /* ---------- tabs ---------- */
  function showTab(name) {
    document.querySelectorAll("nav.tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === name ? "true" : "false"));
    ["add", "list", "tree"].forEach(t => $("#tab-" + t).hidden = t !== name);
    window.scrollTo({ top: 0 });
  }
  document.querySelectorAll("nav.tabs button").forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));

  /* ---------- form ---------- */
  const form = $("#form");
  $("#f-zodiac").innerHTML = `<option value="">自動帶入</option>` + ZODIAC.map(z => `<option>${z}</option>`).join("");
  $("#f-birthday").addEventListener("change", e => { if (!zodiacTouched) $("#f-zodiac").value = zodiacOf(e.target.value); });
  $("#f-zodiac").addEventListener("change", () => { zodiacTouched = true; });

  const isDistOn = () => $("#distToggle").getAttribute("aria-pressed") === "true";
  function setDist(on) {
    $("#distToggle").setAttribute("aria-pressed", on ? "true" : "false");
    $("#distToggle .ttxt").textContent = on ? "是直銷商" : "不是";
    $("#distIdField").hidden = !on;
  }
  $("#distToggle").addEventListener("click", () => { setDist(!isDistOn()); if (isDistOn()) setTimeout(() => $("#f-distId").focus(), 50); });

  function fillReferrerOptions() {
    const blocked = editingId ? descendants(editingId) : new Set();
    if (editingId) blocked.add(editingId);
    const sel = $("#f-referrer"), cur = sel.value;
    sel.innerHTML = `<option value="">我直接認識的</option>` + treeOrder().filter(({ f }) => !blocked.has(f.id))
      .map(({ f, depth }) => `<option value="${esc(f.id)}">${"　".repeat(depth)}${esc(f.name)}</option>`).join("");
    if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
    $("#friendNames").innerHTML = friends.map(f => `<option value="${esc(f.name)}"></option>`).join("");
  }
  const FORM_KEYS = ["name","birthday","zodiac","interests","hometown","residence","referrerId","upline","distributorId"];
  function startEdit(id) {
    const f = byId(id); if (!f) return;
    editingId = id; closeSheet(); fillReferrerOptions();
    for (const k of FORM_KEYS) form.elements[k].value = f[k] || "";
    form.elements.referrerId.value = byId(f.referrerId) ? f.referrerId : "";
    setDist(!!f.isDistributor);
    zodiacTouched = !!f.zodiac && f.zodiac !== zodiacOf(f.birthday);
    $("#editingBar").hidden = false; $("#editingName").textContent = f.name;
    $("#formTitle").textContent = "編輯朋友資料"; $("#saveBtn").textContent = "儲存修改";
    showTab("add");
  }
  function endEdit() {
    editingId = null; zodiacTouched = false; form.reset(); setDist(false);
    $("#editingBar").hidden = true; $("#formTitle").textContent = "新增朋友"; $("#saveBtn").textContent = "新增朋友";
    fillReferrerOptions();
  }
  $("#cancelEdit").addEventListener("click", endEdit);
  form.addEventListener("reset", () => setTimeout(() => { zodiacTouched = false; setDist(false); if (!editingId) fillReferrerOptions(); }));
  form.addEventListener("submit", e => {
    e.preventDefault();
    const name = form.elements.name.value.trim();
    if (!name) { form.elements.name.focus(); toast("請先輸入名字"); return; }
    const prev = editingId ? byId(editingId) : null;
    const data = { ...(prev || {}), id: editingId || newId() };
    for (const k of FORM_KEYS) data[k] = (form.elements[k].value || "").trim();
    if (!data.zodiac && data.birthday) data.zodiac = zodiacOf(data.birthday);
    data.isDistributor = isDistOn();
    data.createdAt = prev?.createdAt || Date.now(); data.updatedAt = Date.now();
    const f = clean(data);
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
    return `<button class="card${f.isDistributor ? " dist" : ""}" data-id="${esc(f.id)}">
      ${depth > 0 ? `<span class="depth">第 ${depth + 1} 層</span>` : ""}
      <span class="name">${esc(f.name)}${age !== null ? `<span class="chip">${age} 歲</span>` : ""}${f.isDistributor ? `<span class="badge">直銷商</span>` : ""}</span>
      ${lines.length ? `<span class="meta">${lines.join("")}</span>` : ""}
      <span class="chev" aria-hidden="true">›</span></button>`;
  }
  function renderCards() {
    const q = $("#search").value.trim().toLowerCase();
    const dn = friends.filter(f => f.isDistributor).length;
    $("#listTitle").textContent = `朋友清單 · ${friends.length} 位${dn ? `（直銷商 ${dn} 位）` : ""}`;
    renderBackupBanner();
    if (!friends.length) {
      $("#cards").innerHTML = `<div class="empty"><strong>還沒有朋友資料</strong>到「新增朋友」輸入第一位朋友，卡片會依照介紹關係由上而下排列在這裡。<button class="btn primary" style="flex:none" data-go="add">新增第一位朋友</button></div>`;
      return;
    }
    const rows = treeOrder().filter(({ f }) => !q || [f.name, f.residence, f.hometown, f.interests, f.zodiac, f.upline, f.distributorId, f.isDistributor ? "直銷商" : ""].some(v => (v || "").toLowerCase().includes(q)));
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
  const lastBackup = () => Number(ls.get(LS_BACKUP, "0")) || 0;
  function renderBackupBanner() {
    const last = lastBackup(), days = last ? Math.floor((Date.now() - last) / 864e5) : null;
    const show = friends.length >= 3 && (days === null || days >= 30);
    $("#backupBanner").hidden = !show;
    if (show) $("#backupMsg").textContent = days === null ? "資料只存在這支手機，建議先備份一次" : `已經 ${days} 天沒有備份了`;
  }
  $("#backupNow").addEventListener("click", () => startExport());

  /* ---------- sheets ---------- */
  function sheet(html) { $("#sheetHost").innerHTML = `<div class="scrim" id="scrim"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div></div>`; }
  function closeSheet() { $("#sheetHost").innerHTML = ""; openDetailId = null; pending = null; }

  function openDetail(id, confirming) {
    const f = byId(id); if (!f) return;
    pending = null; openDetailId = id;
    const age = ageOf(f.birthday), rows = [];
    if (f.birthday) rows.push(["生日", esc(fmtDate(f.birthday)) + (age !== null ? `（${age} 歲）` : "")]);
    if (f.zodiac) rows.push(["星座", esc(f.zodiac)]);
    if (f.interests) rows.push(["興趣", esc(f.interests).replace(/\n/g, "<br>")]);
    if (f.hometown) rows.push(["哪裡人", esc(f.hometown)]);
    if (f.residence) rows.push(["住哪邊", esc(f.residence)]);
    const ref = byId(f.referrerId);
    if (ref) rows.push(["誰帶來的", `<button class="link" data-open="${esc(ref.id)}">${esc(ref.name)}</button>`]);
    if (f.upline) rows.push(["上手白金", esc(f.upline)]);
    if (f.isDistributor) rows.push(["直銷商", `<span class="badge">是</span>`]);
    if (f.isDistributor && f.distributorId) rows.push(["直銷商編號", esc(f.distributorId)]);
    const kids = childrenOf(f.id);
    if (kids.length) rows.push(["帶來的朋友", kids.map(k => `<button class="link" data-open="${esc(k.id)}">${esc(k.name)}</button>`).join("、")]);
    sheet(`<h3>${esc(f.name)}</h3>
      ${f.orgOwner ? `<p class="from">來自「${esc(f.orgOwner)}」的組織${f.orgImportedAt ? `，${fmtDay(f.orgImportedAt)} 匯入` : ""}</p>` : ""}
      ${rows.length ? `<dl class="dl">${rows.map(([l, v]) => `<dt>${l}</dt><dd>${v}</dd>`).join("")}</dl>` : `<p class="hint" style="margin:14px 0">目前只有名字，按「編輯」補上更多資料。</p>`}
      ${confirming ? `<div class="confirm"><span>確定要刪除 <b>${esc(f.name)}</b>？${kids.length ? `他帶來的 ${kids.length} 位朋友會改接到${ref ? `「${esc(ref.name)}」` : "你"}底下。` : ""}這個動作無法復原。</span>
        <div class="actions"><button class="btn danger solid" data-act="del-yes">刪除</button><button class="btn" data-act="del-no">先不要</button></div></div>`
      : `<div class="actions"><button class="btn primary" data-act="edit">編輯</button><button class="btn" data-act="tree">在關係圖中查看</button><button class="btn danger" data-act="del">刪除</button></div>`}`);
  }

  function openMenu() {
    openDetailId = null; pending = null;
    const last = lastBackup(), me = ownerName();
    sheet(`<h3>匯出／匯入</h3>
      <p class="hint" style="margin:0">我的名字：<b>${esc(me || "還沒設定")}</b>　<button class="link" data-act="set-name">${me ? "修改" : "設定"}</button><br>
      這支手機裡有 ${friends.length} 位朋友。上次匯出：${last ? fmtDay(last) : "還沒匯出過"}</p>
      <div class="menu">
        <button class="btn block" data-act="export">匯出我的組織（給上線／當作備份）</button>
        <button class="btn block" data-act="import">匯入檔案（下線的組織／我的備份）</button>
      </div>
      <p class="hint" style="margin-top:14px">匯出的檔案可以傳給上線，讓他把你的組織接到他的樹上；也可以存到雲端硬碟當備份，換手機時匯入。<br>版本 ${APP_VERSION}</p>`);
  }
  $("#meBtn").addEventListener("click", openMenu);

  function askName(then) {
    pending = { then };
    sheet(`<h3>你的名字</h3>
      <p class="hint" style="margin:0">匯出的組織會標上這個名字，上線匯入時就知道是誰的組織。</p>
      <div class="field" style="margin-top:14px"><input id="ownerInput" value="${esc(ownerName())}" placeholder="例如：陳小安"></div>
      <div class="actions" style="margin-top:14px"><button class="btn primary" data-act="name-ok">確定</button><button class="btn" data-act="name-cancel">取消</button></div>`);
    setTimeout(() => $("#ownerInput")?.focus(), 50);
  }

  /* ---------- export ---------- */
  function startExport() {
    if (!friends.length) { toast("還沒有資料可以匯出"); return; }
    if (!ownerName()) { askName("export"); return; }
    exportOrg();
  }
  async function exportOrg() {
    const me = ownerName();
    const data = { app: "friend-tree", version: 2, owner: { name: me }, exportedAt: new Date().toISOString(), friends: friends.map(clean) };
    const d = new Date(), stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const name = `${me.replace(/[\\/:*?"<>|]/g, "")}的組織-${stamp}.json`;
    const file = new File([JSON.stringify(data, null, 2)], name, { type: "application/json" });
    const done = msg => { ls.set(LS_BACKUP, String(Date.now())); renderBackupBanner(); closeSheet(); toast(msg); };
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); done("已匯出"); return; }
    } catch (e) { if (e.name === "AbortError") return; }
    const url = URL.createObjectURL(file);
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    done("檔案已下載");
  }

  /* ---------- import ---------- */
  $("#importFile").addEventListener("change", async e => {
    const file = e.target.files[0]; e.target.value = "";
    if (!file) return;
    let list, owner = "", exportedAt = "";
    try {
      const data = JSON.parse(await file.text());
      list = Array.isArray(data) ? data : data.friends;
      if (!Array.isArray(list)) throw 0;
      owner = (data.owner && String(data.owner.name || "").trim()) || "";
      exportedAt = data.exportedAt || "";
      list = list.filter(f => f && f.id && typeof f.name === "string" && f.name.trim()).map(clean);
    } catch (err) { toast("這不是朋友關係樹的檔案"); return; }
    if (!list.length) { toast("檔案裡沒有朋友資料"); return; }
    pending = { list, owner, exportedAt };
    importChooseKind();
  });

  function importChooseKind() {
    const { list, owner, exportedAt } = pending;
    const mine = owner && owner === ownerName();
    sheet(`<h3>匯入檔案</h3>
      <p class="hint" style="margin:0">「${esc(owner || "未具名")}」的組織 · ${list.length} 人${exportedAt ? ` · ${fmtDay(Date.parse(exportedAt))} 匯出` : ""}</p>
      <div class="choice">
        <label class="radio"><input type="radio" name="kind" value="org" ${mine ? "" : "checked"}><span>這是下線的組織<small>接到我的關係樹上，放在他本人底下</small></span></label>
        <label class="radio"><input type="radio" name="kind" value="backup" ${mine ? "checked" : ""}><span>這是我自己的備份<small>還原到這支手機（例如換手機時）</small></span></label>
      </div>
      <div class="actions" style="margin-top:14px"><button class="btn primary" data-act="kind-next">下一步</button><button class="btn" data-act="cancel">取消</button></div>`);
  }

  function importOrgForm() {
    const { list, owner } = pending;
    const match = friends.find(f => f.name === owner);
    const opts = treeOrder().map(({ f, depth }) => `<option value="${esc(f.id)}" ${match && match.id === f.id ? "selected" : ""}>${"　".repeat(depth)}${esc(f.name)}</option>`).join("");
    sheet(`<h3>接到誰底下？</h3>
      <p class="hint" style="margin:0">選擇「${esc(owner || "這位下線")}」在你樹上的位置，他的 ${list.length} 位朋友會接在他底下。</p>
      <div class="field" style="margin-top:14px">
        <label for="imp-anchor">${esc(owner || "下線")}是我的…</label>
        <select id="imp-anchor">
          <option value="__new" ${match ? "" : "selected"}>＋ 新增「${esc(owner || "下線")}」（我直接認識的）</option>
          ${opts}
        </select>
      </div>
      <div class="field" id="imp-newname-wrap" style="margin-top:10px" ${match ? "hidden" : ""}>
        <label for="imp-newname">名字</label><input id="imp-newname" value="${esc(owner)}" placeholder="下線的名字">
      </div>
      <div id="imp-mode"></div>
      <div class="actions" style="margin-top:14px"><button class="btn primary" data-act="org-go">匯入</button><button class="btn" data-act="cancel">取消</button></div>`);
    updateImpMode();
  }
  function updateImpMode() {
    const sel = $("#imp-anchor"); if (!sel) return;
    const anchor = sel.value;
    $("#imp-newname-wrap").hidden = anchor !== "__new";
    const old = anchor === "__new" ? [] : friends.filter(f => f.orgAnchor === anchor);
    $("#imp-mode").innerHTML = old.length ? `<div class="choice">
      <p class="hint" style="margin:0">這個人底下已經有 ${old.length} 位之前匯入的朋友（${fmtDay(Math.max(...old.map(f => Number(f.orgImportedAt) || 0)))}）。</p>
      <label class="radio"><input type="radio" name="mode" value="replace" checked><span>覆蓋舊組織<small>刪掉之前匯入的 ${old.length} 位，換成新檔案的內容</small></span></label>
      <label class="radio"><input type="radio" name="mode" value="merge"><span>合併<small>保留舊的，同一個人用新資料更新，新的人加進來</small></span></label>
    </div>` : "";
  }
  $("#sheetHost").addEventListener("change", e => { if (e.target.id === "imp-anchor") updateImpMode(); });

  function doImportOrg() {
    const { list, owner } = pending;
    let anchor = $("#imp-anchor").value;
    const now = Date.now();
    if (anchor === "__new") {
      const nm = ($("#imp-newname").value || "").trim();
      if (!nm) { toast("請輸入下線的名字"); return; }
      const a = clean({ id: newId(), name: nm, isDistributor: true, createdAt: now, updatedAt: now });
      friends.push(a); anchor = a.id;
    }
    const anchorF = byId(anchor);
    const mode = (document.querySelector('input[name="mode"]:checked') || {}).value || "merge";
    const ids = new Set(list.map(f => f.id));
    ids.delete(anchor);
    let removed = 0;
    if (mode === "replace") {
      const oldIds = new Set(friends.filter(f => f.orgAnchor === anchor).map(f => f.id));
      removed = oldIds.size;
      friends = friends.filter(f => !oldIds.has(f.id) || ids.has(f.id));
      // 自己加在舊組織底下的人，改接到下線本人底下
      friends.forEach(f => { if (oldIds.has(f.referrerId) && !ids.has(f.referrerId)) f.referrerId = anchor; });
    }
    const map = new Map(friends.map(f => [f.id, f]));
    for (const src of list) {
      if (src.id === anchor) continue;
      const f = clean({ ...src,
        referrerId: src.referrerId && ids.has(src.referrerId) ? src.referrerId : anchor,
        orgAnchor: anchor, orgOwner: anchorF.name, orgImportedAt: now });
      if (map.has(f.id)) f.createdAt = map.get(f.id).createdAt;
      map.set(f.id, f);
    }
    // 防止匯入的資料把下線本人接到自己的組織底下
    if (anchorF.referrerId && ids.has(anchorF.referrerId)) anchorF.referrerId = "";
    friends = [...map.values()];
    if (!persist()) return;
    closeSheet(); renderAll(); showTab("tree");
    toast(mode === "replace" && removed ? `已覆蓋「${anchorF.name}」的組織：${ids.size} 人` : `已匯入「${anchorF.name}」的組織：${ids.size} 人`);
    setTimeout(() => focusNode(anchor), 100);
  }

  function importBackupForm() {
    const { list } = pending;
    if (!friends.length) { applyBackup("replace"); return; }
    sheet(`<h3>還原備份</h3>
      <p class="hint" style="margin:0">備份檔裡有 ${list.length} 位朋友，這支手機目前有 ${friends.length} 位。</p>
      <div class="choice">
        <label class="radio"><input type="radio" name="bmode" value="merge" checked><span>合併<small>保留手機裡的資料，同一個人用備份的內容更新</small></span></label>
        <label class="radio"><input type="radio" name="bmode" value="replace"><span>全部取代<small>手機裡的資料全部換成備份的內容</small></span></label>
      </div>
      <div class="actions" style="margin-top:14px"><button class="btn primary" data-act="backup-go">還原</button><button class="btn" data-act="cancel">取消</button></div>`);
  }
  function applyBackup(mode) {
    const { list } = pending;
    if (mode === "replace") friends = list.map(clean);
    else { const map = new Map(friends.map(x => [x.id, x])); list.forEach(x => map.set(x.id, clean(x))); friends = [...map.values()]; }
    if (!persist()) return;
    closeSheet(); renderAll(); toast(`已還原 ${list.length} 位朋友`);
  }

  /* ---------- sheet actions ---------- */
  $("#sheetHost").addEventListener("click", e => {
    if (e.target.id === "scrim") { closeSheet(); return; }
    const o = e.target.closest("[data-open]"); if (o) { openDetail(o.dataset.open); return; }
    const a = e.target.closest("[data-act]"); if (!a) return;
    const act = a.dataset.act, id = openDetailId, f = byId(id);
    switch (act) {
      case "edit": startEdit(id); break;
      case "tree": closeSheet(); showTab("tree"); focusNode(id); break;
      case "del": openDetail(id, true); break;
      case "del-no": openDetail(id); break;
      case "del-yes": {
        const parent = byId(f.referrerId) ? f.referrerId : "";
        for (const k of childrenOf(id)) { k.referrerId = parent; k.updatedAt = Date.now(); if (!parent) delete k.referrerId; }
        friends.forEach(x => { if (x.orgAnchor === id) { delete x.orgAnchor; } });
        friends = friends.filter(x => x.id !== id);
        persist(); closeSheet(); toast(`已刪除 ${f.name}`);
        if (editingId === id) endEdit();
        renderAll(); break;
      }
      case "set-name": askName("menu"); break;
      case "name-ok": {
        const v = ($("#ownerInput").value || "").trim();
        if (!v) { toast("請輸入名字"); return; }
        ls.set(LS_OWNER, v); renderTree();
        const then = pending && pending.then; pending = null;
        if (then === "export") exportOrg(); else openMenu();
        break;
      }
      case "name-cancel": { const then = pending && pending.then; if (then === "menu") openMenu(); else closeSheet(); break; }
      case "export": startExport(); break;
      case "import": $("#importFile").click(); break;
      case "kind-next": {
        const k = (document.querySelector('input[name="kind"]:checked') || {}).value;
        if (k === "org") importOrgForm(); else importBackupForm();
        break;
      }
      case "org-go": doImportOrg(); break;
      case "backup-go": applyBackup((document.querySelector('input[name="bmode"]:checked') || {}).value || "merge"); break;
      case "cancel": closeSheet(); break;
    }
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeSheet(); });

  /* ---------- tree ---------- */
  function nodeHTML(f, seen) {
    if (seen.has(f.id)) return ""; seen.add(f.id);
    const age = ageOf(f.birthday);
    const sub = [age !== null ? age + " 歲" : "", f.residence || ""].filter(Boolean).join(" · ");
    const kids = childrenOf(f.id).map(k => nodeHTML(k, seen)).join("");
    return `<li><button class="node${f.isDistributor ? " dist" : ""}" data-node="${esc(f.id)}"><span class="n">${esc(f.name)}</span>${sub ? `<span class="s">${esc(sub)}</span>` : ""}</button>${kids ? `<ul>${kids}</ul>` : ""}</li>`;
  }
  function renderTree() {
    const seen = new Set();
    const roots = friends.filter(isRoot).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).map(r => nodeHTML(r, seen)).join("");
    $("#tree").innerHTML = `<ul><li><div class="node me"><span class="n">${esc(ownerName() || "我")}</span><span class="s">${friends.length ? friends.length + " 位朋友" : "從這裡開始"}</span></div>${roots ? `<ul>${roots}</ul>` : ""}</li></ul>`;
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
    clearTimeout(toastTimer); toastTimer = setTimeout(() => $("#toastHost").innerHTML = "", 2800);
  }
  function renderAll() {
    fillReferrerOptions(); renderCards(); renderTree();
    if (openDetailId) { if (!byId(openDetailId)) closeSheet(); else if (!document.querySelector(".confirm")) openDetail(openDetailId); }
  }
  window.addEventListener("storage", e => { if (e.key === LS_KEY) { try { friends = JSON.parse(e.newValue || "[]").map(clean); } catch (x) {} renderAll(); } });

  setDist(false);
  renderAll();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
