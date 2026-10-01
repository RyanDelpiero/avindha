// --- KONFIGURASI BACKEND API ---
const API_BASE_URL = '/api/testcases';

// --- AUTHENTICATION MODULE (login diverifikasi server, sesi = cookie httpOnly) ---
let activeUser = null;

async function checkAuthSession() {
    try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) throw new Error('belum login');
        activeUser = await res.json();
        showDashboardScreen();
    } catch (err) {
        activeUser = null;
        showLoginScreen();
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value;
    const errBox = document.getElementById('login-error');
    const errText = errBox.querySelector('span');

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            activeUser = data;
            document.getElementById('login-password').value = '';
            errBox.classList.add('hidden');
            showDashboardScreen();
        } else {
            errText.innerText = data.error || 'Username atau password salah!';
            errBox.classList.remove('hidden');
        }
    } catch (err) {
        errText.innerText = 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
        errBox.classList.remove('hidden');
    }
}

async function handleLogout() {
    if (!confirm("Apakah Anda yakin ingin keluar dari sistem AVINDHA?")) return;
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (err) {}
    activeUser = null;
    ivrData = []; grapariIndihomeData = []; grapariMobileData = [];
    showLoginScreen();
}

// Dipanggil bila server membalas 401 (sesi habis)
function handleSessionExpired() {
    activeUser = null;
    showLoginScreen();
    alert("Sesi login Anda telah berakhir. Silakan login kembali.");
}

// Escape teks isian user sebelum dimasukkan ke innerHTML (cegah XSS)
function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
}

const MAX_EVIDENCE_CHARS = 3500000; // batas body request Vercel ±4,5 MB

function showLoginScreen() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-content').classList.add('hidden');
}

function showDashboardScreen() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-content').classList.remove('hidden');

    if (activeUser) {
        document.getElementById('user-display-name').innerText = activeUser.name;
        document.getElementById('user-display-role').innerText = activeUser.role;
        document.getElementById('user-avatar-initial').innerText = activeUser.name.charAt(0).toUpperCase();
        const clearBtn = document.getElementById('btn-clear-all');
        if (clearBtn) clearBtn.classList.toggle('hidden', activeUser.role !== 'supervisor');
    }

    switchMainMenu('ivr');
    safeCreateIcons(); // <-- Pastikan baris ini ada di sini
}

// --- DATA & CONFIGURATION ---
const GRAPARI_INDIHOME_CAPABILITIES = [
    "Pasang Baru",
    "Lacak Proses Permintaan",
    "Cek & Bayar Tagihan IndiHome",
    "Berhenti Langganan Sementara",
    "Lanjutkan Langganan",
    "Cek Kondisi Jaringan IndiHome"
];

const GRAPARI_MOBILE_CAPABILITIES = [
    "Beli Kartu Perdana",
    "Beli eSIM Telkomsel",
    "Cek & Bayar Tagihan Halo",
    "Perbaikan Data Profile",
    "Beralih ke Halo",
    "Cek Nomor 4G Anda",
    "Lacak Pesanan Kartu",
    "Ganti Kartu/ Migrasi ke 4G"
];

const JOURNEY_MAP = {
    'grapari-mobile': [
        { title: 'Onboarding & Acquisition', desc: 'Beli Kartu Perdana, Beli eSIM, Beralih ke Halo', capabilities: ['Beli Kartu Perdana', 'Beli eSIM Telkomsel', 'Beralih ke Halo'] },
        { title: 'Account & Billing', desc: 'Cek & Bayar Tagihan, Perbaikan Profile', capabilities: ['Cek & Bayar Tagihan Halo', 'Perbaikan Data Profile'] },
        { title: 'Connectivity & Fulfillment', desc: 'Migrasi 4G, Cek 4G, Lacak Pesanan Kartu', capabilities: ['Ganti Kartu/ Migrasi ke 4G', 'Cek Nomor 4G Anda', 'Lacak Pesanan Kartu'] }
    ],
    'grapari-indihome': [
        { title: 'Sales & New Install', desc: 'Pasang Baru, Lacak Permintaan', capabilities: ['Pasang Baru', 'Lacak Proses Permintaan'] },
        { title: 'Billing & Account Care', desc: 'Cek Tagihan, Berhenti/Lanjut Langganan', capabilities: ['Cek & Bayar Tagihan IndiHome', 'Berhenti Langganan Sementara', 'Lanjutkan Langganan'] },
        { title: 'Technical Assurance', desc: 'Cek Kondisi Jaringan IndiHome', capabilities: ['Cek Kondisi Jaringan IndiHome'] }
    ],
    'ivr': [
        { title: 'Mobile & Package Care', desc: 'Pembelian Paket, Info PUK, Ganti Kartu', categories: ['Press 1 Pembelian Paket', 'Press 2 Informasi Nomor PUK', 'Press 3 Informasi Ganti Kartu'] },
        { title: 'Broadband & Eznet Care', desc: 'Informasi, Registrasi, Pengaduan IndiHome', categories: ['Menggunakan Indihome yg sama', '2. Pengaduan Layanan'] },
        { title: 'Complaint & Agent Escalation', desc: 'Keluhan, Talk to Caroline Officer', categories: ['Press 4 Keluhan', 'Press 0 Berbicara dengan Caroline Officer'] }
    ]
};

let currentMainMenu = 'ivr';
let currentSubTab = 'dashboard';

let ivrData = [];
let grapariIndihomeData = [];
let grapariMobileData = [];

let statusChartInstance = null;
let categoryChartInstance = null;

