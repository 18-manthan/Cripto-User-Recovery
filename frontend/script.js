// ===== API BASE URL =====
// Use the same host as this page (run backend with `python main.py` → open http://localhost:8000).
// Override for split hosting: <script>window.RUD_API_BASE='https://your-api.example.com'</script> before this file.
const API_BASE = (typeof window !== 'undefined' && window.RUD_API_BASE)
    ? `${String(window.RUD_API_BASE).replace(/\/$/, '')}/api`
    : `${window.location.origin}/api`;
const AUTH_TOKEN_KEY = 'rud_admin_token';
const CLIENT_AUTH_TOKEN_KEY = 'rud_client_token';

function brandTerm(key, fallback) {
    return window.DEMO_BRANDING?.terminology?.[key] ?? fallback;
}

function brandStat(key) {
    return window.DEMO_BRANDING?.stats?.[key] ?? {};
}

// ===== STATE =====
let appState = {
    stats: null,
    riskFlags: [],
    actions: [],
    users: [],
    filteredRisks: [],
    filteredActions: [],
    filteredUsers: []
};
let isChatInitialized = false;
let uiMode = 'admin'; // 'admin' | 'client'
const CLIENT_ONLY_SECTIONS = ['investor-dashboard', 'portfolio', 'documents', 'integrations', 'investor-chat'];

// ===== LOGIN (CRYPTO) BACKDROP ANIMATION =====
let authCanvasState = {
    canvas: null,
    ctx: null,
    rafId: 0,
    running: false,
    dpr: 1,
    w: 0,
    h: 0,
    particles: [],
    lastT: 0,
    reducedMotion: false,
};

function prefersReducedMotion() {
    return typeof window !== 'undefined'
        && window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isLoginVisible() {
    const el = document.getElementById('login-screen');
    return Boolean(el && !el.classList.contains('auth-hidden'));
}

function initAuthBackdrop() {
    const canvas = document.getElementById('auth-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    authCanvasState.canvas = canvas;
    authCanvasState.ctx = ctx;
    authCanvasState.reducedMotion = prefersReducedMotion();

    window.addEventListener('resize', resizeAuthBackdrop, { passive: true });
    resizeAuthBackdrop();
    seedAuthParticles();

    if (isLoginVisible()) startAuthBackdrop();
}

function resizeAuthBackdrop() {
    const { canvas } = authCanvasState;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    authCanvasState.dpr = dpr;
    authCanvasState.w = Math.max(1, Math.floor(rect.width));
    authCanvasState.h = Math.max(1, Math.floor(rect.height));

    canvas.width = Math.floor(authCanvasState.w * dpr);
    canvas.height = Math.floor(authCanvasState.h * dpr);
}

function seedAuthParticles() {
    const { w, h } = authCanvasState;
    if (!w || !h) return;

    const area = w * h;
    // Dense "blockchain graph" nodes (no coins).
    const nodeCount = Math.round(clamp(area / 26000, 18, 46));

    const nodes = Array.from({ length: nodeCount }).map(() => ({
        kind: 'node',
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        r: 2.8 + Math.random() * 3.2,
        hue: 185 + Math.random() * 18,
        alpha: 0.62 + Math.random() * 0.28,
    }));
    authCanvasState.particles = nodes;
}

function startAuthBackdrop() {
    if (authCanvasState.running) return;
    authCanvasState.running = true;
    authCanvasState.lastT = performance.now();
    authCanvasState.rafId = requestAnimationFrame(tickAuthBackdrop);
}

function stopAuthBackdrop() {
    authCanvasState.running = false;
    if (authCanvasState.rafId) cancelAnimationFrame(authCanvasState.rafId);
    authCanvasState.rafId = 0;
}

function tickAuthBackdrop(t) {
    if (!authCanvasState.running) return;

    if (!isLoginVisible()) {
        stopAuthBackdrop();
        return;
    }

    const dt = Math.min(40, Math.max(0, t - (authCanvasState.lastT || t)));
    authCanvasState.lastT = t;

    drawAuthBackdrop(dt);

    if (authCanvasState.reducedMotion) {
        stopAuthBackdrop();
        return;
    }

    authCanvasState.rafId = requestAnimationFrame(tickAuthBackdrop);
}

function drawAuthBackdrop(dtMs) {
    const { ctx, w, h, dpr, particles } = authCanvasState;
    if (!ctx || !w || !h) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const dt = dtMs;
    const nodes = particles.filter(p => p.kind === 'node');

    for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        const pad = 30;
        if (p.x < -pad) p.x = w + pad;
        if (p.x > w + pad) p.x = -pad;
        if (p.y < -pad) p.y = h + pad;
        if (p.y > h + pad) p.y = -pad;
    }

    const vg = ctx.createRadialGradient(
        w * 0.35, h * 0.25, 10,
        w * 0.5, h * 0.4, Math.max(w, h) * 0.8
    );
    vg.addColorStop(0, 'rgba(20, 241, 149, 0.08)');
    vg.addColorStop(0.45, 'rgba(34, 211, 238, 0.06)');
    vg.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);

    const maxDist = Math.max(170, Math.min(300, Math.min(w, h) * 0.30));
    ctx.lineWidth = 3.5;
    for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
            const b = nodes[j];
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const d = Math.hypot(dx, dy);
            if (d > maxDist) continue;
            const k = 1 - d / maxDist;
            // Darker + bolder edges (still fades with distance).
            ctx.strokeStyle = `rgba(28, 120, 150, ${0.26 * k})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }
    }

    for (const n of nodes) {
        // Bigger nodes with a soft glow ring so the graph reads clearly.
        const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 3.2);
        glow.addColorStop(0, `hsla(${n.hue} 96% 72% / ${Math.min(1, n.alpha + 0.10)})`);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 3.1, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `hsla(${n.hue} 96% 74% / ${n.alpha})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ===== LIST PAGINATION (Users / Risks / Actions) =====
const listPagination = {
    risks: { page: 1, pageSize: 10 },
    actions: { page: 1, pageSize: 10 },
    users: { page: 1, pageSize: 10 },
};

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

function getPaged(items, key) {
    const cfg = listPagination[key];
    const total = Array.isArray(items) ? items.length : 0;
    const pageSize = clamp(Number(cfg.pageSize) || 10, 5, 100);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = clamp(Number(cfg.page) || 1, 1, totalPages);
    cfg.page = page;
    cfg.pageSize = pageSize;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return { page, pageSize, total, totalPages, items: (items || []).slice(start, end) };
}

function setListPage(key, page) {
    if (!listPagination[key]) return;
    listPagination[key].page = page;
    if (key === 'risks') renderRiskFlags();
    else if (key === 'actions') renderActions();
    else if (key === 'users') renderUsers();
}

function setListPageSize(key, pageSize) {
    if (!listPagination[key]) return;
    listPagination[key].pageSize = pageSize;
    listPagination[key].page = 1;
    setListPage(key, 1);
}

function resetListPage(key) {
    if (!listPagination[key]) return;
    listPagination[key].page = 1;
}

function renderListPagination({ key, mountId, total, page, totalPages, pageSize }) {
    const mount = document.getElementById(mountId);
    if (!mount) return;
    if (!total) {
        mount.innerHTML = '';
        return;
    }

    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);

    const sizeOptions = [10, 25, 50, 100];
    mount.innerHTML = `
        <div class="list-pagination-inner">
            <div class="list-pagination-info">
                Showing <strong>${start}-${end}</strong> of <strong>${total}</strong>
            </div>
            <div class="list-pagination-controls">
                <button class="list-pagination-btn" type="button"
                    onclick="setListPage('${key}', 1)" ${page <= 1 ? 'disabled' : ''}>First</button>
                <button class="list-pagination-btn" type="button"
                    onclick="setListPage('${key}', ${page - 1})" ${page <= 1 ? 'disabled' : ''}>← Prev</button>
                <span class="list-pagination-page">Page <strong>${page}</strong> / ${totalPages}</span>
                <button class="list-pagination-btn" type="button"
                    onclick="setListPage('${key}', ${page + 1})" ${page >= totalPages ? 'disabled' : ''}>Next →</button>
                <button class="list-pagination-btn" type="button"
                    onclick="setListPage('${key}', ${totalPages})" ${page >= totalPages ? 'disabled' : ''}>Last</button>
                <label class="list-pagination-size">
                    <span>Rows</span>
                    <select class="list-pagination-select" onchange="setListPageSize('${key}', this.value)">
                        ${sizeOptions
                            .map((n) => `<option value="${n}" ${Number(pageSize) === n ? 'selected' : ''}>${n}</option>`)
                            .join('')}
                    </select>
                </label>
            </div>
        </div>
    `;
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Demo Dashboard loading...');

    setupAuth();
    setupClientAuth();
    setupNavigation();
    setupFilters();
    setupChatInterface();
    setupInvestorChatInterface();
    setupWorkflowTabs();
    setupResetAllDemoButton();
    initAuthBackdrop();

    if (isClientAuthenticated()) {
        showClientApp();
        renderInvestorDashboard();
    } else if (isAuthenticated()) {
        showApp();
        await initializeApp();
    } else {
        showLogin();
    }
});

function getAuthToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY) || '';
}

function isAuthenticated() {
    return Boolean(getAuthToken());
}

function showLogin(errorMessage = '') {
    document.getElementById('login-screen')?.classList.remove('auth-hidden');
    document.getElementById('app-shell')?.classList.add('app-hidden');
    const resetBtn = document.getElementById('reset-all-demo-btn');
    if (resetBtn) resetBtn.style.display = 'none';
    const errorEl = document.getElementById('login-error');
    if (errorEl) errorEl.textContent = errorMessage;
    setLoginMode('admin');
    if (authCanvasState.canvas) startAuthBackdrop();
}

function showApp() {
    uiMode = 'admin';
    document.getElementById('login-screen')?.classList.add('auth-hidden');
    document.getElementById('app-shell')?.classList.remove('app-hidden');
    stopAuthBackdrop();

    // Restore admin navigation visibility.
    document.querySelectorAll('.nav-item').forEach((item) => {
        if (CLIENT_ONLY_SECTIONS.includes(item.dataset.section)) item.style.display = 'none';
        else item.style.display = '';
    });

    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    document.getElementById('overview')?.classList.add('active');

    // Ensure header widgets are visible on default admin landing (Overview).
    const statsSection = document.getElementById('stats-section');
    const healthStatus = document.querySelector('.health-status');
    if (statsSection) statsSection.style.display = '';
    if (healthStatus) healthStatus.style.display = '';

    document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
    document.querySelector('.nav-item[data-section="overview"]')?.classList.add('active');

    const resetBtn = document.getElementById('reset-all-demo-btn');
    if (resetBtn) resetBtn.style.display = '';
}

function clearSession() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
}

function setupAuth() {
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('logout-btn');

    loginForm?.addEventListener('submit', handleLogin);
    logoutBtn?.addEventListener('click', handleLogout);
}

async function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById('login-email')?.value.trim() || '';
    const password = document.getElementById('login-password')?.value || '';
    const errorEl = document.getElementById('login-error');
    const submitBtn = event.currentTarget.querySelector('button[type="submit"]');

    if (errorEl) errorEl.textContent = '';
    if (submitBtn) submitBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        if (!response.ok || !data.success || !data.token) {
            throw new Error(data.error || 'Login failed');
        }

        localStorage.setItem(AUTH_TOKEN_KEY, data.token);
        showApp();
        await initializeApp();
    } catch (error) {
        if (errorEl) errorEl.textContent = error.message || 'Login failed';
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

function handleLogout() {
    localStorage.removeItem(CLIENT_AUTH_TOKEN_KEY);
    clearSession();
    showLogin();
}

function getClientAuthToken() {
    return localStorage.getItem(CLIENT_AUTH_TOKEN_KEY) || '';
}

function isClientAuthenticated() {
    return Boolean(getClientAuthToken());
}

function setLoginMode(mode) {
    const adminBtn = document.getElementById('login-as-admin');
    const clientBtn = document.getElementById('login-as-client');
    const adminForm = document.getElementById('login-form');
    const clientForm = document.getElementById('client-login-form');
    const clientErrorEl = document.getElementById('client-login-error');

    if (!adminBtn || !clientBtn || !adminForm || !clientForm) return;

    if (clientErrorEl) clientErrorEl.textContent = '';

    if (mode === 'client') {
        adminBtn.classList.remove('active');
        clientBtn.classList.add('active');
        adminForm.style.display = 'none';
        clientForm.style.display = '';
        clientBtn.setAttribute('aria-selected', 'true');
        adminBtn.setAttribute('aria-selected', 'false');
    } else {
        clientBtn.classList.remove('active');
        adminBtn.classList.add('active');
        clientForm.style.display = 'none';
        adminForm.style.display = '';
        adminBtn.setAttribute('aria-selected', 'true');
        clientBtn.setAttribute('aria-selected', 'false');
    }
}

function showClientApp() {
    uiMode = 'client';
    document.getElementById('login-screen')?.classList.add('auth-hidden');
    document.getElementById('app-shell')?.classList.remove('app-hidden');
    stopAuthBackdrop();

    // Client demo mode does not load backend dashboard stats/health.
    // Remove the initial "Initializing..." UI so it doesn't look stuck.
    const indicator = document.getElementById('status-indicator');
    const text = document.getElementById('status-text');
    indicator?.classList.remove('loading');
    indicator?.classList.add('healthy');
    if (text) text.textContent = 'Investor Portal Ready';

    // Hide top header widgets (stats grid + health banner) in client mode.
    hideTopHeaderWidgets();

    // Show only investor portal nav items.
    document.querySelectorAll('.nav-item').forEach((item) => {
        if (CLIENT_ONLY_SECTIONS.includes(item.dataset.section)) item.style.display = '';
        else item.style.display = 'none';
    });

    // Activate default investor dashboard.
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    document.getElementById('investor-dashboard')?.classList.add('active');

    document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
    document.querySelector('.nav-item[data-section="investor-dashboard"]')?.classList.add('active');

    const resetBtn = document.getElementById('reset-all-demo-btn');
    if (resetBtn) resetBtn.style.display = '';
}

function setupClientAuth() {
    const clientForm = document.getElementById('client-login-form');
    const clientErrorEl = document.getElementById('client-login-error');
    const loginAsAdminBtn = document.getElementById('login-as-admin');
    const loginAsClientBtn = document.getElementById('login-as-client');

    loginAsAdminBtn?.addEventListener('click', () => setLoginMode('admin'));
    loginAsClientBtn?.addEventListener('click', () => setLoginMode('client'));

    clientForm?.addEventListener('submit', (event) => {
        event.preventDefault();
        if (clientErrorEl) clientErrorEl.textContent = '';

        const email = document.getElementById('client-login-email')?.value.trim() || '';
        const password = document.getElementById('client-login-password')?.value || '';

        // Demo-only client auth (no backend).
        if (email === 'client@demo.com' && password === 'demo') {
            localStorage.setItem(CLIENT_AUTH_TOKEN_KEY, String(Math.random()).slice(2));
            setLoginMode('client');
            showClientApp();
            renderInvestorDashboard();
        } else {
            if (clientErrorEl) clientErrorEl.textContent = 'Invalid investor credentials. Use client@demo.com / demo.';
        }
    });
}

async function initializeApp() {
    await loadDashboardData();
    renderOverview();
    updateHealthStatus();
}

async function apiFetch(url, options = {}) {
    const headers = {
        ...(options.headers || {})
    };

    const token = getAuthToken();
    if (token) {
        headers['X-Auth-Token'] = token;
    }

    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
        clearSession();
        showLogin('Your session has ended. Please sign in again.');
        throw new Error('Unauthorized');
    }

    return response;
}

// ===== NAVIGATION =====
function setupNavigation() {
    function applyHeaderVisibilityForSection(section) {
        const statsSection = document.getElementById('stats-section');
        const healthStatus = document.querySelector('.health-status');

        // Client mode: keep header widgets hidden for a cleaner demo experience.
        if (uiMode === 'client') {
            if (statsSection) statsSection.style.display = 'none';
            if (healthStatus) healthStatus.style.display = 'none';
            return;
        }

        // Hide top header widgets only on the Users screen (cleaner UX for profile browsing).
        if (section === 'users') {
            if (statsSection) statsSection.style.display = 'none';
            if (healthStatus) healthStatus.style.display = 'none';
        } else {
            if (statsSection) statsSection.style.display = '';
            if (healthStatus) healthStatus.style.display = '';
        }
    }

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            
            item.classList.add('active');
            const section = item.dataset.section;
            document.getElementById(section).classList.add('active');

            applyHeaderVisibilityForSection(section);
            
            // Render section content
            if (section === 'overview') renderOverview();
            else if (section === 'crm-pipeline') renderCrmPipeline();
            else if (section === 'marketing') renderMarketing();
            else if (section === 'ops-integrations') renderOpsIntegrations();
            else if (section === 'risks') renderRiskFlags();
            else if (section === 'actions') {
                renderActions();
                renderWorkflowRules();
            }
            else if (section === 'users') renderUsers();
            else if (section === 'investor-dashboard') renderInvestorDashboard();
            else if (section === 'portfolio') renderPortfolio();
            else if (section === 'documents') renderDocuments();
            else if (section === 'integrations') renderIntegrations();
            else if (section === 'investor-chat') renderInvestorChat();
            else if (section === 'chat') renderChat();
        });
    });
}

