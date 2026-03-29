let currentStockData = { 
    lastUpdated: Date.now(), 
    types: [], 
    items: [],
    globalCustomFields: []   // ← NEW: Global fields
};
let selectedTypeId = null;
let selectedItemId = null;
let db = null;

// Initialize IndexedDB
async function initDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open("StockOrganizerDB", 3);
        req.onupgradeneeded = e => {
            db = e.target.result;
            if (!db.objectStoreNames.contains("stockData")) {
                db.createObjectStore("stockData", { keyPath: "key" });
            }
        };
        req.onsuccess = e => {
            db = e.target.result;
            resolve();
        };
        req.onerror = e => reject(e);
    });
}

// Load data from local storage
async function loadLocalData() {
    if (!db) await initDB();
    return new Promise(resolve => {
        const tx = db.transaction("stockData", "readonly");
        const req = tx.objectStore("stockData").get("main");
        req.onsuccess = () => resolve(req.result ? req.result.data : null);
        req.onerror = () => resolve(null);
    });
}

// Save data to local storage
async function saveLocalData(data) {
    if (!db) await initDB();
    return new Promise(resolve => {
        const tx = db.transaction("stockData", "readwrite");
        tx.objectStore("stockData").put({ key: "main", data: data });
        tx.oncomplete = () => resolve(true);
    });
}

// Fetch data.json from repo
async function fetchRepoData() {
    try {
        const res = await fetch("./data.json", { cache: "no-store" });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.lastUpdated) data.lastUpdated = Date.now();
        return data;
    } catch {
        return null;
    }
}