function safeCreateIcons() {
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

// FETCH DATA DARI REST API MYSQL
async function loadDataFromSQL() {
    const moduleName = currentMainMenu; // simpan: user bisa pindah modul saat data masih dimuat
    try {
        const response = await fetch(`${API_BASE_URL}?module=${encodeURIComponent(moduleName)}`);
        if (response.status === 401) { handleSessionExpired(); return; }
        if (!response.ok) throw new Error("Gagal mengambil data dari database server.");

        const data = await response.json();

        if (moduleName === 'ivr') ivrData = data;
        else if (moduleName === 'grapari-indihome') grapariIndihomeData = data;
        else grapariMobileData = data;

        if (moduleName !== currentMainMenu) return; // sudah pindah modul, jangan timpa tampilan

        updateDashboard();
        renderJourneyImpactCards(data);
        renderTable();
        safeCreateIcons();
    } catch (err) {
        console.error("API Fetch Error:", err);
    }
}

function getActiveDataset() {
    if (currentMainMenu === 'ivr') return ivrData;
    if (currentMainMenu === 'grapari-indihome') return grapariIndihomeData;
    return grapariMobileData;
}

function switchMainMenu(menu) {
    currentMainMenu = menu;

    document.getElementById('menu-btn-ivr').className = `flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg transition ${menu === 'ivr' ? 'main-menu-active' : 'main-menu-inactive'}`;
    document.getElementById('menu-btn-grapari-indihome').className = `flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg transition ${menu === 'grapari-indihome' ? 'main-menu-active' : 'main-menu-inactive'}`;
    document.getElementById('menu-btn-grapari-mobile').className = `flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg transition ${menu === 'grapari-mobile' ? 'main-menu-active' : 'main-menu-inactive'}`;

    const tag = document.getElementById('active-system-tag');
    const journeyBtnLabel = document.getElementById('btn-journey-map-label');

    if (menu === 'ivr') {
        tag.className = "px-2.5 py-1 text-xs font-semibold bg-sky-100 text-sky-800 rounded-full border border-sky-200 flex items-center gap-1";
        tag.innerHTML = `<i data-lucide="phone-call" class="w-3 h-3"></i> Modul: Testing IVR`;
        if (journeyBtnLabel) journeyBtnLabel.innerText = "IVR Journey Map";
    } else if (menu === 'grapari-indihome') {
        tag.className = "px-2.5 py-1 text-xs font-semibold bg-red-100 text-red-800 rounded-full border border-red-200 flex items-center gap-1";
        tag.innerHTML = `<i data-lucide="home" class="w-3 h-3"></i> Modul: GraPARI Online IndiHome`;
        if (journeyBtnLabel) journeyBtnLabel.innerText = "IndiHome Journey Map";
    } else {
        tag.className = "px-2.5 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200 flex items-center gap-1";
        tag.innerHTML = `<i data-lucide="smartphone" class="w-3 h-3"></i> Modul: GraPARI Online Mobile`;
        if (journeyBtnLabel) journeyBtnLabel.innerText = "Mobile Journey Map";
    }

    setupCategoryFilter();
    setupTableHeaders();
    loadDataFromSQL();
}

function switchSubTab(tab) {
    currentSubTab = tab;
    document.getElementById('view-dashboard').classList.toggle('hidden', tab !== 'dashboard');
    document.getElementById('view-data-table').classList.toggle('hidden', tab !== 'data-table');
    
    document.getElementById('tab-dashboard').className = `py-4 text-sm font-medium flex items-center gap-2 ${tab === 'dashboard' ? 'tab-active' : 'text-slate-500 hover:text-slate-700'}`;
    document.getElementById('tab-data-table').className = `py-4 text-sm font-medium flex items-center gap-2 ${tab === 'data-table' ? 'tab-active' : 'text-slate-500 hover:text-slate-700'}`;
    
    if (tab === 'dashboard') updateDashboard();
    if (tab === 'data-table') renderTable();
}

function setupCategoryFilter() {
    const select = document.getElementById('filter-category');
    select.innerHTML = '<option value="ALL">Semua Produk/Kategori</option>';

    if (currentMainMenu === 'ivr') {
        select.innerHTML += `
            <option value="Halo">Halo</option>
            <option value="Prabayar">Prabayar</option>
            <option value="Indihome / Eznet">Indihome / Eznet</option>
            <option value="Indosat">Indosat</option>
            <option value="XL">XL</option>
        `;
    } else if (currentMainMenu === 'grapari-indihome') {
        GRAPARI_INDIHOME_CAPABILITIES.forEach(cap => select.innerHTML += `<option value="${cap}">${cap}</option>`);
    } else {
        GRAPARI_MOBILE_CAPABILITIES.forEach(cap => select.innerHTML += `<option value="${cap}">${cap}</option>`);
    }
}

function setupTableHeaders() {
    const thead = document.getElementById('table-head-dynamic');

    if (currentMainMenu === 'ivr') {
        thead.innerHTML = `
            <tr>
                <th class="py-3 px-3 w-10 text-center">No</th>
                <th class="py-3 px-3 w-28">Tanggal</th>
                <th class="py-3 px-3 w-32">Service Provider</th>
                <th class="py-3 px-3 w-32">No. Telepon</th>
                <th class="py-3 px-3 w-24">Severity</th>
                <th class="py-3 px-3 w-32">Jenis Produk</th>
                <th class="py-3 px-3 w-24">Tier</th>
                <th class="py-3 px-3 w-36">Menu Utama</th>
                <th class="py-3 px-3">Detail Alur Navigasi IVR</th>
                <th class="py-3 px-3 w-20 text-center">Evidence</th>
                <th class="py-3 px-3 w-24 text-center">Hasil Test</th>
                <th class="py-3 px-3">Temuan Issue</th>
                <th class="py-3 px-3">Propose Solusi</th>
                <th class="py-3 px-3 w-20 text-center">Action</th>
            </tr>
        `;
    } else {
        thead.innerHTML = `
            <tr>
                <th class="py-3 px-3 w-10 text-center">No</th>
                <th class="py-3 px-3 w-28">Tanggal</th>
                <th class="py-3 px-3 w-28">Severity</th>
                <th class="py-3 px-3 w-48">Capability</th>
                <th class="py-3 px-3">Wording / Step Pengetesan</th>
                <th class="py-3 px-3 w-20 text-center">Evidence</th>
                <th class="py-3 px-3 w-24 text-center">Hasil Test</th>
                <th class="py-3 px-3">Temuan Issue</th>
                <th class="py-3 px-3">Propose Solusi</th>
                <th class="py-3 px-3 w-20 text-center">Action</th>
            </tr>
        `;
    }
}

function normalizeProductName(prodStr) {
    if (!prodStr) return 'Lainnya';
    const s = String(prodStr).trim().toLowerCase();
    if (s.includes('halo')) return 'Halo';
    if (s.includes('prabayar')) return 'Prabayar';
    if (s.includes('indihome') || s.includes('eznet')) return 'Indihome / Eznet';
    if (s.includes('indosat')) return 'Indosat';
    if (s.includes('xl') || s.includes('axis')) return 'XL';
    return prodStr;
}

function updateDashboard() {
    const dataset = getActiveDataset();
    const total = dataset.length;
    const passed = dataset.filter(d => d.result === 'Passed').length;
    const failed = dataset.filter(d => d.result === 'Failed').length;
    const pending = dataset.filter(d => d.result === 'Pending' || !d.result).length;

    document.getElementById('metric-total').innerText = total;
    document.getElementById('metric-passed').innerText = passed;
    document.getElementById('metric-passed-pct').innerText = total ? `${((passed/total)*100).toFixed(1)}% of total` : '0%';
    document.getElementById('metric-failed').innerText = failed;
    document.getElementById('metric-failed-pct').innerText = total ? `${((failed/total)*100).toFixed(1)}% of total` : '0%';
    document.getElementById('metric-pending').innerText = pending;
    document.getElementById('metric-pending-pct').innerText = total ? `${((pending/total)*100).toFixed(1)}% of total` : '0%';
    
    document.getElementById('total-badge').innerText = total;

    const testedTotal = passed + failed;
    const healthScore = testedTotal > 0 ? Math.round((passed / testedTotal) * 100) : 0;
    const criticalCount = dataset.filter(d => (d.severity === 'Critical' || d.severity === 'Critical / Blocker') && d.result === 'Failed').length;

    document.getElementById('metric-health-score').innerText = `${healthScore}%`;
    document.getElementById('metric-critical-count').innerText = criticalCount;

    const badgeEl = document.getElementById('sla-readiness-badge');
    if (testedTotal === 0) {
        badgeEl.className = "px-2.5 py-0.5 text-[11px] font-extrabold rounded-full bg-slate-700 text-slate-300 border border-slate-600 uppercase tracking-wider";
        badgeEl.innerText = "⚪ NO DATA TESTED";
    } else if (healthScore >= 90) {
        badgeEl.className = "px-2.5 py-0.5 text-[11px] font-extrabold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 uppercase tracking-wider";
        badgeEl.innerText = "🟢 SLA EXCELLENT";
    } else if (healthScore >= 70) {
        badgeEl.className = "px-2.5 py-0.5 text-[11px] font-extrabold rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 uppercase tracking-wider";
        badgeEl.innerText = "🟡 SLA WARNING";
    } else {
        badgeEl.className = "px-2.5 py-0.5 text-[11px] font-extrabold rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/30 uppercase tracking-wider";
        badgeEl.innerText = "🔴 SLA CRITICAL";
    }

    // Pie Chart
    const ctxPie = document.getElementById('statusChart').getContext('2d');
    if (statusChartInstance) statusChartInstance.destroy();
    statusChartInstance = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: ['Passed', 'Failed', 'Pending'],
            datasets: [{
                data: total === 0 ? [0, 0, 1] : [passed, failed, pending],
                backgroundColor: total === 0 ? ['#e2e8f0', '#e2e8f0', '#cbd5e1'] : ['#10b981', '#f43f5e', '#f59e0b'],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });

    // Bar Chart
    const ctxBar = document.getElementById('categoryChart').getContext('2d');
    if (categoryChartInstance) categoryChartInstance.destroy();

    let barLabels = [], passedCounts = [], failedCounts = [], pendingCounts = [];

    if (currentMainMenu === 'ivr') {
        document.getElementById('category-chart-title').innerText = "Test Results by Product Type";
        const baseLabels = ['Halo', 'Prabayar', 'Indihome / Eznet', 'Indosat', 'XL'];
        const existingProds = dataset.map(d => normalizeProductName(d.layanan || d.serviceProvider || d.callerProvider));
        barLabels = Array.from(new Set([...baseLabels, ...existingProds])).filter(Boolean);

        barLabels.forEach(prodLabel => {
            const matchedItems = dataset.filter(d => normalizeProductName(d.layanan || d.serviceProvider || d.callerProvider) === prodLabel);
            passedCounts.push(matchedItems.filter(d => d.result === 'Passed').length);
            failedCounts.push(matchedItems.filter(d => d.result === 'Failed').length);
            pendingCounts.push(matchedItems.filter(d => d.result === 'Pending' || !d.result).length);
        });
    } else {
        const capabilities = currentMainMenu === 'grapari-indihome' ? GRAPARI_INDIHOME_CAPABILITIES : GRAPARI_MOBILE_CAPABILITIES;
        document.getElementById('category-chart-title').innerText = `Test Results by Capability`;
        barLabels = capabilities;
        passedCounts = capabilities.map(c => dataset.filter(d => d.capability === c && d.result === 'Passed').length);
        failedCounts = capabilities.map(c => dataset.filter(d => d.capability === c && d.result === 'Failed').length);
        pendingCounts = capabilities.map(c => dataset.filter(d => d.capability === c && (d.result === 'Pending' || !d.result)).length);
    }

    categoryChartInstance = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: barLabels,
            datasets: [
                { label: 'Passed', data: passedCounts, backgroundColor: '#10b981' },
                { label: 'Failed', data: failedCounts, backgroundColor: '#f43f5e' },
                { label: 'Pending', data: pendingCounts, backgroundColor: '#f59e0b' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, plugins: { legend: { position: 'bottom' } } }
    });

    renderJourneyImpactCards(dataset);

    // Render Table Issues
    const issueHead = document.getElementById('issue-table-head');
    const issueBody = document.getElementById('issue-table-body');

    if (currentMainMenu === 'ivr') {
        issueHead.innerHTML = `
            <tr>
                <th class="py-3 px-4 w-12 text-center">No</th>
                <th class="py-3 px-4 w-28 text-center">Severity</th>
                <th class="py-3 px-4 w-36">Provider / No. Telp</th>
                <th class="py-3 px-4 w-36">Produk / Tier</th>
                <th class="py-3 px-4 w-40">Menu Utama</th>
                <th class="py-3 px-4 w-52">Detail Alur Navigasi IVR</th>
                <th class="py-3 px-4">Issue</th>
                <th class="py-3 px-4">Usulan Solusi / Propose</th>
                <th class="py-3 px-4 w-24 text-center">Status</th>
            </tr>
        `;
    } else {
        issueHead.innerHTML = `
            <tr>
                <th class="py-3 px-4 w-12 text-center">No</th>
                <th class="py-3 px-4 w-28 text-center">Severity</th>
                <th class="py-3 px-4 w-48">Capability</th>
                <th class="py-3 px-4">Wording / Step Pengetesan</th>
                <th class="py-3 px-4">Issue</th>
                <th class="py-3 px-4">Usulan Solusi / Propose</th>
                <th class="py-3 px-4 w-24 text-center">Status</th>
            </tr>
        `;
    }

    issueBody.innerHTML = '';
    const issues = dataset.filter(d => d.desc || d.propose || d.result === 'Failed');

    if (issues.length === 0) {
        const colSpan = currentMainMenu === 'ivr' ? 9 : 7;
        issueBody.innerHTML = `<tr><td colspan="${colSpan}" class="py-8 text-center text-slate-400">Belum ada temuan masalah atau catatan perbaikan.</td></tr>`;
    } else {
        issues.forEach((item, idx) => {
            const tr = document.createElement('tr');
            tr.className = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60';
            const providerVal = item.serviceProvider || item.callerProvider || '-';

            if (currentMainMenu === 'ivr') {
                tr.innerHTML = `
                    <td class="py-2.5 px-4 text-center font-medium text-slate-500">${idx + 1}</td>
                    <td class="py-2.5 px-4 text-center">${getSeverityBadge(item.severity)}</td>
                    <td class="py-2.5 px-4 font-medium">${esc(providerVal)} <br><span class="text-[10px] font-mono text-slate-400">${esc(item.phone || '-')}</span></td>
                    <td class="py-2.5 px-4 font-medium">${esc(item.layanan || '-')} <br><span class="text-[10px] text-slate-400">${esc(item.tier || '-')}</span></td>
                    <td class="py-2.5 px-4 font-bold text-slate-800">${esc(item.menuCategory || '-')}</td>
                    <td class="py-2.5 px-4 font-semibold text-slate-800">${esc(item.detail || item.step || '-')}</td>
                    <td class="py-2.5 px-4 text-rose-700 bg-rose-50/50 rounded">${esc(item.desc || '-')}</td>
                    <td class="py-2.5 px-4 text-sky-800 bg-sky-50/50 rounded">${esc(item.propose || '-')}</td>
                    <td class="py-2.5 px-4 text-center">${getStatusBadge(item.result)}</td>
                `;
            } else {
                tr.innerHTML = `
                    <td class="py-2.5 px-4 text-center font-medium text-slate-500">${idx + 1}</td>
                    <td class="py-2.5 px-4 text-center">${getSeverityBadge(item.severity)}</td>
                    <td class="py-2.5 px-4 font-semibold text-slate-700">${esc(item.capability || '-')}</td>
                    <td class="py-2.5 px-4 font-semibold text-slate-800">${esc(item.step || '-')}</td>
                    <td class="py-2.5 px-4 text-rose-700 bg-rose-50/50 rounded">${esc(item.desc || '-')}</td>
                    <td class="py-2.5 px-4 text-sky-800 bg-sky-50/50 rounded">${esc(item.propose || '-')}</td>
                    <td class="py-2.5 px-4 text-center">${getStatusBadge(item.result)}</td>
                `;
            }
            issueBody.appendChild(tr);
        });
    }

    safeCreateIcons();
}