function renderIntegrations() {
    // Client-only panel, but harmless in admin too.
    hideTopHeaderWidgets();
    renderConnectorSyncLog();
    renderConnectorsDemo();
}

// Render chat panel when switched to
function renderChat() {
    // Chat interface is already rendered in HTML, just set up event listeners
    const chatInput = document.getElementById('chat-input');
    if (chatInput && chatInput.value === '') {
        chatInput.focus();
    }
}

// ===== DATA LOADING =====
async function loadDashboardData() {
    try {
        // Avoid leaving widgets in their initial "loading" state forever.
        appState.stats = appState.stats || {
            total_users: 0,
            total_risk_flags: 0,
            total_actions: 0,
            total_recovery_potential: 0,
            avg_recovery_value_per_action: 0,
            user_status_breakdown: {},
            risk_severity_breakdown: {},
            action_status_breakdown: {},
        };
        appState.riskFlags = appState.riskFlags || [];
        appState.filteredRisks = appState.filteredRisks || appState.riskFlags;
        appState.actions = appState.actions || [];
        appState.filteredActions = appState.filteredActions || appState.actions;
        renderStats();

        // Load all data in parallel
        const [statsRes, risksRes, actionsRes] = await Promise.all([
            apiFetch(`${API_BASE}/dashboard/stats`),
            apiFetch(`${API_BASE}/risk-flags?limit=1000`),
            apiFetch(`${API_BASE}/actions?limit=1000`),
        ]);
        
        appState.stats = await statsRes.json();
        const risksData = await risksRes.json();
        const actionsData = await actionsRes.json();
        
        appState.riskFlags = risksData.items || [];
        appState.filteredRisks = appState.riskFlags;
        
        appState.actions = actionsData.items || [];
        appState.filteredActions = appState.actions;
        
        // Load users (simulate from risk flags for now)
        loadUsers();
        
        console.log('✅ Data loaded successfully');
        renderStats();
        
    } catch (error) {
        console.error('❌ Error loading data:', error);
        appState.stats = appState.stats || {
            total_users: 0,
            total_risk_flags: 0,
            total_actions: 0,
            total_recovery_potential: 0,
            avg_recovery_value_per_action: 0,
            user_status_breakdown: {},
            risk_severity_breakdown: {},
            action_status_breakdown: {},
        };
        appState.riskFlags = [];
        appState.filteredRisks = [];
        appState.actions = [];
        appState.filteredActions = [];
        renderStats();
    }
}

function loadUsers() {
    // Demo: derive user ids from available events
    const uniqueUsers = new Set();
    appState.riskFlags.forEach(flag => uniqueUsers.add(flag.user_id));
    appState.actions.forEach(action => uniqueUsers.add(action.user_id));
    appState.users = Array.from(uniqueUsers);
    appState.filteredUsers = Array.from(uniqueUsers);
    resetListPage('users');
}

async function updateHealthStatus() {
    try {
        const response = await apiFetch(`${API_BASE}/health`);
        const data = await response.json();
        
        const indicator = document.getElementById('status-indicator');
        const text = document.getElementById('status-text');
        
        indicator.classList.remove('loading');
        indicator.classList.add('healthy');
        text.textContent = 'System Ready';
        
    } catch (error) {
        console.error('Health check failed:', error);
        const indicator = document.getElementById('status-indicator');
        const text = document.getElementById('status-text');
        indicator?.classList.remove('loading');
        indicator?.classList.add('healthy');
        if (text) text.textContent = 'System Ready (demo)';
    }
}

// ===== STATS RENDERING =====
function renderStats() {
    if (!appState.stats) return;
    
    const statsSection = document.getElementById('stats-section');
    
    const stats = [
        {
            title: brandStat('totalUsers').title || 'Total Investors',
            value: appState.stats.total_users,
            label: brandStat('totalUsers').label || 'Active + Inactive'
        },
        {
            title: brandStat('riskFlags').title || 'Alerts Detected',
            value: appState.stats.total_risk_flags,
            label: brandStat('riskFlags').label || 'Engagement Opportunities'
        },
        {
            title: brandStat('actions').title || 'Workflows Queued',
            value: appState.stats.total_actions,
            label: brandStat('actions').label || 'Pending Execution'
        },
        {
            title: brandStat('pipeline').title || 'Pipeline Value',
            value: appState.stats.total_recovery_potential,
            label: brandStat('pipeline').label || 'Estimated Total Value'
        }
    ];
    
    statsSection.innerHTML = stats.map(stat => `
        <div class="stat-card">
            <h3>${stat.title}</h3>
            <div class="value">${stat.value}</div>
            <div class="label">${stat.label}</div>
        </div>
    `).join('');
}

// ===== OVERVIEW RENDERING =====
function renderOverview() {
    showTopHeaderWidgets();
    renderUserStatusChart();
    renderSeverityChart();
    renderRecoveryMetrics();
    renderActionSummary();
}

function hideTopHeaderWidgets() {
    const statsSection = document.getElementById('stats-section');
    const healthStatus = document.querySelector('.health-status');
    if (statsSection) statsSection.style.display = 'none';
    if (healthStatus) healthStatus.style.display = 'none';
}

function showTopHeaderWidgets() {
    const statsSection = document.getElementById('stats-section');
    const healthStatus = document.querySelector('.health-status');
    if (statsSection) statsSection.style.display = '';
    if (healthStatus) healthStatus.style.display = '';
}

function renderUserStatusChart() {
    const container = document.getElementById('user-status-chart');
    const data = appState.stats?.user_status_breakdown || {};
    
    let html = '<div style="padding: 1rem;">';
    for (const [status, count] of Object.entries(data)) {
        const percentage = (count / appState.stats.total_users * 100).toFixed(1);
        html += `
            <div style="margin-bottom: 1.5rem;">
                <div style="display: grid; grid-template-columns: 150px 1fr 120px; gap: 1rem; align-items: center; margin-bottom: 0.7rem;">
                    <span style="text-transform: capitalize; font-weight: 600; color: var(--primary);">${status}</span>
                    <div style="height: 8px; background: var(--bg-tertiary); border-radius: 4px; overflow: hidden;">
                        <div style="height: 100%; width: ${percentage}%; background: var(--primary); border-radius: 4px; box-shadow: 0 0 8px rgba(0, 255, 65, 0.4);"></div>
                    </div>
                    <span style="text-align: right; font-weight: 600; color: var(--text-secondary);">${count} (${percentage}%)</span>
                </div>
            </div>
        `;
    }
    html += '</div>';
    container.innerHTML = html;
}

function renderSeverityChart() {
    const container = document.getElementById('severity-chart');
    const data = appState.stats?.risk_severity_breakdown || {};
    
    const severityOrder = ['critical', 'high', 'medium', 'low'];
    const colorMap = {
        critical: '#ff0040',
        high: '#ff006e',
        medium: '#00d9ff',
        low: '#00ff41'
    };
    
    let html = '<div style="padding: 1rem;">';
    for (const severity of severityOrder) {
        const count = data[severity] || 0;
        const total = appState.stats.total_risk_flags;
        const percentage = total > 0 ? (count / total * 100).toFixed(1) : 0;
        
        html += `
            <div style="margin-bottom: 1.5rem;">
                <div style="display: grid; grid-template-columns: 100px 1fr 120px; gap: 1rem; align-items: center; margin-bottom: 0.7rem;">
                    <span style="text-transform: capitalize; font-weight: 600; color: ${colorMap[severity]};">${severity}</span>
                    <div style="height: 8px; background: var(--bg-tertiary); border-radius: 4px; overflow: hidden;">
                        <div style="height: 100%; width: ${percentage}%; background: ${colorMap[severity]}; border-radius: 4px; box-shadow: 0 0 8px ${colorMap[severity]}40;"></div>
                    </div>
                    <span style="text-align: right; font-weight: 600; color: var(--text-secondary);">${count} alerts</span>
                </div>
            </div>
        `;
    }
    html += '</div>';
    container.innerHTML = html;
}

function renderRecoveryMetrics() {
    const potential = document.getElementById('recovery-potential');
    const avg = document.getElementById('avg-recovery');
    
    potential.textContent = appState.stats?.total_recovery_potential || '$0';
    avg.textContent = appState.stats?.avg_recovery_value_per_action || '$0';
}