// Update status notifier
function updateNotifier() {
    const el = document.getElementById("status-notifier");
    const time = new Date(currentStockData.lastUpdated || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    el.innerHTML = `✅ Local saved <span class="text-xs ml-2 bg-emerald-800 px-2 py-0.5 rounded-2xl">${time}</span>`;
    el.className = "px-6 py-3 rounded-3xl text-sm font-medium flex items-center gap-2 bg-emerald-900 text-emerald-300";
}

// Render stock types in sidebar
function renderTypes() {
    const list = document.getElementById("types-list");
    list.innerHTML = "";
    if (currentStockData.types.length === 0) {
        list.innerHTML = `<li class="px-6 py-6 text-zinc-400 text-center border border-dashed border-zinc-700 rounded-3xl">No types yet — add your first one</li>`;
        return;
    }
    currentStockData.types.forEach(type => {
        const li = document.createElement("li");
        li.className = "group flex justify-between px-6 py-4 bg-zinc-900 hover:bg-zinc-800 rounded-3xl cursor-pointer transition-all";
        li.innerHTML = `<span class="text-lg">${type.name}</span>`;
        li.onclick = () => selectType(type.id);
        list.appendChild(li);
    });
}
function createNewType() {
    const name = document.getElementById("type-name-input").value.trim();
    if (!name) {
        alert("Type name is required");
        return;
    }
    
    currentStockData.types.push({
        id: Date.now(),
        name: name,
        customFields: []
    });
    
    currentStockData.lastUpdated = Date.now();
    saveLocalData(currentStockData).then(() => {
        renderTypes();
        updateNotifier();
        hideAddTypeModal();
    });
}

function selectType(id) {
    selectedTypeId = id;
    const type = currentStockData.types.find(t => t.id === id);
    document.getElementById("items-view").classList.remove("hidden");
    document.getElementById("tab-content-0").classList.add("hidden");
    document.getElementById("tab-content-1").classList.add("hidden");
    document.getElementById("current-type-name").innerHTML = `📦 ${type.name}`;
    
    renderGlobalCustomFields();   // Use global instead of per-type
    renderItemsTable();
}

// Back to dashboard
function backToDashboard() {
    selectedTypeId = null;
    document.getElementById("items-view").classList.add("hidden");
    document.getElementById("tab-content-0").classList.remove("hidden");
    renderAlerts();
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

// Render items table
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
        tr.className = "hover:bg-zinc-800 cursor-pointer";
        tr.onclick = (e) => {
            // If user clicked on action buttons, don't open detail
            if (e.target.closest('button')) return;
            showItemDetail(item.id);
        };
        const expiryClass = item.expiry && new Date(item.expiry) < new Date(Date.now() + 30*86400000) ? "text-orange-400" : "";
        
        tr.innerHTML = `
            <td class="px-6 py-4">${item.name}</td>

            <td class="px-6 py-4">
                <button onclick="changeQty(${item.id}, -1)" class="px-3 text-lg">-</button>
                <span class="font-mono mx-3">${item.quantity}</span>
                <button onclick="changeQty(${item.id}, 1)" class="px-3 text-lg">+</button>
            </td>

            <td class="px-6 py-4">${item.status}</td>
            <td class="px-6 py-4 ${expiryClass}">${item.expiry || '-'}</td>
            <td class="px-6 py-4">${item.location || '-'}</td>
            <td class="px-6 py-4 text-center">
                <button onclick="showEditCustomModal(${item.id})" class="text-emerald-400 mr-3">✏️</button>
                <button onclick="showHistoryModal(${item.id})" class="text-blue-400 mr-3">📜</button>
                <button onclick="showQRModal(${item.id})" class="text-purple-400 mr-3">📱</button>
                <button onclick="deleteItem(${item.id})" class="text-red-400">×</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Create new item
async function createNewItem() {
    const noExpiry = document.getElementById("no-expiry").checked;
    
    const item = {
        id: Date.now(),
        typeId: selectedTypeId,
        name: document.getElementById("item-name").value.trim(),
        quantity: document.getElementById("item-qty").value.trim() || "1",
        status: document.getElementById("item-status").value,
        expiry: noExpiry ? null : document.getElementById("item-expiry").value || null,
        location: document.getElementById("item-location").value.trim() || null,
        customValues: {},
        history: []
    };
    
    if (!item.name) return alert("Item name is required");
    
    currentStockData.items.push(item);
    currentStockData.lastUpdated = Date.now();
    await saveLocalData(currentStockData);
    hideAddItemModal();
    renderItemsTable();
    renderAlerts();
    updateNotifier();
}

// Change quantity and log history Change quantity with note
function changeQty(id, delta) {
    const item = currentStockData.items.find(i => i.id === id);
    if (!item) return;

    const oldQty = item.quantity;
    let newQty = oldQty;

    if (typeof oldQty === "number") {
        newQty = Math.max(0, oldQty + delta);
    } else {
        // For text quantities, ask user for new value
        newQty = prompt(`Current quantity: ${oldQty}\nEnter new quantity (can be text):`, oldQty);
        if (newQty === null) return; // user cancelled
    }

    item.quantity = newQty;

    // Log history
    if (!item.history) item.history = [];
    item.history.unshift({
        date: new Date().toISOString(),
        change: delta,
        from: oldQty,
        to: newQty,
        note: delta > 0 ? "Added" : "Consumed"
    });
    if (item.history.length > 15) item.history.pop();

    currentStockData.lastUpdated = Date.now();
    saveLocalData(currentStockData).then(() => {
        renderItemsTable();
        renderAlerts();
        updateNotifier();
    });
}

// Delete item
async function deleteItem(id) {
    if (!confirm("Delete this item permanently?")) return;
    currentStockData.items = currentStockData.items.filter(i => i.id !== id);
    currentStockData.lastUpdated = Date.now();
    await saveLocalData(currentStockData);
    renderItemsTable();
    renderAlerts();
    updateNotifier();
}

// Show add item modal
function showAddItemModal() {
    if (!selectedTypeId) return alert("Select a stock type first");
    document.getElementById("add-item-modal").classList.remove("hidden");
}
function hideAddItemModal() {
    document.getElementById("add-item-modal").classList.add("hidden");
}

// Create Global Custom Field
async function createCustomField() {
    const name = document.getElementById("custom-field-name").value.trim();
    const subStr = document.getElementById("custom-subfields").value.trim();
    
    if (!name) {
        alert("Field name is required");
        return;
    }

    if (!currentStockData.globalCustomFields) currentStockData.globalCustomFields = [];

    // Prevent duplicates globally
    const exists = currentStockData.globalCustomFields.some(f => f.name.toLowerCase() === name.toLowerCase());
    if (exists) {
        alert("This field name already exists globally!");
        return;
    }

    currentStockData.globalCustomFields.push({
        name: name,
        subFields: subStr ? subStr.split(",").map(s => s.trim()).filter(s => s.length > 0) : []
    });
    
    currentStockData.lastUpdated = Date.now();
    await saveLocalData(currentStockData);
    
    hideAddCustomFieldModal();
    renderGlobalCustomFields();   // New function
    updateNotifier();
}

// New: Render Global Custom Fields (show in the items view)
function renderGlobalCustomFields() {
    const container = document.getElementById("custom-fields-display");
    container.innerHTML = "";
    
    if (!currentStockData.globalCustomFields || currentStockData.globalCustomFields.length === 0) {
        container.innerHTML = `<span class="text-zinc-400 text-sm">No global custom fields yet. Click "+ Custom Field"</span>`;
        return;
    }

    currentStockData.globalCustomFields.forEach((field, i) => {
        const pill = document.createElement("div");
        pill.className = "bg-zinc-800 text-zinc-300 px-4 py-2 rounded-3xl text-sm flex items-center gap-2";
        const subText = field.subFields && field.subFields.length ? ` (${field.subFields.join(", ")})` : "";
        pill.innerHTML = `${field.name}${subText} <span onclick="deleteGlobalCustomField(${i}); event.stopImmediatePropagation()" class="text-red-400 cursor-pointer ml-2">×</span>`;
        container.appendChild(pill);
    });
}

function deleteGlobalCustomField(index) {
    if (!confirm("Delete this global custom field? It will affect all items.")) return;
    
    currentStockData.globalCustomFields.splice(index, 1);
    currentStockData.lastUpdated = Date.now();
    saveLocalData(currentStockData).then(() => {
        renderGlobalCustomFields();
        renderItemsTable();
        updateNotifier();
    });
}

// Update showAddCustomFieldModal to not require selectedTypeId
function showAddCustomFieldModal() {
    document.getElementById("add-custom-field-modal").classList.remove("hidden");
}

function hideAddCustomFieldModal() {
    document.getElementById("add-custom-field-modal").classList.add("hidden");
}

function showEditCustomModal(itemId) {
    selectedItemId = itemId;
    const item = currentStockData.items.find(i => i.id === itemId);
    const type = currentStockData.types.find(t => t.id === selectedTypeId);
    
    if (!item || !type) return;

    let html = `<h3 class="text-xl mb-6">Edit values for <span class="text-emerald-300">${item.name}</span></h3>`;
    
    // Use globalCustomFields if you have them, otherwise fall back to type.customFields
    const fields = currentStockData.globalCustomFields && currentStockData.globalCustomFields.length > 0 
                   ? currentStockData.globalCustomFields 
                   : (type.customFields || []);

    fields.forEach(field => {
        html += `<div class="mb-8 border-b border-zinc-700 pb-6 last:border-0 last:pb-0">`;
        html += `<label class="block text-emerald-300 font-medium mb-3">${field.name}</label>`;

        // Main Value
        let mainVal = "";
        if (item.customValues && item.customValues[field.name] !== undefined) {
            if (typeof item.customValues[field.name] === 'object' && item.customValues[field.name] !== null) {
                mainVal = item.customValues[field.name].main || "";
            } else {
                mainVal = item.customValues[field.name] || "";
            }
        }

        html += `
            <div class="mb-5">
                <span class="text-xs text-zinc-500 block mb-1">Main Value</span>
                <input type="text" id="main-${field.name}" value="${mainVal}" 
                       class="w-full bg-zinc-800 border border-zinc-700 rounded-3xl px-6 py-3" placeholder="Main value (optional)">
            </div>`;

        // Sub-fields
        if (field.subFields && field.subFields.length > 0) {
            html += `<div class="pl-5 border-l-2 border-zinc-700 space-y-4">`;
            field.subFields.forEach(sub => {
                let subVal = "";
                if (item.customValues && item.customValues[field.name] && typeof item.customValues[field.name] === 'object') {
                    subVal = item.customValues[field.name][sub] || "";
                }
                html += `
                    <div>
                        <span class="text-sm text-zinc-400 block mb-1">${sub}</span>
                        <input type="text" id="sub-${field.name}-${sub}" value="${subVal}" 
                               class="w-full bg-zinc-800 border border-zinc-700 rounded-3xl px-6 py-3">
                    </div>`;
            });
            html += `</div>`;
        }
        html += `</div>`;
    });

    html += `
        <div class="flex gap-4 mt-10">
            <button onclick="hideEditCustomModal()" class="flex-1 py-4 bg-zinc-800 rounded-3xl">Cancel</button>
            <button onclick="saveCustomValues()" class="flex-1 py-4 bg-emerald-600 rounded-3xl">Save All Values</button>
        </div>`;

    document.getElementById("custom-form-container").innerHTML = html;
    document.getElementById("edit-custom-modal").classList.remove("hidden");
}


function hideEditCustomModal() {
    document.getElementById("edit-custom-modal").classList.add("hidden");
}

async function saveCustomValues() {
    const item = currentStockData.items.find(i => i.id === selectedItemId);
    const type = currentStockData.types.find(t => t.id === selectedTypeId);
    
    if (!item || !type) return;

    item.customValues = item.customValues || {};

    const fields = currentStockData.globalCustomFields && currentStockData.globalCustomFields.length > 0 
                   ? currentStockData.globalCustomFields 
                   : (type.customFields || []);

    fields.forEach(field => {
        const mainInput = document.getElementById(`main-${field.name}`);
        
        if (field.subFields && field.subFields.length > 0) {
            // Field has sub-fields → save as object
            if (!item.customValues[field.name] || typeof item.customValues[field.name] !== 'object') {
                item.customValues[field.name] = {};
            }

            // Save main value if entered
            if (mainInput && mainInput.value.trim()) {
                item.customValues[field.name].main = mainInput.value.trim();
            }

            // Save sub-fields
            field.subFields.forEach(sub => {
                const subInput = document.getElementById(`sub-${field.name}-${sub}`);
                if (subInput) {
                    const val = subInput.value.trim();
                    if (val) {
                        item.customValues[field.name][sub] = val;
                    } else if (item.customValues[field.name][sub]) {
                        delete item.customValues[field.name][sub];
                    }
                }
            });
        } 
        else {
            // No sub-fields → save as simple string
            if (mainInput) {
                const val = mainInput.value.trim();
                if (val) {
                    item.customValues[field.name] = val;
                } else {
                    delete item.customValues[field.name];
                }
            }
        }
    });

    currentStockData.lastUpdated = Date.now();
    await saveLocalData(currentStockData);
    
    hideEditCustomModal();
    renderItemsTable();
    updateNotifier();
}

// Show quantity history
function showHistoryModal(itemId) {
    const item = currentStockData.items.find(i => i.id === itemId);
    const container = document.getElementById("history-list");
    container.innerHTML = "";
    
    if (!item.history || item.history.length === 0) {
        container.innerHTML = `<p class="text-zinc-400 text-center py-8">No history yet</p>`;
    } else {
        item.history.forEach(entry => {
            const div = document.createElement("div");
            div.className = "bg-zinc-800 p-4 rounded-3xl text-sm";
            const sign = entry.change > 0 ? "+" : "";
            div.innerHTML = `${new Date(entry.date).toLocaleString()} — ${sign}${entry.change} (${entry.from} → ${entry.to})`;
            container.appendChild(div);
        });
    }
    document.getElementById("history-modal").classList.remove("hidden");
}
function hideHistoryModal() {
    document.getElementById("history-modal").classList.add("hidden");
}

// Show QR code
function showQRModal(itemId) {
    const item = currentStockData.items.find(i => i.id === itemId);
    const typeName = currentStockData.types.find(t => t.id === selectedTypeId).name;
    
    const qrContainer = document.getElementById("qr-container");
    qrContainer.innerHTML = "";
    
    new QRCode(qrContainer, {
        text: JSON.stringify({
            type: typeName,
            name: item.name,
            qty: item.quantity,
            id: item.id
        }),
        width: 256,
        height: 256,
        colorDark: "#10b981",
        colorLight: "#18181b"
    });
    
    document.getElementById("qr-modal").classList.remove("hidden");
}
function hideQRModal() {
    document.getElementById("qr-modal").classList.add("hidden");
}

// Render alerts on dashboard
function renderAlerts() {
    const box = document.getElementById("alerts-box");
    box.innerHTML = "";
    
    const expiring = currentStockData.items.filter(i => i.expiry && new Date(i.expiry) < new Date(Date.now() + 30 * 86400000));
    const lowStock = currentStockData.items.filter(i => i.quantity < 3);
    
    if (expiring.length) {
        box.innerHTML += `
            <div class="bg-orange-950 border border-orange-400 rounded-3xl p-6">
                <h3 class="text-orange-300 mb-3">⚠️ Expiring soon (${expiring.length})</h3>
                <ul class="text-sm space-y-1">${expiring.map(i => `<li>${i.name} — ${i.expiry}</li>`).join('')}</ul>
            </div>`;
    }
    if (lowStock.length) {
        box.innerHTML += `
            <div class="bg-red-950 border border-red-400 rounded-3xl p-6">
                <h3 class="text-red-300 mb-3">🔴 Low stock (${lowStock.length})</h3>
                <ul class="text-sm space-y-1">${lowStock.map(i => `<li>${i.name} — only ${i.quantity} left</li>`).join('')}</ul>
            </div>`;
    }
    if (!box.innerHTML) {
        box.innerHTML = `<div class="col-span-2 text-center py-12 text-zinc-400">No alerts right now — keep stacking 👍</div>`;
    }
}

// Tab switching
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

// Render shopping list
function renderShoppingList() {
    const container = document.getElementById("shopping-list");
    container.innerHTML = "";
    const low = currentStockData.items.filter(i => i.quantity < 3);
    
    if (low.length === 0) {
        container.innerHTML = `<p class="text-zinc-400">Nothing is low right now — good job stacking supplies!</p>`;
        return;
    }
    
    low.forEach(item => {
        const div = document.createElement("div");
        div.className = "bg-zinc-900 rounded-3xl p-6 flex justify-between items-center";
        div.innerHTML = `
            <div>
                <span class="font-medium">${item.name}</span> 
                <span class="text-xs bg-red-900 px-3 py-1 rounded-3xl ml-2">${item.quantity} left</span>
            </div>
            <span class="text-emerald-400">Buy more</span>
        `;
        container.appendChild(div);
    });
}

// Fixed Export Function
function exportData() {
    if (!currentStockData || !currentStockData.types) {
        alert("No data to export!");
        return;
    }

    try {
        const dataToExport = JSON.parse(JSON.stringify(currentStockData)); // deep copy to be safe
        const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { 
            type: "application/json" 
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `mystock_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        
        // Show success message but DO NOT clear data
        const notifier = document.getElementById("status-notifier");
        const originalText = notifier.innerHTML;
        notifier.innerHTML = `✅ Exported successfully!`;
        notifier.className = "px-6 py-3 rounded-3xl text-sm font-medium flex items-center gap-2 bg-emerald-900 text-emerald-300";
        
        setTimeout(() => {
            notifier.innerHTML = originalText;
        }, 2000);
        
    } catch (err) {
        console.error("Export error:", err);
        alert("Export failed. Please try again.");
    }
}

