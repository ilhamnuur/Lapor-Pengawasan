// Global variables
let currentUser = null;
let currentView = 'overview';
let reports = [];
let users = [];
let activityTypes = [];
let deleteItemId = null;
let deleteItemType = null;
let filteredReports = [];
let reportPage = 1;
const REPORTS_PER_PAGE = 10;

// Calendar state
let calendarMonth = startOfMonth(new Date());
let selectedCalendarDate = toISODate(new Date());
let createDateBlocked = false;
let editDateBlocked = false;
let editOriginalDate = '';

// API Base URL
const API_BASE = '/api';

const VIEW_META = {
    overview: { title: 'Beranda', subtitle: 'Kalender & ringkasan kegiatan pengawasan' },
    reports: { title: 'Laporan Pengawasan', subtitle: 'Daftar seluruh laporan perjalanan dinas' },
    'create-report': { title: 'Buat Laporan', subtitle: 'Catat kegiatan pengawasan baru' },
    'edit-report': { title: 'Edit Laporan', subtitle: 'Perbarui laporan pengawasan' },
    users: { title: 'Manajemen User', subtitle: 'Kelola akun dan hak akses' },
    'activity-types': { title: 'Jenis Kegiatan', subtitle: 'Kelola kategori pengawasan' }
};

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
    setupEventListeners();
});

// Check if user is already authenticated
function checkAuthStatus() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
        currentUser = JSON.parse(user);
        showDashboard();
    } else {
        showLogin();
    }
}

// Setup event listeners
function setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Sidebar toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }
    
    // Sidebar overlay click
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }
    
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const view = e.currentTarget.getAttribute('data-view');
            switchView(view);
        });
    });
    
    // Forms
    const createReportForm = document.getElementById('createReportForm');
    if (createReportForm) {
        createReportForm.addEventListener('submit', handleCreateReport);
    }
    
    const editReportForm = document.getElementById('editReportForm');
    if (editReportForm) {
        editReportForm.addEventListener('submit', handleEditReport);
    }
    
    const userForm = document.getElementById('userForm');
    if (userForm) {
        userForm.addEventListener('submit', handleUserForm);
    }
    
    const activityTypeForm = document.getElementById('activityTypeForm');
    if (activityTypeForm) {
        activityTypeForm.addEventListener('submit', handleActivityTypeForm);
    }
    
    // Buttons
    // Activity Types: Download template + Upload Excel
    const downloadActivityTypesTemplateBtn = document.getElementById('downloadActivityTypesTemplateBtn');
    if (downloadActivityTypesTemplateBtn) {
        downloadActivityTypesTemplateBtn.addEventListener('click', downloadActivityTypesTemplate);
    }
    const uploadActivityTypesBtn = document.getElementById('uploadActivityTypesBtn');
    if (uploadActivityTypesBtn) {
        uploadActivityTypesBtn.addEventListener('click', showUploadActivityTypesModal);
    }

    const cancelCreateBtn = document.getElementById('cancelCreateBtn');
    if (cancelCreateBtn) {
        cancelCreateBtn.addEventListener('click', () => switchView('reports'));
    }
    
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => switchView('reports'));
    }
    
    const refreshReportsBtn = document.getElementById('refreshReportsBtn');
    if (refreshReportsBtn) {
        refreshReportsBtn.addEventListener('click', loadReports);
    }
    
    const printAllReportsBtn = document.getElementById('printAllReportsBtn');
    if (printAllReportsBtn) {
        printAllReportsBtn.addEventListener('click', printAllReports);
    }
    
    const exportExcelBtn = document.getElementById('exportExcelBtn');
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', exportToExcel);
    }
    
    // User management buttons
    const addUserBtn = document.getElementById('addUserBtn');
    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => showUserForm());
    }
    
    const downloadUsersTemplateBtn = document.getElementById('downloadUsersTemplateBtn');
    if (downloadUsersTemplateBtn) {
        downloadUsersTemplateBtn.addEventListener('click', downloadUsersTemplate);
    }

    const uploadUsersBtn = document.getElementById('uploadUsersBtn');
    if (uploadUsersBtn) {
        uploadUsersBtn.addEventListener('click', showUploadUsersModal);
    }

    const cancelUserBtn = document.getElementById('cancelUserBtn');
    if (cancelUserBtn) {
        cancelUserBtn.addEventListener('click', closeUserFormModal);
    }
    
    const closeUserFormModalBtn = document.getElementById('closeUserFormModal');
    if (closeUserFormModalBtn) {
        closeUserFormModalBtn.addEventListener('click', closeUserFormModal);
    }
    
    const closeUploadUsersModalBtn = document.getElementById('closeUploadUsersModal');
    if (closeUploadUsersModalBtn) {
        closeUploadUsersModalBtn.addEventListener('click', closeUploadUsersModal);
    }

    const cancelUploadUsersBtn = document.getElementById('cancelUploadUsersBtn');
    if (cancelUploadUsersBtn) {
        cancelUploadUsersBtn.addEventListener('click', closeUploadUsersModal);
    }

    const uploadUsersForm = document.getElementById('uploadUsersForm');
    if (uploadUsersForm) {
        uploadUsersForm.addEventListener('submit', handleUploadUsers);
    }
    
    // Activity type management buttons
    const addActivityTypeBtn = document.getElementById('addActivityTypeBtn');
    if (addActivityTypeBtn) {
        addActivityTypeBtn.addEventListener('click', () => showActivityTypeForm());
    }
    
    const cancelActivityTypeBtn = document.getElementById('cancelActivityTypeBtn');
    if (cancelActivityTypeBtn) {
        cancelActivityTypeBtn.addEventListener('click', closeActivityTypeFormModal);
    }
    
    const closeActivityTypeFormModalBtn = document.getElementById('closeActivityTypeFormModal');
    if (closeActivityTypeFormModalBtn) {
        closeActivityTypeFormModalBtn.addEventListener('click', closeActivityTypeFormModal);
    }

    
    // Upload Activity Types modal handlers
    const closeUploadActivityTypesModalBtn = document.getElementById('closeUploadActivityTypesModal');
    if (closeUploadActivityTypesModalBtn) {
        closeUploadActivityTypesModalBtn.addEventListener('click', closeUploadActivityTypesModal);
    }
    const cancelUploadActivityTypesBtn = document.getElementById('cancelUploadActivityTypesBtn');
    if (cancelUploadActivityTypesBtn) {
        cancelUploadActivityTypesBtn.addEventListener('click', closeUploadActivityTypesModal);
    }
    const uploadActivityTypesForm = document.getElementById('uploadActivityTypesForm');
    if (uploadActivityTypesForm) {
        uploadActivityTypesForm.addEventListener('submit', handleUploadActivityTypes);
    }

    // Modals
    const closeDetailModal = document.getElementById('closeDetailModal');
    if (closeDetailModal) {
        closeDetailModal.addEventListener('click', closeReportDetailModal);
    }
    
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', closeDeleteConfirmModal);
    }
    
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', confirmDelete);
    }
    
    // Search and filter
    const searchReports = document.getElementById('searchReports');
    if (searchReports) {
        searchReports.addEventListener('input', filterReports);
    }
    
    const filterByMonth = document.getElementById('filterByMonth');
    if (filterByMonth) {
        filterByMonth.addEventListener('change', filterReports);
    }

    const filterByActivityType = document.getElementById('filterByActivityType');
    if (filterByActivityType) {
        filterByActivityType.addEventListener('change', filterReports);
    }
    
    // Auto-fill day when date is selected + validasi tanggal terpakai
    const tanggalPelaksanaan = document.getElementById('tanggalPelaksanaan');
    if (tanggalPelaksanaan) {
        tanggalPelaksanaan.addEventListener('change', () => {
            autoFillDay();
            validateCreateDate();
        });
    }
    
    const editTanggalPelaksanaan = document.getElementById('editTanggalPelaksanaan');
    if (editTanggalPelaksanaan) {
        editTanggalPelaksanaan.addEventListener('change', () => {
            autoFillEditDay();
            validateEditDate();
        });
    }

    // Calendar controls
    const calendarPrev = document.getElementById('calendarPrev');
    if (calendarPrev) calendarPrev.addEventListener('click', () => changeCalendarMonth(-1));
    const calendarNext = document.getElementById('calendarNext');
    if (calendarNext) calendarNext.addEventListener('click', () => changeCalendarMonth(1));
    const calendarToday = document.getElementById('calendarToday');
    if (calendarToday) calendarToday.addEventListener('click', goToCalendarToday);

    // Home quick actions
    const homeCreateBtn = document.getElementById('homeCreateBtn');
    if (homeCreateBtn) homeCreateBtn.addEventListener('click', () => switchView('create-report'));
    const homeViewReportsBtn = document.getElementById('homeViewReportsBtn');
    if (homeViewReportsBtn) homeViewReportsBtn.addEventListener('click', () => switchView('reports'));
    const recentViewAllBtn = document.getElementById('recentViewAllBtn');
    if (recentViewAllBtn) recentViewAllBtn.addEventListener('click', () => switchView('reports'));
    const newReportTopBtn = document.getElementById('newReportTopBtn');
    if (newReportTopBtn) newReportTopBtn.addEventListener('click', () => switchView('create-report'));

    // Event delegation for reports table
    const reportsTableBody = document.getElementById('reportsTableBody');
    if (reportsTableBody) {
        reportsTableBody.addEventListener('click', handleReportAction);
    }
}