function renderJourneyImpactCards(dataset) {
    const container = document.getElementById('journey-impact-container');
    container.innerHTML = '';
    const pillars = JOURNEY_MAP[currentMainMenu] || [];

    pillars.forEach(pilar => {
        let pilarPassed = 0, pilarFailed = 0, pilarTotal = 0;

        if (currentMainMenu === 'ivr') {
            const items = dataset.filter(d => pilar.categories.includes(d.menuCategory));
            pilarPassed = items.filter(d => d.result === 'Passed').length;
            pilarFailed = items.filter(d => d.result === 'Failed').length;
            pilarTotal = items.length;
        } else {
            const items = dataset.filter(d => pilar.capabilities.includes(d.capability));
            pilarPassed = items.filter(d => d.result === 'Passed').length;
            pilarFailed = items.filter(d => d.result === 'Failed').length;
            pilarTotal = items.length;
        }

        const pct = pilarTotal > 0 ? Math.round((pilarPassed / pilarTotal) * 100) : 0;
        let statusColor = "border-emerald-200 bg-emerald-50/30 text-emerald-800";
        if (pilarFailed > 0) statusColor = "border-rose-200 bg-rose-50/30 text-rose-800";
        else if (pilarTotal === 0) statusColor = "border-slate-200 bg-slate-50 text-slate-600";

        container.innerHTML += `
            <div class="p-4 rounded-xl border ${statusColor} space-y-2">
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="font-bold text-xs uppercase tracking-wider">${pilar.title}</h4>
                        <p class="text-[11px] text-slate-500 mt-0.5 line-clamp-1" title="${pilar.desc}">${pilar.desc}</p>
                    </div>
                    <span class="text-xs font-black px-2 py-0.5 rounded bg-white shadow-sm border border-slate-200">${pct}%</span>
                </div>
                <div class="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div class="bg-emerald-500 h-full" style="width: ${pct}%"></div>
                </div>
                <div class="flex justify-between text-[11px] font-medium pt-1">
                    <span class="text-emerald-700">✓ ${pilarPassed} Passed</span>
                    <span class="text-rose-700">✕ ${pilarFailed} Failed</span>
                </div>
            </div>
        `;
    });
}

function setQuickFilter(type) {
    const resultSelect = document.getElementById('filter-result');
    const severitySelect = document.getElementById('filter-severity');
    
    if (type === 'ALL') {
        resultSelect.value = 'ALL';
        severitySelect.value = 'ALL';
    } else if (type === 'Failed') {
        resultSelect.value = 'Failed';
        severitySelect.value = 'ALL';
    } else if (type === 'Critical') {
        resultSelect.value = 'ALL';
        severitySelect.value = 'Critical';
    }
    renderTable();
}

