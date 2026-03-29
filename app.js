let currentStockData = { lastUpdated: Date.now(), types: [], items: [] };
let selectedTypeId = null;
let selectedItemId = null;
let db = null;

async function initDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open("StockOrganizerDB", 3);
        req.onupgradeneeded = e => { db = e.target.result; if (!db.objectStoreNames.contains("stockData")) db.createObjectStore("stockData", { keyPath: "key" }); };
        req.onsuccess = e => { db = e.target.result; resolve(); };
        req.onerror = e => reject(e);
    });
}

async function loadLocalData() {
    if (!db) await initDB();
    return new Promise(resolve => {
        const tx = db.transaction("stockData", "readonly");
        const req = tx.objectStore("stockData").get("main");
        req.onsuccess = () => resolve(req.result ? req.result.data : null);
        req.onerror = () => resolve(null);
    });
}

async function saveLocalData(data) {
    if (!db) await initDB();
    return new Promise(resolve => {
        const tx = db.transaction("stockData", "readwrite");
        tx.objectStore("stockData").put({ key: "main", data });
        tx.oncomplete = () => resolve(true);
    });
}

async function fetchRepoData() {
    try {
        const res = await fetch("./data.json", { cache: "no-store" });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.lastUpdated) data.lastUpdated = Date.now();
        return data;
    } catch { return null; }
}

function updateNotifier() {
    const el = document.getElementById("status-notifier");
    const time = new Date(currentStockData.lastUpdated).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    el.innerHTML = `✅ Local saved <span class="text-xs ml-2 bg-emerald-800 px-2 py-0.5 rounded-2xl">${time}</span>`;
    el.className = "px-6 py-3 rounded-3xl text-sm font-medium flex items-center gap-2 bg-emerald-900 text-emerald-300";
}

function renderTypes() {
    const list = document.getElementById("types-list");
    list.innerHTML = "";
    if (currentStockData.types.length === 0) {
        list.innerHTML = `<li class="px-6 py-6 text-zinc-400 text-center border border-dashed border-zinc-700 rounded-3xl">No types yet — add your first one</li>`;
        return;
    }
    currentStockData.types.forEach(type => {
        const li = document.createElement("li");
        li.className = "group flex justify-between px-6 py-4 bg-zinc-900 hover:bg-zinc-800 rounded-3xl cursor-pointer";
        li.innerHTML = `<span class="text-lg">${type.name}</span>`;
        li.onclick = () => selectType(type.id);
        list.appendChild(li);
    });
}

function selectType(id) {
    selectedTypeId = id;
    const type = currentStockData.types.find(t => t.id === id);
    document.getElementById("items-view").classList.remove("hidden");
    document.getElementById("tab-content-0").classList.add("hidden");
    document.getElementById("tab-content-1").classList.add("hidden");
    document.getElementById("current-type-name").innerHTML = `📦 ${type.name}`;
    renderCustomFields();
    renderItemsTable();
}

function backToDashboard() {
    selectedTypeId = null;
    document.getElementById("items-view").classList.add("hidden");
    document.getElementById("tab-content-0").classList.remove("hidden");
    renderAlerts();
}

function renderCustomFields() {
    const type = currentStockData.types.find(t => t.id === selectedTypeId);
    const container = document.getElementById("custom-fields-display");
    container.innerHTML = "";
    if (!type.customFields || type.customFields.length === 0) {
        container.innerHTML = `<span class="text-zinc-400 text-sm">No custom fields yet. Click "+ Custom Field"</span>`;
        return;
    }
    type.customFields.forEach((field, i) => {
        const pill = document.createElement("div");
        pill.className = "bg-zinc-800 text-zinc-300 px-4 py-2 rounded-3xl text-sm flex items-center gap-2";
        pill.innerHTML = `${field.name} ${field.subFields && field.subFields.length ? `(${field.subFields.join(", ")})` : ''} <span onclick="deleteCustomField(${i});event.stopImmediatePropagation()" class="text-red-400 cursor-pointer">×</span>`;
        container.appendChild(pill);
    });
}

