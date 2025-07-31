document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('manage-usersView')) return;

    const API_BASE = '/api';
    const addUserForm = document.getElementById('addUserForm');
    const usersTableBody = document.getElementById('usersTableBody');

    // Load users list
    async function loadUsers() {
        usersTableBody.innerHTML = '<tr><td colspan="3" class="px-6 py-4 text-center text-gray-500">Memuat data...</td></tr>';
        try {
            const response = await fetch(`${API_BASE}/users`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            if (response.ok) {
                const users = await response.json();
                if (users.length === 0) {
                    usersTableBody.innerHTML = '<tr><td colspan="3" class="px-6 py-4 text-center text-gray-500">Belum ada pengguna</td></tr>';
                    return;
                }
                usersTableBody.innerHTML = users.map(user => `
                    <tr>
                        <td class="px-6 py-4 whitespace-nowrap">${user.username}</td>
                        <td class="px-6 py-4 whitespace-nowrap">${user.name}</td>
                        <td class="px-6 py-4 whitespace-nowrap">${user.role.charAt(0).toUpperCase() + user.role.slice(1)}</td>
                    </tr>
                `).join('');
            } else {
                usersTableBody.innerHTML = '<tr><td colspan="3" class="px-6 py-4 text-center text-red-500">Gagal memuat data pengguna</td></tr>';
            }
        } catch (error) {
            console.error('Error loading users:', error);
            usersTableBody.innerHTML = '<tr><td colspan="3" class="px-6 py-4 text-center text-red-500">Terjadi kesalahan saat memuat data pengguna</td></tr>';
        }
    }

    // Handle add user form submit
    addUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(addUserForm);
        const data = {
            username: formData.get('username'),
            name: formData.get('name'),
            password: formData.get('password'),
            role: formData.get('role')
        };

        try {
            const response = await fetch(`${API_BASE}/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (response.ok) {
                showMessage('User berhasil ditambahkan', 'success');
                addUserForm.reset();
                loadUsers();
            } else {
                showMessage(result.message || 'Gagal menambahkan user', 'error');
            }
        } catch (error) {
            console.error('Error adding user:', error);
            showMessage('Terjadi kesalahan saat menambahkan user', 'error');
        }
    });

    // Show message function (reuse from main script or define here)
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
                container.removeChild(messageDiv);
            }, 300);
        }, 5000);
    }

    // Initial load
    loadUsers();
});