function renderTable() {
    const body = document.getElementById('main-table-body');
    body.innerHTML = '';

    const dataset = getActiveDataset();
    const search = document.getElementById('search-input').value.toLowerCase();
    const filterRes = document.getElementById('filter-result').value;
    const filterSev = document.getElementById('filter-severity').value;
    const filterCat = document.getElementById('filter-category').value;
    const sortDateDir = document.getElementById('sort-date').value;

    let filtered = dataset.filter(item => {
        const providerVal = item.serviceProvider || item.callerProvider || '';
        const searchStr = ((item.step || '') + (item.detail || '') + (item.desc || '') + (item.propose || '') + (item.capability || '') + (item.layanan || '') + providerVal + (item.phone || '')).toLowerCase();
        const matchSearch = searchStr.includes(search);
        const matchRes = filterRes === 'ALL' || item.result === filterRes || (filterRes === 'Pending' && item.result !== 'Passed' && item.result !== 'Failed');
        
        let matchSev = true;
        if (filterSev !== 'ALL') {
            if (filterSev === 'Critical') matchSev = item.severity === 'Critical' || item.severity === 'Critical / Blocker';
            else if (filterSev === 'Major') matchSev = item.severity === 'Major' || item.severity === 'Major / Functional';
            else if (filterSev === 'Minor') matchSev = item.severity === 'Minor' || item.severity === 'Minor / Cosmetic' || !item.severity;
        }

        let matchCat = true;
        if (filterCat !== 'ALL') {
            if (currentMainMenu === 'ivr') {
                matchCat = item.layanan === filterCat;
            } else {
                matchCat = item.capability === filterCat;
            }
        }
        return matchSearch && matchRes && matchSev && matchCat;
    });

    filtered.sort((a, b) => {
        const dateA = new Date(a.date || '1970-01-01');
        const dateB = new Date(b.date || '1970-01-01');
        return sortDateDir === 'DESC' ? dateB - dateA : dateA - dateB;
    });

    document.getElementById('filtered-count').innerText = filtered.length;

    if (filtered.length === 0) {
        body.innerHTML = `<tr><td colspan="14" class="py-12 text-center text-slate-400">Database kosong / Data tidak ditemukan. Klik <strong>"Record Test"</strong>.</td></tr>`;
        return;
    }

    filtered.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.className = index % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/40 hover:bg-slate-50';
        
        let evidenceCell = `<span class="text-slate-300 text-[10px] text-center block">-</span>`;
        if (item.evidence) {
            if (item.evidence.type === 'video') {
                evidenceCell = `
                    <button onclick="viewMediaModal('${item.id}')" class="px-2 py-1 text-[10px] font-bold bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-300 rounded-lg flex items-center gap-1 mx-auto transition">
                        <i data-lucide="video" class="w-3 h-3"></i> Video
                    </button>
                `;
            } else {
                evidenceCell = `
                    <button onclick="viewMediaModal('${item.id}')" class="px-2 py-1 text-[10px] font-bold bg-sky-100 text-sky-700 hover:bg-sky-200 border border-sky-300 rounded-lg flex items-center gap-1 mx-auto transition">
                        <i data-lucide="image" class="w-3 h-3"></i> Gambar
                    </button>
                `;
            }
        }

        const providerVal = item.serviceProvider || item.callerProvider || '-';

        if (currentMainMenu === 'ivr') {
            tr.innerHTML = `
                <td class="py-3 px-3 text-center text-slate-500 font-medium">${index + 1}</td>
                <td class="py-3 px-3 whitespace-nowrap font-medium text-slate-700 bg-amber-50/30 rounded">${esc(item.date || '-')}</td>
                <td class="py-3 px-3 font-semibold text-slate-700">${esc(providerVal)}</td>
                <td class="py-3 px-3 text-slate-600 font-mono">${esc(item.phone || '-')}</td>
                <td class="py-3 px-3 text-center">${getSeverityBadge(item.severity)}</td>
                <td class="py-3 px-3 font-medium text-slate-700">${esc(item.layanan || '-')}</td>
                <td class="py-3 px-3 text-slate-500">${esc(item.tier || '-')}</td>
                <td class="py-3 px-3 font-semibold text-slate-800">${esc(item.menuCategory || '-')}</td>
                <td class="py-3 px-3 text-slate-700 font-medium max-w-xs truncate" title="${esc(item.detail || item.step || '')}">${esc(item.detail || item.step || '-')}</td>
                <td class="py-3 px-3 text-center">${evidenceCell}</td>
                <td class="py-3 px-3 text-center">${getStatusBadge(item.result)}</td>
                <td class="py-3 px-3 text-rose-600 max-w-xs truncate" title="${esc(item.desc)}">${esc(item.desc || '-')}</td>
                <td class="py-3 px-3 text-sky-700 max-w-xs truncate" title="${esc(item.propose)}">${esc(item.propose || '-')}</td>
                <td class="py-3 px-3 text-center">
                    <div class="flex items-center justify-center gap-1">
                        <button onclick="editTestCase('${item.id}')" class="p-1.5 text-slate-600 hover:text-sky-600 hover:bg-sky-50 rounded transition" title="Edit">
                            <i data-lucide="edit-2" class="w-4 h-4"></i>
                        </button>
                        <button onclick="duplicateTestCase('${item.id}')" class="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded transition" title="Duplikat Test Case">
                            <i data-lucide="copy" class="w-4 h-4"></i>
                        </button>
                    </div>
                </td>
            `;
        } else {
            tr.innerHTML = `
                <td class="py-3 px-3 text-center text-slate-500 font-medium">${index + 1}</td>
                <td class="py-3 px-3 whitespace-nowrap font-medium text-slate-700 bg-amber-50/30 rounded">${esc(item.date || '-')}</td>
                <td class="py-3 px-3 text-center">${getSeverityBadge(item.severity)}</td>
                <td class="py-3 px-3 font-semibold text-slate-800">${esc(item.capability || '-')}</td>
                <td class="py-3 px-3 text-slate-700">${esc(item.step)}</td>
                <td class="py-3 px-3 text-center">${evidenceCell}</td>
                <td class="py-3 px-3 text-center">${getStatusBadge(item.result)}</td>
                <td class="py-3 px-3 text-rose-600 max-w-xs truncate" title="${esc(item.desc)}">${esc(item.desc || '-')}</td>
                <td class="py-3 px-3 text-sky-700 max-w-xs truncate" title="${esc(item.propose)}">${esc(item.propose || '-')}</td>
                <td class="py-3 px-3 text-center">
                    <div class="flex items-center justify-center gap-1">
                        <button onclick="editTestCase('${item.id}')" class="p-1.5 text-slate-600 hover:text-sky-600 hover:bg-sky-50 rounded transition" title="Edit">
                            <i data-lucide="edit-2" class="w-4 h-4"></i>
                        </button>
                        <button onclick="duplicateTestCase('${item.id}')" class="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded transition" title="Duplikat Test Case">
                            <i data-lucide="copy" class="w-4 h-4"></i>
                        </button>
                    </div>
                </td>
            `;
        }
        body.appendChild(tr);
    });
    safeCreateIcons();
}

function getStatusBadge(result) {
    if (result === 'Passed') return `<span class="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-300">Passed</span>`;
    if (result === 'Failed') return `<span class="px-2 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-800 rounded-full border border-rose-300">Failed</span>`;
    return `<span class="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded-full border border-amber-300">Pending</span>`;
}

function getSeverityBadge(severity) {
    if (!severity) return `<span class="px-2 py-0.5 text-[9px] font-medium bg-slate-100 text-slate-600 rounded-md border border-slate-200">Minor</span>`;
    if (severity.includes('Critical')) return `<span class="px-2 py-0.5 text-[9px] font-extrabold bg-rose-600 text-white rounded-md shadow-xs">Critical</span>`;
    if (severity.includes('Major')) return `<span class="px-2 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 rounded-md border border-amber-300">Major</span>`;
    return `<span class="px-2 py-0.5 text-[9px] font-medium bg-slate-100 text-slate-600 rounded-md border border-slate-200">Minor</span>`;
}

function openAddModal() {
    let label = 'IVR';
    if (currentMainMenu === 'grapari-indihome') label = 'GraPARI Online IndiHome';
    if (currentMainMenu === 'grapari-mobile') label = 'GraPARI Online Mobile';

    document.getElementById('modal-title').innerText = `Record Test (${label})`;
    document.getElementById('form-id').value = '';
    document.getElementById('form-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('form-result').value = 'Passed';
    document.getElementById('form-severity').value = 'Minor';
    if (document.getElementById('form-step')) document.getElementById('form-step').value = '';
    document.getElementById('form-desc').value = '';
    document.getElementById('form-propose').value = '';

    setupEvidenceFileInput();
    removeEvidence();

    buildDynamicFormFields();
    document.getElementById('test-modal').classList.remove('hidden');
}

function setupEvidenceFileInput() {
    const fileInput = document.getElementById('form-evidence-file');
    const labelText = document.getElementById('evidence-label-text');
    const hintText = document.getElementById('evidence-hint-text');

    if (currentMainMenu === 'ivr') {
        fileInput.accept = "video/*";
        labelText.innerHTML = `<i data-lucide="video" class="w-4 h-4 text-purple-600"></i> Evidence Video Recording`;
        hintText.innerText = "Auto-Compress Active (Video & Audio Preserved)";
    } else {
        fileInput.accept = "image/*";
        labelText.innerHTML = `<i data-lucide="image" class="w-4 h-4 text-sky-600"></i> Evidence Image Screen Capture`;
        hintText.innerText = "Auto-Compress Active (JPEG 60%)";
    }
    safeCreateIcons();
}

async function handleFileUpload(input) {
    const file = input.files[0];
    if (!file) return;

    const loadingBox = document.getElementById('compress-loading');
    const loadingText = document.getElementById('compress-loading-text');
    const btnSave = document.getElementById('btn-save-submit');

    loadingBox.classList.remove('hidden');
    btnSave.disabled = true;
    btnSave.classList.add('opacity-50', 'cursor-not-allowed');

    try {
        let evidenceObj = null;

        if (currentMainMenu === 'ivr') {
            loadingText.innerText = "Mengompres video secara otomatis... Mohon tunggu sebentar.";
            const compressedBase64 = await compressVideo(file);
            evidenceObj = { data: compressedBase64, type: 'video', name: file.name };
        } else {
            loadingText.innerText = "Mengompres gambar screenshot... Mohon tunggu.";
            const compressedBase64 = await compressImage(file);
            evidenceObj = { data: compressedBase64, type: 'image', name: file.name };
        }

        if (evidenceObj.data.length > MAX_EVIDENCE_CHARS) {
            throw new Error("Ukuran evidence setelah kompresi masih terlalu besar (maks ±2,5 MB). Gunakan video yang lebih pendek atau gambar yang lebih kecil.");
        }
        document.getElementById('form-evidence-data').value = JSON.stringify(evidenceObj);
        renderEvidencePreview(evidenceObj);

    } catch (err) {
        alert("Proses kompresi gagal: " + err.message);
        input.value = '';
    } finally {
        loadingBox.classList.add('hidden');
        btnSave.disabled = false;
        btnSave.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}

function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_WIDTH = 1280;
                if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function compressVideo(file) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        const objectUrl = URL.createObjectURL(file);
        video.src = objectUrl;
        video.muted = false;
        video.volume = 0;
        video.playsInline = true;

        video.onloadedmetadata = () => {
            video.play().catch(() => { video.muted = true; });
            const canvas = document.createElement('canvas');
            let width = video.videoWidth || 640;
            let height = video.videoHeight || 360;
            const MAX_WIDTH = 640;
            if (width > MAX_WIDTH) {
                height = Math.round((height * MAX_WIDTH) / width);
                width = MAX_WIDTH;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            const canvasStream = canvas.captureStream(15);
            
            let audioTrack = null;
            try {
                const streamFromVideo = video.captureStream ? video.captureStream() : video.mozCaptureStream();
                if (streamFromVideo && streamFromVideo.getAudioTracks().length > 0) {
                    audioTrack = streamFromVideo.getAudioTracks()[0];
                }
            } catch (e) {}

            const combinedStream = new MediaStream();
            canvasStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));
            if (audioTrack) combinedStream.addTrack(audioTrack);

            let recorder;
            try {
                recorder = new MediaRecorder(combinedStream, {
                    mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' : 'video/webm',
                    videoBitsPerSecond: 250000 
                });
            } catch (e) {
                recorder = new MediaRecorder(combinedStream);
            }

            const chunks = [];
            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                const reader = new FileReader();
                reader.onloadend = () => {
                    URL.revokeObjectURL(objectUrl);
                    resolve(reader.result);
                };
                reader.readAsDataURL(blob);
            };

            recorder.start();
            const drawFrame = () => {
                if (!video.paused && !video.ended) {
                    ctx.drawImage(video, 0, 0, width, height);
                    requestAnimationFrame(drawFrame);
                } else {
                    recorder.stop();
                }
            };
            drawFrame();
        };
        video.onerror = (err) => {
            URL.revokeObjectURL(objectUrl);
            reject(err);
        };
    });
}

