document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    lucide.createIcons();

    // DOM Elements
    const searchInput = document.getElementById('search-input');
    const sectorFilter = document.getElementById('sector-filter');
    const btnExportExcel = document.getElementById('btn-export-excel');
    const tableBody = document.getElementById('table-body');
    const emptyState = document.getElementById('empty-state');
    
    // Stats Elements
    const statTotal = document.getElementById('stat-total');
    const statToday = document.getElementById('stat-today');
    const statTopSector = document.getElementById('stat-top-sector');

    // State Variables
    let registrationsData = [];
    let searchTimeout = null;

    // Load initial data
    loadDashboardData();

    // Event Listeners
    searchInput.addEventListener('input', () => {
        // Debounce search submissions (300ms)
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            loadRegistrations();
        }, 300);
    });

    sectorFilter.addEventListener('change', () => {
        loadRegistrations();
    });

    btnExportExcel.addEventListener('click', () => {
        exportToExcel();
    });

    // Helper to load both stats and records
    function loadDashboardData() {
        loadStats();
        loadRegistrations();
    }

    // Fetch and render registrations
    async function loadRegistrations() {
        const searchQuery = searchInput.value.trim();
        const sectorQuery = sectorFilter.value;

        // Build query string
        const params = new URLSearchParams();
        if (searchQuery) params.append('search', searchQuery);
        if (sectorQuery) params.append('sector', sectorQuery);

        try {
            const response = await fetch(`/api/registrations?${params.toString()}`);
            if (!response.ok) throw new Error('Falha ao obter registros.');

            const data = await response.json();
            registrationsData = data;
            renderTable(data);
        } catch (error) {
            console.error('Erro ao carregar registros:', error);
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--color-danger); padding: 2rem;">Erro ao carregar registros do servidor.</td></tr>`;
        }
    }

    // Fetch and render dashboard metrics
    async function loadStats() {
        try {
            const response = await fetch('/api/stats');
            if (!response.ok) throw new Error('Falha ao obter estatísticas.');

            const stats = await response.json();

            // Update stats cards
            statTotal.textContent = stats.total || 0;
            statToday.textContent = stats.today || 0;

            if (stats.sectors && stats.sectors.length > 0) {
                const top = stats.sectors[0];
                statTopSector.textContent = `${top.sector} (${top.count})`;
            } else {
                statTopSector.textContent = 'Nenhum';
            }
        } catch (error) {
            console.error('Erro ao carregar métricas:', error);
        }
    }

    // Render registrations table
    function renderTable(rows) {
        tableBody.innerHTML = '';

        if (!rows || rows.length === 0) {
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        rows.forEach(row => {
            const tr = document.createElement('tr');
            
            // Badges configurations
            const reasonBadgeClass = row.reason === 'Visita' ? 'visit' : 'service';
            
            tr.innerHTML = `
                <td class="reg-date">${row.dateTime || '-'}</td>
                <td class="reg-name">${row.name || '-'}</td>
                <td class="reg-cpf">${formatCPF(row.cpf || '')}</td>
                <td>${row.company || '-'}</td>
                <td><span class="reg-badge-sector">${row.sector || '-'}</span></td>
                <td><span class="reg-badge-reason ${reasonBadgeClass}">${row.reason || '-'}</span></td>
                <td><span class="reg-code">${row.verificationCode || '-'}</span></td>
                <td style="text-align: center;">
                    <button class="btn-delete" title="Excluir registro">
                        <i data-lucide="trash-2"></i>
                    </button>
                </td>
            `;

            // Vincular evento de exclusão
            const deleteBtn = tr.querySelector('.btn-delete');
            deleteBtn.addEventListener('click', () => {
                deleteRegistration(row.id, row.name);
            });

            tableBody.appendChild(tr);
        });

        lucide.createIcons();
    }

    // Deletar registro do banco de dados
    async function deleteRegistration(id, name) {
        if (!confirm(`Deseja realmente excluir a integração de "${name}"? Esta ação não pode ser desfeita.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/registrations/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Erro ao excluir registro.');

            const result = await response.json();
            if (result.status === 'success') {
                // Recarregar os dados do dashboard
                loadDashboardData();
            } else {
                alert('Erro ao excluir registro: ' + result.message);
            }
        } catch (error) {
            console.error('Erro ao deletar registro:', error);
            alert('Falha ao excluir registro do servidor.');
        }
    }

    // Format CPF for representation (000.000.000-00)
    function formatCPF(cpf) {
        const cleaned = cpf.replace(/\D/g, "");
        if (cleaned.length !== 11) return cpf; // returns original if not matched standard digits length
        return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9, 11)}`;
    }

    // Export current filtered rows list to XLSX (Excel) using SheetJS
    function exportToExcel() {
        if (!registrationsData || registrationsData.length === 0) {
            alert('Não há dados disponíveis para exportar.');
            return;
        }

        // Map data to user-friendly column headers
        const excelData = registrationsData.map(row => ({
            'Data/Hora de Conclusão': row.dateTime || '',
            'Nome Completo': row.name || '',
            'CPF': formatCPF(row.cpf || ''),
            'Empresa': row.company || '',
            'Setor Responsável': row.sector || '',
            'Tipo de Presença': row.reason || '',
            'Código de Verificação': row.verificationCode || ''
        }));

        // Create worksheet and workbook
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Integrações HSE');

        // Adjust column widths automatically based on max cell content length
        const maxLen = {};
        excelData.forEach(row => {
            Object.keys(row).forEach(key => {
                const val = String(row[key]);
                maxLen[key] = Math.max(maxLen[key] || key.length, val.length);
            });
        });
        worksheet['!cols'] = Object.keys(maxLen).map(key => ({
            wch: maxLen[key] + 3
        }));

        // Generate filename with date suffix
        const dateSuffix = new Date().toISOString().slice(0, 10);
        
        // Write file and trigger download
        XLSX.writeFile(workbook, `integracoes-hse-${dateSuffix}.xlsx`);
    }
});