async function createCustomField() {
    const name = document.getElementById("custom-field-name").value.trim();
    const subStr = document.getElementById("custom-subfields").value.trim();
    if (!name || !selectedTypeId) return;
    const type = currentStockData.types.find(t => t.id === selectedTypeId);
    if (!type.customFields) type.customFields = [];
    type.customFields.push({ name: name, subFields: subStr ? subStr.split(",").map(s => s.trim()) : [] });
    currentStockData.lastUpdated = Date.now();
    await saveLocalData(currentStockData);
    hideAddCustomFieldModal();
    renderCustomFields();
    updateNotifier();
}

function deleteCustomField(index) {
    if (!confirm("Delete field?")) return;
    const type = currentStockData.types.find(t => t.id === selectedTypeId);
    type.customFields.splice(index, 1);
    currentStockData.lastUpdated = Date.now();
    saveLocalData(currentStockData).then(() => { renderCustomFields(); renderItemsTable(); updateNotifier(); });
}

function showAddCustomFieldModal() {
    if (!selectedTypeId) return alert("Select a type first");
    document.getElementById("add-custom-field-modal").classList.remove("hidden");
}
function hideAddCustomFieldModal() { document.getElementById("add-custom-field-modal").classList.add("hidden"); document.getElementById("custom-subfields").value = ""; }