function renderEvidencePreview(evidenceObj) {
    const container = document.getElementById('evidence-preview-container');
    const content = document.getElementById('evidence-preview-content');

    container.classList.remove('hidden');
    if (evidenceObj.type === 'video') {
        content.innerHTML = `
            <div class="flex items-center gap-2">
                <div class="p-2 bg-purple-100 text-purple-700 rounded-lg"><i data-lucide="video" class="w-4 h-4"></i></div>
                <span class="text-xs font-semibold text-slate-700 max-w-[200px] truncate">${esc(evidenceObj.name)} (Compressed)</span>
            </div>
        `;
    } else {
        content.innerHTML = `
            <div class="flex items-center gap-2">
                ${evidenceObj.data
                    ? `<img src="${esc(evidenceObj.data)}" class="w-10 h-10 object-cover rounded-lg border border-slate-300 shadow-xs">`
                    : `<div class="p-2 bg-sky-100 text-sky-700 rounded-lg"><i data-lucide="image" class="w-4 h-4"></i></div>`}
                <span class="text-xs font-semibold text-slate-700 max-w-[200px] truncate">${esc(evidenceObj.name)} (Compressed)</span>
            </div>
        `;
    }
    safeCreateIcons();
}

function removeEvidence() {
    document.getElementById('form-evidence-file').value = '';
    document.getElementById('form-evidence-data').value = '';
    document.getElementById('evidence-preview-container').classList.add('hidden');
}

async function viewMediaModal(id) {
    const dataset = getActiveDataset();
    const item = dataset.find(d => String(d.id) === String(id));
    if (!item || !item.evidence) return;

    // Data evidence (base64) tidak ikut di daftar; ambil dari server saat dibuka
    let ev = item.evidence;
    if (!ev.data) {
        try {
            const res = await fetch(`${API_BASE_URL}/${encodeURIComponent(id)}/evidence`);
            if (res.status === 401) { handleSessionExpired(); return; }
            if (!res.ok) throw new Error('evidence tidak ditemukan');
            ev = await res.json();
        } catch (err) {
            alert("Gagal memuat evidence: " + err.message);
            return;
        }
    }

    const body = document.getElementById('media-modal-body');
    const title = document.getElementById('media-modal-title');

    if (ev.type === 'video') {
        title.innerHTML = `<i data-lucide="video" class="w-4 h-4 text-purple-400"></i> Evidence Video: ${esc(ev.name || 'IVR Recording')}`;
        body.innerHTML = `<video src="${esc(ev.data)}" controls class="w-full max-h-[70vh] rounded-xl shadow-lg" autoplay></video>`;
    } else {
        title.innerHTML = `<i data-lucide="image" class="w-4 h-4 text-sky-400"></i> Evidence Screenshot: ${esc(ev.name || 'Screen Capture')}`;
        body.innerHTML = `<img src="${esc(ev.data)}" class="max-w-full max-h-[70vh] object-contain rounded-xl shadow-lg">`;
    }

    safeCreateIcons();
    document.getElementById('media-modal').classList.remove('hidden');
}

function closeMediaModal() {
    document.getElementById('media-modal').classList.add('hidden');
    document.getElementById('media-modal-body').innerHTML = '';
}

function buildDynamicFormFields(item = null) {
    const container = document.getElementById('dynamic-form-fields');
    const stepWrapper = document.getElementById('wrapper-form-step');
    const stepInput = document.getElementById('form-step');

    container.innerHTML = '';

    if (currentMainMenu === 'ivr') {
        if (stepWrapper) stepWrapper.classList.add('hidden');
        if (stepInput) stepInput.removeAttribute('required');

        container.innerHTML = `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1">Service Provider</label>
                    <select id="form-service-provider" onchange="onServiceProviderChange()" required class="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white font-medium">
                        <option value="Telkomsel">Telkomsel</option>
                        <option value="OLO">OLO</option>
                    </select>
                </div>
                <div id="wrapper-form-phone">
                    <label class="block text-xs font-semibold text-slate-700 mb-1">Nomor Telepon</label>
                    <input type="text" id="form-phone" placeholder="Masukkan nomor telepon..." class="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none font-medium">
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1">Jenis Produk</label>
                    <select id="form-layanan" onchange="onLayananChange()" required class="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white font-medium">
                    </select>
                </div>
                <div id="wrapper-form-tier">
                    <label class="block text-xs font-semibold text-slate-700 mb-1">Tier Pelanggan</label>
                    <select id="form-tier" onchange="onTierChange()" class="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white font-medium">
                        <option value="Priority">Priority</option>
                        <option value="Reguler">Reguler</option>
                    </select>
                </div>
            </div>
            
            <div id="wrapper-form-menu-category">
                <label class="block text-xs font-semibold text-slate-700 mb-1">Menu Utama</label>
                <select id="form-menu-category" onchange="onMenuCategoryChange()" required class="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white font-medium">
                    <option value="" disabled selected>-- Pilih Kategori Menu --</option>
                </select>
            </div>

            <div id="ivr-dynamic-steps-container" class="space-y-3"></div>
        `;

        if (item) {
            const providerVal = item.serviceProvider || item.callerProvider || 'Telkomsel';
            if (document.getElementById('form-service-provider')) document.getElementById('form-service-provider').value = providerVal;
            if (item.phone && document.getElementById('form-phone')) document.getElementById('form-phone').value = item.phone;
            if (item.tier && document.getElementById('form-tier')) document.getElementById('form-tier').value = item.tier.includes('Priority') ? "Priority" : "Reguler";
            onServiceProviderChange(item.layanan, item.menuCategory);
        } else {
            onServiceProviderChange();
        }
    } else {
        if (stepWrapper) stepWrapper.classList.remove('hidden');
        if (stepInput) stepInput.setAttribute('required', 'required');

        const capabilities = currentMainMenu === 'grapari-indihome' ? GRAPARI_INDIHOME_CAPABILITIES : GRAPARI_MOBILE_CAPABILITIES;
        let optionsHtml = capabilities.map(c => `<option value="${c}">${c}</option>`).join('');

        container.innerHTML = `
            <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Capability / Fitur</label>
                <select id="form-capability" required class="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white font-medium">
                    ${optionsHtml}
                </select>
            </div>
        `;
        if (item && item.capability) document.getElementById('form-capability').value = item.capability;
    }
}

function onServiceProviderChange(selectedProduct = null, selectedCategory = null) {
    const provider = document.getElementById('form-service-provider')?.value;
    const layananSelect = document.getElementById('form-layanan');
    if (!layananSelect) return;

    layananSelect.innerHTML = '';

    if (provider === 'Telkomsel') {
        ['Halo', 'Prabayar', 'Indihome / Eznet'].forEach(prod => {
            const isSelected = selectedProduct === prod ? 'selected' : '';
            layananSelect.innerHTML += `<option value="${prod}" ${isSelected}>${prod}</option>`;
        });
    } else if (provider === 'OLO') {
        ['Indosat', 'XL'].forEach(prod => {
            const isSelected = selectedProduct === prod ? 'selected' : '';
            layananSelect.innerHTML += `<option value="${prod}" ${isSelected}>${prod}</option>`;
        });
    }

    onLayananChange(selectedCategory);
}

function onTierChange() {
    const categorySelect = document.getElementById('form-menu-category');
    if (categorySelect) onLayananChange(categorySelect.value);
}