async function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const imported = JSON.parse(ev.target.result);
            
            if (!imported.types || !Array.isArray(imported.types)) {
                alert("Invalid stock file format");
                return;
            }
            
            if (!imported.lastUpdated) imported.lastUpdated = Date.now();
            
            currentStockData = imported;
            await saveLocalData(currentStockData);
            
            renderTypes();
            if (selectedTypeId) {
                renderItemsTable();
                renderCustomFields();
            }
            renderAlerts();
            updateNotifier();
            
            alert("✅ Import successful!");
        } catch (err) {
            console.error(err);
            alert("❌ Invalid JSON file or corrupted data");
        }
    };
    reader.readAsText(file);
}

// Load from repo data.json
async function loadFromRepo() {
    const repoData = await fetchRepoData();
    if (!repoData) {
        alert("Could not load from repo (offline or no data.json)");
        return;
    }
    
    if (repoData.lastUpdated > (currentStockData.lastUpdated || 0)) {
        if (confirm("Repo has newer data.\nDo you want to overwrite your local data?")) {
            currentStockData = repoData;
            await saveLocalData(currentStockData);
            renderTypes();
            updateNotifier();
            renderAlerts();
            alert("✅ Loaded latest data from repo");
        }
    } else {
        alert("✅ Your local data is already newer or the same");
    }
}

