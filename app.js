let currentStockData = { lastUpdated: Date.now(), types: [], items: [] };
let selectedTypeId = null;
let db = null;

// Init IndexedDB
async function initDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open("StockOrganizerDB", 1);
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

// Load from local
async function loadLocalData() {
    if (!db) await initDB();
    return new Promise(resolve => {
        const tx = db.transaction("stockData", "readonly");
        const store = tx.objectStore("stockData");
        const req = store.get("main");
        req.onsuccess = () => resolve(req.result ? req.result.data : null);
        req.onerror = () => resolve(null);
    });
}

// Save to local
async function saveLocalData(data) {
    if (!db) await initDB();
    return new Promise(resolve => {
        const tx = db.transaction("stockData", "readwrite");
        const store = tx.objectStore("stockData");
        store.put({ key: "main", data: data });
        tx.oncomplete = () => resolve(true);
    });
}

// Fetch repo data.json
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

// Update notifier
function updateNotifier() {
    const el = document.getElementById("status-notifier");
    const localTime = currentStockData.lastUpdated || 0;
    el.innerHTML = `
        ✅ Local data saved 
        <span class="text-xs ml-2 bg-emerald-800 text-emerald-200 px-2 py-0.5 rounded-2xl">${new Date(localTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
    `;
    el.className = "px-6 py-3 rounded-3xl text-sm font-medium flex items-center gap-2 bg-emerald-900 text-emerald-300";
}

// Render types list
function renderTypes() {
    const list = document.getElementById("types-list");
    list.innerHTML = "";
    if (currentStockData.types.length === 0) {
        list.innerHTML = `<li class="px-6 py-6 text-zinc-400 text-center border border-dashed border-zinc-700 rounded-3xl">No types yet — add your first one 👆</li>`;
        return;
    }
    currentStockData.types.forEach(type => {
        const li = document.createElement("li");
        li.className = "group flex items-center justify-between px-6 py-4 bg-zinc-900 hover:bg-zinc-800 rounded-3xl cursor-pointer transition-all";
        li.innerHTML = `
            <span class="text-lg">${type.name}</span>
            <button onclick="deleteType(${type.id}); event.stopImmediatePropagation();" 
                    class="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 px-3 py-1 text-sm">×</button>
        `;
        li.onclick = () => selectType(type.id);
        list.appendChild(li);
    });
}

// Add type modal
function showAddTypeModal() {
    document.getElementById("add-type-modal").classList.remove("hidden");
    document.getElementById("type-name-input").focus();
}

function hideAddTypeModal() {
    document.getElementById("add-type-modal").classList.add("hidden");
    document.getElementById("type-name-input").value = "";
}

async function createNewType() {
    const name = document.getElementById("type-name-input").value.trim();
    if (!name) return;
    
    const newType = {
        id: Date.now(),
        name: name,
        customFields: []   // ready for step 2
    };
    
    currentStockData.types.push(newType);
    currentStockData.lastUpdated = Date.now();
    await saveLocalData(currentStockData);
    
    renderTypes();
    updateNotifier();
    hideAddTypeModal();
}

// Delete type
async function deleteType(id) {
    if (!confirm("Delete this type and ALL its items forever?")) return;
    
    currentStockData.types = currentStockData.types.filter(t => t.id !== id);
    currentStockData.items = currentStockData.items.filter(i => i.typeId !== id);
    currentStockData.lastUpdated = Date.now();
    
    await saveLocalData(currentStockData);
    renderTypes();
    updateNotifier();
    if (selectedTypeId === id) backToDashboard();
}

// Select type (for step 2)
function selectType(id) {
    selectedTypeId = id;
    const type = currentStockData.types.find(t => t.id === id);
    document.getElementById("dashboard-view").classList.add("hidden");
    const itemsView = document.getElementById("items-view");
    itemsView.classList.remove("hidden");
    document.getElementById("current-type-name").innerHTML = `📦 ${type.name}`;
}

function backToDashboard() {
    selectedTypeId = null;
    document.getElementById("items-view").classList.add("hidden");
    document.getElementById("dashboard-view").classList.remove("hidden");
}

// Export
function exportData() {
    const blob = new Blob([JSON.stringify(currentStockData, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mystock.json";
    a.click();
    URL.revokeObjectURL(url);
}

// Import
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
            alert("✅ Import successful!");
        } catch {
            alert("❌ Bad JSON file");
        }
    };
    reader.readAsText(file);
}

// Load from repo
async function loadFromRepo() {
    const repoData = await fetchRepoData();
    if (!repoData) {
        alert("No data.json or you're offline");
        return;
    }
    
    const localTime = currentStockData.lastUpdated || 0;
    const repoTime = repoData.lastUpdated || 0;
    
    if (repoTime > localTime) {
        if (confirm("Repo has newer data.\nOverwrite your local data?")) {
            currentStockData = repoData;
            await saveLocalData(currentStockData);
            renderTypes();
            updateNotifier();
            alert("✅ Loaded from repo");
        }
    } else {
        alert("✅ Local is already newer or the same");
    }
}

// Start the app
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
    
    // PWA service worker
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("./sw.js").catch(console.log);
    }
    
    console.log("%c✅ Stock Organizer v1.0 ready", "color:#10b981; font-weight:bold");
};