// Authentication functions
async function handleLogin(e) {
    e.preventDefault();
    showLoading();
    
    const formData = new FormData(e.target);
    const credentials = {
        username: formData.get('username'),
        password: formData.get('password')
    };
    
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(credentials)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            currentUser = data.user;
            showMessage('Login berhasil!', 'success');
            showDashboard();
        } else {
            showMessage(data.message || 'Login gagal', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('Terjadi kesalahan saat login', 'error');
    } finally {
        hideLoading();
    }
}

function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentUser = null;
    showLogin();
    showMessage('Logout berhasil', 'success');
}

// UI functions
function showLogin() {
    const loginScreen = document.getElementById('loginScreen');
    const dashboard = document.getElementById('dashboard');
    if (loginScreen) loginScreen.classList.remove('hidden');
    if (dashboard) dashboard.classList.add('hidden');
}

function showDashboard() {
    const loginScreen = document.getElementById('loginScreen');
    const dashboard = document.getElementById('dashboard');
    if (loginScreen) loginScreen.classList.add('hidden');
    if (dashboard) dashboard.classList.remove('hidden');
    
    updateUserInfo();
    setupRoleBasedUI();
    switchView('overview');
}

function updateUserInfo() {
    if (currentUser) {
        const userInfo = document.getElementById('userInfo');
        const roleLabel = document.getElementById('userRoleLabel');
        const avatar = document.getElementById('userAvatar');
        if (userInfo) userInfo.textContent = currentUser.name;
        if (roleLabel) roleLabel.textContent = currentUser.role === 'kepala' ? 'Kepala' : 'Pegawai';
        if (avatar) {
            const initials = String(currentUser.name || 'BPS')
                .split(/\s+/).filter(Boolean).slice(0, 2)
                .map(part => part.charAt(0).toUpperCase()).join('');
            avatar.textContent = initials || 'BPS';
        }
    }
}

function setupRoleBasedUI() {
    if (currentUser.role === 'pegawai') {
        document.querySelectorAll('.kepala-only').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.pegawai-only').forEach(el => el.classList.remove('hidden'));
    } else {
        document.querySelectorAll('.kepala-only').forEach(el => el.classList.remove('hidden'));
        document.querySelectorAll('.pegawai-only').forEach(el => el.classList.add('hidden'));
    }
}

function switchView(view) {
    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    
    // Show selected view
    const viewElement = document.getElementById(`${view}View`);
    if (viewElement) {
        viewElement.classList.remove('hidden');
    }
    
    // Update navigation active state
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-view') === view) {
            btn.classList.add('active');
        }
    });

    // Update page heading
    const meta = VIEW_META[view];
    const pageTitle = document.getElementById('pageTitle');
    const pageSubtitle = document.getElementById('pageSubtitle');
    if (meta) {
        if (pageTitle) pageTitle.textContent = meta.title;
        if (pageSubtitle) pageSubtitle.textContent = meta.subtitle;
    }
    
    currentView = view;
    
    // Load data based on view
    if (view === 'overview') {
        loadOverviewData();
    } else if (view === 'reports') {
        if (!activityTypes.length) loadActivityTypes();
        loadReports();
    } else if (view === 'create-report') {
        resetCreateForm();
        // Jenis kegiatan biasanya sudah dimuat; hindari reload yang bisa menimpa
        // pilihan hasil "Copy" pada form.
        if (!activityTypes.length) loadActivityTypes();
    } else if (view === 'edit-report') {
       // Data is loaded when editReport is called
    } else if (view === 'users') {
        loadUsers();
    } else if (view === 'activity-types') {
        loadActivityTypes();
    }

    // Close mobile menu
    closeSidebar();
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('sidebar-active');
        overlay.classList.toggle('active');
    }
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar && overlay) {
        sidebar.classList.remove('sidebar-active');
        overlay.classList.remove('active');
    }
}

// Data loading functions
async function loadOverviewData() {
    updateGreeting();
    try {
        await loadReports();
    } catch (error) {
        console.error('Error loading reports for overview:', error);
        showMessage('Gagal memuat data ringkasan', 'error');
    }
    // Tetap render kalender walau pengambilan data gagal, menggunakan data terakhir yang ada.
    updateOverviewStats();
    renderCalendar();
    renderSelectedDatePanel();
    loadRecentReports();
}

function updateGreeting() {
    const greetingEl = document.getElementById('greetingText');
    const todayEl = document.getElementById('todayText');
    const hour = new Date().getHours();
    const greeting = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam';
    if (greetingEl) {
        greetingEl.textContent = `${greeting}, ${currentUser?.name || 'Sahabat BPS'}!`;
    }
    if (todayEl) {
        todayEl.textContent = new Date().toLocaleDateString('id-ID', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
    }
}

async function loadReports() {
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE}/reports`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            reports = await response.json();
            reportPage = 1;
            filterReports();
        } else {
            throw new Error('Failed to load reports');
        }
    } catch (error) {
        console.error('Error loading reports:', error);
        showMessage('Gagal memuat data laporan', 'error');
    } finally {
        hideLoading();
    }
}

async function loadUsers() {
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE}/users`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            users = await response.json();
            updateUsersTable();
        } else {
            throw new Error('Failed to load users');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        showMessage('Gagal memuat data user', 'error');
    } finally {
        hideLoading();
    }
}

async function loadActivityTypes() {
    try {
        const response = await fetch(`${API_BASE}/activity-types`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            activityTypes = await response.json();
            updateActivityTypesTable();
            populateActivityTypeSelects();
        } else {
            throw new Error('Failed to load activity types');
        }
    } catch (error) {
        console.error('Error loading activity types:', error);
        showMessage('Gagal memuat data jenis kegiatan', 'error');
    }
}