function createNewType() {
    const name = document.getElementById("type-name-input").value.trim();
    if (!name) {
        alert("Type name is required");
        return;
    }
    
    currentStockData.types.push({
        id: Date.now(),
        name: name,
        customFields: []   // keep for backward compatibility
    });
    
    currentStockData.lastUpdated = Date.now();
    saveLocalData(currentStockData).then(() => {
        renderTypes();
        updateNotifier();
        hideAddTypeModal();
    });
}


function hideAddTypeModal() {
    document.getElementById("add-type-modal").classList.add("hidden");
    document.getElementById("type-name-input").value = "";
}

function showItemDetail(itemId) {
    selectedItemId = itemId;
    const item = currentStockData.items.find(i => i.id === itemId);
    const type = currentStockData.types.find(t => t.id === selectedTypeId);

    if (!item || !type) return;

    document.getElementById("detail-item-name").textContent = item.name;
    document.getElementById("detail-qty").textContent = item.quantity || "—";
    document.getElementById("detail-status").textContent = item.status || "Good";
    document.getElementById("detail-expiry").textContent = item.expiry || "No expiry";
    document.getElementById("detail-location").textContent = item.location || "Not set";

    const customContainer = document.getElementById("detail-custom-fields");
    customContainer.innerHTML = "<h3 class='text-lg font-medium mb-4'>Custom Fields</h3>";

    const fields = currentStockData.globalCustomFields && currentStockData.globalCustomFields.length > 0 
                   ? currentStockData.globalCustomFields 
                   : (type.customFields || []);

    if (fields.length > 0) {
        fields.forEach(field => {
            const div = document.createElement("div");
            div.className = "mb-6 bg-zinc-950 p-5 rounded-3xl";

            let content = `<p class="text-emerald-300 mb-3 font-medium">${field.name}</p>`;

            const fieldData = item.customValues ? item.customValues[field.name] : null;

            // Main Value
            let mainValue = "—";
            if (fieldData) {
                if (typeof fieldData === 'string') mainValue = fieldData;
                else if (typeof fieldData === 'object' && fieldData.main) mainValue = fieldData.main;
            }
            content += `<div class="mb-4"><span class="text-xs text-zinc-500">Main Value:</span><br><span class="text-lg">${mainValue}</span></div>`;

            // Sub-fields
            if (field.subFields && field.subFields.length > 0) {
                content += `<div class="pl-4 border-l-2 border-zinc-700 space-y-2">`;
                field.subFields.forEach(sub => {
                    let subVal = "—";
                    if (fieldData && typeof fieldData === 'object') {
                        subVal = fieldData[sub] || "—";
                    }
                    content += `<div class="flex justify-between"><span class="text-zinc-400">${sub}</span><span>${subVal}</span></div>`;
                });
                content += `</div>`;
            }

            div.innerHTML = content;
            customContainer.appendChild(div);
        });
    } else {
        customContainer.innerHTML += `<p class="text-zinc-400">No custom fields defined</p>`;
    }

    // History
    const historyContainer = document.getElementById("detail-history");
    historyContainer.innerHTML = "";
    if (item.history && item.history.length > 0) {
        item.history.forEach(entry => {
            const d = document.createElement("div");
            d.className = "flex justify-between text-sm py-2 border-b border-zinc-800 last:border-0";
            const sign = entry.change > 0 ? "+" : "";
            d.innerHTML = `<span>${new Date(entry.date).toLocaleString()}</span><span class="font-mono">${sign}${entry.change}</span>`;
            historyContainer.appendChild(d);
        });
    } else {
        historyContainer.innerHTML = `<p class="text-zinc-400 text-center py-4">No history yet</p>`;
    }

    document.getElementById("item-detail-modal").classList.remove("hidden");
}