function onLayananChange(selectedCategory = null) {
    const provider = document.getElementById('form-service-provider')?.value;
    const layanan = document.getElementById('form-layanan')?.value;
    const tierEl = document.getElementById('form-tier');
    const wrapperTier = document.getElementById('wrapper-form-tier');
    const wrapperPhone = document.getElementById('wrapper-form-phone');
    const wrapperMenuCategory = document.getElementById('wrapper-form-menu-category');
    const categorySelect = document.getElementById('form-menu-category');

    if (!categorySelect) return;
    categorySelect.innerHTML = '';

    // Sembunyikan field nomor telepon dan menu utama jika OLO, atau atur sesuai kebutuhan
    if (provider === 'OLO') {
        if (wrapperPhone) wrapperPhone.classList.add('hidden'); // Sembunyikan input nomor telepon
        if (wrapperTier) wrapperTier.classList.add('hidden');
        if (tierEl) tierEl.removeAttribute('required');
        
        // Menu utama OLO dibuat fleksibel, tidak terkunci ke Caroline Officer
        categorySelect.disabled = false;
        categorySelect.innerHTML = `
            <option value="" disabled selected>-- Pilih Kategori Menu --</option>
            <option value="Layanan Utama OLO">Layanan Provider Non Tsel</option>
            <option value="Press 0 Berbicara dengan Caroline Officer">Press 0 Berbicara dengan Caroline Officer</option>
        `;
        if (selectedCategory) categorySelect.value = selectedCategory;
    } else {
        if (wrapperPhone) wrapperPhone.classList.remove('hidden'); // Tampilkan kembali untuk Telkomsel
        
        if (layanan === "Indihome / Eznet") {
            if (wrapperTier) wrapperTier.classList.add('hidden');
            if (tierEl) tierEl.removeAttribute('required');
        } else {
            if (wrapperTier) wrapperTier.classList.remove('hidden');
            if (tierEl) tierEl.setAttribute('required', 'required');
        }

    const isTelkomselPriority = (provider === 'Telkomsel') && (layanan === 'Halo' || layanan === 'Prabayar') && (tierEl?.value === 'Priority');
    const isHaloReguler = (provider === 'Telkomsel' && layanan === 'Halo' && tierEl?.value === 'Reguler');

    if (isTelkomselPriority) {
            categorySelect.innerHTML = `<option value="Press 0 Berbicara dengan Caroline Officer" selected>Press 0 Berbicara dengan Caroline Officer (Priority Escalation)</option>`;
            categorySelect.disabled = true;
    }else {
            categorySelect.disabled = false;
            categorySelect.innerHTML = '<option value="" disabled selected>-- Pilih Kategori Menu --</option>';

        let categories = [];
            if (isHaloReguler) {
                categories = [
                    "Press 1 Pembelian Paket",
                    "Press 2 Informasi PUK",
                    "Press 3 Informasi Tagihan Terakhir",
                    "Press 4 Lapor Gangguan",
                    "Press 0 Berbicara dengan Caroline Officer"
                ];
            } else if (layanan === "Indihome / Eznet") {
                categories = [
                    "Press 1 Menggunakan nomor yang sama",
                    "Press 2 Menggunakan Nomor Berbeda"
                ];
            } else {
                categories = [
                    "Press 1 Pembelian Paket", 
                    "Press 2 Informasi Nomor PUK", 
                    "Press 3 Informasi Ganti Kartu", 
                    "Press 4 Keluhan", 
                    "Press 0 Berbicara dengan Caroline Officer"
                ];
            }

        categories.forEach(cat => {
                const isSelected = selectedCategory && selectedCategory === cat ? 'selected' : '';
                categorySelect.innerHTML += `<option value="${cat}" ${isSelected}>${cat}</option>`;
            });
        }
    }

    onMenuCategoryChange();
}

function onMenuCategoryChange() {
    const provider = document.getElementById('form-service-provider')?.value;
    const layanan = document.getElementById('form-layanan')?.value;
    const tier = document.getElementById('form-tier')?.value;
    const categorySelect = document.getElementById('form-menu-category');
    const stepsContainer = document.getElementById('ivr-dynamic-steps-container');
    if (!categorySelect || !stepsContainer) return;

    const category = categorySelect.value;
    stepsContainer.innerHTML = '';


    // --- KHUSUS INDIHOME / EZNET ---
    const isHaloReguler = (provider === 'Telkomsel' && layanan === 'Halo' && tier === 'Reguler');
    const isIndihome = (layanan === "Indihome / Eznet");

    if (provider === 'OLO') {
        renderStepSelect("step-1", "Step 1 : Input Nomor", ["Input nomor (Free Text)"]);
        renderStepSelect("step-2", "Step 2 : Konfirmasi Nomor", ["Verified", "Not Verified"], "onOloVerificationChange()");
    }
    else if (isIndihome && category === "Press 1 Menggunakan nomor yang sama") {
        renderStepSelect("step-1", "Step 1 :", ["Informasi tagihan berjalan"]);
        renderStepSelect("step-2", "Step 2 :", ["Dihubungkan ke Agent"]);
    } else if (isIndihome && category === "Press 2 Menggunakan Nomor Berbeda") {
        // renderStepSelect("step-1", "Step 1 : Konfirmasi Nomor Indihome", ["Verified","Not Verified"], "onHaloRegulerPress2Change()");
        // renderStepSelect("step-2", "Step 2 : ", ["Informasi Tagihan Berjalan"]);
        // renderStepSelect("step-3", "Step 3 : ", ["Dihubungkan ke Agent"]);
        renderStepSelect("step-2", "Step 2 : Verifikasi Status", ["Verified", "Not Verified"], "onIndihomeEznetPress2Change()");
    }
    // --- KHUSUS HALO REGULER ---
    else if (isHaloReguler && category === "Press 1 Pembelian Paket") {
        renderStepSelect("step-1", "Pilih Paket :", [
            "1. Ekstra Kuota", 
            "2. Ekstra Nelpon Bulanan", 
            "3. RoaMAX Umroh 10GB 17 Hari"
        ], "onHaloRegulerPress1Change()");
    } else if (isHaloReguler && category === "Press 2 Informasi PUK") {
        renderStepSelect("step-1", "Step 1 : Input NIK KTP", ["1. Masukkan NIK KTP"]);
        renderStepSelect("step-2", "Step 2 : Verifikasi Status", ["Verified", "Not Verified"], "onHaloRegulerPress2Change()");
    } else if (isHaloReguler && category === "Press 3 Informasi Tagihan Terakhir") {
        renderStepSelect("step-1", "Step 1 : Metode eBill", ["Kirim ulang eBill ke email"]);
        renderStepSelect("step-2", "Step 2 : Konfirmasi", ["Masuk","Tidak Masuk"], "onHaloRegulerPress4Change()");
    } else if (isHaloReguler && category === "Press 4 Lapor Gangguan") {
        renderStepSelect("step-1", "Step 1 : Jenis Gangguan", ["Tidak Bisa Akses Internet","Tidak Bisa Aktivasi Paket"], "onHaloRegulerPress4Change()");
        renderStepSelect("step-2", "Step 2 : Escalation", ["Press 0 Berbicara dengan Caroline Officer"]);
    } else if (isHaloReguler && category === "Press 0 Berbicara dengan Caroline Officer") {
        renderStepSelect("step-1", "Step 1 : Escalation", ["Press 0 Berbicara dengan Caroline Officer"]);
    } 
    // --- MENU DEFAULT / PRABAYAR ---
    else if (category === "Press 1 Pembelian Paket") {
        // renderStepSelect("step-1", "Sub Menu :", ["Internet Super Seru", "Perpanjangan Masa Aktif", "RoaMAX Umroh 10GB 17 Hari"]);
        renderStepSelect("step-1", "Sub Menu :", ["Press 1 Perpanjangan Masa Aktif", "Press 0 Untuk Berbicara dengan Caroline Officer"], "onPrepaidRegulerNIK()");
        // renderStepSelect("step-2", "Konfirmasi Status :", ["Aktivasi Berhasil","Aktivasi Gagal"], "onHaloRegulerPress1Change()");
    } else if (category === "Press 2 Informasi Nomor PUK") {
        renderStepSelect("step-1", "Step 1 : Input NIK diakhir dgn #", ["Masukkan NIK KTP"]);
        renderStepSelect("step-2", "Step 2 : NIK Terverifikasi", ["Verified", "Not Verified"], "onPrepaidRegulerNIK()");
        renderStepSelect("step-3", "Step 3 : Informasi PUK", ["Diterima", "Tidak diterima"]);
    } else if (category === "Press 3 Informasi Ganti Kartu") {
        renderStepSelect("step-1", "Step 1 : Informasi Ganti Kartu", ["Informasi Ganti Kartu OK", "Informasi Ganti Kartu Not OK"]);
        renderStepSelect("step-2", "Step 2 : Escalation", ["Press 0 Berbicara dengan Caroline Officer","Press 7 Kembali ke Menu Utama"]);
    } else if (category === "Press 4 Keluhan") {
        renderStepSelect("step-1", "Step 1 : ", ["Kendala Internet", "Kendala Aktivasi Paket", "Berbicara dengan Caroline Officer","Kembali ke Menu Sebelumnya", "Kembali ke Menu Utama"], "onComplainStep2Change()");
        renderStepSelect("step-2", "Step 2 : ", ["Berbicara dengan Caroline Officer","Kembali ke Menu Sebelumnya", "Kembali ke Menu Utama"]);
    } 
    // else {
    //     renderStepSelect("step-1", "Step 1 : Layanan Navigasi", ["Informasi Layanan", "Pengaduan Layanan"]);
    // }
}

