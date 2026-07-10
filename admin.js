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
                    <div style="display: flex; gap: 0.5rem; justify-content: center; align-items: center;">
                        <button class="btn-cert" title="Gerar Certificado">
                            <i data-lucide="award"></i>
                        </button>
                        <button class="btn-delete" title="Excluir registro">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </td>
            `;

            // Vincular evento de exclusão
            const deleteBtn = tr.querySelector('.btn-delete');
            deleteBtn.addEventListener('click', () => {
                deleteRegistration(row.id, row.name);
            });

            // Vincular evento de geração de certificado
            const certBtn = tr.querySelector('.btn-cert');
            certBtn.addEventListener('click', () => {
                generateCertificateFromRow(row);
            });

            tableBody.appendChild(tr);
        });

        lucide.createIcons();
    }

    // ==========================================
    // CERTIFICATE CAPTURE HELPER (Screen-independent)
    // ==========================================

    /**
     * Clona o certificado para um container off-screen com dimensões fixas A4 paisagem,
     * garantindo que a captura seja idêntica independente do tamanho da tela do administrador.
     * Retorna um canvas HTML já renderizado em alta resolução (2x).
     */
    async function captureCertificateCanvas() {
        const certElement = document.getElementById('certificate-print-area');
        if (!certElement) throw new Error('Elemento do certificado não encontrado.');

        const CERT_W = 842;
        const CERT_H = 595;

        // 1. Cria um container off-screen com dimensões fixas
        const offscreen = document.createElement('div');
        offscreen.style.cssText = `
            position: fixed;
            left: -9999px;
            top: 0;
            width: ${CERT_W}px;
            height: ${CERT_H}px;
            overflow: hidden;
            z-index: -9999;
            background: #FFFFFF;
            pointer-events: none;
        `;

        // 2. Clona o certificado inteiro (incluindo imagens e estilos inline)
        const clone = certElement.cloneNode(true);
        clone.removeAttribute('id');

        // Força dimensões fixas no clone para garantir consistência
        clone.style.cssText = `
            width: ${CERT_W}px !important;
            height: ${CERT_H}px !important;
            min-width: ${CERT_W}px !important;
            min-height: ${CERT_H}px !important;
            max-width: ${CERT_W}px !important;
            max-height: ${CERT_H}px !important;
            padding: 30px !important;
            box-sizing: border-box !important;
            background-color: #FFFFFF !important;
            box-shadow: none !important;
            position: relative !important;
            display: block !important;
            transform: none !important;
            margin: 0 !important;
            flex-shrink: 0 !important;
            overflow: hidden !important;
        `;

        offscreen.appendChild(clone);
        document.body.appendChild(offscreen);

        // 3. Aguarda todas as imagens do clone carregarem (assinaturas, etc.)
        const images = clone.querySelectorAll('img');
        const imagePromises = Array.from(images).map(img => {
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            return new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
                setTimeout(resolve, 3000);
            });
        });
        await Promise.all(imagePromises);

        // 4. Pequeno delay para garantir renderização completa do layout
        await new Promise(resolve => setTimeout(resolve, 100));

        // 5. Captura com html2canvas usando o clone off-screen
        try {
            const capturedCanvas = await html2canvas(clone, {
                scale: 2,
                backgroundColor: '#FFFFFF',
                useCORS: true,
                logging: false,
                allowTaint: false,
                width: CERT_W,
                height: CERT_H,
                windowWidth: CERT_W + 100,
                windowHeight: CERT_H + 100
            });
            return capturedCanvas;
        } finally {
            // 6. Remove o container do DOM
            document.body.removeChild(offscreen);
        }
    }

    // Gera e salva o PDF do certificado a partir dos dados da linha
    async function generateCertificateFromRow(row) {
        const certDisplayName = document.getElementById('cert-display-name');
        const certDisplayCpf = document.getElementById('cert-display-cpf');
        const certDisplayCompany = document.getElementById('cert-display-company');
        const certDisplaySector = document.getElementById('cert-display-sector');
        const certDisplayDate = document.getElementById('cert-display-date');
        const certDisplayHash = document.getElementById('cert-display-hash');
        const certSignatureImg = document.getElementById('cert-signature-img');
        const certSignatureText = document.getElementById('cert-signature-text');

        const capitalize = (str) => str.toLowerCase().replace(/(^\w|\s\w)/g, m => m.toUpperCase());

        certDisplayName.textContent = capitalize(row.name);
        certDisplayCpf.textContent = formatCPF(row.cpf || '');
        certDisplayCompany.textContent = row.company;
        certDisplaySector.textContent = row.sector;
        certDisplayDate.textContent = `Realizado em: ${row.dateTime}`;
        certDisplayHash.textContent = `CÓD. VERIFICAÇÃO: ${row.verificationCode}`;

        // Tratamento da assinatura do participante:
        if (row.signature && row.signature.trim() !== '') {
            // Exibe a assinatura original que o usuário desenhou no canvas
            certSignatureImg.src = row.signature;
            certSignatureImg.style.display = 'block';
            certSignatureText.style.display = 'none';
            certSignatureText.textContent = '';
        } else {
            // Deixa em branco (para registros antigos que não possuem assinatura salva)
            certSignatureImg.src = '';
            certSignatureImg.style.display = 'none';
            certSignatureText.style.display = 'none';
            certSignatureText.textContent = '';
        }

        const cpfClean = (row.cpf || '').replace(/\D/g, '');
        const nameClean = (row.name || 'certificado')
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-');
        const filename = `certificado-${nameClean}-${cpfClean}.pdf`;

        // Pequeno delay para garantir que a imagem de assinatura carregue no DOM visível antes de clonar
        await new Promise(resolve => setTimeout(resolve, 300));

        try {
            // 1. Captura a imagem do certificado de forma independente de tela
            const capturedCanvas = await captureCertificateCanvas();

            // 2. Cria o PDF a partir da imagem JPEG comprimida (~300KB em vez de ~7MB)
            const jpegDataUrl = capturedCanvas.toDataURL('image/jpeg', 0.92);
            const jsPDF = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'pt',
                format: 'a4'
            });

            const pageW = pdf.internal.pageSize.getWidth();
            const pageH = pdf.internal.pageSize.getHeight();
            pdf.addImage(jpegDataUrl, 'JPEG', 0, 0, pageW, pageH);
            pdf.save(filename);
        } catch (err) {
            console.error('Erro ao gerar PDF do certificado no admin:', err);
        }
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