function hideItemDetailModal() {
    document.getElementById("item-detail-modal").classList.add("hidden");
}

function showQRModalFromDetail() {
    hideItemDetailModal();
    showQRModal(selectedItemId);
}

// Helper to check if quantity is low
function isLowStock(qty) {
    if (typeof qty === "number") return qty < 3;
    if (typeof qty === "string") {
        const num = parseFloat(qty);
        return !isNaN(num) && num < 3;
    }
    return false;
}

// New: Smart Export with comparison
async function exportData() {
    if (!currentStockData || !currentStockData.types) {
        alert("No data to export!");
        return;
    }

    const repoData = await fetchRepoData();

    // If no repo data or same as local → just export normally
    if (!repoData || JSON.stringify(repoData) === JSON.stringify(currentStockData)) {
        downloadJSON();
        return;
    }

    // Show comparison modal
    showCompareModal(repoData);
}

// Download the JSON
function downloadJSON() {
    try {
        const dataToExport = JSON.parse(JSON.stringify(currentStockData));
        const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `mystock_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);

        // Success feedback
        const notifier = document.getElementById("status-notifier");
        const original = notifier.innerHTML;
        notifier.innerHTML = `✅ Exported successfully`;
        setTimeout(() => { notifier.innerHTML = original; }, 2500);
    } catch (err) {
        console.error(err);
        alert("Export failed");
    }
}

// Show comparison modal
function showCompareModal(repoData) {
    const localTime = new Date(currentStockData.lastUpdated || Date.now());
    const repoTime = new Date(repoData.lastUpdated || Date.now());

    let summaryHTML = `
        <div class="space-y-4">
            <div class="flex justify-between">
                <span class="text-emerald-300">Your Local Data</span>
                <span class="text-zinc-400">${localTime.toLocaleString()}</span>
            </div>
            <div class="flex justify-between">
                <span class="text-amber-300">Repo Data</span>
                <span class="text-zinc-400">${repoTime.toLocaleString()}</span>
            </div>
            
            <div class="pt-4 border-t border-zinc-700 text-sm">
                <p class="text-orange-300">Your local data is different from the repo version.</p>
                <p class="text-zinc-400 mt-2">What do you want to do?</p>
            </div>
        </div>
    `;

    document.getElementById("compare-summary").innerHTML = summaryHTML;
    document.getElementById("compare-modal").classList.remove("hidden");
}

function hideCompareModal() {
    document.getElementById("compare-modal").classList.add("hidden");
}

// Proceed with export after confirmation
function proceedWithExport() {
    hideCompareModal();
    downloadJSON();
}

// App initialization
window.onload = async () => {
    await initDB();
    
    let local = await loadLocalData();
    if (local) {
        currentStockData = local;
    } else {
        const repo = await fetchRepoData();
        if (repo) {
            currentStockData = repo;
            await saveLocalData(currentStockData);
        }
    }
    
    renderTypes();
    updateNotifier();
    renderAlerts();
    
    // Register PWA service worker
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("./sw.js").catch(console.log);
    }
    
    console.log("%c✅ Stock Organizer v3.0 Final — Ready for bad times", "color:#10b981; font-weight:bold");
};