function renderItemsTable() {
    const tbody = document.getElementById("items-table-body");
    tbody.innerHTML = "";
    const filtered = currentStockData.items.filter(i => i.typeId === selectedTypeId);
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-12 text-center text-zinc-400">No items yet</td></tr>`;
        return;
    }
    filtered.forEach(item => {
        const tr = document.createElement("tr");
        tr.className = "hover:bg-zinc-800";
        tr.innerHTML = `
            <td class="px-6 py-4">${item.name}</td>
            <td class="px-6 py-4"><button onclick="changeQty(${item.id}, -1)" class="px-3">-</button> <span class="font-mono">${item.quantity}</span> <button onclick="changeQty(${item.id}, 1)" class="px-3">+</button></td>
            <td class="px-6 py-4">${item.status}</td>
            <td class="px-6 py-4">${item.expiry || '-'}</td>
            <td class="px-6 py-4">${item.location || '-'}</td>
            <td class="px-6 py-4 text-center">
                <button onclick="showEditCustomModal(${item.id})" class="text-emerald-400 mr-2">✏️</button>
                <button onclick="showHistoryModal(${item.id})" class="text-blue-400 mr-2">📜</button>
                <button onclick="showQRModal(${item.id})" class="text-purple-400 mr-2">📱</button>
                <button onclick="deleteItem(${item.id})" class="text-red-400">×</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function createNewItem() {
    const item = {
        id: Date.now(),
        typeId: selectedTypeId,
        name: document.getElementById("item-name").value.trim(),
        quantity: parseInt(document.getElementById("item-qty").value) || 1,
        status: document.getElementById("item-status").value,
        expiry: document.getElementById("item-expiry").value || null,
        location: document.getElementById("item-location").value.trim() || null,
        customValues: {},
        history: []
    };
    if (!item.name) return;
    currentStockData.items.push(item);
    currentStockData.lastUpdated = Date.now();
    await saveLocalData(currentStockData);
    hideAddItemModal();
    renderItemsTable();
    renderAlerts();
    updateNotifier();
}

function changeQty(id, delta) {
    const item = currentStockData.items.find(i => i.id === id);
    if (!item) return;
    const oldQty = item.quantity;
    item.quantity = Math.max(0, item.quantity + delta);
    item.history = item.history || [];
    item.history.unshift({ date: new Date().toISOString(), change: delta, from: oldQty, to: item.quantity });
    if (item.history.length > 10) item.history.pop();
    currentStockData.lastUpdated = Date.now();
    saveLocalData(currentStockData).then(() => {
        renderItemsTable();
        renderAlerts();
        updateNotifier();
    });
}

async function deleteItem(id) {
    if (!confirm("Delete item?")) return;
    currentStockData.items = currentStockData.items.filter(i => i.id !== id);
    currentStockData.lastUpdated = Date.now();
    await saveLocalData(currentStockData);
    renderItemsTable();
    renderAlerts();
    updateNotifier();
}

function showAddItemModal() {
    if (!selectedTypeId) return alert("Select a type first");
    document.getElementById("add-item-modal").classList.remove("hidden");
}
function hideAddItemModal() { document.getElementById("add-item-modal").classList.add("hidden"); }

function showEditCustomModal(itemId) {
    selectedItemId = itemId;
    const item = currentStockData.items.find(i => i.id === itemId);
    const type = currentStockData.types.find(t => t.id === selectedTypeId);
    let html = `<h3 class="text-xl mb-6">Edit custom values for ${item.name}</h3>`;
    type.customFields.forEach(field => {
        html += `<div class="mb-6"><label class="block text-emerald-300 mb-2">${field.name}</label>`;
        if (field.subFields && field.subFields.length) {
            field.subFields.forEach(sub => {
                const val = item.customValues && item.customValues[field.name] && item.customValues[field.name][sub] ? item.customValues[field.name][sub] : "";
                html += `<div class="mb-3"><span class="text-sm text-zinc-400">${sub}</span><input type="text" id="sub-${field.name}-${sub}" value="${val}" class="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-3xl px-6 py-3"></div>`;
            });
        } else {
            const val = item.customValues && item.customValues[field.name] ? item.customValues[field.name] : "";
            html += `<input type="text" id="field-${field.name}" value="${val}" class="w-full bg-zinc-800 border border-zinc-700 rounded-3xl px-6 py-3">`;
        }
        html += `</div>`;
    });
    html += `<div class="flex gap-4 mt-8"><button onclick="hideEditCustomModal()" class="flex-1 py-4 bg-zinc-800 rounded-3xl">Cancel</button><button onclick="saveCustomValues()" class="flex-1 py-4 bg-emerald-600 rounded-3xl">Save Values</button></div>`;
    document.getElementById("custom-form-container").innerHTML = html;
    document.getElementById("edit-custom-modal").classList.remove("hidden");
}

function hideEditCustomModal() { document.getElementById("edit-custom-modal").classList.add("hidden"); }

function saveCustomValues() {
    const item = currentStockData.items.find(i => i.id === selectedItemId);
    const type = currentStockData.types.find(t => t.id === selectedTypeId);
    item.customValues = item.customValues || {};
    type.customFields.forEach(field => {
        if (field.subFields && field.subFields.length) {
            item.customValues[field.name] = {};
            field.subFields.forEach(sub => {
                const input = document.getElementById(`sub-${field.name}-${sub}`);
                if (input) item.customValues[field.name][sub] = input.value.trim();
            });
        } else {
            const input = document.getElementById(`field-${field.name}`);
            if (input) item.customValues[field.name] = input.value.trim();
        }
    });
    currentStockData.lastUpdated = Date.now();
    saveLocalData(currentStockData).then(() => {
        hideEditCustomModal();
        renderItemsTable();
        updateNotifier();
    });
}

function showHistoryModal(itemId) {
    const item = currentStockData.items.find(i => i.id === itemId);
    const container = document.getElementById("history-list");
    container.innerHTML = "";
    if (!item.history || item.history.length === 0) {
        container.innerHTML = `<p class="text-zinc-400">No history yet</p>`;
    } else {
        item.history.forEach(entry => {
            const div = document.createElement("div");
            div.className = "bg-zinc-800 p-4 rounded-3xl text-sm";
            div.innerHTML = `${new Date(entry.date).toLocaleString()} — ${entry.change > 0 ? '+' : ''}${entry.change} (${entry.from} → ${entry.to})`;
            container.appendChild(div);
        });
    }
    document.getElementById("history-modal").classList.remove("hidden");
}
function hideHistoryModal() { document.getElementById("history-modal").classList.add("hidden"); }

function showQRModal(itemId) {
    const item = currentStockData.items.find(i => i.id === itemId);
    const typeName = currentStockData.types.find(t => t.id === selectedTypeId).name;
    const qrContainer = document.getElementById("qr-container");
    qrContainer.innerHTML = "";
    new QRCode(qrContainer, {
        text: JSON.stringify({type: typeName, name: item.name, qty: item.quantity, id: item.id}),
        width: 256,
        height: 256,
        colorDark: "#10b981",
        colorLight: "#18181b"
    });
    document.getElementById("qr-modal").classList.remove("hidden");
}
function hideQRModal() { document.getElementById("qr-modal").classList.add("hidden"); }

function renderAlerts() {
    const box = document.getElementById("alerts-box");
    box.innerHTML = "";
    const expiring = currentStockData.items.filter(i => i.expiry && new Date(i.expiry) < new Date(Date.now() + 30*86400000));
    const lowStock = currentStockData.items.filter(i => i.quantity < 3);
    if (expiring.length) box.innerHTML += `<div class="bg-orange-950 border border-orange-400 rounded-3xl p-6"><h3 class="text-orange-300 mb-3">⚠️ Expiring soon (${expiring.length})</h3><ul class="text-sm">${expiring.map(i=>`<li>${i.name} — ${i.expiry}</li>`).join('')}</ul></div>`;
    if (lowStock.length) box.innerHTML += `<div class="bg-red-950 border border-red-400 rounded-3xl p-6"><h3 class="text-red-300 mb-3">🔴 Low stock (${lowStock.length})</h3><ul class="text-sm">${lowStock.map(i=>`<li>${i.name} — only ${i.quantity}</li>`).join('')}</ul></div>`;
    if (!box.innerHTML) box.innerHTML = `<div class="col-span-2 text-center py-8 text-zinc-400">No alerts — keep stacking 👍</div>`;
}

function showTab(n) {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("bg-emerald-600"));
    document.getElementById(`tab-${n}`).classList.add("bg-emerald-600");
    document.getElementById("tab-content-0").classList.add("hidden");
    document.getElementById("tab-content-1").classList.add("hidden");
    document.getElementById("items-view").classList.add("hidden");
    if (n === 0) { document.getElementById("tab-content-0").classList.remove("hidden"); renderAlerts(); }
    else if (n === 1) { document.getElementById("tab-content-1").classList.remove("hidden"); renderShoppingList(); }
}

function renderShoppingList() {
    const container = document.getElementById("shopping-list");
    container.innerHTML = "";
    const low = currentStockData.items.filter(i => i.quantity < 3);
    if (low.length === 0) {
        container.innerHTML = `<p class="text-zinc-400">Nothing low — good job!</p>`;
        return;
    }
    low.forEach(item => {
        const div = document.createElement("div");
        div.className = "bg-zinc-900 rounded-3xl p-6 flex justify-between";
        div.innerHTML = `<div><span class="font-medium">${item.name}</span> <span class="text-xs bg-red-900 px-3 py-1 rounded-3xl">${item.quantity} left</span></div><span class="text-emerald-400">Need more</span>`;
        container.appendChild(div);
    });
}

function exportData() {
    const blob = new Blob([JSON.stringify(currentStockData, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "mystock.json"; a.click(); URL.revokeObjectURL(url);
}

async function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
        try {
            const imported = JSON.parse(ev.target.result);
            if (!imported.lastUpdated) imported.lastUpdated = Date.now();
            currentStockData = imported;
            await saveLocalData(currentStockData);
            renderTypes();
            updateNotifier();
            renderAlerts();
            alert("✅ Import successful!");
        } catch { alert("❌ Bad JSON"); }
    };
    reader.readAsText(file);
}

async function loadFromRepo() {
    const repoData = await fetchRepoData();
    if (!repoData) return alert("No data.json or offline");
    if (repoData.lastUpdated > currentStockData.lastUpdated) {
        if (confirm("Repo has newer data.\nOverwrite local?")) {
            currentStockData = repoData;
            await saveLocalData(currentStockData);
            renderTypes();
            updateNotifier();
            renderAlerts();
            alert("✅ Loaded from repo");
        }
    } else alert("✅ Local is newer");
}

function createNewType() {
    const name = document.getElementById("type-name-input").value.trim();
    if (!name) return;
    currentStockData.types.push({ id: Date.now(), name: name, customFields: [] });
    currentStockData.lastUpdated = Date.now();
    saveLocalData(currentStockData).then(() => {
        renderTypes();
        updateNotifier();
        hideAddTypeModal();
    });
}

function hideAddTypeModal() { document.getElementById("add-type-modal").classList.add("hidden"); document.getElementById("type-name-input").value = ""; }

window.onload = async () => {
    await initDB();
    let local = await loadLocalData();
    if (local) currentStockData = local;
    else {
        const repo = await fetchRepoData();
        if (repo) currentStockData = repo;
    }
    renderTypes();
    updateNotifier();
    renderAlerts();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js");
    console.log("%c✅ FINAL Stock Organizer v3.0 — ready for bad times", "color:#10b981; font-weight:bold");
};