function updateOverviewStats() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const totalReports = reports.length;
    const monthReports = reports.filter(report => {
        const iso = toISODate(report.tanggal_pelaksanaan);
        if (!iso) return false;
        const d = parseISODate(iso);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const monthlyReports = monthReports.length;
    const usedDayKeys = new Set(monthReports.map(report => toISODate(report.tanggal_pelaksanaan)).filter(Boolean));
    
    const totalReportsEl = document.getElementById('totalReports');
    const monthlyReportsEl = document.getElementById('monthlyReports');
    const usedDaysEl = document.getElementById('usedDays');
    
    if (totalReportsEl) totalReportsEl.textContent = totalReports;
    if (monthlyReportsEl) monthlyReportsEl.textContent = monthlyReports;
    if (usedDaysEl) usedDaysEl.textContent = usedDayKeys.size;
    
    if (currentUser?.role === 'kepala') {
        const uniquePegawai = new Set(reports.map(r => r.user_id)).size;
        const activePegawaiEl = document.getElementById('activePegawai');
        if (activePegawaiEl) activePegawaiEl.textContent = uniquePegawai;
    }
}

function loadRecentReports() {
    const recentReports = reports.slice(0, 5);
    const container = document.getElementById('recentReportsTable');
    
    if (!container) return;
    
    if (recentReports.length === 0) {
        container.innerHTML = `
            <div class="empty-row">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                <p>Belum ada laporan pengawasan.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `<div class="recent-list">${recentReports.map(report => {
        const iso = toISODate(report.tanggal_pelaksanaan);
        const date = iso ? parseISODate(iso) : null;
        const day = date ? date.getDate() : '-';
        const month = date ? date.toLocaleDateString('id-ID', { month: 'short' }) : '';
        const tujuan = report.tujuan_perjalanan_dinas || report.kegiatan_pengawasan || '-';
        return `
            <button class="recent-item" data-action="view-detail" data-id="${report.id}" style="border-left:0;border-right:0;border-bottom:0;background:transparent;width:100%;text-align:left;">
                <div class="date-pill"><strong>${day}</strong><span>${month}</span></div>
                <div class="recent-main">
                    <div class="recent-title">${escapeHtml(tujuan)}</div>
                    <div class="recent-sub">
                        <span>${escapeHtml(report.pegawai_name || '-')}</span>
                        <span>•</span>
                        <span>${escapeHtml(report.hari_pelaksanaan || '')}</span>
                        ${report.nomor_surat_tugas ? `<span>•</span><span>No. ST: ${escapeHtml(report.nomor_surat_tugas)}</span>` : ''}
                    </div>
                </div>
                <svg class="recent-arrow" width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </button>
        `;
    }).join('')}</div>`;

    // Recent items open the same detail modal.
    container.querySelectorAll('[data-action="view-detail"]').forEach(button => {
        button.addEventListener('click', () => viewReportDetail(button.dataset.id));
    });
}

function updateReportsTable() {
    const tbody = document.getElementById('reportsTableBody');
    
    if (!tbody) return;

    const totalReports = filteredReports.length;
    const totalPages = Math.max(1, Math.ceil(totalReports / REPORTS_PER_PAGE));
    if (reportPage > totalPages) reportPage = totalPages;
    if (reportPage < 1) reportPage = 1;
    const startIndex = (reportPage - 1) * REPORTS_PER_PAGE;
    const pageReports = filteredReports.slice(startIndex, startIndex + REPORTS_PER_PAGE);
    
    if (totalReports === 0) {
        tbody.innerHTML = `
            <tr><td colspan="6" class="empty-row">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                <p>Belum ada laporan yang sesuai.</p>
            </td></tr>
        `;
        renderReportsPagination();
        return;
    }
    
    tbody.innerHTML = pageReports.map(report => {
        const pegawaiName = report.pegawai_name || '-';
        const initials = pegawaiName.split(/\s+/).filter(Boolean).slice(0, 2)
            .map(part => part.charAt(0).toUpperCase()).join('');
        const tujuan = report.tujuan_perjalanan_dinas || report.kegiatan_pengawasan || '-';
        return `
        <tr>
            <td data-label="Pegawai">
                <div class="cell-person">
                    <div class="avatar" style="width:32px;height:32px;font-size:10px;">${escapeHtml(initials)}</div>
                    <div>
                        <div class="cell-main">${escapeHtml(pegawaiName)}</div>
                        <div class="cell-sub">Pegawai pengawasan</div>
                    </div>
                </div>
            </td>
            <td data-label="Jenis Kegiatan">
                <span class="badge badge-primary">${escapeHtml(report.activity_type_name || 'Lainnya')}</span>
            </td>
            <td data-label="Tujuan">
                <div class="cell-main" style="white-space:normal;line-height:1.5;">${escapeHtml(tujuan)}</div>
                ${report.nomor_surat_tugas ? `<div class="cell-sub">No. ST: ${escapeHtml(report.nomor_surat_tugas)}</div>` : ''}
            </td>
            <td data-label="Tanggal" style="white-space:nowrap;">
                <div class="cell-main">${formatDate(report.tanggal_pelaksanaan)}</div>
                <div class="cell-sub">${escapeHtml(report.hari_pelaksanaan || '')}</div>
            </td>
            <td data-label="Status">
                <span class="badge badge-success">Selesai</span>
            </td>
            <td data-label="Aksi">
                <div class="action-group">
                    <button data-action="view-detail" data-id="${report.id}" class="action-link" style="color:var(--brand);border-color:#c7d2fe;background:var(--brand-soft);">Detail</button>
                    <button data-action="print" data-id="${report.id}" class="action-link">Cetak</button>
                    ${canEditReport(report) ? `
                        <button data-action="edit" data-id="${report.id}" class="action-link warn">Edit</button>
                        <button data-action="copy" data-id="${report.id}" class="action-link green">Copy</button>
                        <button data-action="delete" data-id="${Number(report.id)}" class="action-link danger">Hapus</button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `;
    }).join('');

    renderReportsPagination();
}

function renderReportsPagination() {
    const container = document.getElementById('reportsPagination');
    if (!container) return;

    const totalReports = filteredReports.length;
    if (totalReports <= REPORTS_PER_PAGE) {
        container.hidden = true;
        container.innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(totalReports / REPORTS_PER_PAGE);
    const startNumber = (reportPage - 1) * REPORTS_PER_PAGE + 1;
    const endNumber = Math.min(reportPage * REPORTS_PER_PAGE, totalReports);

    const maxButtons = 5;
    let firstPage = Math.max(1, reportPage - 2);
    let lastPage = Math.min(totalPages, firstPage + maxButtons - 1);
    firstPage = Math.max(1, lastPage - maxButtons + 1);

    const pageButtons = [];
    for (let page = firstPage; page <= lastPage; page++) {
        pageButtons.push(
            `<button type="button" class="page-btn${page === reportPage ? ' is-active' : ''}" data-page="${page}"${page === reportPage ? ' aria-current="page"' : ''}>${page}</button>`
        );
    }

    container.hidden = false;
    container.innerHTML = `
        <div class="pagination-info">Menampilkan ${startNumber}–${endNumber} dari ${totalReports} laporan</div>
        <div class="pagination-pages">
            <button type="button" class="page-btn" data-page="${reportPage - 1}"${reportPage === 1 ? ' disabled' : ''}>‹ Sebelumnya</button>
            ${pageButtons.join('')}
            <button type="button" class="page-btn" data-page="${reportPage + 1}"${reportPage === totalPages ? ' disabled' : ''}>Berikutnya ›</button>
        </div>
    `;

    container.querySelectorAll('[data-page]').forEach(button => {
        button.addEventListener('click', () => {
            const page = parseInt(button.dataset.page, 10);
            if (!Number.isInteger(page) || page < 1 || page > totalPages || page === reportPage) return;
            reportPage = page;
            updateReportsTable();
            document.getElementById('reportsView')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}

function updateUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    
    if (!tbody) return;
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-row"><p>Belum ada user.</p></td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(user => {
        const initials = String(user.name || user.username || '?').split(/\s+/).filter(Boolean).slice(0, 2)
            .map(part => part.charAt(0).toUpperCase()).join('');
        return `
        <tr>
            <td data-label="Username">
                <div class="cell-person">
                    <div class="avatar" style="width:32px;height:32px;font-size:10px;">${escapeHtml(initials)}</div>
                    <div class="cell-main">${escapeHtml(user.username)}</div>
                </div>
            </td>
            <td data-label="Nama"><div class="cell-main">${escapeHtml(user.name)}</div></td>
            <td data-label="Role">
                <span class="badge ${user.role === 'kepala' ? 'badge-primary' : 'badge-success'}">
                    ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </span>
            </td>
            <td data-label="Dibuat"><div class="cell-sub" style="margin-top:0;">${formatDate(user.created_at)}</div></td>
            <td data-label="Aksi">
                <div class="action-group">
                    <button onclick="editUser(${user.id})" class="action-link warn">Edit</button>
                    ${user.id !== currentUser.id ? `<button onclick="deleteUser(${user.id})" class="action-link danger">Hapus</button>` : ''}
                </div>
            </td>
        </tr>
    `;
    }).join('');
}

function updateActivityTypesTable() {
    const tbody = document.getElementById('activityTypesTableBody');
    
    if (!tbody) return;
    
    if (activityTypes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-row"><p>Belum ada jenis kegiatan.</p></td></tr>';
        return;
    }
    
    tbody.innerHTML = activityTypes.map(activityType => `
        <tr>
            <td data-label="Nama"><div class="cell-main">${escapeHtml(activityType.name)}</div></td>
            <td data-label="Deskripsi"><div class="cell-sub" style="margin-top:0;">${escapeHtml(activityType.description || '-')}</div></td>
            <td data-label="Surat Tugas">
                ${activityType.surat_tugas_path
                    ? `<a class="action-link" style="color:var(--brand);border-color:#c7d2fe;background:var(--brand-soft);" href="/${escapeHtml(activityType.surat_tugas_path)}" target="_blank" rel="noopener">Lihat PDF</a>`
                    : '<span class="cell-sub" style="margin-top:0;">-</span>'}
            </td>
            <td data-label="Dibuat"><div class="cell-sub" style="margin-top:0;">${formatDate(activityType.created_at)}</div></td>
            <td data-label="Aksi">
                <div class="action-group">
                    <button onclick="editActivityType(${activityType.id})" class="action-link warn">Edit</button>
                    <button onclick="deleteActivityType(${activityType.id})" class="action-link danger">Hapus</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function populateActivityTypeSelects() {
    const selects = ['activityType', 'editActivityType'];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            const currentValue = select.value;
            select.innerHTML = '<option value="">Pilih Jenis Kegiatan</option>';
            
            activityTypes.forEach(activityType => {
                const option = document.createElement('option');
                option.value = activityType.id;
                option.textContent = activityType.name;
                if (activityType.id == currentValue) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        }
    });

    // Filter daftar laporan berdasarkan jenis kegiatan.
    const filterSelect = document.getElementById('filterByActivityType');
    if (filterSelect) {
        const currentValue = filterSelect.value;
        filterSelect.innerHTML = '<option value="">Semua Jenis Kegiatan</option>';
        activityTypes.forEach(activityType => {
            const option = document.createElement('option');
            option.value = activityType.id;
            option.textContent = activityType.name;
            filterSelect.appendChild(option);
        });
        filterSelect.value = currentValue;
        if (filterSelect.value !== currentValue) filterSelect.value = '';
    }
}

// Report functions
function canEditReport(report) {
    return currentUser.role === 'pegawai' && report.user_id === currentUser.id;
}

async function handleCreateReport(e) {
    e.preventDefault();

    // Validasi sisi klien: cegah submit jika tanggal sudah dipakai.
    validateCreateDate();
    if (createDateBlocked) {
        showMessage('Tanggal tersebut sudah dipakai. Silakan pilih tanggal lain.', 'error');
        document.getElementById('tanggalPelaksanaan')?.focus();
        return;
    }

    showLoading();
    
    const formData = new FormData(e.target);
    // Normalize optional fields
    if (!formData.get('nomor_surat_tugas')) {
        formData.set('nomor_surat_tugas', '');
    }
    
    try {
        const response = await fetch(`${API_BASE}/reports`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage('Laporan berhasil dibuat!', 'success');
            resetCreateForm();
            // Bersihkan form state tersimpan agar tidak mengisi ulang
            if (window.__formPersistence) window.__formPersistence.clear('createReport');
            switchView('reports');
            loadReports();
        } else {
            if (response.status === 409) {
                createDateBlocked = true;
                const dateInput = document.getElementById('tanggalPelaksanaan');
                if (dateInput) dateInput.classList.add('is-invalid');
                const submitBtn = document.getElementById('createReportSubmitBtn');
                if (submitBtn) submitBtn.disabled = true;
                renderDateStatus('createDateStatus', 'blocked', data.message || 'Tanggal sudah dipakai.');
            }
            showMessage(data.message || 'Gagal membuat laporan', 'error');
        }
    } catch (error) {
        console.error('Error creating report:', error);
        showMessage('Terjadi kesalahan saat membuat laporan', 'error');
    } finally {
        hideLoading();
    }
}

async function handleEditReport(e) {
    e.preventDefault();

    validateEditDate();
    if (editDateBlocked) {
        showMessage('Tanggal tersebut sudah dipakai laporan lain. Silakan pilih tanggal lain.', 'error');
        document.getElementById('editTanggalPelaksanaan')?.focus();
        return;
    }

    showLoading();
    
    const formData = new FormData(e.target);
    const reportId = formData.get('reportId');

    // Pastikan tujuan_perjalanan_dinas dikirim (kompatibel dengan form input yang sudah diganti)
    // Jika browser masih mengirim "kegiatan_pengawasan" dari cache lama, salin ke tujuan_perjalanan_dinas.
    if (!formData.get('tujuan_perjalanan_dinas') && formData.get('kegiatan_pengawasan')) {
        formData.set('tujuan_perjalanan_dinas', formData.get('kegiatan_pengawasan'));
    }

    // Normalize optional fields
    if (!formData.get('nomor_surat_tugas')) {
        formData.set('nomor_surat_tugas', '');
    }
    
    try {
        const response = await fetch(`${API_BASE}/reports/${reportId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage('Laporan berhasil diupdate!', 'success');
            // Bersihkan form state tersimpan agar tidak mengisi ulang
            if (window.__formPersistence) window.__formPersistence.clear('editReport');
            switchView('reports');
            loadReports();
        } else {
            if (response.status === 409) {
                editDateBlocked = true;
                const dateInput = document.getElementById('editTanggalPelaksanaan');
                if (dateInput) dateInput.classList.add('is-invalid');
                const submitBtn = document.getElementById('editReportSubmitBtn');
                if (submitBtn) submitBtn.disabled = true;
                renderDateStatus('editDateStatus', 'blocked', data.message || 'Tanggal sudah dipakai.');
            }
            showMessage(data.message || 'Gagal mengupdate laporan', 'error');
        }
    } catch (error) {
        console.error('Error updating report:', error);
        showMessage('Terjadi kesalahan saat mengupdate laporan', 'error');
    } finally {
        hideLoading();
    }
}

function resetCreateForm() {
    const form = document.getElementById('createReportForm');
    if (form) {
        form.reset();
    }
    createDateBlocked = false;
    const dateInput = document.getElementById('tanggalPelaksanaan');
    if (dateInput) dateInput.classList.remove('is-invalid');
    renderDateStatus('createDateStatus', null, '');
}

async function viewReportDetail(reportId) {
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE}/reports/${reportId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const report = await response.json();
            showReportDetailModal(report);
        } else {
            throw new Error('Failed to load report detail');
        }
    } catch (error) {
        console.error('Error loading report detail:', error);
        showMessage('Gagal memuat detail laporan', 'error');
    } finally {
        hideLoading();
    }
}

// =================== FORM STATE PERSISTENCE ===================
// Simpan nilai form ke localStorage agar tidak hilang saat reload
(function setupFormPersistence() {
    // Mapping form id -> storage key prefix
    const forms = [
        { id: 'createReportForm', key: 'createReport' },
        { id: 'editReportForm', key: 'editReport' }
    ];

    function saveFormToStorage(formEl, keyPrefix) {
        if (!formEl) return;
        const data = {};
        Array.from(formEl.elements).forEach(el => {
            if (!el.name) return;
            if (el.type === 'file') return;
            if (el.type === 'checkbox' || el.type === 'radio') {
                data[el.name] = el.checked;
            } else {
                data[el.name] = el.value;
            }
        });
        try {
            localStorage.setItem(`formState:${keyPrefix}`, JSON.stringify(data));
        } catch (e) {
            // ignore quota errors
        }
    }

    function restoreFormFromStorage(formEl, keyPrefix) {
        if (!formEl) return;
        const raw = localStorage.getItem(`formState:${keyPrefix}`);
        if (!raw) return;
        let data = {};
        try { data = JSON.parse(raw) || {}; } catch { data = {}; }
        Array.from(formEl.elements).forEach(el => {
            if (!el.name) return;
            if (!(el.name in data)) return;
            if (el.type === 'file') return;
            if (el.type === 'checkbox' || el.type === 'radio') {
                el.checked = !!data[el.name];
            } else {
                // Jangan overwrite jika element punya value yang lebih baru via populate
                if (el.value === '' || el.dataset.allowRestore === 'force') {
                    el.value = data[el.name] ?? '';
                }
            }
        });
    }

    function clearFormStorage(keyPrefix) {
        localStorage.removeItem(`formState:${keyPrefix}`);
    }

    // Pasang listeners untuk simpan otomatis on input
    window.addEventListener('DOMContentLoaded', () => {
        forms.forEach(({ id, key }) => {
            const formEl = document.getElementById(id);
            if (!formEl) return;

            // Restore saat load
            restoreFormFromStorage(formEl, key);

            // Simpan perubahan setiap input berubah
            formEl.addEventListener('input', () => saveFormToStorage(formEl, key));
            formEl.addEventListener('change', () => saveFormToStorage(formEl, key));

            // Bersihkan storage saat submit sukses (handleCreateReport/handleEditReport akan memanggil clear juga)
            formEl.addEventListener('submit', () => clearFormStorage(key));
        });
    });

    // Ekspor helper agar bisa dipanggil setelah submit sukses atau reset
    window.__formPersistence = {
        save: saveFormToStorage,
        restore: restoreFormFromStorage,
        clear: clearFormStorage
    };
})();

function showReportDetailModal(report) {
    const modal = document.getElementById('reportDetailModal');
    const content = document.getElementById('reportDetailContent');
    
    if (!modal || !content) return;
    
    content.innerHTML = `
        <div class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Nama Pegawai</label>
                    <p class="text-gray-900">${report.pegawai_name}</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Jenis Kegiatan</label>
                    <p class="text-gray-900">${escapeHtml(report.activity_type_name || 'Lainnya')}</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Nomor Surat Tugas</label>
                    <p class="text-gray-900">${report.nomor_surat_tugas || '-'}</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Tanggal Pelaksanaan</label>
                    <p class="text-gray-900">${formatDate(report.tanggal_pelaksanaan)}</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Hari Pelaksanaan</label>
                    <p class="text-gray-900">${report.hari_pelaksanaan}</p>
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Tujuan Perjalanan Dinas</label>
                    <p class="text-gray-900">${report.tujuan_perjalanan_dinas || report.kegiatan_pengawasan}</p>
                </div>
            </div>
            
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Aktivitas yang Dilakukan</label>
                <p class="text-gray-900 whitespace-pre-wrap">${report.aktivitas}</p>
            </div>
            
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Permasalahan</label>
                <p class="text-gray-900 whitespace-pre-wrap">${report.permasalahan || 'Tidak ada permasalahan'}</p>
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Petugas/Responden yang Ditemui</label>
                <p class="text-gray-900 whitespace-pre-wrap">${report.petugas_responden || '-'}</p>
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Solusi/Langkah Antisipatif</label>
                <p class="text-gray-900 whitespace-pre-wrap">${report.solusi_antisipasi || '-'}</p>
            </div>
            
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Foto Dokumentasi</label>
                <div class="mt-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    ${report.foto_dokumentasi && report.foto_dokumentasi.length > 0 ?
                        report.foto_dokumentasi.map(photoPath => `
                            <div>
                                <img src="/${photoPath.replace(/\\/g, '/')}" alt="Foto Dokumentasi" class="rounded-lg object-cover h-48 w-full">
                            </div>
                        `).join('') :
                        '<p class="text-gray-500">Tidak ada foto dokumentasi.</p>'
                    }
                </div>
            </div>
            
            <div class="flex justify-end space-x-4 pt-4 border-t">
                <button onclick="printReport(${report.id})" class="btn-primary px-4 py-2 rounded-md">
                    <div class="flex items-center space-x-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H3a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 00-2-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
                        </svg>
                        <span>Cetak PDF</span>
                    </div>
                </button>
            </div>
        </div>
    `;
    // Ensure report object reflects optional field for downstream usage
    if (!report.nomor_surat_tugas) {
        report.nomor_surat_tugas = '';
    }
    
    modal.classList.remove('hidden');
}

function closeReportDetailModal() {
    const modal = document.getElementById('reportDetailModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

async function editReport(reportId) {
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE}/reports/${reportId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const report = await response.json();
            // Bersihkan draft edit sebelumnya agar nilai dari server (terutama tanggal) tidak tertimpa data lama.
            if (window.__formPersistence) window.__formPersistence.clear('editReport');
            await loadActivityTypes(); // Ensure activity types are loaded before populating
            populateEditForm(report);
            switchView('edit-report');
        } else {
            throw new Error('Failed to load report for editing');
        }
    } catch (error) {
        console.error('Error loading report for editing:', error);
        showMessage('Gagal memuat data laporan untuk diedit', 'error');
    } finally {
        hideLoading();
    }
}

function populateEditForm(report) {
    // Normalisasi nilai agar tidak muncul "undefined" di input
    const tujuanPerjalanan = (report.tujuan_perjalanan_dinas != null && report.tujuan_perjalanan_dinas !== '')
        ? report.tujuan_perjalanan_dinas
        : (report.kegiatan_pengawasan || '');

    const elements = {
        'editReportId': report.id ?? '',
        'editActivityType': report.activity_type_id ?? '',
        'editNomorSuratTugas': report.nomor_surat_tugas || '',
        // Ganti ke field tujuan_perjalanan_dinas (fallback ke kegiatan_pengawasan bila legacy)
        'editKegiatanPengawasan': tujuanPerjalanan,
        // PENTING: input type=date hanya menerima YYYY-MM-DD. Jangan kirim ISO datetime / Date mentah.
        'editTanggalPelaksanaan': toISODate(report.tanggal_pelaksanaan) || '',
        'editHariPelaksanaan': report.hari_pelaksanaan || '',
        'editAktivitas': report.aktivitas || '',
        'editPermasalahan': report.permasalahan || '',
        'editPetugasResponden': report.petugas_responden || '',
        'editSolusiAntisipasi': report.solusi_antisipasi || ''
    };

    // Simpan tanggal asli untuk membedakan "tanggal tetap" vs "tanggal diubah".
    editOriginalDate = toISODate(report.tanggal_pelaksanaan) || '';

    Object.keys(elements).forEach(id => {
        const element = document.getElementById(id);
        if (element != null) {
            element.value = elements[id];
            // Tandai agar form persistence boleh overwrite jika restore diperlukan
            element.dataset.allowRestore = 'force';
        }
    });

    // Jangan restore draft lokal di sini. Draft lama bisa berisi tanggal kosong dan
    // menimpa tanggal yang baru saja dimuat dari server (bug tanggal reset saat edit).

    const currentFotoDokumentasi = document.getElementById('currentFotoDokumentasi');
    if (currentFotoDokumentasi) {
        currentFotoDokumentasi.innerHTML = report.foto_dokumentasi && report.foto_dokumentasi.length > 0
            ? `Ada ${report.foto_dokumentasi.length} foto telah diunggah.`
            : 'Tidak ada foto dokumentasi.';
    }

    editDateBlocked = false;
    const dateInput = document.getElementById('editTanggalPelaksanaan');
    if (dateInput) dateInput.classList.remove('is-invalid');
    validateEditDate();
}

function deleteReport(reportId) {
    deleteItemId = Number(reportId);
    deleteItemType = 'report';
    const modal = document.getElementById('deleteConfirmModal');
    const message = document.getElementById('deleteConfirmMessage');
    if (modal && message) {
        message.textContent = 'Apakah Anda yakin ingin menghapus laporan ini?';
        modal.classList.remove('hidden');
    }
}

// User management functions
async function handleUserForm(e) {
    e.preventDefault();
    showLoading();
    
    const formData = new FormData(e.target);
    const userId = formData.get('userId');
    const userData = {
        username: formData.get('username'),
        password: formData.get('password'),
        name: formData.get('name'),
        role: formData.get('role')
    };
    
    // Remove empty password for edit
    if (userId && !userData.password) {
        delete userData.password;
    }
    
    try {
        const url = userId ? `${API_BASE}/users/${userId}` : `${API_BASE}/users`;
        const method = userId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(userData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage(userId ? 'User berhasil diupdate!' : 'User berhasil dibuat!', 'success');
            closeUserFormModal();
            loadUsers();
        } else {
            showMessage(data.message || 'Gagal menyimpan user', 'error');
        }
    } catch (error) {
        console.error('Error saving user:', error);
        showMessage('Terjadi kesalahan saat menyimpan user', 'error');
    } finally {
        hideLoading();
    }
}

function showUserForm(user = null) {
    const modal = document.getElementById('userFormModal');
    const title = document.getElementById('userFormTitle');
    const form = document.getElementById('userForm');
    const passwordHint = document.getElementById('passwordHint');
    const passwordField = document.getElementById('userPassword');
    
    if (!modal || !title || !form) return;
    
    if (user) {
        title.textContent = 'Edit User';
        document.getElementById('userId').value = user.id;
        document.getElementById('userUsername').value = user.username;
        document.getElementById('userPassword').value = '';
        document.getElementById('userName').value = user.name;
        document.getElementById('userRole').value = user.role;
        
        if (passwordField) passwordField.required = false;
        if (passwordHint) passwordHint.classList.remove('hidden');
    } else {
        title.textContent = 'Tambah User';
        form.reset();
        document.getElementById('userId').value = '';
        
        if (passwordField) passwordField.required = true;
        if (passwordHint) passwordHint.classList.add('hidden');
    }
    
    modal.classList.remove('hidden');
}

function closeUserFormModal() {
    const modal = document.getElementById('userFormModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

async function editUser(userId) {
    const user = users.find(u => u.id === userId);
    if (user) {
        showUserForm(user);
    }
}

function deleteUser(userId) {
    deleteItemId = userId;
    deleteItemType = 'user';
    const modal = document.getElementById('deleteConfirmModal');
    const message = document.getElementById('deleteConfirmMessage');
    if (modal && message) {
        message.textContent = 'Apakah Anda yakin ingin menghapus user ini?';
        modal.classList.remove('hidden');
    }
}

function showUploadUsersModal() {
    const modal = document.getElementById('uploadUsersModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function showUploadActivityTypesModal() {
    const modal = document.getElementById('uploadActivityTypesModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeUploadActivityTypesModal() {
    const modal = document.getElementById('uploadActivityTypesModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

async function downloadActivityTypesTemplate() {
    showLoading();
    try {
        const response = await fetch(`${API_BASE}/activity-types/template`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'template_jenis_kegiatan.xlsx';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            showMessage('Template jenis kegiatan berhasil didownload!', 'success');
        } else {
            const j = await response.json().catch(() => ({}));
            throw new Error(j.message || 'Failed to download template');
        }
    } catch (error) {
        console.error('Error downloading activity types template:', error);
        showMessage('Gagal mendownload template jenis kegiatan', 'error');
    } finally {
        hideLoading();
    }
}

async function handleUploadActivityTypes(e) {
    e.preventDefault();
    showLoading();

    try {
        const formData = new FormData(e.target);
        const response = await fetch(`${API_BASE}/activity-types/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
        });

        const data = await response.json();
        if (response.ok) {
            showMessage(data.message || 'Upload jenis kegiatan berhasil', 'success');
            closeUploadActivityTypesModal();
            loadActivityTypes();
        } else {
            showMessage(data.message || 'Gagal upload jenis kegiatan', 'error');
        }
    } catch (error) {
        console.error('Error uploading activity types:', error);
        showMessage('Terjadi kesalahan saat upload jenis kegiatan', 'error');
    } finally {
        hideLoading();
    }
}

function closeUploadUsersModal() {
    const modal = document.getElementById('uploadUsersModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

async function downloadUsersTemplate() {
    showLoading();
    try {
        const response = await fetch(`${API_BASE}/users/template`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'template_upload_users.xlsx';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            showMessage('Template berhasil didownload!', 'success');
        } else {
            throw new Error('Failed to download template');
        }
    } catch (error) {
        console.error('Error downloading template:', error);
        showMessage('Gagal mendownload template', 'error');
    } finally {
        hideLoading();
    }
}

async function handleUploadUsers(e) {
    e.preventDefault();
    showLoading();
    
    const formData = new FormData(e.target);
    
    try {
        const response = await fetch(`${API_BASE}/users/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage(data.message || 'Users uploaded successfully!', 'success');
            closeUploadUsersModal();
            loadUsers();
        } else {
            showMessage(data.message || 'Failed to upload users', 'error');
        }
    } catch (error) {
        console.error('Error uploading users:', error);
        showMessage('An error occurred while uploading users', 'error');
    } finally {
        hideLoading();
    }
}

// Activity type management functions
async function handleActivityTypeForm(e) {
    e.preventDefault();
    showLoading();
    
    const formData = new FormData(e.target);
    const activityTypeId = formData.get('activityTypeId');
    const payload = new FormData();
    payload.append('name', formData.get('name') || '');
    payload.append('description', formData.get('description') || '');

    const fileInput = document.getElementById('activityTypeSuratTugas');
    if (fileInput && fileInput.files && fileInput.files[0]) {
        payload.append('surat_tugas', fileInput.files[0]);
    }
    const removeCheckbox = document.getElementById('activityTypeRemoveSuratTugas');
    if (removeCheckbox && removeCheckbox.checked) {
        payload.append('remove_surat_tugas', '1');
    }
    
    try {
        const url = activityTypeId ? `${API_BASE}/activity-types/${activityTypeId}` : `${API_BASE}/activity-types`;
        const method = activityTypeId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: payload
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage(activityTypeId ? 'Jenis kegiatan berhasil diupdate!' : 'Jenis kegiatan berhasil dibuat!', 'success');
            closeActivityTypeFormModal();
            loadActivityTypes();
        } else {
            showMessage(data.message || 'Gagal menyimpan jenis kegiatan', 'error');
        }
    } catch (error) {
        console.error('Error saving activity type:', error);
        showMessage('Terjadi kesalahan saat menyimpan jenis kegiatan', 'error');
    } finally {
        hideLoading();
    }
}

function showActivityTypeForm(activityType = null) {
    const modal = document.getElementById('activityTypeFormModal');
    const title = document.getElementById('activityTypeFormTitle');
    const form = document.getElementById('activityTypeForm');
    
    if (!modal || !title || !form) return;
    
    if (activityType) {
        title.textContent = 'Edit Jenis Kegiatan';
        document.getElementById('activityTypeId').value = activityType.id;
        document.getElementById('activityTypeName').value = activityType.name;
        document.getElementById('activityTypeDescription').value = activityType.description || '';
    } else {
        title.textContent = 'Tambah Jenis Kegiatan';
        form.reset();
        document.getElementById('activityTypeId').value = '';
    }

    // Reset input file & status surat tugas setiap kali modal dibuka.
    const fileInput = document.getElementById('activityTypeSuratTugas');
    if (fileInput) fileInput.value = '';

    const currentEl = document.getElementById('activityTypeSuratTugasCurrent');
    const removeWrap = document.getElementById('activityTypeRemoveSuratTugasWrap');
    const removeCheckbox = document.getElementById('activityTypeRemoveSuratTugas');
    if (removeCheckbox) removeCheckbox.checked = false;

    const hasFile = !!(activityType && activityType.surat_tugas_path);
    if (currentEl) {
        if (hasFile) {
            currentEl.innerHTML = `Surat tugas saat ini: <a href="/${escapeHtml(activityType.surat_tugas_path)}" target="_blank" rel="noopener">lihat PDF</a>`;
            currentEl.classList.remove('hidden');
        } else {
            currentEl.innerHTML = '';
            currentEl.classList.add('hidden');
        }
    }
    if (removeWrap) removeWrap.classList.toggle('hidden', !hasFile);
    
    modal.classList.remove('hidden');
}

function closeActivityTypeFormModal() {
    const modal = document.getElementById('activityTypeFormModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

async function editActivityType(activityTypeId) {
    const activityType = activityTypes.find(at => at.id === activityTypeId);
    if (activityType) {
        showActivityTypeForm(activityType);
    }
}

function deleteActivityType(activityTypeId) {
    deleteItemId = activityTypeId;
    deleteItemType = 'activity-type';
    const modal = document.getElementById('deleteConfirmModal');
    const message = document.getElementById('deleteConfirmMessage');
    if (modal && message) {
        message.textContent = 'Apakah Anda yakin ingin menghapus jenis kegiatan ini?';
        modal.classList.remove('hidden');
    }
}

// Delete confirmation functions
function closeDeleteConfirmModal() {
    deleteItemId = null;
    deleteItemType = null;
    const modal = document.getElementById('deleteConfirmModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

async function confirmDelete() {
    // Validasi awal
    if (deleteItemType == null) {
        console.warn('confirmDelete: deleteItemType is null');
        return;
    }

    const type = String(deleteItemType).toLowerCase().trim();

    // Pastikan id valid number
    const idNum = Number(deleteItemId);
    if (!Number.isFinite(idNum) || idNum <= 0) {
        console.warn('confirmDelete: invalid deleteItemId', deleteItemId);
        showMessage('ID item tidak valid. Coba ulangi aksi hapus.', 'error');
        // Jangan lanjut request DELETE jika id invalid
        closeDeleteConfirmModal();
        return;
    }

    showLoading();
    closeDeleteConfirmModal();

    try {
        let url = null;
        if (type === 'report') {
            url = `${API_BASE}/reports/${idNum}`;
        } else if (type === 'user') {
            url = `${API_BASE}/users/${idNum}`;
        } else if (type === 'activity-type') {
            url = `${API_BASE}/activity-types/${idNum}`;
        } else {
            console.warn('Unknown delete type, received:', deleteItemType);
            throw new Error('Invalid delete type');
        }

        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (response.ok) {
            showMessage('Item berhasil dihapus!', 'success');

            if (type === 'report') {
                await loadReports();
            } else if (type === 'user') {
                await loadUsers();
            } else if (type === 'activity-type') {
                await loadActivityTypes();
            }
        } else {
            let data = {};
            try { data = await response.json(); } catch {}
            showMessage(data.message || 'Gagal menghapus item', 'error');
        }
    } catch (error) {
        console.error('Error deleting item:', error);
        showMessage(error?.message || 'Terjadi kesalahan saat menghapus item', 'error');
    } finally {
        hideLoading();
        // Reset state untuk mencegah reuse nilai lama
        deleteItemId = null;
        deleteItemType = null;
    }
}

// PDF and Export functions
async function printReport(reportId) {
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE}/pdf/report/${reportId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `laporan_pengawasan_${reportId}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            showMessage('PDF berhasil didownload!', 'success');
        } else {
            throw new Error('Failed to generate PDF');
        }
    } catch (error) {
        console.error('Error generating PDF:', error);
        showMessage('Gagal membuat PDF', 'error');
    } finally {
        hideLoading();
    }
}

async function printAllReports() {
    if (currentUser.role !== 'kepala') return;
    
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE}/pdf/all-reports`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'laporan_semua_kegiatan_pengawasan.pdf';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            showMessage('PDF berhasil didownload!', 'success');
        } else {
            throw new Error('Failed to generate PDF');
        }
    } catch (error) {
        console.error('Error generating PDF:', error);
        showMessage('Gagal membuat PDF', 'error');
    } finally {
        hideLoading();
    }
}

async function exportToExcel() {
    if (currentUser.role !== 'kepala') return;
    
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE}/excel/reports`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'laporan_pengawasan.xlsx';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            showMessage('Excel berhasil didownload!', 'success');
        } else {
            throw new Error('Failed to generate Excel');
        }
    } catch (error) {
        console.error('Error generating Excel:', error);
        showMessage('Gagal membuat Excel', 'error');
    } finally {
        hideLoading();
    }
}

// Search and filter functions
function filterReports() {
    const searchTerm = document.getElementById('searchReports')?.value.toLowerCase() || '';
    const selectedMonth = document.getElementById('filterByMonth')?.value || '';
    const selectedActivityType = document.getElementById('filterByActivityType')?.value || '';
    
    filteredReports = reports.filter(report => {
        const tujuan = (report.tujuan_perjalanan_dinas || report.kegiatan_pengawasan || '').toLowerCase();
        const matchesSearch = tujuan.includes(searchTerm) ||
                              (report.pegawai_name || '').toLowerCase().includes(searchTerm) ||
                              (report.aktivitas || '').toLowerCase().includes(searchTerm) ||
                              (report.activity_type_name || '').toLowerCase().includes(searchTerm);
        
        const reportMonth = toISODate(report.tanggal_pelaksanaan);
        const matchesMonth = !selectedMonth ||
                           (reportMonth && parseISODate(reportMonth).getMonth() + 1 === parseInt(selectedMonth));

        const matchesActivityType = !selectedActivityType ||
                           String(report.activity_type_id || '') === String(selectedActivityType);
        
        return matchesSearch && matchesMonth && matchesActivityType;
    });

    reportPage = 1;
    updateReportsTable();
}

// Utility functions
function autoFillDay() {
    const dateInput = document.getElementById('tanggalPelaksanaan');
    const daySelect = document.getElementById('hariPelaksanaan');
    
    if (dateInput && daySelect && dateInput.value) {
        const date = new Date(dateInput.value);
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        daySelect.value = days[date.getDay()];
    }
}

function autoFillEditDay() {
    const dateInput = document.getElementById('editTanggalPelaksanaan');
    const daySelect = document.getElementById('editHariPelaksanaan');
    
    if (dateInput && daySelect && dateInput.value) {
        const date = new Date(dateInput.value);
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        daySelect.value = days[date.getDay()];
    }
}

// =================== DATE & CALENDAR HELPERS ===================
function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Ubah nilai tanggal apa pun (Date, ISO datetime, YYYY-MM-DD) menjadi YYYY-MM-DD lokal.
function toISODate(value) {
    if (!value) return '';
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return '';
        return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    }
    const str = String(value).trim();
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
    const parsed = new Date(str);
    if (Number.isNaN(parsed.getTime())) return '';
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

function parseISODate(iso) {
    const [year, month, day] = String(iso).split('-').map(Number);
    return new Date(year, month - 1, day || 1);
}

function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, amount) {
    return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function formatDate(dateString) {
    const iso = toISODate(dateString);
    if (!iso) return '-';
    const date = parseISODate(iso);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatDateShort(dateString) {
    const iso = toISODate(dateString);
    if (!iso) return '-';
    return parseISODate(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function reportsForDate(dateISO, excludeId = null) {
    return reports.filter(report => {
        if (excludeId != null && Number(report.id) === Number(excludeId)) return false;
        return toISODate(report.tanggal_pelaksanaan) === dateISO;
    });
}

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const label = document.getElementById('calendarMonthLabel');
    const summary = document.getElementById('calendarMonthSummary');
    if (!grid) return;

    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const monthName = calendarMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    if (label) label.textContent = monthName;

    // Senin sebagai awal minggu.
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayISO = toISODate(new Date());

    const reportMap = new Map();
    reports.forEach(report => {
        const iso = toISODate(report.tanggal_pelaksanaan);
        if (!iso) return;
        if (!reportMap.has(iso)) reportMap.set(iso, []);
        reportMap.get(iso).push(report);
    });

    let monthCount = 0;
    let monthDays = 0;
    let html = '';

    for (let i = 0; i < firstWeekday; i++) {
        html += '<div class="cal-day is-empty" aria-hidden="true"></div>';
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayReports = reportMap.get(iso) || [];
        const classes = ['cal-day'];
        if (iso === todayISO) classes.push('is-today');
        if (dayReports.length) classes.push('has-report');
        if (iso === selectedCalendarDate) classes.push('is-selected');
        if (dayReports.length) {
            monthCount += dayReports.length;
            monthDays += 1;
        }

        const dots = dayReports.slice(0, 3).map(() => '<span class="cal-dot"></span>').join('');
        const count = dayReports.length > 3 ? `<span class="cal-count">${dayReports.length}</span>` : '';
        const title = dayReports.length
            ? `${dayReports.length} laporan pada ${formatDate(iso)}`
            : `Tidak ada laporan pada ${formatDate(iso)}`;

        html += `
            <button type="button" class="${classes.join(' ')}" data-date="${iso}" title="${escapeHtml(title)}" onclick="selectCalendarDate('${iso}')">
                <span class="cal-day-num">${day}</span>
                ${dayReports.length ? `<span class="cal-dots">${dots}</span>` : '<span class="cal-dots"></span>'}
                ${count}
            </button>
        `;
    }

    const trailing = (7 - ((firstWeekday + daysInMonth) % 7)) % 7;
    for (let i = 0; i < trailing; i++) {
        html += '<div class="cal-day is-empty" aria-hidden="true"></div>';
    }

    grid.innerHTML = html;

    if (summary) {
        summary.textContent = `${monthCount} laporan pada ${monthDays} hari di bulan ini`;
    }
}

function selectCalendarDate(dateISO) {
    selectedCalendarDate = dateISO;
    renderCalendar();
    renderSelectedDatePanel();
}

function changeCalendarMonth(amount) {
    calendarMonth = addMonths(calendarMonth, amount);
    const today = new Date();
    if (today.getFullYear() === calendarMonth.getFullYear() && today.getMonth() === calendarMonth.getMonth()) {
        selectedCalendarDate = toISODate(today);
    } else {
        selectedCalendarDate = toISODate(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1));
    }
    renderCalendar();
    renderSelectedDatePanel();
}

function goToCalendarToday() {
    const today = new Date();
    calendarMonth = startOfMonth(today);
    selectedCalendarDate = toISODate(today);
    renderCalendar();
    renderSelectedDatePanel();
}

function renderSelectedDatePanel() {
    const titleEl = document.getElementById('calendarSelectedDate');
    const metaEl = document.getElementById('calendarSelectedMeta');
    const listEl = document.getElementById('calendarDayReports');
    const actionEl = document.getElementById('calendarDayAction');
    if (!listEl) return;

    const dateISO = selectedCalendarDate || toISODate(new Date());
    const date = parseISODate(dateISO);
    const dayReports = reportsForDate(dateISO);
    const isToday = dateISO === toISODate(new Date());

    if (titleEl) {
        titleEl.textContent = date.toLocaleDateString('id-ID', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
    }
    if (metaEl) {
        metaEl.textContent = dayReports.length
            ? `${dayReports.length} laporan pengawasan${isToday ? ' • hari ini' : ''}`
            : `Belum ada laporan${isToday ? ' • hari ini' : ''}`;
    }

    if (dayReports.length === 0) {
        listEl.innerHTML = `
            <div class="day-empty">
                <div class="day-empty-icon">
                    <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </div>
                <p>Belum ada agenda pengawasan pada tanggal ini.</p>
            </div>
        `;
    } else {
        listEl.innerHTML = dayReports.map(report => `
            <button type="button" class="day-item" onclick="viewReportDetail(${report.id})">
                <div class="day-item-top">
                    <span class="day-item-title">${escapeHtml(report.tujuan_perjalanan_dinas || report.kegiatan_pengawasan || '-')}</span>
                    <span class="badge badge-success" style="flex:0 0 auto;">Selesai</span>
                </div>
                <div class="day-item-sub">${escapeHtml(report.pegawai_name || '-')}${report.nomor_surat_tugas ? ` • No. ST: ${escapeHtml(report.nomor_surat_tugas)}` : ''}</div>
            </button>
        `).join('');
    }

    if (actionEl) {
        if (currentUser?.role === 'pegawai' && dayReports.length === 0) {
            actionEl.innerHTML = `
                <button type="button" class="btn btn-primary" style="width:100%;" onclick="openCreateForDate('${dateISO}')">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                    Buat laporan tanggal ini
                </button>
            `;
        } else if (currentUser?.role === 'pegawai') {
            actionEl.innerHTML = `
                <div class="date-status blocked" style="margin:0;">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-2.5L13.73 4c-.77-.83-1.96-.83-2.73 0L4.07 16.5C3.3 17.33 4.26 19 5.8 19z"/></svg>
                    <span>Tanggal ini sudah dipakai. Pilih tanggal lain untuk entri baru.</span>
                </div>
            `;
        } else {
            actionEl.innerHTML = `<p class="form-hint" style="text-align:center;">Klik laporan untuk melihat detail.</p>`;
        }
    }
}

function openCreateForDate(dateISO) {
    if (currentUser?.role !== 'pegawai') return;
    switchView('create-report');
    // Tunggu reset form & load jenis kegiatan selesai, lalu isi tanggal.
    setTimeout(() => {
        const dateInput = document.getElementById('tanggalPelaksanaan');
        if (dateInput) {
            dateInput.value = dateISO;
            validateCreateDate();
            dateInput.focus();
        }
    }, 50);
}

function validateCreateDate() {
    const dateInput = document.getElementById('tanggalPelaksanaan');
    const submitBtn = document.getElementById('createReportSubmitBtn');
    if (!dateInput) return;

    const dateISO = toISODate(dateInput.value);
    createDateBlocked = false;
    dateInput.classList.remove('is-invalid');

    if (!dateISO) {
        renderDateStatus('createDateStatus', null, '');
        if (submitBtn) submitBtn.disabled = false;
        return;
    }

    const conflicts = reportsForDate(dateISO);
    if (conflicts.length) {
        createDateBlocked = true;
        dateInput.classList.add('is-invalid');
        renderDateStatus(
            'createDateStatus',
            'blocked',
            `Tanggal ${formatDate(dateISO)} sudah dipakai laporan pengawasan. Pilih tanggal lain.`
        );
        if (submitBtn) submitBtn.disabled = true;
        return;
    }

    renderDateStatus(
        'createDateStatus',
        'ok',
        `Tanggal ${formatDate(dateISO)} masih tersedia.`
    );
    if (submitBtn) submitBtn.disabled = false;
}

function validateEditDate() {
    const dateInput = document.getElementById('editTanggalPelaksanaan');
    const submitBtn = document.getElementById('editReportSubmitBtn');
    if (!dateInput) return;

    const dateISO = toISODate(dateInput.value);
    const reportId = document.getElementById('editReportId')?.value;
    editDateBlocked = false;
    dateInput.classList.remove('is-invalid');

    if (!dateISO) {
        renderDateStatus('editDateStatus', null, '');
        if (submitBtn) submitBtn.disabled = false;
        return;
    }

    // Tanggal tidak diubah: selalu valid. Ini juga menghindari laporan lama
    // yang memiliki duplikat historis ikut terblokir saat diedit.
    if (dateISO === editOriginalDate) {
        renderDateStatus(
            'editDateStatus',
            'ok',
            `Tanggal ${formatDate(dateISO)} tersimpan untuk laporan ini.`
        );
        if (submitBtn) submitBtn.disabled = false;
        return;
    }

    const conflicts = reportsForDate(dateISO, reportId);
    if (conflicts.length) {
        editDateBlocked = true;
        dateInput.classList.add('is-invalid');
        renderDateStatus(
            'editDateStatus',
            'blocked',
            `Tanggal ${formatDate(dateISO)} sudah dipakai laporan lain. Pilih tanggal lain.`
        );
        if (submitBtn) submitBtn.disabled = true;
        return;
    }

    renderDateStatus(
        'editDateStatus',
        'ok',
        `Tanggal ${formatDate(dateISO)} tersedia.`
    );
    if (submitBtn) submitBtn.disabled = false;
}

function renderDateStatus(elementId, type, message) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (!type || !message) {
        el.className = 'date-status hidden';
        el.innerHTML = '';
        return;
    }
    const icon = type === 'ok'
        ? '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
        : '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-2.5L13.73 4c-.77-.83-1.96-.83-2.73 0L4.07 16.5C3.3 17.33 4.26 19 5.8 19z"/></svg>';
    el.className = `date-status ${type}`;
    el.innerHTML = `${icon}<span>${escapeHtml(message)}</span>`;
}

window.selectCalendarDate = selectCalendarDate;
window.changeCalendarMonth = changeCalendarMonth;
window.goToCalendarToday = goToCalendarToday;
window.openCreateForDate = openCreateForDate;
window.viewReportDetail = viewReportDetail;

function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.remove('hidden');
    }
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

function showMessage(message, type = 'info') {
    const container = document.getElementById('messageContainer');
    if (!container) return;
    
    const messageDiv = document.createElement('div');
    const toastType = type === 'success' ? 'success' : type === 'error' ? 'error' : 'info';
    messageDiv.className = `toast toast-${toastType}`;
    messageDiv.textContent = message;
    
    container.appendChild(messageDiv);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        messageDiv.classList.add('hide');
        setTimeout(() => {
            if (container.contains(messageDiv)) {
                container.removeChild(messageDiv);
            }
        }, 240);
    }, 5000);
}

function handleReportAction(e) {
    const target = e.target.closest('button');
    if (!target) return;

    const action = target.dataset.action;
    const id = target.dataset.id;

    if (!action || !id) return;

    switch (action) {
        case 'view-detail':
            viewReportDetail(id);
            break;
        case 'print':
            printReport(id);
            break;
        case 'edit':
            editReport(id);
            break;
        case 'copy':
            copyReport(id);
            break;
        case 'delete':
            deleteReport(id);
            break;
    }
}

// Global functions for onclick handlers (for other tables)
window.editUser = editUser;
window.deleteUser = deleteUser;
window.editActivityType = editActivityType;
window.deleteActivityType = deleteActivityType;
window.confirmDelete = confirmDelete;

// Copy report: prefill a new report form. Tanggal sengaja dikosongkan karena
// tanggal lama sudah terpakai dan tidak boleh dientri ulang.
async function copyReport(reportId) {
    try {
        showLoading();
        const detailResp = await fetch(`${API_BASE}/reports/${reportId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!detailResp.ok) {
            const j = await detailResp.json().catch(() => ({}));
            throw new Error(j.message || 'Gagal mengambil detail laporan untuk disalin');
        }
        const report = await detailResp.json();

        await loadActivityTypes();
        // Buang draft form lama agar isian hasil copy tidak tercampur draft sebelumnya.
        if (window.__formPersistence) window.__formPersistence.clear('createReport');
        switchView('create-report');

        const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value ?? '';
        };

        setValue('activityType', report.activity_type_id ?? '');
        setValue('nomorSuratTugas', report.nomor_surat_tugas || '');
        setValue('kegiatanPengawasan', report.tujuan_perjalanan_dinas || report.kegiatan_pengawasan || '');
        setValue('tanggalPelaksanaan', '');
        setValue('aktivitas', report.aktivitas || '');
        setValue('permasalahan', report.permasalahan || '');
        setValue('petugasResponden', report.petugas_responden || '');
        setValue('solusiAntisipasi', report.solusi_antisipasi || '');

        // Form hasil copy diperlakukan seperti laporan baru: tanggal wajib diisi ulang.
        createDateBlocked = false;
        const dateInput = document.getElementById('tanggalPelaksanaan');
        if (dateInput) {
            dateInput.value = '';
            dateInput.classList.remove('is-invalid');
            dateInput.focus();
        }
        const submitBtn = document.getElementById('createReportSubmitBtn');
        if (submitBtn) submitBtn.disabled = false;
        renderDateStatus('createDateStatus', null, '');
        showMessage('Data laporan disalin. Pilih tanggal baru untuk menyimpan.', 'success');
    } catch (err) {
        console.error('Error copying report:', err);
        showMessage(err?.message || 'Terjadi kesalahan saat menyalin laporan', 'error');
    } finally {
        hideLoading();
    }
}
