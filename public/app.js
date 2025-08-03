// Global variables
let currentUser = null;
let currentView = 'overview';
let reports = [];
let users = [];
let activityTypes = [];
let deleteItemId = null;
let deleteItemType = null;
let filteredReports = [];

// API Base URL
const API_BASE = '/api';

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
    
    // Auto-fill day when date is selected
    const tanggalPelaksanaan = document.getElementById('tanggalPelaksanaan');
    if (tanggalPelaksanaan) {
        tanggalPelaksanaan.addEventListener('change', autoFillDay);
    }
    
    const editTanggalPelaksanaan = document.getElementById('editTanggalPelaksanaan');
    if (editTanggalPelaksanaan) {
        editTanggalPelaksanaan.addEventListener('change', autoFillEditDay);
    }

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
        if (userInfo) {
            userInfo.textContent = 
                `${currentUser.name} (${currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)})`;
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
        btn.classList.remove('bg-blue-100', 'text-blue-600');
        if (btn.getAttribute('data-view') === view) {
            btn.classList.add('bg-blue-100', 'text-blue-600');
        }
    });
    
    currentView = view;
    
    // Load data based on view
    if (view === 'overview') {
        loadOverviewData();
    } else if (view === 'reports') {
        loadReports();
    } else if (view === 'create-report') {
        resetCreateForm();
        loadActivityTypes();
    } else if (view === 'edit-report') {
       // Data is loaded when editReport is called
    } else if (view === 'users') {
        loadUsers();
    } else if (view === 'activity-types') {
        loadActivityTypes();
    }
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
    try {
        await loadReports();
        updateOverviewStats();
        loadRecentReports();
    } catch (error) {
        console.error('Error loading overview data:', error);
        showMessage('Gagal memuat data ringkasan', 'error');
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
            filteredReports = [...reports];
            updateReportsTable();
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
    const totalReports = reports.length;
    const currentMonth = new Date().getMonth();
    const monthlyReports = reports.filter(report => {
        const reportMonth = new Date(report.tanggal_pelaksanaan).getMonth();
        return reportMonth === currentMonth;
    }).length;
    
    const totalReportsEl = document.getElementById('totalReports');
    const monthlyReportsEl = document.getElementById('monthlyReports');
    
    if (totalReportsEl) totalReportsEl.textContent = totalReports;
    if (monthlyReportsEl) monthlyReportsEl.textContent = monthlyReports;
    
    if (currentUser.role === 'kepala') {
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
        container.innerHTML = '<p class="text-gray-500 text-center py-4">Belum ada laporan</p>';
        return;
    }
    
    const tableHTML = `
        <div class="overflow-x-auto">
            <table class="min-w-full">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pegawai</th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Kegiatan</th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                    ${recentReports.map(report => `
                        <tr>
                            <td class="px-4 py-3 text-sm">${report.pegawai_name}</td>
                            <td class="px-4 py-3 text-sm">${report.kegiatan_pengawasan}</td>
                            <td class="px-4 py-3 text-sm">${formatDate(report.tanggal_pelaksanaan)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = tableHTML;
}

function updateReportsTable() {
    const tbody = document.getElementById('reportsTableBody');
    
    if (!tbody) return;
    
    if (filteredReports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">Belum ada laporan</td></tr>';
        return;
    }
    
    tbody.innerHTML = filteredReports.map(report => `
        <tr>
            <td data-label="Pegawai" class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">${report.pegawai_name}</div>
            </td>
            <td data-label="Kegiatan" class="px-6 py-4">
                <div class="text-sm text-gray-900">${report.kegiatan_pengawasan}</div>
            </td>
            <td data-label="Tanggal" class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">${formatDate(report.tanggal_pelaksanaan)}</div>
                <div class="text-sm text-gray-500">${report.hari_pelaksanaan}</div>
            </td>
            <td data-label="Status" class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                    Selesai
                </span>
            </td>
            <td data-label="Aksi" class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                <button data-action="view-detail" data-id="${report.id}" class="text-blue-600 hover:text-blue-900">
                    Detail
                </button>
                <button data-action="print" data-id="${report.id}" class="text-purple-600 hover:text-purple-900">
                    Cetak
                </button>
                ${canEditReport(report) ? `
                    <button data-action="edit" data-id="${report.id}" class="text-yellow-600 hover:text-yellow-900">
                        Edit
                    </button>
                    <button data-action="delete" data-id="${Number(report.id)}" class="text-red-600 hover:text-red-900">
                        Hapus
                    </button>
                ` : ''}
            </td>
        </tr>
    `).join('');
}

function updateUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    
    if (!tbody) return;
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">Belum ada user</td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(user => `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">${user.username}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">${user.name}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${user.role === 'kepala' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}">
                    ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">${formatDate(user.created_at)}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div class="actions flex flex-wrap gap-2 justify-center sm:justify-start">
                    <button onclick="editUser(${user.id})" class="text-yellow-600 hover:text-yellow-900 px-2 py-1 rounded border border-yellow-200">
                        Edit
                    </button>
                    ${user.id !== currentUser.id ? `
                        <button onclick="deleteUser(${user.id})" class="text-red-600 hover:text-red-900 px-2 py-1 rounded border border-red-200">
                            Hapus
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

function updateActivityTypesTable() {
    const tbody = document.getElementById('activityTypesTableBody');
    
    if (!tbody) return;
    
    if (activityTypes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">Belum ada jenis kegiatan</td></tr>';
        return;
    }
    
    tbody.innerHTML = activityTypes.map(activityType => `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">${activityType.name}</div>
            </td>
            <td class="px-6 py-4">
                <div class="text-sm text-gray-900">${activityType.description || '-'}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">${formatDate(activityType.created_at)}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div class="actions flex flex-wrap gap-2 justify-center sm:justify-start">
                    <button onclick="editActivityType(${activityType.id})" class="text-yellow-600 hover:text-yellow-900 px-2 py-1 rounded border border-yellow-200">
                        Edit
                    </button>
                    <button onclick="deleteActivityType(${activityType.id})" class="text-red-600 hover:text-red-900 px-2 py-1 rounded border border-red-200">
                        Hapus
                    </button>
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
}

// Report functions
function canEditReport(report) {
    return currentUser.role === 'pegawai' && report.user_id === currentUser.id;
}

async function handleCreateReport(e) {
    e.preventDefault();
    showLoading();
    
    const formData = new FormData(e.target);
    
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
            switchView('reports');
            loadReports();
        } else {
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
    showLoading();
    
    const formData = new FormData(e.target);
    const reportId = formData.get('reportId');
    
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
            switchView('reports');
            loadReports();
        } else {
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
                    <label class="block text-sm font-medium text-gray-700 mb-1">Kegiatan Pengawasan</label>
                    <p class="text-gray-900">${report.kegiatan_pengawasan}</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Tanggal Pelaksanaan</label>
                    <p class="text-gray-900">${formatDate(report.tanggal_pelaksanaan)}</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Hari Pelaksanaan</label>
                    <p class="text-gray-900">${report.hari_pelaksanaan}</p>
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
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H3a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
                        </svg>
                        <span>Cetak PDF</span>
                    </div>
                </button>
            </div>
        </div>
    `;
    
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
    const elements = {
        'editReportId': report.id,
        'editActivityType': report.activity_type_id,
        'editKegiatanPengawasan': report.kegiatan_pengawasan,
        'editTanggalPelaksanaan': report.tanggal_pelaksanaan,
        'editHariPelaksanaan': report.hari_pelaksanaan,
        'editAktivitas': report.aktivitas,
        'editPermasalahan': report.permasalahan || '',
        'editPetugasResponden': report.petugas_responden || '',
        'editSolusiAntisipasi': report.solusi_antisipasi || ''
    };
    
    Object.keys(elements).forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.value = elements[id];
        }
    });
    
    const currentFotoDokumentasi = document.getElementById('currentFotoDokumentasi');
    
    if (currentFotoDokumentasi) {
        // This part can be enhanced to show a list of current photos
        currentFotoDokumentasi.innerHTML = report.foto_dokumentasi && report.foto_dokumentasi.length > 0 ?
            `Ada ${report.foto_dokumentasi.length} foto telah diunggah.` :
            'Tidak ada foto dokumentasi.';
    }
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
    const activityTypeData = {
        name: formData.get('name'),
        description: formData.get('description')
    };
    
    try {
        const url = activityTypeId ? `${API_BASE}/activity-types/${activityTypeId}` : `${API_BASE}/activity-types`;
        const method = activityTypeId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(activityTypeData)
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
    
    filteredReports = reports.filter(report => {
        const matchesSearch = report.kegiatan_pengawasan.toLowerCase().includes(searchTerm) ||
                            report.pegawai_name.toLowerCase().includes(searchTerm) ||
                            report.aktivitas.toLowerCase().includes(searchTerm);
        
        const matchesMonth = !selectedMonth || 
                           new Date(report.tanggal_pelaksanaan).getMonth() + 1 === parseInt(selectedMonth);
        
        return matchesSearch && matchesMonth;
    });
    
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

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

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
    
    const bgColor = type === 'success' ? 'bg-green-500' : 
                   type === 'error' ? 'bg-red-500' : 'bg-blue-500';
    
    messageDiv.className = `${bgColor} text-white px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 translate-x-full`;
    messageDiv.textContent = message;
    
    container.appendChild(messageDiv);
    
    // Animate in
    setTimeout(() => {
        messageDiv.classList.remove('translate-x-full');
    }, 100);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        messageDiv.classList.add('translate-x-full');
        setTimeout(() => {
            if (container.contains(messageDiv)) {
                container.removeChild(messageDiv);
            }
        }, 300);
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