function renderActionSummary() {
    const container = document.getElementById('action-summary');
    const data = appState.stats?.action_status_breakdown || {};
    
    const statusOrder = ['pending', 'approved', 'executed'];
    
    let html = '';
    for (const status of statusOrder) {
        const count = data[status] || 0;
        html += `
            <div class="action-summary-item">
                <span class="label">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
                <span class="count">${count}</span>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// ===== RISK FLAGS RENDERING =====
function renderRiskFlags() {
    showTopHeaderWidgets();
    const container = document.getElementById('risk-flags-list');
    const paginationMountId = 'risk-flags-pagination';
    
    if (appState.filteredRisks.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✅</div>No alerts found</div>';
        document.getElementById(paginationMountId).innerHTML = '';
        return;
    }
    
    const paged = getPaged(appState.filteredRisks, 'risks');
    container.innerHTML = paged.items.map(flag => `
        <div class="list-item">
            <div class="list-item-header">
                <div class="list-item-title">
                    ${getInsightIcon(flag.flag_type)} ${flag.flag_type.replace(/_/g, ' ')}
                </div>
                <span class="badge severity-${flag.severity}">${flag.severity}</span>
            </div>
            <div class="list-item-meta">
                <div><strong>User:</strong> ${flag.user_id}</div>
                <div><strong>Detected:</strong> ${new Date(flag.detected_at).toLocaleDateString()}</div>
            </div>
            <div class="list-item-description">
                ${flag.description}
            </div>
            <div class="list-item-footer">
                <button class="btn-primary" onclick="viewUserDetail('${flag.user_id}')">
                    View User Profile
                </button>
            </div>
        </div>
    `).join('');

    renderListPagination({
        key: 'risks',
        mountId: paginationMountId,
        total: paged.total,
        page: paged.page,
        totalPages: paged.totalPages,
        pageSize: paged.pageSize,
    });
}

// ===== ACTIONS RENDERING =====
function renderActions() {
    showTopHeaderWidgets();
    const container = document.getElementById('actions-list');
    const paginationMountId = 'actions-pagination';
    
    if (appState.filteredActions.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div>No workflows found</div>';
        document.getElementById(paginationMountId).innerHTML = '';
        return;
    }
    
    const paged = getPaged(appState.filteredActions, 'actions');
    container.innerHTML = paged.items.map(action => `
        <div class="list-item">
            <div class="list-item-header">
                <div class="list-item-title">${action.action_type.replace(/_/g, ' ')}</div>
                <div style="display: flex; gap: 0.5rem;">
                    <span class="badge priority-${action.priority}">${action.priority}</span>
                    <span class="badge status-${action.status}">${action.status}</span>
                </div>
            </div>
            <div class="list-item-meta">
                <div><strong>User:</strong> ${action.user_id}</div>
                <div><strong>Created:</strong> ${new Date(action.created_at).toLocaleDateString()}</div>
            </div>
            <div class="list-item-description">
                ${action.reason}
            </div>
            <div class="list-item-footer">
                <div class="list-item-value">${brandTerm('listItemValue', 'Impact')}: ${action.estimated_recovery_value}</div>
                <div class="button-group">
                    ${action.status === 'pending' ? `
                        <button class="btn-primary" onclick="approveAction('${action.action_id}')">Approve</button>
                        <button class="btn-secondary" onclick="executeAction('${action.action_id}')">Execute</button>
                        <button class="btn-secondary" onclick="previewWorkflowAction('${action.action_id}')">Preview</button>
                    ` : action.status === 'approved' ? `
                        <button class="btn-primary" onclick="executeAction('${action.action_id}')">Execute</button>
                        <button class="btn-secondary" onclick="previewWorkflowAction('${action.action_id}')">Preview</button>
                    ` : `
                        <button class="btn-secondary" disabled>${action.status}</button>
                    `}
                    <button class="btn-secondary" onclick="viewUserDetail('${action.user_id}')">View Investor</button>
                </div>
            </div>
        </div>
    `).join('');

    renderListPagination({
        key: 'actions',
        mountId: paginationMountId,
        total: paged.total,
        page: paged.page,
        totalPages: paged.totalPages,
        pageSize: paged.pageSize,
    });
}

// ===== CRM PIPELINE (Phase 3) =====
const CRM_PIPELINE_KEY = 'rud_crm_pipeline';
const CRM_STAGES = ['lead', 'qualified', 'onboarded', 'active', 'at_risk'];
const CRM_STAGE_LABELS = {
    lead: 'Lead',
    qualified: 'Qualified',
    onboarded: 'Onboarded',
    active: 'Active',
    at_risk: 'At Risk',
};

const CRM_SEED_LEADS = [
    { id: 'lead_apex_cap', name: 'Apex Capital Partners', email: 'contact@apexcap.demo', value: 250000, source: 'Referral', stage: 'lead', kind: 'lead' },
    { id: 'lead_northstar', name: 'Northstar Family Office', email: 'ops@northstar.demo', value: 180000, source: 'Conference', stage: 'lead', kind: 'lead' },
    { id: 'lead_blue_oak', name: 'Blue Oak Ventures', email: 'hello@blueoak.demo', value: 95000, source: 'Paid Ads', stage: 'qualified', kind: 'lead' },
];

function getCrmPipelineState() {
    try {
        const raw = localStorage.getItem(CRM_PIPELINE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && Array.isArray(parsed.cards)) return parsed;
    } catch (e) {
        // ignore
    }
    return { cards: [], initialized: false };
}

function setCrmPipelineState(state) {
    localStorage.setItem(CRM_PIPELINE_KEY, JSON.stringify(state || { cards: [] }));
}

async function ensureCrmPipelineInitialized() {
    const state = getCrmPipelineState();
    if (state.initialized && state.cards.length) return state;

    const cards = [...CRM_SEED_LEADS];
    try {
        const res = await apiFetch(`${API_BASE}/crm/investors`);
        const data = await res.json();
        if (res.ok && Array.isArray(data.items)) {
            data.items.forEach((inv) => {
                cards.push({
                    id: inv.id,
                    name: inv.name || inv.id,
                    email: inv.email || '',
                    value: Number(inv.value || 0),
                    source: inv.source || 'organic',
                    stage: inv.stage || 'qualified',
                    kind: inv.kind || 'investor',
                });
            });
        }
    } catch (e) {
        console.warn('CRM investor sync skipped:', e);
    }

    const next = { cards, initialized: true };
    setCrmPipelineState(next);
    return next;
}

function moveCrmCard(cardId, newStage) {
    if (!CRM_STAGES.includes(newStage)) return;
    const state = getCrmPipelineState();
    const card = state.cards.find((c) => c.id === cardId);
    if (!card) return;
    card.stage = newStage;
    setCrmPipelineState(state);
    renderCrmPipeline();
}

function resetCrmPipelineDemo() {
    if (!confirm('Reset CRM pipeline to demo seed + investors from database?')) return;
    localStorage.removeItem(CRM_PIPELINE_KEY);
    renderCrmPipeline();
}

async function renderCrmPipeline() {
    const board = document.getElementById('crm-pipeline-board');
    if (!board) return;

    board.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
    const state = await ensureCrmPipelineInitialized();

    board.innerHTML = CRM_STAGES.map((stage) => {
        const cards = state.cards.filter((c) => c.stage === stage);
        return `
            <div class="crm-column">
                <div class="crm-column-head">
                    <span class="crm-column-title">${CRM_STAGE_LABELS[stage]}</span>
                    <span class="crm-column-count">${cards.length}</span>
                </div>
                <div class="crm-cards">
                    ${cards.map((card) => `
                        <div class="crm-card">
                            <div class="crm-card-kind">${escapeHtml(card.kind === 'lead' ? 'Lead' : 'Investor')}</div>
                            <div class="crm-card-name">${escapeHtml(card.name)}</div>
                            <div class="crm-card-meta">
                                ${card.email ? `${escapeHtml(card.email)}<br>` : ''}
                                ${formatUSD(card.value)} · ${escapeHtml(card.source || '')}
                            </div>
                            <select class="crm-card-move" onchange="moveCrmCard(${JSON.stringify(card.id)}, this.value)" aria-label="Move stage">
                                ${CRM_STAGES.map((s) => `<option value="${s}" ${s === card.stage ? 'selected' : ''}>Move to ${CRM_STAGE_LABELS[s]}</option>`).join('')}
                            </select>
                        </div>
                    `).join('') || '<p class="portfolio-note" style="margin:0;">No cards</p>'}
                </div>
            </div>
        `;
    }).join('');
}

// ===== WORKFLOW BUILDER (Phase 3) =====
const WORKFLOW_RULES_KEY = 'rud_workflow_rules';

function getWorkflowRules() {
    try {
        const raw = localStorage.getItem(WORKFLOW_RULES_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (Array.isArray(parsed)) return parsed;
    } catch (e) {
        // ignore
    }
    return [];
}

function setWorkflowRules(rules) {
    localStorage.setItem(WORKFLOW_RULES_KEY, JSON.stringify(rules || []));
}

function setupWorkflowTabs() {
    document.querySelectorAll('.workflow-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.workflowTab;
            document.querySelectorAll('.workflow-tab').forEach((t) => {
                t.classList.toggle('active', t.dataset.workflowTab === target);
                t.setAttribute('aria-selected', t.dataset.workflowTab === target ? 'true' : 'false');
            });
            document.getElementById('workflow-queue-panel')?.classList.toggle('active', target === 'queue');
            document.getElementById('workflow-builder-panel')?.classList.toggle('active', target === 'builder');
            if (target === 'builder') renderWorkflowRules();
        });
    });
}

function saveWorkflowRule() {
    const name = document.getElementById('wf-rule-name')?.value.trim();
    const trigger = document.getElementById('wf-trigger')?.value;
    const action = document.getElementById('wf-action')?.value;
    const channel = document.getElementById('wf-channel')?.value;
    if (!name) {
        alert('Please enter a rule name.');
        return;
    }
    const rules = getWorkflowRules();
    rules.unshift({
        id: generateId('wf'),
        name,
        trigger,
        action,
        channel,
        enabled: true,
        createdAt: new Date().toISOString(),
    });
    setWorkflowRules(rules);
    document.getElementById('wf-rule-name').value = '';
    renderWorkflowRules();
    showSuccess('Workflow rule saved (demo)');
}

function renderWorkflowRules() {
    const list = document.getElementById('workflow-rules-list');
    if (!list) return;
    const rules = getWorkflowRules();
    if (!rules.length) {
        list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚡</div>No saved rules yet — create one above.</div>';
        return;
    }
    list.innerHTML = rules.map((rule) => `
        <div class="workflow-rule-card ${rule.enabled ? '' : 'disabled'}">
            <div>
                <div class="workflow-rule-title">${escapeHtml(rule.name)}</div>
                <div class="workflow-rule-meta">
                    <strong>When:</strong> ${escapeHtml(humanizeWorkflowKey(rule.trigger))}<br>
                    <strong>Then:</strong> ${escapeHtml(humanizeWorkflowKey(rule.action))}<br>
                    <strong>Via:</strong> ${escapeHtml(humanizeWorkflowChannel(rule.channel))}
                </div>
            </div>
            <div class="workflow-rule-actions">
                <button type="button" class="btn-secondary" onclick="toggleWorkflowRule('${rule.id}')">${rule.enabled ? 'Disable' : 'Enable'}</button>
                <button type="button" class="btn-secondary" onclick="testWorkflowRule('${rule.id}')">Test preview</button>
                <button type="button" class="btn-secondary" onclick="deleteWorkflowRule('${rule.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

function humanizeWorkflowKey(key) {
    return String(key || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanizeWorkflowChannel(channel) {
    const map = {
        email: 'Email (SendGrid)',
        salesforce: 'Salesforce',
        hubspot: 'HubSpot',
        zendesk: 'Zendesk',
        jira: 'Jira',
    };
    return map[channel] || channel;
}

function toggleWorkflowRule(ruleId) {
    const rules = getWorkflowRules().map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r));
    setWorkflowRules(rules);
    renderWorkflowRules();
}

function deleteWorkflowRule(ruleId) {
    if (!confirm('Delete this workflow rule?')) return;
    setWorkflowRules(getWorkflowRules().filter((r) => r.id !== ruleId));
    renderWorkflowRules();
}

function testWorkflowRuleFromForm() {
    const action = document.getElementById('wf-action')?.value || 'workflow_trigger';
    const trigger = document.getElementById('wf-trigger')?.value || 'manual';
    const name = document.getElementById('wf-rule-name')?.value.trim() || 'Workflow rule test';
    runWorkflowSimulatePreview({
        action_type: action,
        user_id: null,
        reason: `Demo test for rule "${name}" (trigger: ${trigger})`,
    });
}

function testWorkflowRule(ruleId) {
    const rule = getWorkflowRules().find((r) => r.id === ruleId);
    if (!rule) return;
    runWorkflowSimulatePreview({
        action_type: rule.action,
        user_id: null,
        reason: `Demo test: ${rule.name} — trigger ${rule.trigger} via ${rule.channel}`,
    });
}

async function previewWorkflowAction(actionId) {
    const action = appState.actions.find((a) => a.action_id === actionId);
    if (!action) return;
    await runWorkflowSimulatePreview({
        action_type: action.action_type,
        user_id: action.user_id,
        reason: action.reason || `Preview workflow ${action.action_type}`,
    });
}

async function runWorkflowSimulatePreview(act) {
    try {
        const res = await apiFetch(`${API_BASE}/chat/simulate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action_type: act.action_type,
                user_id: act.user_id || null,
                reason: act.reason || null,
            }),
        });
        const j = await res.json();
        if (!res.ok || !j.success) {
            throw new Error(j.detail || j.message || 'Simulate failed');
        }
        openSimulateActionModal({ mocks: j.mocks, logId: j.log_id, act });
    } catch (e) {
        console.error(e);
        showError(e.message || 'Could not open workflow preview');
    }
}

function buildActivityTimelineHtml(data) {
    const user = data.user || {};
    const events = [];

    if (user.first_seen_at) {
        events.push({
            at: new Date(user.first_seen_at),
            title: 'Account created',
            desc: `Investor onboarded to platform (${user.acquisition_source || 'unknown source'}).`,
            icon: 'account',
        });
    }
    if (user.last_activity_at) {
        events.push({
            at: new Date(user.last_activity_at),
            title: 'Last activity',
            desc: `Most recent engagement recorded for ${user.name || user.id}.`,
            icon: 'activity',
        });
    }

    (data.tickets || []).forEach((t) => {
        if (!t.created_at) return;
        events.push({
            at: new Date(t.created_at),
            title: `Support: ${t.subject || t.category || 'Ticket'}`,
            desc: `${t.category || 'general'} · ${t.status || 'open'} · priority ${t.priority || 'n/a'}`,
            icon: 'ticket',
        });
    });

    (data.risk_flags || []).forEach((f) => {
        const at = f.detected_at ? new Date(f.detected_at) : new Date(Date.now() - (f.days_since_detection || 0) * 86400000);
        events.push({
            at,
            title: `Alert: ${(f.type || 'flag').replace(/_/g, ' ')}`,
            desc: `${f.severity || 'medium'} severity — ${f.description || ''}`,
            icon: 'alert',
        });
    });

    (data.recovery_actions || []).forEach((a) => {
        const at = a.executed_at ? new Date(a.executed_at) : (a.created_at ? new Date(a.created_at) : new Date());
        events.push({
            at,
            title: `Workflow: ${(a.type || 'action').replace(/_/g, ' ')}`,
            desc: `${a.status || 'pending'} · ${brandTerm('recoveryValue', 'Impact')}: $${Number(a.recovery_value || 0).toLocaleString()}${a.reason ? ` — ${a.reason}` : ''}`,
            icon: 'workflow',
        });
    });

    events.sort((a, b) => b.at - a.at);
    const top = events.slice(0, 12);
    if (!top.length) {
        return '<p class="portfolio-note">No activity recorded yet.</p>';
    }

    return `
        <div class="activity-timeline">
            ${top.map((ev) => `
                <div class="activity-timeline-item">
                    <div class="activity-timeline-time">${escapeHtml(ev.at.toLocaleString())}</div>
                    <div class="activity-timeline-title">${escapeHtml(ev.title)}</div>
                    <div class="activity-timeline-desc">${escapeHtml(ev.desc)}</div>
                </div>
            `).join('')}
        </div>
    `;
}

// ===== MARKETING & LEAD GEN (Phase 4) =====
const MARKETING_LEADS_KEY = 'rud_marketing_leads';
const MARKETING_SEED_LEADS = [
    { id: 'mkt_seed_1', name: 'Harbor Wealth LLC', email: 'partners@harborwealth.demo', company: 'Harbor Wealth LLC', aum: 1200000, source: 'Google Ads', status: 'new', crmPushed: false, createdAt: '2026-03-28T10:00:00Z' },
    { id: 'mkt_seed_2', name: 'Maya Chen', email: 'maya.chen@oakline.demo', company: 'Oakline Capital', aum: 750000, source: 'Conference', status: 'contacted', crmPushed: true, createdAt: '2026-03-25T14:30:00Z' },
    { id: 'mkt_seed_3', name: 'Sterling Family Office', email: 'info@sterlingfo.demo', company: 'Sterling FO', aum: 2100000, source: 'Referral', status: 'qualified', crmPushed: true, createdAt: '2026-03-20T09:15:00Z' },
];

const MARKETING_CAMPAIGNS = [
    { id: 'cmp_search', name: 'Google Search — HNW Investors', channel: 'Google Ads', status: 'active', spend: 12400, leads: 38, conversions: 11, roi: 2.4 },
    { id: 'cmp_li', name: 'LinkedIn — Family Offices', channel: 'LinkedIn', status: 'active', spend: 8200, leads: 22, conversions: 6, roi: 1.9 },
    { id: 'cmp_email', name: 'Q1 Nurture Sequence', channel: 'Mailchimp', status: 'paused', spend: 1200, leads: 54, conversions: 9, roi: 3.1 },
    { id: 'cmp_seo', name: 'Organic Content Hub', channel: 'SEO', status: 'active', spend: 3500, leads: 41, conversions: 14, roi: 4.2 },
];

const MARKETING_SEO = {
    score: 78,
    traffic: 18420,
    trafficChange: 12.4,
    keywordsTop3: 24,
    keywordsTop10: 89,
    bounceRate: 38.2,
    avgPosition: 14.6,
    keywords: [
        { term: 'family office portfolio platform', position: 3, volume: 1200, change: 2 },
        { term: 'investor portal software', position: 7, volume: 2400, change: -1 },
        { term: 'private wealth reporting', position: 11, volume: 1800, change: 4 },
        { term: 'alternative investment dashboard', position: 9, volume: 900, change: 1 },
        { term: 'investor transparency platform', position: 5, volume: 650, change: 3 },
    ],
};

function getMarketingLeads() {
    try {
        const raw = localStorage.getItem(MARKETING_LEADS_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch (e) {
        // ignore
    }
    localStorage.setItem(MARKETING_LEADS_KEY, JSON.stringify(MARKETING_SEED_LEADS));
    return [...MARKETING_SEED_LEADS];
}

function setMarketingLeads(leads) {
    localStorage.setItem(MARKETING_LEADS_KEY, JSON.stringify(leads || []));
}

function resetMarketingDemo() {
    if (!confirm('Reset marketing leads to demo seed data?')) return;
    localStorage.removeItem(MARKETING_LEADS_KEY);
    renderMarketing();
}

function submitMarketingLead(event) {
    event.preventDefault();
    const name = document.getElementById('mkt-lead-name')?.value.trim();
    const email = document.getElementById('mkt-lead-email')?.value.trim();
    const company = document.getElementById('mkt-lead-company')?.value.trim() || name;
    const aum = Number(document.getElementById('mkt-lead-aum')?.value || 0);
    const source = document.getElementById('mkt-lead-source')?.value || 'Website';
    if (!name || !email) return;

    const leads = getMarketingLeads();
    leads.unshift({
        id: generateId('mkt'),
        name,
        email,
        company,
        aum,
        source,
        status: 'new',
        crmPushed: false,
        createdAt: new Date().toISOString(),
    });
    setMarketingLeads(leads);
    event.target.reset();
    renderMarketing();
    showSuccess('Lead captured (demo)');
}

function pushMarketingLeadToCrm(leadId) {
    const leads = getMarketingLeads();
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    if (lead.crmPushed) {
        alert('This lead is already in the CRM pipeline.');
        return;
    }

    const crm = getCrmPipelineState();
    const exists = crm.cards.some((c) => c.id === `mkt_${leadId}` || c.email === lead.email);
    if (!exists) {
        crm.cards.unshift({
            id: `mkt_${leadId}`,
            name: lead.company || lead.name,
            email: lead.email,
            value: Number(lead.aum || 0),
            source: lead.source || 'Marketing',
            stage: lead.status === 'qualified' ? 'qualified' : 'lead',
            kind: 'lead',
        });
        crm.initialized = true;
        setCrmPipelineState(crm);
    }

    lead.crmPushed = true;
    lead.status = lead.status === 'new' ? 'contacted' : lead.status;
    setMarketingLeads(leads);
    renderMarketing();
    showSuccess('Lead pushed to CRM Pipeline (demo)');
}

function renderMarketing() {
    hideTopHeaderWidgets();
    const kpiEl = document.getElementById('marketing-kpis');
    const leadsEl = document.getElementById('marketing-leads-list');
    const seoEl = document.getElementById('marketing-seo-panel');
    const campaignsEl = document.getElementById('marketing-campaigns-grid');
    if (!kpiEl || !leadsEl || !seoEl || !campaignsEl) return;

    const leads = getMarketingLeads();
    const totalLeads = leads.length;
    const pushed = leads.filter((l) => l.crmPushed).length;
    const totalAum = leads.reduce((s, l) => s + Number(l.aum || 0), 0);
    const convRate = totalLeads ? ((pushed / totalLeads) * 100).toFixed(1) : '0.0';

    kpiEl.innerHTML = `
        <div class="portfolio-summary-item investor-kpi-card">
            <div class="portfolio-summary-label">Leads captured</div>
            <div class="portfolio-summary-value">${totalLeads}</div>
        </div>
        <div class="portfolio-summary-item investor-kpi-card">
            <div class="portfolio-summary-label">Pipeline AUM (demo)</div>
            <div class="portfolio-summary-value">${formatUSD(totalAum)}</div>
        </div>
        <div class="portfolio-summary-item investor-kpi-card">
            <div class="portfolio-summary-label">CRM handoff rate</div>
            <div class="portfolio-summary-value investor-kpi-pos">${convRate}%</div>
        </div>
        <div class="portfolio-summary-item investor-kpi-card">
            <div class="portfolio-summary-label">SEO health score</div>
            <div class="portfolio-summary-value">${MARKETING_SEO.score}/100</div>
        </div>
    `;

    leadsEl.innerHTML = leads.length ? leads.map((lead) => `
        <div class="marketing-lead-card">
            <div class="marketing-lead-head">
                <strong>${escapeHtml(lead.name)}</strong>
                <span class="badge status-${lead.status === 'qualified' ? 'approved' : lead.status === 'contacted' ? 'pending' : 'executed'}">${escapeHtml(lead.status)}</span>
            </div>
            <div class="marketing-lead-meta">${escapeHtml(lead.email)} · ${escapeHtml(lead.source)} · ${formatUSD(lead.aum)}</div>
            <div class="marketing-lead-actions">
                ${lead.crmPushed
                    ? '<span class="marketing-pushed-tag">In CRM</span>'
                    : `<button type="button" class="btn-primary" onclick="pushMarketingLeadToCrm(${JSON.stringify(lead.id)})">Push to CRM</button>`}
            </div>
        </div>
    `).join('') : '<p class="portfolio-note">No leads yet — use the form to capture one.</p>';

    seoEl.innerHTML = `
        <div class="marketing-seo-stats">
            <div><span class="marketing-seo-label">Monthly organic traffic</span><strong>${MARKETING_SEO.traffic.toLocaleString()}</strong> <span class="investor-kpi-pos">+${MARKETING_SEO.trafficChange}%</span></div>
            <div><span class="marketing-seo-label">Keywords in top 3</span><strong>${MARKETING_SEO.keywordsTop3}</strong></div>
            <div><span class="marketing-seo-label">Keywords in top 10</span><strong>${MARKETING_SEO.keywordsTop10}</strong></div>
            <div><span class="marketing-seo-label">Avg. position</span><strong>${MARKETING_SEO.avgPosition}</strong></div>
        </div>
        <table class="portfolio-table marketing-seo-table">
            <thead><tr><th>Keyword</th><th>Pos.</th><th>Volume</th><th>Δ</th></tr></thead>
            <tbody>
                ${MARKETING_SEO.keywords.map((k) => `
                    <tr>
                        <td>${escapeHtml(k.term)}</td>
                        <td>${k.position}</td>
                        <td>${k.volume.toLocaleString()}</td>
                        <td class="${k.change >= 0 ? 'portfolio-change pos' : 'portfolio-change neg'}">${k.change >= 0 ? '+' : ''}${k.change}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    campaignsEl.innerHTML = MARKETING_CAMPAIGNS.map((c) => `
        <div class="marketing-campaign-card">
            <div class="marketing-campaign-head">
                <strong>${escapeHtml(c.name)}</strong>
                <span class="badge ${c.status === 'active' ? 'status-approved' : 'status-pending'}">${escapeHtml(c.status)}</span>
            </div>
            <div class="marketing-campaign-channel">${escapeHtml(c.channel)}</div>
            <div class="marketing-campaign-metrics">
                <div><span>Spend</span><strong>${formatUSD(c.spend)}</strong></div>
                <div><span>Leads</span><strong>${c.leads}</strong></div>
                <div><span>Conv.</span><strong>${c.conversions}</strong></div>
                <div><span>ROI</span><strong class="investor-kpi-pos">${c.roi}x</strong></div>
            </div>
        </div>
    `).join('');
}

// ===== OPS INTEGRATION HUB (Phase 4) =====
const OPS_CONNECTOR_STATE_KEY = 'rud_ops_connectors';
const OPS_CONNECTOR_SYNC_LOG_KEY = 'rud_ops_connector_sync_log';
const OPS_CONNECTORS = [
    { id: 'salesforce', name: 'Salesforce', description: 'CRM accounts, opportunities, and investor stages.', placeholder: 'Salesforce access token (demo)' },
    { id: 'hubspot', name: 'HubSpot', description: 'Marketing contacts, lists, and nurture workflows.', placeholder: 'HubSpot private app token (demo)' },
    { id: 'google_ads', name: 'Google Ads', description: 'Campaign spend, clicks, and conversion imports.', placeholder: 'Google Ads developer token (demo)' },
    { id: 'mailchimp', name: 'Mailchimp', description: 'Email campaigns and audience segments.', placeholder: 'Mailchimp API key (demo)' },
    { id: 'zendesk', name: 'Zendesk', description: 'Support tickets and SLA metrics.', placeholder: 'Zendesk API token (demo)' },
    { id: 'slack', name: 'Slack', description: 'Ops alerts and workflow notifications.', placeholder: 'Slack bot token (demo)' },
];

function getOpsConnectorSyncLog() {
    try {
        const raw = localStorage.getItem(OPS_CONNECTOR_SYNC_LOG_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (Array.isArray(parsed)) return parsed;
    } catch (e) { /* ignore */ }
    const empty = [];
    localStorage.setItem(OPS_CONNECTOR_SYNC_LOG_KEY, JSON.stringify(empty));
    return empty;
}

function setOpsConnectorSyncLog(log) {
    localStorage.setItem(OPS_CONNECTOR_SYNC_LOG_KEY, JSON.stringify(log || []));
}

function appendOpsConnectorSyncLogItem(item) {
    const log = getOpsConnectorSyncLog();
    log.push(item);
    setOpsConnectorSyncLog(log.slice(Math.max(0, log.length - 50)));
}

function clearOpsConnectorSyncLog() {
    setOpsConnectorSyncLog([]);
    renderOpsConnectorSyncLog();
}

function getOpsConnectorState() {
    try {
        const raw = localStorage.getItem(OPS_CONNECTOR_STATE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && typeof parsed === 'object') return parsed;
    } catch (e) { /* ignore */ }
    const empty = {};
    localStorage.setItem(OPS_CONNECTOR_STATE_KEY, JSON.stringify(empty));
    return empty;
}

function setOpsConnectorState(state) {
    localStorage.setItem(OPS_CONNECTOR_STATE_KEY, JSON.stringify(state || {}));
}

function renderOpsConnectorSyncLog() {
    const mount = document.getElementById('ops-connector-sync-log');
    const subtitle = document.getElementById('ops-connector-sync-subtitle');
    if (!mount) return;

    const log = getOpsConnectorSyncLog().slice().reverse();
    if (!log.length) {
        mount.innerHTML = '<div class="connector-sync-item"><div class="connector-sync-item-body">No sync runs yet. Connect a provider and run a demo sync.</div></div>';
        if (subtitle) subtitle.textContent = 'Connect a provider, then run a demo sync.';
        return;
    }

    if (subtitle) {
        const last = log[0]?.time ? new Date(log[0].time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        subtitle.textContent = last ? `Last sync: ${last}` : 'Sync runs recorded below.';
    }

    mount.innerHTML = log.map((item) => {
        const t = item.time ? new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        return `
            <div class="connector-sync-item">
                <div class="connector-sync-item-top">
                    <div class="connector-sync-item-title">${escapeHtml(item.title || 'Sync run')}</div>
                    <div class="connector-sync-item-meta">${escapeHtml(t)}</div>
                </div>
                <div class="connector-sync-item-body">${escapeHtml(item.body || '')}</div>
            </div>
        `;
    }).join('');
}

function runOpsConnectorSync(connectorId) {
    const connector = OPS_CONNECTORS.find((c) => c.id === connectorId);
    if (!connector) return;
    const state = getOpsConnectorState();
    const s = state[connectorId] || { connected: false };
    if (!s.connected) {
        alert(`Please connect ${connector.name} first (demo).`);
        return;
    }

    const now = new Date().toISOString();
    const bodies = {
        salesforce: `Synced ${14 + Math.floor(Math.random() * 20)} accounts and ${3 + Math.floor(Math.random() * 8)} opportunities into CRM Pipeline view (demo).`,
        hubspot: `Imported ${22 + Math.floor(Math.random() * 30)} contacts and ${2 + Math.floor(Math.random() * 5)} marketing lists (demo).`,
        google_ads: `Pulled ${4 + Math.floor(Math.random() * 6)} campaigns, ${1200 + Math.floor(Math.random() * 4000)} clicks, and ${18 + Math.floor(Math.random() * 25)} conversions into Marketing dashboard (demo).`,
        mailchimp: `Updated ${3 + Math.floor(Math.random() * 4)} email campaigns and ${800 + Math.floor(Math.random() * 2000)} subscriber events (demo).`,
        zendesk: `Imported ${6 + Math.floor(Math.random() * 12)} tickets and refreshed SLA dashboard metrics (demo).`,
        slack: `Posted ${2 + Math.floor(Math.random() * 4)} workflow alerts to #investor-ops channel (demo).`,
    };

    state[connectorId] = { ...s, lastSyncAt: now };
    setOpsConnectorState(state);
    appendOpsConnectorSyncLogItem({
        time: now,
        title: `Synced ${connector.name}`,
        body: bodies[connectorId] || 'Sync completed (demo).',
        connectorId,
    });
    renderOpsConnectorSyncLog();
    renderOpsConnectorsDemo();
}

function runAllOpsConnectorSync() {
    const state = getOpsConnectorState();
    const connected = OPS_CONNECTORS.filter((c) => state[c.id]?.connected);
    if (!connected.length) {
        alert('Connect at least one provider first (demo).');
        return;
    }
    connected.forEach((c) => runOpsConnectorSync(c.id));
}

function toggleOpsConnector(connectorId) {
    const connector = OPS_CONNECTORS.find((c) => c.id === connectorId);
    if (!connector) return;
    const state = getOpsConnectorState();
    const current = state[connectorId] || { connected: false };
    if (current.connected) {
        state[connectorId] = { ...current, connected: false };
        setOpsConnectorState(state);
        renderOpsConnectorSyncLog();
        renderOpsConnectorsDemo();
        return;
    }
    const input = document.getElementById(`ops-connector-input-${connectorId}`);
    const apiKey = input?.value ? String(input.value).trim() : '';
    if (!apiKey) {
        alert(`Please enter a token for ${connector.name} (demo).`);
        return;
    }
    state[connectorId] = { connected: true, apiKey, connectedAt: new Date().toISOString(), lastSyncAt: null };
    setOpsConnectorState(state);
    renderOpsConnectorSyncLog();
    renderOpsConnectorsDemo();
}

function renderOpsConnectorsDemo() {
    const mount = document.getElementById('ops-connectors-list');
    if (!mount) return;
    const state = getOpsConnectorState();
    mount.innerHTML = OPS_CONNECTORS.map((c) => {
        const s = state[c.id] || { connected: false };
        const connected = !!s.connected;
        const statusText = connected ? 'Connected (demo)' : 'Not connected';
        const statusClass = connected ? 'connector-status-pill--connected' : '';
        const btnText = connected ? 'Disconnect' : 'Connect';
        const btnClass = connected ? 'btn-secondary' : 'btn-primary';
        const lastSyncAt = s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        return `
            <div class="connector-card">
                <div class="connector-row">
                    <div style="min-width: 220px;">
                        <h4 style="margin:0 0 0.35rem 0;">${escapeHtml(c.name)}</h4>
                        <div style="color: var(--text-muted); font-size: 0.9rem;">${escapeHtml(c.description)}</div>
                    </div>
                    <div><div class="connector-status-pill ${statusClass}">${escapeHtml(statusText)}</div></div>
                </div>
                <div class="connector-row" style="margin-top: 0.75rem;">
                    <div class="connector-input">
                        <input id="ops-connector-input-${c.id}" type="password" class="bot-input" placeholder="${escapeHtml(c.placeholder)}" ${connected ? 'disabled' : ''} />
                    </div>
                    <div class="connector-actions">
                        <button type="button" class="${btnClass}" onclick="toggleOpsConnector('${c.id}')">${btnText}</button>
                        <button type="button" class="btn-secondary" onclick="runOpsConnectorSync('${c.id}')" ${connected ? '' : 'disabled'}>Sync now</button>
                    </div>
                </div>
                <div style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.6rem;">
                    Demo only — no external API calls.${lastSyncAt ? ` Last sync: ${escapeHtml(lastSyncAt)}` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function renderOpsIntegrations() {
    hideTopHeaderWidgets();
    renderOpsConnectorSyncLog();
    renderOpsConnectorsDemo();
}

// ===== USERS RENDERING =====
let inlineExpandedUserId = null;
const inlineUserProfileCache = {};

function safeDomId(value) {
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function buildUserProfileInlineHtml(data) {
    const user = data.user || {};
    const wallet = data.wallet || null;

    const escape = (t) => escapeHtml(String(t ?? ''));

    let html = `
        <div class="user-profile-inline-sections">
            <div class="user-profile-inline-title">
                ${escapeHtml(user.name || user.id || 'User')}
            </div>
            
            <div class="user-detail-section">
                <h3>Profile</h3>
                <div class="detail-row"><span class="detail-label">User ID:</span><span class="detail-value">${escapeHtml(user.id || '')}</span></div>
                <div class="detail-row"><span class="detail-label">Email:</span><span class="detail-value">${escapeHtml(user.email || '')}</span></div>
                <div class="detail-row"><span class="detail-label">Lifecycle Stage:</span><span class="detail-value">${escapeHtml(user.lifecycle_stage || '')}</span></div>
                <div class="detail-row"><span class="detail-label">Country:</span><span class="detail-value">${escapeHtml(user.country || '')}</span></div>
                <div class="detail-row"><span class="detail-label">Acquisition Source:</span><span class="detail-value">${escapeHtml(user.acquisition_source || '')}</span></div>
                <div class="detail-row"><span class="detail-label">Estimated LTV:</span><span class="detail-value">$${Number(user.estimated_ltv || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                <div class="detail-row"><span class="detail-label">Last Active:</span><span class="detail-value">${user.last_activity_at ? escapeHtml(new Date(user.last_activity_at).toLocaleDateString()) : 'N/A'}</span></div>
            </div>
    `;

    if (wallet) {
        html += `
            <div class="user-detail-section">
                <h3>AUM Snapshot</h3>
                <div class="detail-row"><span class="detail-label">Primary Custodian:</span><span class="detail-value">${escapeHtml(formatCustodianLabel(wallet.blockchain))}</span></div>
                <div class="detail-row"><span class="detail-label">Reported AUM:</span><span class="detail-value">$${wallet.balance_usd ? escapeHtml(Number(wallet.balance_usd).toLocaleString()) : '0'}</span></div>
                <div class="detail-row"><span class="detail-label">Engagement Score:</span><span class="detail-value">${Number(wallet.activity_score || 0).toFixed(1)}/100</span></div>
                <div class="detail-row"><span class="detail-label">Portal Touchpoints:</span><span class="detail-value">${wallet.transaction_count || 0}</span></div>
                <div class="detail-row"><span class="detail-label">Relationship Tenure:</span><span class="detail-value">${wallet.wallet_age_days || 0} days</span></div>
            </div>
        `;
    }

    const tickets = Array.isArray(data.tickets) ? data.tickets : [];
    const riskFlags = Array.isArray(data.risk_flags) ? data.risk_flags : [];
    const actions = Array.isArray(data.recovery_actions) ? data.recovery_actions : [];

    if (tickets.length) {
        html += `
            <div class="user-detail-section">
                <h3>Support Tickets (${tickets.length})</h3>
                ${tickets.map((ticket) => `
                    <div style="margin-bottom: 0.9rem; padding: 0.85rem; background: var(--bg-alt); border-radius: 6px;">
                        <div style="margin-bottom: 0.5rem;">
                            <strong>${escapeHtml(ticket.subject || '')}</strong>
                            <span class="badge status-${escapeHtml(ticket.status || '')}" style="margin-left: 0.5rem;">${escapeHtml(ticket.status || '')}</span>
                        </div>
                        <div style="font-size: 0.9rem; color: var(--text-secondary);">
                            Category: ${escapeHtml(ticket.category || '')} | Priority: ${escapeHtml(ticket.priority || '')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    if (riskFlags.length) {
        html += `
            <div class="user-detail-section">
                <h3>${brandTerm('riskFlags', 'Alerts')} (${riskFlags.length})</h3>
                ${riskFlags.map((flag) => `
                    <div style="margin-bottom: 0.9rem; padding: 0.85rem; background: var(--bg-alt); border-radius: 6px;">
                        <div style="margin-bottom: 0.5rem;">
                            <strong>${escapeHtml(flag.type || '')}</strong>
                            <span class="badge severity-${escapeHtml(flag.severity || '')}" style="margin-left: 0.5rem;">${escapeHtml(flag.severity || '')}</span>
                        </div>
                        <div style="font-size: 0.9rem; color: var(--text-secondary);">${escapeHtml(flag.description || '')}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    html += `
        <div class="user-detail-section">
            <h3>Activity Timeline</h3>
            ${buildActivityTimelineHtml(data)}
        </div>
    `;

    if (actions.length) {
        html += `
            <div class="user-detail-section">
                <h3>${brandTerm('recoveryActions', 'Workflow Actions')} (${actions.length})</h3>
                ${actions.map((action) => `
                    <div style="margin-bottom: 0.9rem; padding: 0.85rem; background: var(--bg-alt); border-radius: 6px;">
                        <div style="margin-bottom: 0.5rem;">
                            <strong>${escapeHtml(action.type || '')}</strong>
                            <span class="badge status-${escapeHtml(action.status || '')}" style="margin-left: 0.5rem;">${escapeHtml(action.status || '')}</span>
                        </div>
                        <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                            ${brandTerm('recoveryValue', 'Estimated Impact')}: $${Number(action.recovery_value || 0).toLocaleString()}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    html += `</div>`;
    return html;
}

async function toggleInlineUserProfile(userId) {
    if (inlineExpandedUserId === userId) {
        inlineExpandedUserId = null;
        renderUsers();
        return;
    }

    inlineExpandedUserId = userId;
    renderUsers();

    const panel = document.getElementById(`user-profile-inline-${safeDomId(userId)}`);
    if (panel) panel.innerHTML = `<div class="loading-inline">Loading profile...</div>`;

    if (inlineUserProfileCache[userId]) {
        if (panel) panel.innerHTML = inlineUserProfileCache[userId];
        return;
    }

    try {
        const response = await apiFetch(`${API_BASE}/users/${userId}`);
        const data = await response.json();
        if (!response.ok || data.error) throw new Error(data.error || data.detail || 'User not found');

        const html = buildUserProfileInlineHtml(data);
        inlineUserProfileCache[userId] = html;
        if (panel) panel.innerHTML = html;
    } catch (error) {
        console.error('Error loading inline user profile:', error);
        if (panel) panel.innerHTML = `<div class="empty-state">Could not load profile.</div>`;
    }
}

function renderUsers() {
    hideTopHeaderWidgets();
    const container = document.getElementById('users-list');
    const paginationMountId = 'users-pagination';
    
    if (appState.filteredUsers.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👥</div>No investors found</div>';
        document.getElementById(paginationMountId).innerHTML = '';
        return;
    }
    
    const paged = getPaged(appState.filteredUsers, 'users');
    container.innerHTML = paged.items.map(userId => {
        const risks = appState.riskFlags.filter(f => f.user_id === userId);
        const actions = appState.actions.filter(a => a.user_id === userId);
        const expanded = inlineExpandedUserId === userId;
        
        return `
            <div class="list-item">
                <div class="list-item-header">
                    <div class="list-item-title">${userId}</div>
                </div>
                <div class="list-item-meta">
                    <div><strong>${brandTerm('riskFlags', 'Alerts')}:</strong> ${risks.length}</div>
                    <div><strong>Workflows:</strong> ${actions.length}</div>
                </div>
                <div class="list-item-footer">
                    <button class="${expanded ? 'btn-secondary' : 'btn-primary'}" onclick="toggleInlineUserProfile('${userId}')">
                        ${expanded ? 'Hide Profile' : 'Open Profile'}
                    </button>
                </div>

                <div
                    id="user-profile-inline-${safeDomId(userId)}"
                    class="user-profile-inline"
                    style="display:${expanded ? 'block' : 'none'};"
                ></div>
            </div>
        `;
    }).join('');

    renderListPagination({
        key: 'users',
        mountId: paginationMountId,
        total: paged.total,
        page: paged.page,
        totalPages: paged.totalPages,
        pageSize: paged.pageSize,
    });
}

// ===== CLIENT PORTFOLIO (demo-only UI) =====
const CLIENT_WATCHED_HOLDINGS_KEY = 'rud_client_tracked_coins';
const PORTFOLIO_PLATFORM_HOLDING = 'RGCF';

const CLIENT_HOLDING_LIBRARY = [
    { symbol: 'RGCF', name: 'RGCIS Growth Fund II', color: '#14f195', assetClass: 'Private Equity' },
    { symbol: 'RGRE', name: 'RGCIS Real Estate Fund', color: '#fbbf24', assetClass: 'Real Estate' },
    { symbol: 'VTSAX', name: 'Vanguard Total Stock', color: '#60a5fa', assetClass: 'Equities' },
    { symbol: 'AGG', name: 'iShares Core Bond', color: '#a78bfa', assetClass: 'Fixed Income' },
    { symbol: 'CASH', name: 'Cash & Equivalents', color: '#34d399', assetClass: 'Cash' },
    { symbol: 'VCOP', name: 'Venture Co-Invest', color: '#8be8f6', assetClass: 'Ventures' },
];

const CLIENT_DEMO_HOLDINGS = [
    { symbol: 'RGCF', qty: 850, avgPrice: 1000, currentPrice: 1185, change24h: 0.4 },
    { symbol: 'RGRE', qty: 420, avgPrice: 500, currentPrice: 542, change24h: 0.2 },
    { symbol: 'VTSAX', qty: 1200, avgPrice: 98, currentPrice: 104.5, change24h: -0.3 },
    { symbol: 'AGG', qty: 800, avgPrice: 102, currentPrice: 101.2, change24h: 0.1 },
    { symbol: 'CASH', qty: 185000, avgPrice: 1, currentPrice: 1, change24h: 0.0 },
    { symbol: 'VCOP', qty: 150, avgPrice: 2500, currentPrice: 2680, change24h: 1.1 },
];

const CLIENT_PORTFOLIO_HOLDINGS_KEY = 'rud_client_portfolio_holdings';

function getKnownClientHoldingSymbols() {
    return CLIENT_HOLDING_LIBRARY.map((h) => h.symbol);
}

function getWatchedHoldings() {
    try {
        const raw = localStorage.getItem(CLIENT_WATCHED_HOLDINGS_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (!Array.isArray(parsed)) throw new Error('bad');
        const known = new Set(getKnownClientHoldingSymbols());
        const clean = parsed
            .map((c) => String(c))
            .filter(Boolean)
            .filter((sym) => known.has(sym));
        if (!clean.includes(PORTFOLIO_PLATFORM_HOLDING)) clean.unshift(PORTFOLIO_PLATFORM_HOLDING);
        return Array.from(new Set(clean));
    } catch (e) {
        return [PORTFOLIO_PLATFORM_HOLDING, 'RGRE', 'VTSAX', 'CASH'];
    }
}

function setWatchedHoldings(symbols) {
    const known = new Set(getKnownClientHoldingSymbols());
    const withPlatform = Array.from(
        new Set([PORTFOLIO_PLATFORM_HOLDING, ...(symbols || [])].map((c) => String(c)).filter((sym) => known.has(sym)))
    );
    localStorage.setItem(CLIENT_WATCHED_HOLDINGS_KEY, JSON.stringify(withPlatform));
}

function generateId(prefix) {
    return `${prefix}_${Date.now()}_${String(Math.random()).slice(2, 8)}`;
}

function formatUSD(n) {
    const num = Number(n || 0);
    return `$${num.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatSignedUSD(n) {
    const num = Number(n || 0);
    const abs = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function resetClientDemoState() {
    localStorage.removeItem(CLIENT_PORTFOLIO_HOLDINGS_KEY);
    localStorage.removeItem(CLIENT_WATCHED_HOLDINGS_KEY);
    localStorage.removeItem(CLIENT_CONNECTOR_STATE_KEY);
    localStorage.removeItem(CLIENT_CONNECTOR_SYNC_LOG_KEY);
}

function resetClientDemo() {
    const ok = confirm('Reset demo data? This will restore default portfolio holdings and clear connector logs.');
    if (!ok) return;
    resetClientDemoState();
    renderInvestorDashboard();
    renderPortfolio();
    renderDocuments();
    renderConnectorsDemo();
    renderConnectorSyncLog();
}

function resetOpsDemoState() {
    localStorage.removeItem(CRM_PIPELINE_KEY);
    localStorage.removeItem(MARKETING_LEADS_KEY);
    localStorage.removeItem(WORKFLOW_RULES_KEY);
    localStorage.removeItem(OPS_CONNECTOR_STATE_KEY);
    localStorage.removeItem(OPS_CONNECTOR_SYNC_LOG_KEY);
}

function seedPerfectOpsDemoPath() {
    const leads = MARKETING_SEED_LEADS.map((l) => ({ ...l }));
    if (leads[0]) leads[0] = { ...leads[0], crmPushed: false, status: 'new' };
    setMarketingLeads(leads);
    setWorkflowRules([
        {
            id: 'wf_seed_inactivity',
            name: 'Inactivity nurture email',
            trigger: 'inactivity_detected',
            action: 'email_outreach',
            channel: 'hubspot',
            enabled: true,
            createdAt: new Date().toISOString(),
        },
        {
            id: 'wf_seed_alert',
            name: 'Critical alert → Slack',
            trigger: 'alert_raised',
            action: 'workflow_trigger',
            channel: 'slack',
            enabled: true,
            createdAt: new Date().toISOString(),
        },
    ]);
}

function resetAllDemoData() {
    if (!confirm('Reset all demo local data? This restores showcase defaults for operations AND investor portal (backend database unchanged).')) return;
    resetOpsDemoState();
    resetClientDemoState();
    seedPerfectOpsDemoPath();
    localStorage.removeItem('rud_demo_checklist');
    inlineUserProfileCache = {};
    inlineExpandedUserId = null;

    if (uiMode === 'client') {
        showClientApp();
        renderInvestorDashboard();
        renderPortfolio();
        renderDocuments();
        renderConnectorsDemo();
        renderConnectorSyncLog();
    } else {
        loadDashboardData().then(() => {
            renderOverview();
            updateHealthStatus();
        });
    }
    showSuccess('Demo reset to showcase defaults');
}

function setupResetAllDemoButton() {
    document.getElementById('reset-all-demo-btn')?.addEventListener('click', resetAllDemoData);
}

// ===== Connectors (Demo-only UI) =====
const CLIENT_CONNECTOR_STATE_KEY = 'rud_client_connectors';
const CLIENT_CONNECTOR_SYNC_LOG_KEY = 'rud_client_connector_sync_log';
const CLIENT_CONNECTORS = [
    {
        id: 'plaid',
        name: 'Plaid',
        description: 'Banking & custody account aggregation (demo only).',
        placeholder: 'Paste Plaid secret (demo)'
    },
    {
        id: 'salesforce_investor',
        name: 'Salesforce Investor Portal',
        description: 'Sync investor relationship data (demo only).',
        placeholder: 'Paste Salesforce token (demo)'
    },
    {
        id: 'docusign',
        name: 'DocuSign',
        description: 'Statements and subscription documents (demo only).',
        placeholder: 'Paste integration key (demo)'
    },
    {
        id: 'yahoo',
        name: 'Yahoo Finance',
        description: 'Market price snapshots for portfolio holdings (demo only).',
        placeholder: 'Paste API key (demo)'
    },
];

function getConnectorSyncLog() {
    try {
        const raw = localStorage.getItem(CLIENT_CONNECTOR_SYNC_LOG_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (Array.isArray(parsed)) return parsed;
    } catch (e) {
        // ignore
    }
    const empty = [];
    localStorage.setItem(CLIENT_CONNECTOR_SYNC_LOG_KEY, JSON.stringify(empty));
    return empty;
}

function setConnectorSyncLog(log) {
    localStorage.setItem(CLIENT_CONNECTOR_SYNC_LOG_KEY, JSON.stringify(log || []));
}

function appendConnectorSyncLogItem(item) {
    const log = getConnectorSyncLog();
    log.push(item);
    const trimmed = log.slice(Math.max(0, log.length - 40));
    setConnectorSyncLog(trimmed);
}

function clearConnectorSyncLog() {
    setConnectorSyncLog([]);
    renderConnectorSyncLog();
}

function renderConnectorSyncLog() {
    const mount = document.getElementById('connector-sync-log');
    const subtitle = document.getElementById('connector-sync-subtitle');
    if (!mount) return;

    const log = getConnectorSyncLog().slice().reverse();
    if (!log.length) {
        mount.innerHTML = `
            <div class="connector-sync-item">
                <div class="connector-sync-item-body">No sync runs yet. Click “Sync all (demo)” or run sync on a connector.</div>
            </div>
        `;
        if (subtitle) subtitle.textContent = 'Connect a provider, then run a demo sync.';
        return;
    }

    if (subtitle) {
        const last = log[0]?.time ? new Date(log[0].time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        subtitle.textContent = last ? `Last sync run: ${last}` : 'Sync runs are recorded below.';
    }

    mount.innerHTML = log.map((item) => {
        const t = item.time ? new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        return `
            <div class="connector-sync-item">
                <div class="connector-sync-item-top">
                    <div class="connector-sync-item-title">${escapeHtml(item.title || 'Sync run')}</div>
                    <div class="connector-sync-item-meta">${escapeHtml(t)}</div>
                </div>
                <div class="connector-sync-item-body">${escapeHtml(item.body || '')}</div>
            </div>
        `;
    }).join('');
}

function applyDemoPriceRefreshFromConnector(intensity = 'medium') {
    // Make Yahoo sync feel tangible by refreshing prices + 24h changes.
    const holdings = getClientPortfolioHoldings();
    const symbols = holdings.map((h) => h.symbol);
    simulateMarketPrices(holdings, symbols, intensity);
    setClientPortfolioHoldings(holdings);
}

function runConnectorSync(connectorId) {
    const connector = CLIENT_CONNECTORS.find((c) => c.id === connectorId);
    if (!connector) return;

    const state = getClientConnectorState();
    const s = state[connectorId] || { connected: false };
    if (!s.connected) {
        alert(`Please connect ${connector.name} first (demo).`);
        return;
    }

    // Mock results for storytelling.
    const now = new Date().toISOString();
    const results = (() => {
        if (connectorId === 'yahoo') {
            applyDemoPriceRefreshFromConnector('medium');
            return {
                title: `Synced ${connector.name}`,
                body: `Fetched ${60 + Math.floor(Math.random() * 80)} market price snapshots. Updated portfolio pricing + 24h change view (demo).`
            };
        }
        if (connectorId === 'plaid') {
            return {
                title: `Synced ${connector.name}`,
                body: `Linked ${1 + Math.floor(Math.random() * 2)} institution(s) and imported ${3 + Math.floor(Math.random() * 6)} custody accounts (demo).`
            };
        }
        if (connectorId === 'salesforce_investor') {
            return {
                title: `Synced ${connector.name}`,
                body: `Pulled investor profile updates and ${2 + Math.floor(Math.random() * 5)} document status changes (demo).`
            };
        }
        if (connectorId === 'docusign') {
            return {
                title: `Synced ${connector.name}`,
                body: `Retrieved ${1 + Math.floor(Math.random() * 4)} signed agreements and ${1 + Math.floor(Math.random() * 3)} pending envelopes (demo).`
            };
        }
        return {
            title: `Synced ${connector.name}`,
            body: `Sync completed successfully (demo).`
        };
    })();

    state[connectorId] = { ...s, lastSyncAt: now };
    setClientConnectorState(state);

    appendConnectorSyncLogItem({ time: now, title: results.title, body: results.body, connectorId });
    renderConnectorSyncLog();
    renderConnectorsDemo();
    // If we updated prices, refresh portfolio view when user returns.
    renderPortfolio();
}

function runAllConnectorSync() {
    const state = getClientConnectorState();
    const connected = CLIENT_CONNECTORS.filter((c) => state[c.id]?.connected);
    if (!connected.length) {
        alert('Connect at least one provider first (demo).');
        return;
    }
    connected.forEach((c) => runConnectorSync(c.id));
}

function getClientConnectorState() {
    try {
        const raw = localStorage.getItem(CLIENT_CONNECTOR_STATE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && typeof parsed === 'object') return parsed;
    } catch (e) {
        // ignore
    }
    const empty = {};
    localStorage.setItem(CLIENT_CONNECTOR_STATE_KEY, JSON.stringify(empty));
    return empty;
}

function setClientConnectorState(state) {
    localStorage.setItem(CLIENT_CONNECTOR_STATE_KEY, JSON.stringify(state || {}));
}

function toggleClientDemoConnector(connectorId) {
    const connector = CLIENT_CONNECTORS.find((c) => c.id === connectorId);
    if (!connector) return;

    const state = getClientConnectorState();
    const current = state[connectorId] || { connected: false };

    if (current.connected) {
        state[connectorId] = { ...current, connected: false };
        setClientConnectorState(state);
        renderConnectorSyncLog();
        renderConnectorsDemo();
        return;
    }

    const input = document.getElementById(`connector-input-${connectorId}`);
    const apiKey = input?.value ? String(input.value).trim() : '';
    if (!apiKey) {
        alert(`Please enter an API key for ${connector.name} (demo).`);
        return;
    }

    state[connectorId] = {
        connected: true,
        apiKey,
        connectedAt: new Date().toISOString(),
        lastSyncAt: null
    };
    setClientConnectorState(state);
    renderConnectorSyncLog();
    renderConnectorsDemo();
}

function renderConnectorsDemo() {
    const mount = document.getElementById('portfolio-connectors-list');
    if (!mount) return;

    const state = getClientConnectorState();
    mount.innerHTML = CLIENT_CONNECTORS.map((c) => {
        const s = state[c.id] || { connected: false, apiKey: '' };
        const connected = !!s.connected;
        const statusText = connected ? 'Connected (demo)' : 'Not connected';
        const statusClass = connected ? 'connector-status-pill--connected' : '';
        const btnText = connected ? 'Disconnect' : 'Connect';
        const btnClass = connected ? 'btn-secondary' : 'btn-primary';
        const connectedAt = s.connectedAt ? new Date(s.connectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const lastSyncAt = s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

        return `
            <div class="connector-card">
                <div class="connector-row">
                    <div style="min-width: 220px;">
                        <h4 style="margin:0 0 0.35rem 0;">${escapeHtml(c.name)}</h4>
                        <div style="color: var(--text-muted); font-size: 0.9rem; line-height: 1.3;">${escapeHtml(c.description)}</div>
                    </div>
                    <div>
                        <div class="connector-status-pill ${statusClass}">
                            ${escapeHtml(statusText)}${connectedAt ? ` · ${escapeHtml(connectedAt)}` : ''}
                        </div>
                    </div>
                </div>

                <div class="connector-row" style="margin-top: 0.75rem;">
                    <div class="connector-input">
                        <input
                            id="connector-input-${c.id}"
                            type="password"
                            placeholder="${escapeHtml(c.placeholder)}"
                            value="${escapeHtml(s.apiKey || '')}"
                            ${connected ? 'disabled' : ''}
                        />
                    </div>
                    <div class="connector-btn-row">
                        <button type="button" class="${btnClass}" onclick="toggleClientDemoConnector('${c.id}')">${btnText}</button>
                        <button type="button" class="btn-secondary" onclick="runConnectorSync('${c.id}')" ${connected ? '' : 'disabled'}>Sync now</button>
                    </div>
                </div>

                <div style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.6rem;">
                    Demo note: connector wiring is UI only; data is still simulated.${lastSyncAt ? ` Last sync: ${escapeHtml(lastSyncAt)}` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function getClientPortfolioHoldings() {
    try {
        const raw = localStorage.getItem(CLIENT_PORTFOLIO_HOLDINGS_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                const known = new Set(getKnownClientHoldingSymbols());
                const normalized = parsed
                    .filter((h) => h && known.has(h.symbol))
                    .map((h) => {
                        const priceNow = Number(h.currentPrice || 0);
                        if (h.price24hAgo === undefined || h.price24hAgo === null) {
                            const change = Number(h.change24h || 0);
                            const denom = 1 + (change / 100);
                            const base = denom !== 0 ? priceNow / denom : priceNow;
                            return { ...h, price24hAgo: base };
                        }
                        return h;
                    });
                // Persist normalized fields so future reads are consistent.
                setClientPortfolioHoldings(normalized);
                return normalized;
            }
        }
    } catch (e) {
        // ignore
    }
    const known = new Set(getKnownClientHoldingSymbols());
    const seeded = CLIENT_DEMO_HOLDINGS.filter((h) => known.has(h.symbol)).map((h) => {
        const priceNow = Number(h.currentPrice || 0);
        const change = Number(h.change24h || 0);
        const denom = 1 + (change / 100);
        const base = denom !== 0 ? priceNow / denom : priceNow;
        return { ...h, price24hAgo: base };
    });
    localStorage.setItem(CLIENT_PORTFOLIO_HOLDINGS_KEY, JSON.stringify(seeded));
    return seeded;
}

function setClientPortfolioHoldings(holdings) {
    localStorage.setItem(CLIENT_PORTFOLIO_HOLDINGS_KEY, JSON.stringify(holdings || []));
}

// ===== INVESTOR PORTAL (Phase 2 — dashboard, documents, FAQ assistant) =====
const INVESTOR_PERFORMANCE_TREND = [0.92, 0.94, 0.91, 0.97, 1.02, 1.06];
const INVESTOR_DOCUMENTS = [
    { id: 'stmt-mar-2026', title: 'Monthly Statement — March 2026', type: 'Statement', date: '2026-03-31', size: '245 KB', file: 'statement-mar-2026.pdf' },
    { id: 'perf-q4-2025', title: 'Q4 2025 Performance Report', type: 'Performance', date: '2026-01-15', size: '1.2 MB', file: 'performance-q4-2025.pdf' },
    { id: 'tax-2025', title: 'Tax Summary — FY 2025', type: 'Tax', date: '2026-02-01', size: '380 KB', file: 'tax-summary-2025.pdf' },
    { id: 'kyc-letter', title: 'KYC Verification Letter', type: 'Compliance', date: '2025-11-08', size: '120 KB', file: 'kyc-verification.pdf' },
    { id: 'alloc-memo', title: 'Allocation Strategy Memo', type: 'Strategy', date: '2026-02-20', size: '540 KB', file: 'allocation-memo.pdf' },
];

const INVESTOR_STATIC_UPDATES = [
    { time: '2 hours ago', title: 'Q1 report published', body: 'Your Q1 2026 performance summary is now available in Documents.', icon: '📊' },
    { time: 'Yesterday', title: 'New allocation posted', body: 'Target weights updated for RGCIS Growth Fund II.', icon: '📈' },
    { time: '3 days ago', title: 'Connector sync completed', body: 'Plaid custodian balances refreshed for your linked accounts.', icon: '🔌' },
];

function getInvestorPortfolioSnapshot() {
    const watched = new Set(getWatchedHoldings());
    const holdings = getClientPortfolioHoldings().map((h) => {
        const value = Number(h.qty || 0) * Number(h.currentPrice || 0);
        const meta = CLIENT_HOLDING_LIBRARY.find((c) => c.symbol === h.symbol);
        return {
            ...h,
            value,
            color: meta?.color || '#8be8f6',
            name: meta?.name || h.symbol,
            assetClass: meta?.assetClass || 'Other',
            watched: watched.has(h.symbol),
        };
    });
    const totalValue = holdings.reduce((s, h) => s + h.value, 0);
    const cash = holdings.find((h) => h.symbol === 'CASH')?.value || 0;
    const invested = Math.max(0, totalValue - cash);
    const costBasis = holdings.reduce((s, h) => s + Number(h.qty || 0) * Number(h.avgPrice || 0), 0);
    const unrealizedPnl = totalValue - costBasis;
    const unrealizedPct = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0;
    const allocation = holdings
        .filter((h) => h.value > 0 && h.watched)
        .sort((a, b) => b.value - a.value)
        .map((h) => ({
            ...h,
            pct: totalValue > 0 ? (h.value / totalValue) * 100 : 0,
        }));
    return { holdings, totalValue, cash, invested, unrealizedPnl, unrealizedPct, allocation };
}

function renderInvestorDashboard() {
    const kpiEl = document.getElementById('investor-dashboard-kpis');
    const allocEl = document.getElementById('investor-allocation-chart');
    const perfEl = document.getElementById('investor-performance-chart');
    const feedEl = document.getElementById('investor-updates-feed');
    if (!kpiEl || !allocEl || !perfEl || !feedEl) return;

    const snap = getInvestorPortfolioSnapshot();
    const mtdReturn = 2.4 + (snap.unrealizedPct * 0.05);
    const ytdReturn = 8.6 + (snap.unrealizedPct * 0.08);

    kpiEl.innerHTML = `
        <div class="portfolio-summary-item investor-kpi-card">
            <div class="portfolio-summary-label">Total Portfolio Value</div>
            <div class="portfolio-summary-value">${formatUSD(snap.totalValue)}</div>
        </div>
        <div class="portfolio-summary-item investor-kpi-card">
            <div class="portfolio-summary-label">MTD Return (demo)</div>
            <div class="portfolio-summary-value investor-kpi-pos">+${mtdReturn.toFixed(1)}%</div>
        </div>
        <div class="portfolio-summary-item investor-kpi-card">
            <div class="portfolio-summary-label">YTD Return (demo)</div>
            <div class="portfolio-summary-value investor-kpi-pos">+${ytdReturn.toFixed(1)}%</div>
        </div>
        <div class="portfolio-summary-item investor-kpi-card">
            <div class="portfolio-summary-label">Cash & Equivalents</div>
            <div class="portfolio-summary-value">${formatUSD(snap.cash)}</div>
        </div>
    `;

    allocEl.innerHTML = snap.allocation.map((h) => `
        <div class="investor-alloc-row">
            <div class="investor-alloc-label">
                <span class="coin-dot" style="background:${h.color}"></span>
                <span>${h.symbol} <span class="investor-alloc-pct">${h.assetClass}</span></span>
                <span class="investor-alloc-pct">${h.pct.toFixed(1)}%</span>
            </div>
            <div class="investor-alloc-bar-wrap">
                <div class="investor-alloc-bar" style="width:${Math.max(h.pct, 2)}%; background:${h.color}"></div>
            </div>
            <div class="investor-alloc-value">${formatUSD(h.value)}</div>
        </div>
    `).join('') || '<p class="portfolio-note">No holdings to display.</p>';

    const maxTrend = Math.max(...INVESTOR_PERFORMANCE_TREND);
    perfEl.innerHTML = `
        <div class="investor-perf-bars">
            ${INVESTOR_PERFORMANCE_TREND.map((factor, i) => {
                const height = Math.round((factor / maxTrend) * 100);
                const labels = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
                const val = snap.totalValue * factor;
                return `
                    <div class="investor-perf-col" title="${labels[i]}: ${formatUSD(val)}">
                        <div class="investor-perf-bar" style="height:${height}%"></div>
                        <span class="investor-perf-label">${labels[i]}</span>
                    </div>
                `;
            }).join('')}
        </div>
        <div class="investor-perf-footer">
            <span>Unrealized P/L: <strong class="${snap.unrealizedPnl >= 0 ? 'investor-kpi-pos' : 'investor-kpi-neg'}">${formatSignedUSD(snap.unrealizedPnl)}</strong></span>
            <span>Positions: <strong>${snap.holdings.length}</strong></span>
        </div>
    `;

    const updates = INVESTOR_STATIC_UPDATES.slice(0, 5);

    feedEl.innerHTML = updates.map((u) => `
        <div class="investor-update-item">
            <div class="investor-update-icon" aria-hidden="true">${u.icon}</div>
            <div class="investor-update-body">
                <div class="investor-update-head">
                    <strong>${escapeHtml(u.title)}</strong>
                    <span class="investor-update-time">${escapeHtml(u.time)}</span>
                </div>
                <p>${escapeHtml(u.body)}</p>
            </div>
        </div>
    `).join('');
}

function renderDocuments() {
    const listEl = document.getElementById('investor-documents-list');
    if (!listEl) return;

    listEl.innerHTML = INVESTOR_DOCUMENTS.map((doc) => `
        <div class="investor-doc-card">
            <div class="investor-doc-icon" aria-hidden="true">${getDocumentIcon(doc.type)}</div>
            <div class="investor-doc-meta">
                <div class="investor-doc-title">${escapeHtml(doc.title)}</div>
                <div class="investor-doc-sub">
                    <span class="investor-doc-type">${escapeHtml(doc.type)}</span>
                    <span>${escapeHtml(doc.date)}</span>
                    <span>${escapeHtml(doc.size)}</span>
                </div>
            </div>
            <div class="investor-doc-actions">
                <button type="button" class="btn-secondary" onclick="previewInvestorDocument('${doc.id}')">Preview</button>
                <button type="button" class="btn-primary" onclick="downloadInvestorDocument('${doc.id}')">Download</button>
            </div>
        </div>
    `).join('');
}

function getDocumentIcon(type) {
    const icons = { Statement: '📄', Performance: '📊', Tax: '🧾', Compliance: '✅', Strategy: '📋' };
    return icons[type] || '📁';
}

function findInvestorDocument(id) {
    return INVESTOR_DOCUMENTS.find((d) => d.id === id);
}

function previewInvestorDocument(id) {
    const doc = findInvestorDocument(id);
    if (!doc) return;
    alert(`Demo preview: ${doc.title}\n\nThis is a mock document for the investor portal demo. No file is stored on the server.`);
}

function downloadInvestorDocument(id) {
    const doc = findInvestorDocument(id);
    if (!doc) return;
    const blob = new Blob(
        [`Investor Intelligence Platform — Demo Document\n\n${doc.title}\nGenerated: ${doc.date}\n\nThis is placeholder content for demo purposes only.`],
        { type: 'text/plain' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.file.replace(/\.pdf$/i, '.txt');
    a.click();
    URL.revokeObjectURL(url);
}

let isInvestorChatInitialized = false;

function setupInvestorChatInterface() {
    if (isInvestorChatInitialized) return;
    const input = document.getElementById('investor-chat-input');
    const sendBtn = document.getElementById('investor-chat-send-btn');
    if (!input || !sendBtn) return;

    const send = () => {
        const message = input.value.trim();
        if (!message) return;
        sendInvestorChatMessage(message);
        input.value = '';
        input.focus();
    };

    sendBtn.addEventListener('click', send);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    });
    isInvestorChatInitialized = true;
}

function renderInvestorChat() {
    document.getElementById('investor-chat-input')?.focus();
}

function sendInvestorChatSuggestion(text) {
    sendInvestorChatMessage(text);
}

function sendInvestorChatMessage(userQuery) {
    const container = document.getElementById('investor-chat-messages');
    if (!container) return;

    container.appendChild(createChatMessage('user', userQuery));
    container.scrollTop = container.scrollHeight;

    const typing = createChatMessage('bot', '...', true);
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;

    setTimeout(() => {
        typing.remove();
        const reply = answerInvestorFaq(userQuery);
        const html = `<div>${formatInvestorChatReply(reply)}</div>`;
        container.appendChild(createChatMessage('bot', html));
        container.scrollTop = container.scrollHeight;
    }, 350 + Math.random() * 250);
}

function formatInvestorChatReply(text) {
    return escapeHtml(String(text || ''))
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
}

function answerInvestorFaq(query) {
    const q = String(query).toLowerCase().replace(/\s+/g, ' ').trim();
    const snap = getInvestorPortfolioSnapshot();

    if (/^(hi|hello|hey|greetings)\b/.test(q)) {
        return `Hello — I can help with your portfolio demo. You currently hold about ${formatUSD(snap.totalValue)} across ${snap.holdings.length} positions. Ask about allocation, returns, documents, or connected accounts.`;
    }
    if (/help|what can you do|capabilities/.test(q)) {
        return 'I can answer demo questions about:\n• Portfolio value and allocation\n• Performance and returns\n• Available documents and reports\n• Connected custodian accounts\n\nTry a quick-ask chip below or type your own question.';
    }
    if (/portfolio|total value|net worth|how much/.test(q)) {
        return `Your total portfolio value is **${formatUSD(snap.totalValue)}** (demo). Cash & equivalents: ${formatUSD(snap.cash)}. Invested assets: ${formatUSD(snap.invested)}. Unrealized P/L: ${formatSignedUSD(snap.unrealizedPnl)} (${snap.unrealizedPct >= 0 ? '+' : ''}${snap.unrealizedPct.toFixed(1)}%).`;
    }
    if (/allocat|exposure|breakdown|split|weight/.test(q)) {
        if (!snap.allocation.length) return 'No allocation data available yet — try Reset Demo to restore seed holdings.';
        const lines = snap.allocation.slice(0, 6).map((h) => `• **${h.symbol}**: ${h.pct.toFixed(1)}% (${formatUSD(h.value)})`);
        return `Here's your current allocation:\n${lines.join('\n')}`;
    }
    if (/return|performance|ytd|mtd|gain|profit/.test(q)) {
        const mtd = (2.4 + snap.unrealizedPct * 0.05).toFixed(1);
        const ytd = (8.6 + snap.unrealizedPct * 0.08).toFixed(1);
        return `Demo performance snapshot:\n• MTD return: **+${mtd}%**\n• YTD return: **+${ytd}%**\n• Unrealized P/L: **${formatSignedUSD(snap.unrealizedPnl)}**\n\nSee the Dashboard tab for the 6-month performance chart.`;
    }
    if (/document|report|statement|download|pdf/.test(q)) {
        const names = INVESTOR_DOCUMENTS.slice(0, 3).map((d) => `• ${d.title}`).join('\n');
        return `You have **${INVESTOR_DOCUMENTS.length}** documents available (demo):\n${names}\n\nOpen the **Documents** tab to preview or download mock files.`;
    }
    if (/integrat|connect|sync|plaid|docusign|salesforce/.test(q)) {
        const state = getClientConnectorState();
        const connected = Object.values(state).filter((c) => c && c.connected).length;
        return `**${connected}** of ${CLIENT_CONNECTORS.length} connectors are connected (demo UI only). Open **Connected Accounts** to link Plaid, DocuSign, or Salesforce and run a mock sync.`;
    }
    if (/rgcf|growth fund|rgcis fund/.test(q)) {
        const rg = snap.holdings.find((h) => h.symbol === PORTFOLIO_PLATFORM_HOLDING);
        return rg
            ? `**${PORTFOLIO_PLATFORM_HOLDING}** (RGCIS Growth Fund II) is valued at **${formatUSD(rg.value)}** in your portfolio. It is always highlighted on your dashboard.`
            : `**${PORTFOLIO_PLATFORM_HOLDING}** is the flagship private fund in this demo. Check Portfolio for holdings.`;
    }
    if (/cash|liquidity/.test(q)) {
        return `Your cash & equivalents balance is **${formatUSD(snap.cash)}** — available for capital calls and distributions in the demo narrative.`;
    }
    if (/thank/.test(q)) {
        return "You're welcome — happy to help with your investor portal demo.";
    }
    return `I didn't quite match that to a demo topic. Try asking about portfolio value, allocation, returns, documents, or integrations. For example: "What's my allocation?"`;
}

function renderPortfolio() {
    const holdingsTbody = document.getElementById('portfolio-holdings-tbody');
    const trackList = document.getElementById('portfolio-track-list');
    const summaryEl = document.getElementById('portfolio-summary');
    const tipsEl = document.getElementById('portfolio-track-tips');

    if (!holdingsTbody || !trackList || !summaryEl) return;

    const watched = getWatchedHoldings();
    const watchedSet = new Set(watched);

    const holdingsState = getClientPortfolioHoldings();
    const holdings = holdingsState.map((h) => {
        const value = h.qty * h.currentPrice;
        const meta = CLIENT_HOLDING_LIBRARY.find((c) => c.symbol === h.symbol);
        return { ...h, value, watched: watchedSet.has(h.symbol), assetClass: meta?.assetClass || '—', color: meta?.color };
    }).sort((a, b) => b.value - a.value);

    const totalValue = holdings.reduce((s, h) => s + h.value, 0);
    const watchedValue = holdings.filter((h) => h.watched).reduce((s, h) => s + h.value, 0);

    summaryEl.innerHTML = `
        <div class="portfolio-summary-grid">
            <div class="portfolio-summary-item">
                <div class="portfolio-summary-label">Total Portfolio Value</div>
                <div class="portfolio-summary-value">${formatUSD(totalValue)}</div>
            </div>
            <div class="portfolio-summary-item">
                <div class="portfolio-summary-label">Dashboard Highlights</div>
                <div class="portfolio-summary-value">${formatUSD(watchedValue)}</div>
            </div>
            <div class="portfolio-summary-item">
                <div class="portfolio-summary-label">Positions</div>
                <div class="portfolio-summary-value">${holdings.length}</div>
            </div>
        </div>
    `;

    holdingsTbody.innerHTML = holdings.map((h) => {
        const changeClass = h.change24h > 0 ? 'pos' : h.change24h < 0 ? 'neg' : 'flat';
        const changeText = `${h.change24h > 0 ? '+' : ''}${h.change24h.toFixed(2)}%`;
        return `
            <tr>
                <td>
                    <div class="portfolio-coin-cell">
                        <span class="coin-dot" style="background:${h.color || '#8be8f6'}"></span>
                        <span class="portfolio-coin-symbol">${h.symbol}</span>
                    </div>
                </td>
                <td>${escapeHtml(h.assetClass)}</td>
                <td>${typeof h.qty === 'number' ? h.qty.toLocaleString(undefined, { maximumFractionDigits: 2 }) : h.qty}</td>
                <td>${formatUSD(h.currentPrice)}</td>
                <td><strong>${formatUSD(h.value)}</strong></td>
                <td class="portfolio-change ${changeClass}">${changeText}</td>
            </tr>
        `;
    }).join('');

    if (tipsEl) {
        tipsEl.innerHTML = `<p class="portfolio-note"><strong>${PORTFOLIO_PLATFORM_HOLDING}</strong> is always shown on your dashboard. Toggle other positions to include them in the allocation chart.</p>`;
    }

    trackList.innerHTML = CLIENT_HOLDING_LIBRARY.map((pos) => {
        const isPlatform = pos.symbol === PORTFOLIO_PLATFORM_HOLDING;
        const checked = watchedSet.has(pos.symbol);
        return `
            <label class="portfolio-coin-track">
                <input
                    type="checkbox"
                    ${checked ? 'checked' : ''}
                    ${isPlatform ? 'disabled' : ''}
                    onchange="onPortfolioWatchToggle('${pos.symbol}', this.checked)"
                />
                <span class="portfolio-coin-track-label">
                    <span class="coin-dot" style="background:${pos.color};"></span>
                    ${pos.symbol} <span class="portfolio-coin-track-name">(${pos.name})</span>
                </span>
            </label>
        `;
    }).join('');

    renderConnectorsDemo();
}

function onPortfolioWatchToggle(symbol, checked) {
    const watched = getWatchedHoldings();
    const set = new Set(watched);
    if (symbol === PORTFOLIO_PLATFORM_HOLDING) return;
    if (checked) set.add(symbol);
    else set.delete(symbol);
    setWatchedHoldings(Array.from(set));
    renderPortfolio();
    renderInvestorDashboard();
}

// ===== FILTERS =====
function setupFilters() {
    document.getElementById('risk-type-filter')?.addEventListener('change', filterRisks);
    document.getElementById('risk-severity-filter')?.addEventListener('change', filterRisks);
    document.getElementById('action-status-filter')?.addEventListener('change', filterActions);
    document.getElementById('action-priority-filter')?.addEventListener('change', filterActions);
    document.getElementById('user-search')?.addEventListener('input', filterUsers);
}

function filterRisks() {
    const typeFilter = document.getElementById('risk-type-filter')?.value || '';
    const severityFilter = document.getElementById('risk-severity-filter')?.value || '';
    
    appState.filteredRisks = appState.riskFlags.filter(flag => {
        return (!typeFilter || flag.flag_type === typeFilter) &&
               (!severityFilter || flag.severity === severityFilter);
    });
    
    resetListPage('risks');
    renderRiskFlags();
}

function filterActions() {
    const statusFilter = document.getElementById('action-status-filter')?.value || '';
    const priorityFilter = document.getElementById('action-priority-filter')?.value || '';
    
    appState.filteredActions = appState.actions.filter(action => {
        return (!statusFilter || action.status === statusFilter) &&
               (!priorityFilter || action.priority === priorityFilter);
    });
    
    resetListPage('actions');
    renderActions();
}

function filterUsers() {
    const searchTerm = document.getElementById('user-search')?.value.toLowerCase() || '';
    
    appState.filteredUsers = Array.from(new Set(appState.riskFlags.map(f => f.user_id))).filter(userId =>
        userId.toLowerCase().includes(searchTerm)
    );
    
    resetListPage('users');
    renderUsers();
}

// ===== ACTIONS =====
async function approveAction(actionId) {
    try {
        const response = await apiFetch(`${API_BASE}/actions/${actionId}/approve`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.success) {
            showSuccess('Action approved');
            loadDashboardData();
        }
    } catch (error) {
        console.error('Error approving action:', error);

    }
}

async function executeAction(actionId) {
    const action = appState.actions.find((a) => a.action_id === actionId);
    try {
        const response = await apiFetch(`${API_BASE}/actions/${actionId}/execute`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.success) {
            showSuccess('Action executed — opening integration preview');
            await loadDashboardData();
            if (action) {
                await runWorkflowSimulatePreview({
                    action_type: action.action_type,
                    user_id: action.user_id,
                    reason: action.reason || `Executed workflow ${action.action_type}`,
                });
            }
        }
    } catch (error) {
        console.error('Error executing action:', error);

    }
}

async function viewUserDetail(userId) {
    try {
        const response = await apiFetch(`${API_BASE}/users/${userId}`);
        const data = await response.json();
        
        if (data.error) {
            showError('User not found');
            return;
        }
        
        const modal = document.getElementById('user-modal');
        const content = document.getElementById('user-detail-content');
        
        const user = data.user;
        const wallet = data.wallet;
        
        let html = `
            <h2>${user.name}</h2>
            
            <div class="user-detail-section">
                <h3>Profile Information</h3>
                <div class="detail-row"><span class="detail-label">User ID:</span><span class="detail-value">${user.id}</span></div>
                <div class="detail-row"><span class="detail-label">Email:</span><span class="detail-value">${user.email}</span></div>
                <div class="detail-row"><span class="detail-label">Lifecycle Stage:</span><span class="detail-value">${user.lifecycle_stage}</span></div>
                <div class="detail-row"><span class="detail-label">Country:</span><span class="detail-value">${user.country}</span></div>
                <div class="detail-row"><span class="detail-label">Acquisition Source:</span><span class="detail-value">${user.acquisition_source}</span></div>
                <div class="detail-row"><span class="detail-label">Estimated LTV:</span><span class="detail-value">$${(user.estimated_ltv || 0).toLocaleString(undefined, {maximumFractionDigits: 2})}</span></div>
                <div class="detail-row"><span class="detail-label">Account Created:</span><span class="detail-value">${new Date(user.first_seen_at).toLocaleDateString()}</span></div>
                <div class="detail-row"><span class="detail-label">Last Active:</span><span class="detail-value">${user.last_activity_at ? new Date(user.last_activity_at).toLocaleDateString() : 'N/A'}</span></div>
            </div>
        `;
        
        if (wallet) {
            html += `
                <div class="user-detail-section">
                    <h3>AUM Snapshot</h3>
                    <div class="detail-row"><span class="detail-label">Primary Custodian:</span><span class="detail-value">${formatCustodianLabel(wallet.blockchain)}</span></div>
                    <div class="detail-row"><span class="detail-label">Reported AUM:</span><span class="detail-value">$${wallet.balance_usd ? wallet.balance_usd.toLocaleString() : '0'}</span></div>
                    <div class="detail-row"><span class="detail-label">Engagement Score:</span><span class="detail-value">${(wallet.activity_score || 0).toFixed(1)}/100</span></div>
                    <div class="detail-row"><span class="detail-label">Portal Touchpoints:</span><span class="detail-value">${wallet.transaction_count || 0}</span></div>
                    <div class="detail-row"><span class="detail-label">Relationship Tenure:</span><span class="detail-value">${wallet.wallet_age_days || 0} days</span></div>
                </div>
            `;
        }
        
        if (data.tickets && data.tickets.length > 0) {
            html += `
                <div class="user-detail-section">
                    <h3>Support Tickets (${data.tickets.length})</h3>
                    ${data.tickets.map(ticket => `
                        <div style="margin-bottom: 1rem; padding: 1rem; background: var(--bg-tertiary); border-radius: 6px;">
                            <div style="margin-bottom: 0.5rem;">
                                <strong>${ticket.subject}</strong>
                                <span class="badge status-${ticket.status}" style="margin-left: 0.5rem;">${ticket.status}</span>
                            </div>
                            <div style="font-size: 0.9rem; color: var(--text-secondary);">Category: ${ticket.category} | Priority: ${ticket.priority}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        if (data.risk_flags && data.risk_flags.length > 0) {
            html += `
                <div class="user-detail-section">
                    <h3>${brandTerm('riskFlags', 'Alerts')} (${data.risk_flags.length})</h3>
                    ${data.risk_flags.map(flag => `
                        <div style="margin-bottom: 1rem; padding: 1rem; background: var(--bg-tertiary); border-radius: 6px;">
                            <div style="margin-bottom: 0.5rem;">
                                <strong>${flag.type}</strong>
                                <span class="badge severity-${flag.severity}" style="margin-left: 0.5rem;">${flag.severity}</span>
                            </div>
                            <div style="font-size: 0.9rem; color: var(--text-secondary);">${flag.description}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        html += `
            <div class="user-detail-section">
                <h3>Activity Timeline</h3>
                ${buildActivityTimelineHtml(data)}
            </div>
        `;
        
        if (data.recovery_actions && data.recovery_actions.length > 0) {
            html += `
                <div class="user-detail-section">
                    <h3>${brandTerm('recoveryActions', 'Workflow Actions')} (${data.recovery_actions.length})</h3>
                    ${data.recovery_actions.map(action => `
                        <div style="margin-bottom: 1rem; padding: 1rem; background: var(--bg-tertiary); border-radius: 6px;">
                            <div style="margin-bottom: 0.5rem;">
                                <strong>${action.type}</strong>
                                <span class="badge status-${action.status}" style="margin-left: 0.5rem;">${action.status}</span>
                            </div>
                            <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">${brandTerm('recoveryValue', 'Estimated Impact')}: $${(action.recovery_value || 0).toLocaleString()}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        content.innerHTML = html;
        modal.classList.add('active');
        
    } catch (error) {
        console.error('Error loading user details:', error);
    
    }
}

// ===== HELPERS =====
function formatCustodianLabel(value) {
    const labels = {
        schwab: 'Charles Schwab',
        fidelity: 'Fidelity',
        pershing: 'Pershing',
        sei: 'SEI',
        internal_fund: 'Internal Fund Admin',
        morgan_stanley: 'Morgan Stanley',
    };
    const key = String(value || '').toLowerCase().replace(/\s+/g, '_');
    return labels[key] || String(value || '—').replace(/_/g, ' ');
}

function getInsightIcon(flagType) {
    const icons = {
        'onboarding_delay': '📝',
        'inactivity': '😴',
        'support_unresolved': '🆘',
        'abandoned': '👋'
    };
    return icons[flagType] || '⚠️';
}

function showSuccess(message) {
    console.log('✅', message);
    alert(message);
}

function showError(message) {
    console.error('❌', message);
    alert('Error: ' + message);
}

// ===== MODALS (user detail + simulate preview) =====
function closeSimulateActionModal() {
    const modal = document.getElementById('simulate-action-modal');
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

function openSimulateActionModal({ mocks, logId, act }) {
    const modal = document.getElementById('simulate-action-modal');
    const bodyEl = document.getElementById('simulate-modal-body');
    const introEl = document.getElementById('simulate-modal-intro');
    const titleEl = document.getElementById('simulate-modal-title');
    const preEl = document.getElementById('simulate-modal-raw-pre');
    if (!modal || !bodyEl || !introEl || !titleEl || !preEl) return;

    const actionLabel = titleCaseActionType(act.action_type);
    const uid = act.user_id ? String(act.user_id) : '';
    titleEl.textContent = `Preview: ${actionLabel}`;

    const logShort = logId ? String(logId).slice(0, 8) : '';
    const line2 = uid
        ? `Below is what those integrations <em>might</em> look like for <strong>${escapeHtml(actionLabel)}</strong> on <strong>${escapeHtml(uid)}</strong>.`
        : `Below is what those integrations <em>might</em> look like for <strong>${escapeHtml(actionLabel)}</strong> on this workflow.`;
    introEl.innerHTML = [
        'This is a <strong>demo-only</strong> preview: nothing was actually sent to SendGrid, Jira, Salesforce, HubSpot, or Zendesk.',
        line2,
        logShort
            ? `We still write one row to the demo log so you can trace it (<code>${escapeHtml(logShort)}…</code>).`
            : '',
    ]
        .filter(Boolean)
        .join(' ');

    bodyEl.innerHTML = '';
    bodyEl.appendChild(buildSimulateCards(mocks));
    preEl.textContent = JSON.stringify(mocks, null, 2);

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function titleCaseActionType(type) {
    return String(type || 'action')
        .split('_')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
}

function titleCaseWords(str) {
    return String(str)
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
}

document.addEventListener('click', (e) => {
    const userModal = document.getElementById('user-modal');
    const simModal = document.getElementById('simulate-action-modal');
    if (e.target === userModal) {
        userModal.classList.remove('active');
    }
    if (simModal && e.target === simModal) {
        closeSimulateActionModal();
    }
    if (e.target.classList.contains('modal-close')) {
        if (userModal.contains(e.target)) {
            userModal.classList.remove('active');
        }
        if (simModal && simModal.contains(e.target)) {
            closeSimulateActionModal();
        }
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const simModal = document.getElementById('simulate-action-modal');
    if (simModal?.classList.contains('active')) {
        closeSimulateActionModal();
        return;
    }
    const userModal = document.getElementById('user-modal');
    if (userModal?.classList.contains('active')) {
        userModal.classList.remove('active');
    }
});


// ===== AI CHAT FUNCTIONALITY =====

function setupChatInterface() {
    if (isChatInitialized) return;

    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');
    
    if (!chatInput || !sendBtn) return;
    
    // Send on button click
    sendBtn.addEventListener('click', () => {
        const message = chatInput.value.trim();
        if (message) {
            sendChatMessage(message);
            chatInput.value = '';
            chatInput.focus();
        }
    });
    
    // Send on Enter key
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const message = chatInput.value.trim();
            if (message) {
                sendChatMessage(message);
                chatInput.value = '';
            }
        }
    });

    isChatInitialized = true;
}

function formatInsightBold(text) {
    if (!text) return '';
    const parts = String(text).split(/\*\*/);
    return parts.map((p, i) => (i % 2 === 1 ? `<strong>${escapeHtml(p)}</strong>` : escapeHtml(p))).join('');
}

function humanizeSimKey(k) {
    const s = String(k);
    if (s.endsWith('__c')) {
        const base = s.slice(0, -3).replace(/_/g, ' ');
        return `${titleCaseWords(base)} (custom CRM field)`;
    }
    return titleCaseWords(s.replace(/_/g, ' '));
}

/** Nested key–value blocks inside a simulate channel card (no innerHTML). */
function fillSimulateCardBody(bodyEl, obj) {
    if (!obj || typeof obj !== 'object') return;
    Object.entries(obj).forEach(([k, v]) => {
        const row = document.createElement('div');
        row.className = 'chat-sim-row';
        const label = document.createElement('span');
        label.className = 'chat-sim-field-label';
        label.textContent = humanizeSimKey(k);
        const valWrap = document.createElement('div');
        valWrap.className = 'chat-sim-field-value';
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
            const sub = document.createElement('div');
            sub.className = 'chat-sim-subblock';
            fillSimulateCardBody(sub, v);
            valWrap.appendChild(sub);
        } else if (Array.isArray(v)) {
            valWrap.classList.add('chat-sim-tags');
            valWrap.textContent = v.join(' · ');
        } else {
            valWrap.textContent = v == null ? '—' : String(v);
        }
        row.appendChild(label);
        row.appendChild(valWrap);
        bodyEl.appendChild(row);
    });
}

/** Card grid: integration channels from mock payload. */
function buildSimulateCards(mocks) {
    const grid = document.createElement('div');
    grid.className = 'chat-sim-grid';
    const channels = [
        { key: 'email', title: 'Email (SendGrid)', icon: '✉' },
        { key: 'salesforce', title: 'Salesforce', icon: '☁' },
        { key: 'hubspot', title: 'HubSpot', icon: '🟠' },
        { key: 'zendesk', title: 'Zendesk', icon: '🎫' },
        { key: 'jira', title: 'Jira', icon: '◆' },
        { key: 'crm', title: 'CRM (legacy)', icon: '◇' },
    ];
    channels.forEach(({ key, title, icon }) => {
        const data = mocks[key];
        if (!data || typeof data !== 'object') return;
        const card = document.createElement('div');
        card.className = 'chat-sim-card';
        const head = document.createElement('div');
        head.className = 'chat-sim-card-head';
        const ic = document.createElement('span');
        ic.className = 'chat-sim-card-icon';
        ic.setAttribute('aria-hidden', 'true');
        ic.textContent = icon;
        const tt = document.createElement('span');
        tt.textContent = title;
        head.appendChild(ic);
        head.appendChild(tt);
        const body = document.createElement('div');
        body.className = 'chat-sim-card-body';
        fillSimulateCardBody(body, data);
        card.appendChild(head);
        card.appendChild(body);
        grid.appendChild(card);
    });
    return grid;
}

async function runChatSimulate(act) {
    const messagesContainer = document.getElementById('chat-messages');
    try {
        const res = await apiFetch(`${API_BASE}/chat/simulate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action_type: act.action_type,
                user_id: act.user_id || null,
                reason: act.reason || null,
            }),
        });
        const j = await res.json();
        if (!res.ok || !j.success) {
            throw new Error(j.detail || j.message || 'Simulate failed');
        }
        openSimulateActionModal({ mocks: j.mocks, logId: j.log_id, act });
    } catch (e) {
        console.error(e);
        messagesContainer.appendChild(createChatMessage('error', `Simulate error: ${e.message}`));
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

async function sendChatMessage(userQuery) {
    const messagesContainer = document.getElementById('chat-messages');
    
    // Add user message to display
    const userMessageDiv = createChatMessage('user', userQuery);
    messagesContainer.appendChild(userMessageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Show typing indicator
    const typingDiv = createChatMessage('bot', '...', true);
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    try {
        // Send to backend
        const response = await apiFetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: userQuery })
        });
        
        const data = await response.json();
        
        // Remove typing indicator
        typingDiv.remove();
        
        if (data.success) {
            // Create bot message container
            const botMessageDiv = document.createElement('div');
            botMessageDiv.className = 'chat-message bot';
            if (data.playbook_id) {
                botMessageDiv.classList.add('chat-message-playbook');
            }

            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            
            let fullContent = '';
            let responseData = null;
            try {
                responseData = JSON.parse(data.response);
            } catch (e) {
                responseData = null;
            }

            if (responseData) {
                if (responseData.data !== undefined) {
                    if (data.playbook_id) {
                        const title = escapeHtml(data.playbook_id.replace(/_/g, ' '));
                        fullContent += `<div class="chat-answer-playbook">`;
                        fullContent += `<header class="chat-playbook-header"><span class="chat-playbook-kicker">Verified playbook</span><h3 class="chat-playbook-title">${title}</h3><p class="chat-playbook-sub">Straight from your demo database: a short summary plus the matching rows. We skip an extra AI “story” on top so you can trust what you see.</p></header>`;
                    } else if (String(responseData.text || '').trim()) {
                        fullContent += `<p class="chat-response-context">${escapeHtml(responseData.text)}</p>`;
                    }
                    if (Array.isArray(responseData.insights) && responseData.insights.length > 0) {
                        fullContent += '<div class="chat-insights-card"><div class="chat-insights-label">Key facts</div><ul class="chat-insights">';
                        responseData.insights.forEach(ins => {
                            fullContent += `<li>${formatInsightBold(ins)}</li>`;
                        });
                        fullContent += '</ul></div>';
                    }
                    if (Array.isArray(responseData.data) && responseData.data.length > 0) {
                        fullContent += `<div class="chat-table-card"><div class="chat-table-label">Data</div>`;
                        fullContent += formatJsonResponse(responseData.data, data.row_count || 0);
                        fullContent += '</div>';
                    }
                    if (data.playbook_id) {
                        fullContent += '</div>';
                    }
                } else if (Array.isArray(responseData)) {
                    if (data.context) {
                        fullContent += `<p class="chat-response-context">${escapeHtml(data.context)}</p>`;
                    }
                    fullContent += formatJsonResponse(responseData, data.row_count || 0);
                } else {
                    if (data.context) {
                        fullContent += `<p class="chat-response-context">${escapeHtml(data.context)}</p>`;
                    }
                    fullContent += formatJsonResponse(responseData, data.row_count || 0);
                }
            } else {
                fullContent += `<p class="chat-response-text">${escapeHtml(data.response)}</p>`;
            }

            contentDiv.innerHTML = fullContent;

            if (responseData && Array.isArray(responseData.suggested_actions) && responseData.suggested_actions.length > 0) {
                const simWrap = document.createElement('div');
                simWrap.className = 'chat-suggested-actions';
                const hint = document.createElement('p');
                hint.className = 'chat-sim-hint';
                hint.innerHTML =
                    '<strong>Suggested next steps</strong> — tap a button to open a <em>preview window</em> with mock Email, Jira, and CRM payloads (nothing is sent for real). Each run is logged in the demo; raw JSON lives at the bottom of that window.';
                const pickerRow = document.createElement('div');
                pickerRow.className = 'chat-sim-picker-row';

                const select = document.createElement('select');
                select.className = 'chat-sim-select';
                select.setAttribute('aria-label', 'Select a suggested next step');

                const placeholder = document.createElement('option');
                placeholder.value = '';
                placeholder.textContent = 'Choose an action…';
                placeholder.selected = true;
                placeholder.disabled = true;
                select.appendChild(placeholder);

                responseData.suggested_actions.forEach((act, idx) => {
                    const opt = document.createElement('option');
                    opt.value = String(idx);
                    const label = titleCaseActionType(act.action_type);
                    opt.textContent = `${label}${act.user_id ? ` · ${act.user_id}` : ''}`;
                    select.appendChild(opt);
                });

                const goBtn = document.createElement('button');
                goBtn.type = 'button';
                goBtn.className = 'chat-sim-btn chat-sim-go';
                goBtn.textContent = 'Preview';
                goBtn.disabled = true;

                const updateBtn = () => {
                    goBtn.disabled = !select.value;
                    const idx = Number(select.value);
                    const act = Number.isFinite(idx) ? responseData.suggested_actions[idx] : null;
                    goBtn.title = act
                        ? `Simulate ${act.action_type}${act.reason ? ': ' + act.reason : ''}`
                        : 'Select an action first';
                };
                select.addEventListener('change', updateBtn);

                goBtn.addEventListener('click', () => {
                    const idx = Number(select.value);
                    if (!Number.isFinite(idx)) return;
                    const act = responseData.suggested_actions[idx];
                    if (!act) return;
                    runChatSimulate(act);
                });

                pickerRow.appendChild(select);
                pickerRow.appendChild(goBtn);
                simWrap.appendChild(hint);
                simWrap.appendChild(pickerRow);
                contentDiv.appendChild(simWrap);
            }

            botMessageDiv.appendChild(contentDiv);

            if (data.sql_query) {
                const det = document.createElement('details');
                det.className = 'chat-sql-details';
                const sum = document.createElement('summary');
                sum.textContent = '📋 Generated SQL';
                det.appendChild(sum);
                const pre = document.createElement('pre');
                pre.className = 'chat-sql-pre';
                pre.textContent = data.sql_query;
                det.appendChild(pre);
                botMessageDiv.appendChild(det);
            }

            messagesContainer.appendChild(botMessageDiv);
        } else {
            const errRaw = data.error || 'Unknown error';
            const errText = errRaw.startsWith('Error:') ? errRaw : `Error: ${errRaw}`;
            const errorDiv = createChatMessage('error', errText);
            messagesContainer.appendChild(errorDiv);
        }
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } catch (error) {
        console.error('Chat error:', error);
        typingDiv.remove();
        
        const errorDiv = createChatMessage('error', `Connection error: ${error.message}`);
        messagesContainer.appendChild(errorDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

function formatJsonResponse(data, rowCount) {
    if (!Array.isArray(data) || data.length === 0) {
        return `<p class="chat-response-text">No results found</p>`;
    }
    
    // Check if it's a single count/aggregate result
    if (data.length === 1 && Object.keys(data[0]).length === 1) {
        const key = Object.keys(data[0])[0];
        const value = data[0][key];
        return `<p class="chat-response-text"><strong>Result:</strong> ${formatValue(value)}</p>`;
    }
    
    // For small result sets (≤5 rows), show as table
    if (data.length <= 5) {
        return formatAsTable(data);
    }
    
    // For larger result sets (>5 rows), show summary with pagination
    return formatAsSummary(data, rowCount);
}

function formatAsTable(data) {
    if (!data || data.length === 0) return '';
    
    const keys = Object.keys(data[0]);
    
    let html = '<div class="chat-response-table-wrapper"><table class="chat-response-table"><thead><tr>';
    
    // Header
    keys.forEach(key => {
        html += `<th>${escapeHtml(key)}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    // Rows - show all rows for data <= 5
    data.forEach(row => {
        html += '<tr>';
        keys.forEach(key => {
            const value = formatValue(row[key]);
            html += `<td>${escapeHtml(value)}</td>`;
        });
        html += '</tr>';
    });
    
    html += '</tbody></table></div>';
    
    return html;
}

function formatAsSummary(data, rowCount) {
    if (!data || data.length === 0) return '';
    
    const keys = Object.keys(data[0]);
    const itemsPerPage = 5;
    const totalPages = Math.ceil(data.length / itemsPerPage);
    
    // Store pagination data globally for this response
    const paginationId = 'pagination_' + Date.now();
    window.chatPagination = window.chatPagination || {};
    window.chatPagination[paginationId] = {
        data: data,
        keys: keys,
        currentPage: 1,
        itemsPerPage: itemsPerPage,
        totalPages: totalPages,
        totalRecords: rowCount
    };
    
    let html = `<p class="chat-response-summary"><strong>Found ${rowCount} record(s)</strong></p>`;
    
    // Initial table with first page
    const startIdx = 0;
    const endIdx = Math.min(itemsPerPage, data.length);
    const pageData = data.slice(startIdx, endIdx);
    
    html += `<div class="chat-response-pagination-info">Showing ${startIdx + 1}-${endIdx} of ${rowCount} records</div>`;
    
    // Show table for current page
    html += `<div class="chat-response-table-wrapper" id="table-${paginationId}"><table class="chat-response-table"><thead><tr>`;
    
    keys.forEach(key => {
        html += `<th>${escapeHtml(key)}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    pageData.forEach(row => {
        html += '<tr>';
        keys.forEach(key => {
            const value = formatValue(row[key]);
            const truncated = value.length > 50 ? value.substring(0, 47) + '...' : value;
            html += `<td title="${escapeHtml(value)}">${escapeHtml(truncated)}</td>`;
        });
        html += '</tr>';
    });
    
    html += '</tbody></table></div>';
    
    // Pagination controls
    if (totalPages > 1) {
        html += `<div class="chat-response-pagination">`;
        
        // Previous button
        html += `<button class="chat-pagination-btn" onclick="goToChatPage('${paginationId}', 0)" ${totalPages <= 1 ? 'disabled' : ''}>← Previous</button>`;
        
        // Page info
        html += `<span class="chat-pagination-info"><span id="current-page-${paginationId}">1</span>/${totalPages}</span>`;
        
        // Next button
        html += `<button class="chat-pagination-btn" onclick="goToChatPage('${paginationId}', 2)">Next →</button>`;
        
        // Show all button
        html += `<button class="chat-pagination-btn chat-pagination-btn-primary" onclick="showAllChatResults('${paginationId}')">Show All ${rowCount}</button>`;
        
        html += `</div>`;
    }
    
    return html;
}

function goToChatPage(paginationId, direction) {
    const pagination = window.chatPagination[paginationId];
    if (!pagination) return;
    
    let newPage = pagination.currentPage;
    if (direction === 0) {
        newPage = Math.max(1, newPage - 1);
    } else if (direction === 2) {
        newPage = Math.min(pagination.totalPages, newPage + 1);
    }
    
    if (newPage === pagination.currentPage) return;
    
    pagination.currentPage = newPage;
    const startIdx = (newPage - 1) * pagination.itemsPerPage;
    const endIdx = Math.min(startIdx + pagination.itemsPerPage, pagination.data.length);
    const pageData = pagination.data.slice(startIdx, endIdx);
    
    // Update table
    const tableWrapper = document.getElementById('table-' + paginationId);
    let html = `<table class="chat-response-table"><thead><tr>`;
    
    pagination.keys.forEach(key => {
        html += `<th>${escapeHtml(key)}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    pageData.forEach(row => {
        html += '<tr>';
        pagination.keys.forEach(key => {
            const value = formatValue(row[key]);
            const truncated = value.length > 50 ? value.substring(0, 47) + '...' : value;
            html += `<td title="${escapeHtml(value)}">${escapeHtml(truncated)}</td>`;
        });
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    tableWrapper.innerHTML = html;
    
    // Update page info
    document.getElementById('current-page-' + paginationId).textContent = newPage;
    
    // Update pagination text
    const paginationInfoEl = tableWrapper.parentElement.querySelector('.chat-response-pagination-info');
    if (paginationInfoEl) {
        paginationInfoEl.textContent = `Showing ${startIdx + 1}-${endIdx} of ${pagination.totalRecords} records`;
    }
    
    // Scroll to table
    tableWrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showAllChatResults(paginationId) {
    const pagination = window.chatPagination[paginationId];
    if (!pagination) return;
    
    // Update table to show all
    const tableWrapper = document.getElementById('table-' + paginationId);
    let html = `<table class="chat-response-table"><thead><tr>`;
    
    pagination.keys.forEach(key => {
        html += `<th>${escapeHtml(key)}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    pagination.data.forEach(row => {
        html += '<tr>';
        pagination.keys.forEach(key => {
            const value = formatValue(row[key]);
            const truncated = value.length > 50 ? value.substring(0, 47) + '...' : value;
            html += `<td title="${escapeHtml(value)}">${escapeHtml(truncated)}</td>`;
        });
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    tableWrapper.innerHTML = html;
    
    // Hide pagination controls
    const paginationControls = tableWrapper.parentElement.querySelector('.chat-response-pagination');
    if (paginationControls) {
        paginationControls.style.display = 'none';
    }
    
    // Update info
    const paginationInfoEl = tableWrapper.parentElement.querySelector('.chat-response-pagination-info');
    if (paginationInfoEl) {
        paginationInfoEl.textContent = `Showing all ${pagination.totalRecords} records`;
    }
}

function formatValue(value) {
    if (value === null || value === undefined) {
        return '—';
    }
    if (typeof value === 'number') {
        // Format currency if it looks like money
        if (value > 1000 && value.toString().includes('.')) {
            return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
        }
        return value.toLocaleString();
    }
    if (typeof value === 'boolean') {
        return value ? '✓' : '✗';
    }
    if (typeof value === 'object') {
        return JSON.stringify(value);
    }
    return String(value);
}

function createChatMessage(role, content, isTyping = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}${isTyping ? ' typing' : ''}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    if (isTyping) {
        contentDiv.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    } else if (typeof content === 'string') {
        // Check if content looks like HTML (starts with <)
        if (content.trim().startsWith('<')) {
            contentDiv.innerHTML = content;
        } else {
            contentDiv.textContent = content;
        }
    } else {
        contentDiv.textContent = String(content);
    }
    
    messageDiv.appendChild(contentDiv);
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    messageDiv.appendChild(timeDiv);
    
    return messageDiv;
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}
