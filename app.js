let currentStockData = { lastUpdated: Date.now(), types: [], items: [] };
let selectedTypeId = null;
let db = null;

async function initDB() { /* same as Step 1 */ 
    return new Promise((resolve, reject) => {
        const req = indexedDB.open("StockOrganizerDB", 2);
        req.onupgradeneeded = e => {
            db = e.target.result;
            if (!db.objectStoreNames.contains("stockData")) db.createObjectStore("stockData", { keyPath: "key" });
        };
        req.onsuccess = e => { db = e.target.result; resolve(); };
        req.onerror = e => reject(e);
    });
}

async function loadLocalData() { /* same as Step 1 */ 
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

async function fetchRepoData() { /* same as Step 1 */ 
    try {
        const res = await fetch("./data.json", { cache: "no-store" });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.lastUpdated) data.lastUpdated = Date.now();
        return data;
    } catch { return null; }
}

function updateNotifier() { /* same as Step 1 */ 
    const el = document.getElementById("status-notifier");
    const time = new Date(currentStockData.lastUpdated || Date.now()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    el.innerHTML = `✅ Local saved <span class="text-xs ml-2 bg-emerald-800 px-2 py-0.5 rounded-2xl">${time}</span>`;
    el.className = "px-6 py-3 rounded-3xl text-sm font-medium flex items-center gap-2 bg-emerald-900 text-emerald-300";
}

function renderTypes() { /* same as Step 1 but calls selectType on click */ 
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

// === NEW: Custom Fields ===
function renderCustomFields() {
    const type = currentStockData.types.find(t => t.id === selectedTypeId);
    const container = document.getElementById("custom-fields-display");
    container.innerHTML = "";
    if (!type.customFields || type.customFields.length === 0) {
        container.innerHTML = `<span class="text-zinc-400 text-sm">No custom fields yet. Click "+ Custom Field" above.</span>`;
        return;
    }
    type.customFields.forEach((field, i) => {
        const pill = document.createElement("div");
        pill.className = "bg-zinc-800 text-zinc-300 px-4 py-2 rounded-3xl text-sm flex items-center gap-2";
        pill.innerHTML = `${field} <span onclick="deleteCustomField(${i});event.stopImmediatePropagation()" class="text-red-400 cursor-pointer">×</span>`;
        container.appendChild(pill);
    });
}

async function createCustomField() {
    const name = document.getElementById("custom-field-name").value.trim();
    if (!name || !selectedTypeId) return;
    const type = currentStockData.types.find(t => t.id === selectedTypeId);
    if (!type.customFields) type.customFields = [];
    type.customFields.push(name);
    currentStockData.lastUpdated = Date.now();
    await saveLocalData(currentStockData);
    hideAddCustomFieldModal();
    renderCustomFields();
    updateNotifier();
}

function deleteCustomField(index) {
    if (!confirm("Delete this custom field?")) return;
    const type = currentStockData.types.find(t => t.id === selectedTypeId);
    type.customFields.splice(index, 1);
    currentStockData.lastUpdated = Date.now();
    saveLocalData(currentStockData).then(() => {
        renderCustomFields();
        renderItemsTable();
        updateNotifier();
    });
}

function showAddCustomFieldModal() {
    if (!selectedTypeId) return alert("Select a type first");
    document.getElementById("add-custom-field-modal").classList.remove("hidden");
}

// === NEW: Items ===
function renderItemsTable() {
    const tbody = document.getElementById("items-table-body");
    tbody.innerHTML = "";
    const filteredItems = currentStockData.items.filter(i => i.typeId === selectedTypeId);
    if (filteredItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-12 text-center text-zinc-400">No items yet — add one above</td></tr>`;
        return;
    }
    filteredItems.forEach(item => {
        const tr = document.createElement("tr");
        tr.className = "hover:bg-zinc-800";
        const expiryClass = item.expiry && new Date(item.expiry) < new Date(Date.now() + 30*86400000) ? "text-orange-400" : "";
        tr.innerHTML = `
            <td class="px-6 py-4">${item.name}</td>
            <td class="px-6 py-4">
                <button onclick="changeQty(${item.id}, -1)" class="px-3">-</button>
                <span class="font-mono">${item.quantity}</span>
                <button onclick="changeQty(${item.id}, 1)" class="px-3">+</button>
            </td>
            <td class="px-6 py-4">${item.status}</td>
            <td class="px-6 py-4 ${expiryClass}">${item.expiry || '-'}</td>
            <td class="px-6 py-4">${item.location || '-'}</td>
            <td class="px-6 py-4 text-center">
                <button onclick="deleteItem(${item.id})" class="text-red-400">×</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function createNewItem() {
    const type = currentStockData.types.find(t => t.id === selectedTypeId);
    const item = {
        id: Date.now(),
        typeId: selectedTypeId,
        name: document.getElementById("item-name").value.trim(),
        quantity: parseInt(document.getElementById("item-qty").value) || 1,
        status: document.getElementById("item-status").value,
        expiry: document.getElementById("item-expiry").value || null,
        location: document.getElementById("item-location").value.trim() || null,
        customValues: {}   // will hold Power: "battery", etc. in future steps
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
    item.quantity = Math.max(0, item.quantity + delta);
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

function hideAddItemModal() {
    document.getElementById("add-item-modal").classList.add("hidden");
    // clear fields if you want
}

// === NEW: Alerts & Shopping List ===
function renderAlerts() {
    const box = document.getElementById("alerts-box");
    box.innerHTML = "";
    
    const expiring = currentStockData.items.filter(i => i.expiry && new Date(i.expiry) < new Date(Date.now() + 30*86400000));
    const lowStock = currentStockData.items.filter(i => i.quantity < 3);
    
    if (expiring.length) {
        box.innerHTML += `<div class="bg-orange-950 border border-orange-400 rounded-3xl p-6"><h3 class="text-orange-300 mb-3">⚠️ Expiring soon (${expiring.length})</h3><ul class="text-sm">${expiring.map(i=>`<li>${i.name} — ${i.expiry}</li>`).join('')}</ul></div>`;
    }
    if (lowStock.length) {
        box.innerHTML += `<div class="bg-red-950 border border-red-400 rounded-3xl p-6"><h3 class="text-red-300 mb-3">🔴 Low stock (${lowStock.length})</h3><ul class="text-sm">${lowStock.map(i=>`<li>${i.name} — only ${i.quantity} left</li>`).join('')}</ul></div>`;
    }
    if (!box.innerHTML) box.innerHTML = `<div class="col-span-2 text-center py-8 text-zinc-400">No alerts right now 👍</div>`;
}

function showTab(n) {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("bg-emerald-600"));
    document.getElementById(`tab-${n}`).classList.add("bg-emerald-600");
    
    document.getElementById("tab-content-0").classList.add("hidden");
    document.getElementById("tab-content-1").classList.add("hidden");
    document.getElementById("items-view").classList.add("hidden");
    
    if (n === 0) {
        document.getElementById("tab-content-0").classList.remove("hidden");
        renderAlerts();
    } else if (n === 1) {
        document.getElementById("tab-content-1").classList.remove("hidden");
        renderShoppingList();
    }
}

function renderShoppingList() {
    const container = document.getElementById("shopping-list");
    container.innerHTML = "";
    const low = currentStockData.items.filter(i => i.quantity < 3);
    if (low.length === 0) {
        container.innerHTML = `<p class="text-zinc-400">Nothing low — good job stacking!</p>`;
        return;
    }
    low.forEach(item => {
        const div = document.createElement("div");
        div.className = "bg-zinc-900 rounded-3xl p-6 flex justify-between items-center";
        div.innerHTML = `<div><span class="font-medium">${item.name}</span> <span class="text-xs bg-red-900 px-3 py-1 rounded-3xl">${item.quantity} left</span></div><span class="text-emerald-400">Buy more</span>`;
        container.appendChild(div);
    });
}

function clearShoppingList() {
    if (confirm("Clear shopping list?")) {
        // we don't actually delete items, just hide for now
        document.getElementById("shopping-list").innerHTML = `<p class="text-zinc-400">List cleared — add low-stock items again later</p>`;
    }
}

// === Rest of Step 1 functions (createNewType, deleteType, exportData, importData, loadFromRepo, show/hide modals) stay exactly the same ===
/* copy-paste them from your previous app.js if you want — they are unchanged */

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
    
    console.log("%c✅ Stock Organizer v2.0 ready — items + custom fields added", "color:#10b981; font-weight:bold");
};