// Handler Alur Prepaid

function onPrabayarRegulerPress1Change() {
        renderStepSelect("step-1", "Sub Menu :", ["Press 1 Perpanjangan Masa Aktif", "Press 0 Untuk Berbicara dengan Caroline Officer"], "onPrabayarRegulerChange()");
}

function onPrabayarRegulerChange() {
    const statusVal = document.getElementById('ivr-step-1')?.value;
    removeStepsAfter(2);
    if (statusVal === "Press 0 Untuk Berbicara dengan Caroline Officer") {
        renderStepSelect("step-1", "Tindak Lanjut :", ["Dihubungkan ke Agent"]);
    }
}

function onPrepaidRegulerNIK() {
        renderStepSelect("step-2", "Step 2 : NIK Terverifikasi", ["Verified", "Not Verified"], "onPrepaidRegulerNIKVerif()");
}

function onPrepaidRegulerNIKVerif() {
    const statusVal = document.getElementById('ivr-step-2')?.value;
    removeStepsAfter(2);
    if (statusVal === "Verified") {
        renderStepSelect("step-3", "Informasi Nomor PUK :", ["Diterima","Tidak Diterima"],"onPrepaidRegulerNIKVerifInfo()");
    } else if (statusVal === "Not Verified") {
        renderStepSelect("step-3", "Tindak Lanjut :", ["Dihubungkan ke Agent"]);
    }
}

function onPrepaidRegulerNIKVerifInfo() {
        renderStepSelect("step-3", "Informasi Nomor PUK :", ["Diterima","Tidak Diterima"], "onPrepaidRegulerNIKVerifInfoReceived()");
}

function onPrepaidRegulerNIKVerifInfoReceived() {
    const statusVal = document.getElementById('ivr-step-3')?.value;
    // removeStepsAfter(2);
    if (statusVal === "Tidak Diterima") {
        renderStepSelect("step-4", "Tindak Lanjut :", ["Dihubungkan ke Agent"]);
    }
}

// --- HANDLER ALUR OLO (INDOSAT / XL) ---
function onOloVerificationChange() {
    const step2Val = document.getElementById('ivr-step-2')?.value;
    removeStepsAfter(2); // Bersihkan step di bawahnya jika ada perubahan

    if (step2Val === "Verified") {
        renderStepSelect("step-3", "Step 3 : Menu Lanjutan", [
            "Informasi Reaktivasi",
            "Berbicara dengan Caroline Officer",
            "Kembali ke Menu Sebelumnya",
            "Untuk kembali ke menu utama"
        ], "onOloVerifiedSubMenuChange()");
    } else if (step2Val === "Not Verified") {
        renderStepSelect("step-3", "Step 3 : Tindak Lanjut", ["Dihubungkan ke Agent"]);
    }
}

function onOloVerifiedSubMenuChange() {
    const step3Val = document.getElementById('ivr-step-3')?.value;
    removeStepsAfter(3); // Bersihkan step 4 ke bawah

    if (step3Val === "Informasi Reaktivasi") {
        renderStepSelect("step-4", "Step 4 : Tindak Lanjut", ["Dihubungkan ke Agent"]);
    }
}


// Handler Alur Indihome Nomor Berbeda

function onHaloRegulerPress2Change() {
    const step2Val = document.getElementById('ivr-step-2')?.value;
    removeStepsAfter(2);
    if (step2Val === "Verified") {
        renderStepSelect("step-3", "Hasil :", ["Informasi Nomor PUK Diterima"]);
    } else if (step2Val === "Not Verified") {
        renderStepSelect("step-3", "Tindak Lanjut :", ["Dihubungkan ke Agent"]);
    }
}
function onIndihomeEznetPress2Change() {
    const step2Val = document.getElementById('ivr-step-2')?.value;
    removeStepsAfter(2);
    if (step2Val === "Verified") {
        renderStepSelect("step-3", "Hasil :", ["Informasi Tagihan Berjalan"]);
    } else if (step2Val === "Not Verified") {
        renderStepSelect("step-3", "Step 3 :", [
            "Press 1 Kendala Layanan atau Tagihan",
            "Press 2 Upgrade, Downgrade, PSB",
            "Press 0 Berbicara dengan Caroline Officer",
            "Press 7 Mengulangi Pilihan Menu"]);
        renderStepSelect("step-4", "Escalation :", ["Berbicara dengan Caroline Officer"]);
    }
}


function onIndihomeVerifikasiStatusChange() {
    const statusVal = document.getElementById('ivr-step-2')?.value;
    removeStepsAfter(2);

    if (statusVal === "Verified") {
        renderStepSelect("step-3", "Arahkan ke Poin 1 :", ["Informasi tagihan berjalan"]);
        renderStepSelect("step-4", "Step Lanjutan :", ["Dihubungkan ke Agent"]);
    } else if (statusVal === "Not Verified") {
        renderStepSelect("step-3", "Pilih Menu Lanjutan :", [
            "Press 1 Kendala Layanan atau Tagihan",
            "Press 2 UPGRADE, Downgrade, PSB",
            "Press 0 Dihubungkan ke Agent",
            "Press 7 Mengulangi Pilihan Menu"
        ]);
    }
}

// Handler Alur Turunan Telkomsel Halo Reguler
function onHaloRegulerPress1Change() {
    renderStepSelect("step-2", "Status Aktivasi :", ["Aktivasi Berhasil", "Aktivasi Gagal"], "onHaloRegulerAktivasiStatusChange()");
}

function onHaloRegulerAktivasiStatusChange() {
    const statusVal = document.getElementById('ivr-step-2')?.value;
    removeStepsAfter(2);
    if (statusVal === "Aktivasi Gagal") {
        renderStepSelect("step-3", "Tindak Lanjut :", ["Dihubungkan ke Agent"]);
    }
}

function onHaloRegulerPress2Change() {
    const step2Val = document.getElementById('ivr-step-2')?.value;
    removeStepsAfter(2);
    if (step2Val === "Verified") {
        renderStepSelect("step-3", "Hasil :", ["Informasi Nomor PUK Diterima"]);
    } else if (step2Val === "Not Verified") {
        renderStepSelect("step-3", "Tindak Lanjut :", ["Dihubungkan ke Agent"]);
    }
}

function onHaloRegulerPress3Change() {
    const step2Val = document.getElementById('ivr-step-2')?.value;
    removeStepsAfter(2);
    if (step2Val === ("Masuk")) {
        renderStepSelect("step-3", "Hasil :", ["eBill sudah diterima"]);
    } else if (step2Val === "Tidak Masuk") {
        renderStepSelect("step-3", "Tindak Lanjut :", ["Dihubungkan ke Agent"]);
    }
}

function onHaloRegulerPress4Change() {
    const step2Val = document.getElementById('ivr-step-2')?.value;
    removeStepsAfter(2);
    if (step2Val === ("Masuk")) {
        renderStepSelect("step-3", "Hasil :", ["eBill sudah diterima"]);
    } else if (step2Val === "Tidak Masuk") {
        renderStepSelect("step-3", "Tindak Lanjut :", ["Dihubungkan ke Agent"]);
    }
}

function renderStepSelect(stepId, labelText, optionsArray, onChangeFn = '') {
    const container = document.getElementById('ivr-dynamic-steps-container');
    if (!container) return;

    let existingDiv = document.getElementById(`wrapper-${stepId}`);
    if (!existingDiv) {
        existingDiv = document.createElement('div');
        existingDiv.id = `wrapper-${stepId}`;
        existingDiv.className = 'space-y-1';
        container.appendChild(existingDiv);
    }

    let optionsHtml = optionsArray.map(opt => `<option value="${opt}">${opt}</option>`).join('');

    existingDiv.innerHTML = `
        <label class="block text-xs font-semibold text-slate-700 mb-1">${labelText}</label>
        <select id="ivr-${stepId}" onchange="${onChangeFn}" required class="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white font-medium">
            ${optionsArray.length > 1 ? '<option value="" disabled selected>-- Pilih ' + labelText + ' --</option>' : ''}
            ${optionsHtml}
        </select>
    `;

    if (optionsArray.length === 1) {
        const selectEl = document.getElementById(`ivr-${stepId}`);
        if (selectEl) selectEl.value = optionsArray[0];
    }
}

function removeStepsAfter(stepNumber) {
    let currentNum = stepNumber + 1;
    while (document.getElementById(`wrapper-step-${currentNum}`)) {
        document.getElementById(`wrapper-step-${currentNum}`).remove();
        currentNum++;
    }
}

function editTestCase(id) {
    const dataset = getActiveDataset();
    const item = dataset.find(d => String(d.id) === String(id));
    if (!item) return;

    let label = currentMainMenu === 'grapari-indihome' ? 'GraPARI Online IndiHome' : currentMainMenu === 'grapari-mobile' ? 'GraPARI Online Mobile' : 'IVR';

    document.getElementById('modal-title').innerText = `Edit Record Test (${label})`;
    document.getElementById('form-id').value = item.id;
    document.getElementById('form-date').value = item.date || new Date().toISOString().split('T')[0];
    document.getElementById('form-result').value = item.result || 'Passed';
    
    let sev = item.severity || 'Minor';
    if (sev.includes('Critical')) sev = 'Critical';
    else if (sev.includes('Major')) sev = 'Major';
    else sev = 'Minor';
    
    document.getElementById('form-severity').value = sev;
    if (document.getElementById('form-step')) document.getElementById('form-step').value = item.step || '';
    document.getElementById('form-desc').value = item.desc || '';
    document.getElementById('form-propose').value = item.propose || '';

    setupEvidenceFileInput();
    if (item.evidence) {
        document.getElementById('form-evidence-data').value = JSON.stringify(item.evidence);
        renderEvidencePreview(item.evidence);
    } else {
        removeEvidence();
    }

    buildDynamicFormFields(item);
    document.getElementById('test-modal').classList.remove('hidden');
}

function duplicateTestCase(id) {
    editTestCase(id);
    document.getElementById('form-id').value = '';
    document.getElementById('modal-title').innerText = `Duplikat Record Test (${currentMainMenu.toUpperCase()})`;
}

function closeModal() {
    document.getElementById('test-modal').classList.add('hidden');
}

// SIMPAN TEST CASE KE MYSQL BACKEND REST API (POST/PUT)
async function saveTestCase(e) {
    e.preventDefault();

    const idVal = document.getElementById('form-id').value;

    let newItem = {
        module: currentMainMenu,
        date: document.getElementById('form-date').value,
        result: document.getElementById('form-result').value,
        severity: document.getElementById('form-severity').value,
        desc: document.getElementById('form-desc').value,
        propose: document.getElementById('form-propose').value
    };

    const evidenceRaw = document.getElementById('form-evidence-data').value;
    if (evidenceRaw) {
        try {
            const ev = JSON.parse(evidenceRaw);
            // Evidence lama (hanya penanda, tanpa data) tidak dikirim ulang: server mempertahankannya
            if (ev && ev.data) newItem.evidence = ev;
        } catch (err) {}
    } else if (idVal) {
        newItem.evidence = null; // edit + evidence dihapus user -> hapus di server
    }

    if (currentMainMenu === 'ivr') {
        newItem.serviceProvider = document.getElementById('form-service-provider')?.value || 'Telkomsel';
        newItem.phone = document.getElementById('form-phone')?.value || '';
        newItem.layanan = document.getElementById('form-layanan')?.value || '';
        
        const isOloOrIndihome = newItem.serviceProvider === 'OLO' || newItem.layanan === "Indihome / Eznet";
        newItem.tier = isOloOrIndihome ? "-" : (document.getElementById('form-tier')?.value || "Reguler");
        newItem.menuCategory = document.getElementById('form-menu-category')?.value || '';
        
        let collectedSteps = [];
        let stepIdx = 1;
        while (document.getElementById(`ivr-step-${stepIdx}`)) {
            const stepVal = document.getElementById(`ivr-step-${stepIdx}`).value;
            if (stepVal) collectedSteps.push(stepVal);
            stepIdx++;
        }
        newItem.detail = collectedSteps.join(" > ");
        newItem.step = newItem.detail;
    } else {
        newItem.capability = document.getElementById('form-capability').value;
        newItem.step = document.getElementById('form-step').value;
    }

    try {
        let response;
        if (idVal) {
            // PUT / Update
            response = await fetch(`${API_BASE_URL}/${idVal}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newItem)
            });
        } else {
            // POST / Insert
            response = await fetch(API_BASE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newItem)
            });
        }

        if (response.status === 401) { closeModal(); handleSessionExpired(); return; }
        if (response.ok) {
            await loadDataFromSQL(); // Reload data dari database
            closeModal();
            alert("Data berhasil tersimpan di database!");
        } else {
            const errorData = await response.json().catch(() => ({}));
            alert("Gagal menyimpan data: " + (errorData.error || response.status));
        }
    } catch (err) {
        alert("Terjadi kesalahan jaringan/server: " + err.message);
    }
}

// EXPORT TO EXCEL
function exportToExcel(type = 'all') {
    const dataset = getActiveDataset();
    if (dataset.length === 0) {
        alert("Data masih kosong, belum ada test case yang dicatat.");
        return;
    }

    let exportData = [];

    if (currentMainMenu === 'ivr') {
        exportData = dataset.map((item, index) => ({
            "No": index + 1,
            "Tanggal Testing": item.date || "-",
            "Service Provider": item.serviceProvider || item.callerProvider || "-",
            "No. Telepon": item.phone || "-",
            "Severity": item.severity || "Minor",
            "Jenis Produk": item.layanan || "-",
            "Tier Pelanggan": item.tier || "-",
            "Kategori Menu": item.menuCategory || "-",
            "Detail Alur Navigasi IVR": item.detail || item.step || "-",
            "Status Evidence": item.evidence ? `Ada (${item.evidence.type})` : "Tidak Ada",
            "Hasil Test Case": item.result || "Pending",
            "Deskripsi Issue": item.desc || "-",
            "Rekomendasi Propose": item.propose || "-"
        }));
    } else {
        exportData = dataset.map((item, index) => ({
            "No": index + 1,
            "Tanggal Testing": item.date || "-",
            "Severity": item.severity || "Minor",
            "Capability": item.capability || "-",
            "Wording / Step Pengetesan": item.step || "-",
            "Status Evidence": item.evidence ? `Ada (${item.evidence.type})` : "Tidak Ada",
            "Hasil Test Case": item.result || "Pending",
            "Deskripsi Issue": item.desc || "-",
            "Rekomendasi Propose": item.propose || "-"
        }));
    }

    if (type === 'issues') {
        exportData = exportData.filter(d => d["Deskripsi Issue"] !== "-" || d["Rekomendasi Propose"] !== "-" || d["Hasil Test Case"] === "Failed");
    }

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Hasil Testing");

    const filename = `AVINDHA_Laporan_QA_${currentMainMenu.toUpperCase()}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
}

function exportJSON() {
    const dataset = getActiveDataset();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataset, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `AVINDHA_Backup_${currentMainMenu.toUpperCase()}_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function importJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const parsed = JSON.parse(e.target.result);
            if (Array.isArray(parsed)) {
                if (confirm(`Impor ${parsed.length} data test case ke database untuk modul ${currentMainMenu.toUpperCase()}?`)) {
                    for (let item of parsed) {
                        item.module = currentMainMenu;
                        await fetch(API_BASE_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(item)
                        });
                    }
                    await loadDataFromSQL();
                    alert("Data berhasil diimpor ke database!");
                }
            } else {
                alert("Format JSON tidak valid!");
            }
        } catch (err) {
            alert("Gagal membaca/mengimpor file JSON: " + err.message);
        }
    };
    reader.readAsText(file);
}

function copyIssueSummary() {
    const dataset = getActiveDataset();
    const issues = dataset.filter(d => d.desc || d.propose || d.result === 'Failed');

    if (issues.length === 0) {
        alert("Tidak ada temuan issue untuk di-copy.");
        return;
    }

    let summaryText = `📌 *RANGKUMAN TEMUAN ISSUE QA - ${currentMainMenu.toUpperCase()}*\n`;
    summaryText += `Tanggal: ${new Date().toLocaleDateString('id-ID')}\n`;
    summaryText += `Total Issue: ${issues.length} item\n\n`;

    issues.forEach((item, i) => {
        summaryText += `${i + 1}. [${item.severity || 'Minor'}] ${esc(item.layanan || item.capability || 'Feature')}\n`;
        summaryText += `   • Issue: ${esc(item.desc || 'No Description')}\n`;
        summaryText += `   • Solusi: ${esc(item.propose || '-')}\n\n`;
    });

    navigator.clipboard.writeText(summaryText).then(() => {
        alert("Rangkuman issue berhasil di-copy ke clipboard!");
    });
}

// CLEAR ALL DATA MODUL DI MYSQL
async function clearAllData() {
    if (confirm(`Apakah Anda yakin ingin MENGHAPUS SELURUH DATA DATABASE pengetesan ${currentMainMenu.toUpperCase()}?`)) {
        try {
            const response = await fetch(`${API_BASE_URL}/module/${currentMainMenu}`, { method: 'DELETE' });
            if (response.status === 401) { handleSessionExpired(); return; }
            if (response.ok) {
                await loadDataFromSQL();
                alert("Seluruh data modul berhasil dibersihkan dari database!");
            } else {
                const errorData = await response.json().catch(() => ({}));
                alert("Gagal menghapus data: " + (errorData.error || response.status));
            }
        } catch (err) {
            alert("Gagal menghapus data dari server: " + err.message);
        }
    }
}

// INISIALISASI APLIKASI
document.addEventListener("DOMContentLoaded", () => {
    // Cek sesi login ke server; bila valid, dashboard tampil & data dimuat otomatis
    checkAuthSession();
});
