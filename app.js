document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    lucide.createIcons();

    // ==========================================
    // Configurações de Integração (Node.js)
    // ==========================================
    const SUBMIT_API_URL = "/api/submit";

    // ==========================================
    // State Management
    // ==========================================
    const state = {
        currentStep: 1,
        videoWatched: false,
        quizPassed: false,
        formData: null,
        signatureDrawings: [] // Stores stroke paths for undo function
    };

    // Navigation elements
    const views = {
        1: document.getElementById('view-video'),
        2: document.getElementById('view-quiz'),
        3: document.getElementById('view-questions'),
        4: document.getElementById('view-signature'),
        5: document.getElementById('view-certificate')
    };

    const navSteps = {
        1: document.getElementById('step-nav-1'),
        2: document.getElementById('step-nav-2'),
        3: document.getElementById('step-nav-3'),
        4: document.getElementById('step-nav-4'),
        5: document.getElementById('step-nav-5')
    };

    function navigateToStep(stepNumber) {
        // Hide all views
        Object.keys(views).forEach(k => {
            views[k].classList.remove('active');
        });

        // Show active view
        views[stepNumber].classList.add('active');
        state.currentStep = stepNumber;

        // Update Stepper Visuals
        Object.keys(navSteps).forEach(k => {
            const stepInt = parseInt(k);
            const stepEl = navSteps[k];

            if (stepInt < stepNumber) {
                stepEl.className = 'step completed';
                // Update icon to checkmark if completed
                const iconContainer = stepEl.querySelector('.step-icon');
                iconContainer.innerHTML = '<i data-lucide="check"></i>';
            } else if (stepInt === stepNumber) {
                stepEl.className = 'step active';
                // Restore original icon configuration based on step
                const iconContainer = stepEl.querySelector('.step-icon');
                if (stepInt === 1) iconContainer.innerHTML = '<i data-lucide="video"></i>';
                if (stepInt === 2) iconContainer.innerHTML = '<i data-lucide="clipboard-check"></i>';
                if (stepInt === 3) iconContainer.innerHTML = '<i data-lucide="file-text"></i>';
                if (stepInt === 4) iconContainer.innerHTML = '<i data-lucide="pen-tool"></i>';
                if (stepInt === 5) iconContainer.innerHTML = '<i data-lucide="award"></i>';
            } else {
                stepEl.className = 'step';
                // Restore original icon configuration
                const iconContainer = stepEl.querySelector('.step-icon');
                if (stepInt === 1) iconContainer.innerHTML = '<i data-lucide="video"></i>';
                if (stepInt === 2) iconContainer.innerHTML = '<i data-lucide="clipboard-check"></i>';
                if (stepInt === 3) iconContainer.innerHTML = '<i data-lucide="file-text"></i>';
                if (stepInt === 4) iconContainer.innerHTML = '<i data-lucide="pen-tool"></i>';
                if (stepInt === 5) iconContainer.innerHTML = '<i data-lucide="award"></i>';
            }
        });

        lucide.createIcons();

        // If step is signature (Step 4), we need to handle canvas dimensions initialization
        if (stepNumber === 4) {
            initSignatureCanvas();
        }

        // Scroll to top of window on navigation
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ==========================================
    // STEP 1: Video Player & Gating Logic
    // ==========================================
    const video = document.getElementById('hse-video');
    const playCenterBtn = document.getElementById('play-center-btn');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const timeDisplay = document.getElementById('video-time-display');
    const progressFill = document.getElementById('video-progress-fill');
    const muteBtn = document.getElementById('mute-btn');
    const volumeSlider = document.getElementById('volume-slider');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const btnToQuestions = document.getElementById('btn-to-questions');
    const videoStatusText = document.getElementById('video-status-text');
    const videoContainer = document.querySelector('.video-container');

    let lastTime = 0;
    let isMuted = false;
    let savedVolume = 1;

    // Format seconds to MM:SS
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // Update time displays
    function updateVideoTime() {
        if (!isNaN(video.duration)) {
            timeDisplay.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
            const pct = (video.currentTime / video.duration) * 100;
            progressFill.style.width = `${pct}%`;
        }
    }

    // Check duration and update immediately when metadata is loaded
    video.addEventListener('loadedmetadata', updateVideoTime);

    // Play/Pause Action
    function togglePlay() {
        if (video.paused) {
            video.play();
        } else {
            video.pause();
        }
    }

    video.addEventListener('play', () => {
        videoContainer.classList.add('playing');
        playPauseBtn.innerHTML = '<i data-lucide="pause"></i>';
        lucide.createIcons();
    });

    video.addEventListener('pause', () => {
        videoContainer.classList.remove('playing');
        playPauseBtn.innerHTML = '<i data-lucide="play"></i>';
        lucide.createIcons();
    });

    // Mute/Volume controls
    function toggleMute() {
        if (isMuted) {
            video.volume = savedVolume;
            volumeSlider.value = savedVolume;
            muteBtn.innerHTML = '<i data-lucide="volume-2"></i>';
            isMuted = false;
        } else {
            savedVolume = video.volume;
            video.volume = 0;
            volumeSlider.value = 0;
            muteBtn.innerHTML = '<i data-lucide="volume-x"></i>';
            isMuted = true;
        }
        lucide.createIcons();
    }

    volumeSlider.addEventListener('input', (e) => {
        const vol = parseFloat(e.target.value);
        video.volume = vol;
        if (vol === 0) {
            muteBtn.innerHTML = '<i data-lucide="volume-x"></i>';
            isMuted = true;
        } else {
            muteBtn.innerHTML = vol < 0.5 ? '<i data-lucide="volume-1"></i>' : '<i data-lucide="volume-2"></i>';
            isMuted = false;
        }
        lucide.createIcons();
    });

    // Fullscreen control
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            videoContainer.requestFullscreen().catch(err => {
                console.error(`Erro ao ativar tela cheia: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    }

    // Connect control events
    playCenterBtn.addEventListener('click', togglePlay);
    playPauseBtn.addEventListener('click', togglePlay);
    video.addEventListener('click', togglePlay);
    muteBtn.addEventListener('click', toggleMute);
    fullscreenBtn.addEventListener('click', toggleFullscreen);

    // ANTI-SEEKING GATING LOGIC:
    // Prevents the user from fast forwarding. If they attempt to skip ahead,
    // they are forced back to their furthest watched point.
    video.addEventListener('timeupdate', () => {
        const currentTime = video.currentTime;

        // Tolerance threshold of 1.5 seconds prevents minor timing inaccuracies from triggering gating
        if (currentTime > lastTime + 1.5) {
            // User skipped ahead! Revert to last watched position
            video.currentTime = lastTime;
        } else {
            // User playing normally or seeking backwards (backward is allowed)
            lastTime = currentTime;
        }

        updateVideoTime();
    });

    // Reset last time track when user seeks back manually
    video.addEventListener('seeking', () => {
        const currentTime = video.currentTime;
        if (currentTime > lastTime) {
            // Attempt to jump forward detected during seeking event
            video.currentTime = lastTime;
        }
    });

    // Video Finished
    video.addEventListener('ended', () => {
        state.videoWatched = true;
        btnToQuestions.disabled = false;
        videoStatusText.style.color = 'var(--color-primary)';
        videoStatusText.innerHTML = '<i data-lucide="check-circle" class="inline-icon"></i> Vídeo de integração concluído com sucesso! Prossiga para o questionário.';
        lucide.createIcons();
    });

    btnToQuestions.addEventListener('click', () => {
        if (state.videoWatched) {
            navigateToStep(2);
        }
    });


    // ==========================================
    // STEP 2: Fixation Quiz Logic
    // ==========================================
    const quizForm = document.getElementById('quiz-form');
    const btnSubmitQuiz = document.getElementById('btn-submit-quiz');
    const btnQuizRetryVideo = document.getElementById('btn-quiz-retry-video');
    const btnQuizRetry = document.getElementById('btn-quiz-retry');
    const btnQuizToQuestions = document.getElementById('btn-quiz-to-questions');
    const quizResultArea = document.getElementById('quiz-result-area');
    const quizResultTitle = document.getElementById('quiz-result-title');
    const quizResultText = document.getElementById('quiz-result-text');
    const quizResultIcon = document.getElementById('quiz-result-icon');
    const errorQuiz = document.getElementById('error-quiz');

    // Answer key mapping
    const answersKey = {
        q1: "C",
        q2: "B",
        q3: "B",
        q4: "C",
        q5: "C"
    };

    btnSubmitQuiz.addEventListener('click', () => {
        errorQuiz.style.display = 'none';

        // Extract answers
        const userAnswers = {
            q1: quizForm.querySelector('input[name="q1"]:checked')?.value,
            q2: quizForm.querySelector('input[name="q2"]:checked')?.value,
            q3: quizForm.querySelector('input[name="q3"]:checked')?.value,
            q4: quizForm.querySelector('input[name="q4"]:checked')?.value,
            q5: quizForm.querySelector('input[name="q5"]:checked')?.value
        };

        // Validate that all are answered
        const allAnswered = Object.values(userAnswers).every(ans => ans !== undefined);
        if (!allAnswered) {
            errorQuiz.style.display = 'block';
            return;
        }

        // Evaluate score
        let correctCount = 0;
        Object.keys(answersKey).forEach(key => {
            if (userAnswers[key] === answersKey[key]) {
                correctCount++;
            }
        });

        // Hide submission button
        btnSubmitQuiz.style.display = 'none';

        // Setup results card classes and texts
        quizResultArea.style.display = 'flex';
        if (correctCount >= 4) {
            // Success (>= 80%)
            state.quizPassed = true;
            quizResultArea.className = 'quiz-result-card success';
            quizResultTitle.textContent = "Aprovado!";
            quizResultText.textContent = `Você acertou ${correctCount} de 5 questões (Nota: ${(correctCount / 5 * 100)}%).`;
            quizResultIcon.innerHTML = '<i data-lucide="check-circle-2"></i>';
            btnQuizToQuestions.style.display = 'inline-flex';
        } else {
            // Failure (< 80%)
            state.quizPassed = false;
            quizResultArea.className = 'quiz-result-card danger';
            quizResultTitle.textContent = "Reprovado";
            quizResultText.textContent = `Você acertou ${correctCount} de 5 questões. É necessário acertar no mínimo 4 (80%).`;
            quizResultIcon.innerHTML = '<i data-lucide="x-circle"></i>';
            btnQuizRetryVideo.style.display = 'inline-flex';
            btnQuizRetry.style.display = 'inline-flex';
        }

        lucide.createIcons();
    });

    btnQuizRetryVideo.addEventListener('click', () => {
        // Reset Video watch state
        state.videoWatched = false;
        lastTime = 0;
        video.currentTime = 0;
        video.pause();
        progressFill.style.width = '0%';
        btnToQuestions.disabled = true;
        videoStatusText.style.color = 'var(--color-text-light)';
        videoStatusText.innerHTML = '<i data-lucide="info" class="inline-icon"></i> O formulário será desbloqueado automaticamente ao concluir o vídeo. Não é permitido avançar a gravação.';

        // Reset Quiz form
        quizForm.reset();
        quizResultArea.style.display = 'none';
        btnQuizRetryVideo.style.display = 'none';
        btnSubmitQuiz.style.display = 'inline-flex';
        errorQuiz.style.display = 'none';

        // Return to video
        navigateToStep(1);
    });

    btnQuizRetry.addEventListener('click', () => {
        // Reset quiz form in-place, keep video already watched
        quizForm.reset();
        quizResultArea.style.display = 'none';
        btnQuizRetryVideo.style.display = 'none';
        btnQuizRetry.style.display = 'none';
        btnSubmitQuiz.style.display = 'inline-flex';
        errorQuiz.style.display = 'none';
    });

    btnQuizToQuestions.addEventListener('click', () => {
        if (state.quizPassed) {
            navigateToStep(3);
        }
    });


    // ==========================================
    // STEP 3: Termo de Autorização de Acesso
    // ==========================================
    const form = document.getElementById('hse-form');
    const inputCpf = document.getElementById('input-cpf');
    const btnToSignature = document.getElementById('btn-to-signature');

    // CPF automatic input mask: 000.000.000-00
    inputCpf.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, ""); // Remove non-digits
        if (value.length > 11) value = value.slice(0, 11);

        // Build the masked string
        let masked = "";
        if (value.length > 0) {
            masked += value.slice(0, Math.min(value.length, 3));
        }
        if (value.length > 3) {
            masked += "." + value.slice(3, Math.min(value.length, 6));
        }
        if (value.length > 6) {
            masked += "." + value.slice(6, Math.min(value.length, 9));
        }
        if (value.length > 9) {
            masked += "-" + value.slice(9, Math.min(value.length, 11));
        }

        e.target.value = masked;
    });

    // CPF Digits Validation Algorithm
    function isValidCPF(cpf) {
        const cleaned = cpf.replace(/\D/g, "");
        if (cleaned.length !== 11) return false;

        // Rejects known invalid sequences of identical numbers
        if (/^(\d)\1{10}$/.test(cleaned)) return false;

        // First validation digit check
        let sum = 0;
        for (let i = 0; i < 9; i++) {
            sum += parseInt(cleaned.charAt(i)) * (10 - i);
        }
        let check1 = 11 - (sum % 11);
        if (check1 >= 10) check1 = 0;
        if (parseInt(cleaned.charAt(9)) !== check1) return false;

        // Second validation digit check
        sum = 0;
        for (let i = 0; i < 10; i++) {
            sum += parseInt(cleaned.charAt(i)) * (11 - i);
        }
        let check2 = 11 - (sum % 11);
        if (check2 >= 10) check2 = 0;
        if (parseInt(cleaned.charAt(10)) !== check2) return false;

        return true;
    }

    // Helper to toggle input field error visual classes
    function setFieldValidity(element, isValid, errorElementId) {
        const parent = element.closest('.form-group') || element.closest('.declaration-item') || element.closest('.epi-grid');
        const errorEl = document.getElementById(errorElementId);

        if (isValid) {
            if (parent) parent.classList.remove('has-error');
            if (errorEl) errorEl.style.display = 'none';
        } else {
            if (parent) parent.classList.add('has-error');
            if (errorEl) errorEl.style.display = 'block';
        }
        return isValid;
    }

    btnToSignature.addEventListener('click', () => {
        let isFormValid = true;

        // 1. Name input validation
        const nameInput = document.getElementById('input-name');
        if (nameInput.value.trim() === '') {
            isFormValid = setFieldValidity(nameInput, false, 'error-name') && isFormValid;
        } else {
            setFieldValidity(nameInput, true, 'error-name');
        }

        // 2. CPF validation
        if (!isValidCPF(inputCpf.value)) {
            isFormValid = setFieldValidity(inputCpf, false, 'error-cpf') && isFormValid;
        } else {
            setFieldValidity(inputCpf, true, 'error-cpf');
        }

        // 3. Company name validation
        const companyInput = document.getElementById('input-company');
        if (companyInput.value.trim() === '') {
            isFormValid = setFieldValidity(companyInput, false, 'error-company') && isFormValid;
        } else {
            setFieldValidity(companyInput, true, 'error-company');
        }

        // 4. Emergency contact validation
        const emergencyInput = document.getElementById('input-emergency');
        if (emergencyInput.value.trim() === '') {
            isFormValid = setFieldValidity(emergencyInput, false, 'error-emergency') && isFormValid;
        } else {
            setFieldValidity(emergencyInput, true, 'error-emergency');
        }

        // 5. Sector select validation
        const sectorSelect = document.getElementById('input-sector');
        if (sectorSelect.value === '') {
            isFormValid = setFieldValidity(sectorSelect, false, 'error-sector') && isFormValid;
        } else {
            setFieldValidity(sectorSelect, true, 'error-sector');
        }

        // 6. Presence reason validation
        const selectedReason = form.querySelector('input[name="presence_reason"]:checked');
        const reasonInput = form.querySelector('input[name="presence_reason"]');
        if (!selectedReason) {
            isFormValid = setFieldValidity(reasonInput, false, 'error-presence') && isFormValid;
        } else {
            setFieldValidity(reasonInput, true, 'error-presence');
        }

        // 7. EPI checks validation (At least one checkbox is mandatory)
        const checkedEpisCount = form.querySelectorAll('input[name="epi_check"]:checked').length;
        const epiGrid = document.querySelector('.epi-grid');
        if (checkedEpisCount < 1) {
            isFormValid = setFieldValidity(epiGrid, false, 'error-epi') && isFormValid;
        } else {
            setFieldValidity(epiGrid, true, 'error-epi');
        }

        // 8. Declaration 9 validation (Must be Sim)
        const decl9Selected = form.querySelector('input[name="decl_9"]:checked');
        const decl9Input = form.querySelector('input[name="decl_9"]');
        if (!decl9Selected || decl9Selected.value !== 'Sim') {
            isFormValid = setFieldValidity(decl9Input, false, 'error-decl9') && isFormValid;
        } else {
            setFieldValidity(decl9Input, true, 'error-decl9');
        }

        // 9. Declaration 10 validation (Must be Sim)
        const decl10Selected = form.querySelector('input[name="decl_10"]:checked');
        const decl10Input = form.querySelector('input[name="decl_10"]');
        if (!decl10Selected || decl10Selected.value !== 'Sim') {
            isFormValid = setFieldValidity(decl10Input, false, 'error-decl10') && isFormValid;
        } else {
            setFieldValidity(decl10Input, true, 'error-decl10');
        }

        if (isFormValid) {
            // Save state data
            state.formData = {
                name: nameInput.value.trim(),
                cpf: inputCpf.value,
                company: companyInput.value.trim(),
                emergency: emergencyInput.value.trim(),
                sector: sectorSelect.value,
                reason: selectedReason.value
            };

            // Advance step (Step 4 is Signature)
            navigateToStep(4);
        }
    });

    // ==========================================
    // STEP 3: Digital Signature Canvas
    // ==========================================
    const canvas = document.getElementById('signature-canvas');
    const placeholder = document.getElementById('canvas-placeholder');
    const btnClear = document.getElementById('btn-clear-signature');
    const btnUndo = document.getElementById('btn-undo-signature');
    const btnGenerateCert = document.getElementById('btn-generate-cert');
    let ctx = null;

    let drawing = false;
    let currentStroke = [];

    function initSignatureCanvas() {
        ctx = canvas.getContext('2d');

        // Handle resizing and High DPI screen support
        const rect = canvas.parentNode.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        canvas.width = rect.width * dpr;
        canvas.height = 250 * dpr; // Static height styled in css

        ctx.scale(dpr, dpr);

        // Set standard brush style
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#0D4E63'; // Azul petróleo signature ink color

        // Reset state array and redraw if there are existing drawings
        redrawCanvas();
    }

    function getPointerPos(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    function startDrawing(e) {
        e.preventDefault();
        drawing = true;
        currentStroke = [];
        const pos = getPointerPos(e);
        currentStroke.push(pos);

        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);

        placeholder.classList.add('hidden');
    }

    function draw(e) {
        if (!drawing) return;
        e.preventDefault();

        const pos = getPointerPos(e);
        currentStroke.push(pos);

        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    }

    function stopDrawing() {
        if (!drawing) return;
        drawing = false;

        if (currentStroke.length > 1) {
            state.signatureDrawings.push(currentStroke);
        }

        validateSignatureStatus();
    }

    function redrawCanvas() {
        if (!ctx) return;

        // Clear entire context area
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (state.signatureDrawings.length === 0) {
            placeholder.classList.remove('hidden');
        } else {
            placeholder.classList.add('hidden');

            // Replay drawing path array
            state.signatureDrawings.forEach(stroke => {
                ctx.beginPath();
                ctx.moveTo(stroke[0].x, stroke[0].y);
                for (let i = 1; i < stroke.length; i++) {
                    ctx.lineTo(stroke[i].x, stroke[i].y);
                }
                ctx.stroke();
            });
        }

        validateSignatureStatus();
    }

    function validateSignatureStatus() {
        if (state.signatureDrawings.length > 0) {
            btnGenerateCert.disabled = false;
        } else {
            btnGenerateCert.disabled = true;
        }
    }

    // Touch events for mobile screens
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchcancel', stopDrawing);

    // Mouse events for desktop
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stopDrawing);

    // Clear Canvas Action
    btnClear.addEventListener('click', () => {
        state.signatureDrawings = [];
        redrawCanvas();
    });

    // Undo Last Stroke Action
    btnUndo.addEventListener('click', () => {
        state.signatureDrawings.pop();
        redrawCanvas();
    });

    // Handle viewport resize (maintain drawings proportion)
    window.addEventListener('resize', () => {
        if (state.currentStep === 4) {
            const tempDrawings = [...state.signatureDrawings];
            initSignatureCanvas();
            state.signatureDrawings = tempDrawings;
            redrawCanvas();
        }
    });

    btnGenerateCert.addEventListener('click', () => {
        if (state.signatureDrawings.length > 0) {
            generateCertificate();
        }
    });


    // ==========================================
    // STEP 4: Certificate Generation & Download
    // ==========================================
    const certDisplayName = document.getElementById('cert-display-name');
    const certDisplayCpf = document.getElementById('cert-display-cpf');
    const certDisplayCompany = document.getElementById('cert-display-company');
    const certDisplaySector = document.getElementById('cert-display-sector');
    const certDisplayDate = document.getElementById('cert-display-date');
    const certDisplayHash = document.getElementById('cert-display-hash');
    const certSignatureImg = document.getElementById('cert-signature-img');

    const btnDownloadPdf = document.getElementById('btn-download-pdf');
    const btnPrint = document.getElementById('btn-print');
    const btnReset = document.getElementById('btn-reset');

    function generateHash() {
        // Generates A1B2-C3D4-E5F6-G7H8 format verification code
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let hash = '';
        for (let i = 0; i < 4; i++) {
            let part = '';
            for (let j = 0; j < 4; j++) {
                part += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            hash += (i === 0 ? '' : '-') + part;
        }
        return `CÓD. VERIFICAÇÃO: ${hash}`;
    }

    function capitalizeString(str) {
        return str.toLowerCase().replace(/(^\w|\s\w)/g, m => m.toUpperCase());
    }

    /**
     * Envia os dados de integração para o servidor Node.js local.
     */
    function sendToLocalServer(data, dateTime, verificationCode) {
        const payload = {
            dateTime: dateTime,
            name: capitalizeString(data.name),
            cpf: data.cpf,
            company: data.company,
            emergency: data.emergency,
            sector: data.sector,
            reason: data.reason,
            verificationCode: verificationCode
        };

        return fetch(SUBMIT_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Erro na requisição: ${response.status}`);
            }
            return response.json();
        })
        .then(res => {
            console.log("Google Sheets: Registro salvo no banco de dados local com sucesso.", res);
            return true;
        })
        .catch(error => {
            console.error("Google Sheets: Erro ao enviar dados para o servidor local:", error);
            return false;
        });
    }

    function generateCertificate() {
        const data = state.formData;
        if (!data) return;

        // Populate Certificate details
        certDisplayName.textContent = capitalizeString(data.name);
        certDisplayCpf.textContent = data.cpf;
        certDisplayCompany.textContent = data.company;
        certDisplaySector.textContent = data.sector;

        // Set Completion date/time
        const now = new Date();
        const dateStr = now.toLocaleDateString('pt-BR');
        const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        certDisplayDate.textContent = `Realizado em: ${dateStr} às ${timeStr}`;

        // Set digital hash check
        const hashFull = generateHash();
        certDisplayHash.textContent = hashFull;
        const verificationCode = hashFull.replace("CÓD. VERIFICAÇÃO: ", "");

        // Transfer canvas drawing image to certificate IMG element
        // We create a temporary canvas to trim the signature bounds or just export at 1x resolution without DPI scale factor
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');

        // Set white background for safety and draw the signature image from canvas
        tempCtx.fillStyle = '#FFFFFF';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.drawImage(canvas, 0, 0);

        const dataURL = tempCanvas.toDataURL('image/png');
        certSignatureImg.src = dataURL;

        // Enviar os dados para o servidor local
        sendToLocalServer(data, `${dateStr} ${timeStr}`, verificationCode);

        // Proceed navigation (Step 5 is Certificate)
        navigateToStep(5);

        // Auto-download PNG after element is fully painted
        setTimeout(() => downloadCertificateAsPng(), 800);
    }

    // ==========================================
    // CERTIFICATE DOWNLOAD HELPERS
    // ==========================================

    const btnDownloadPng = document.getElementById('btn-download-png');

    /**
     * Captures the certificate element as a PNG and triggers browser download.
     * Uses html2canvas (loaded separately) for reliable rendering.
     */
    async function downloadCertificateAsPng(filename) {
        const certElement = document.getElementById('certificate-print-area');
        if (!certElement) return;

        // Build filename from formData if not provided
        if (!filename) {
            const cpfClean = (state.formData.cpf || '').replace(/\D/g, '');
            const nameClean = (state.formData.name || 'certificado')
                .toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]/g, '-')
                .replace(/-+/g, '-');
            filename = `${nameClean}-${cpfClean}.png`;
        }

        try {
            const canvas = await html2canvas(certElement, {
                scale: 2,
                backgroundColor: '#FFFFFF',
                useCORS: true,
                logging: false,
                allowTaint: false
            });

            canvas.toBlob((blob) => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }, 'image/png');
        } catch (err) {
            console.error('Erro ao gerar imagem do certificado:', err);
        }
    }

    /**
     * Opens the certificate in a new window and triggers the browser's
     * native print dialog. The user selects "Salvar como PDF" no diálogo.
     * This approach is 100% reliable in static sites (no server needed).
     */
    function openCertificatePrintWindow() {
        const certElement = document.getElementById('certificate-print-area');
        if (!certElement) return;

        // Collect certificate CSS from the loaded stylesheet
        let certStyles = '';
        try {
            for (const sheet of document.styleSheets) {
                try {
                    for (const rule of sheet.cssRules) {
                        certStyles += rule.cssText + '\n';
                    }
                } catch (e) { /* cross-origin sheet */ }
            }
        } catch (e) { }

        const certHTML = certElement.outerHTML;
        const printWin = window.open('', '_blank', 'width=950,height=720');
        if (!printWin) {
            alert('Permita pop-ups para esta página e tente novamente.');
            return;
        }

        printWin.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Certificado de Participação</title>
  <base href="${window.location.href}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Montserrat:wght@600;700;800&display=swap" rel="stylesheet">
  <style>
    ${certStyles}
    @page { size: A4 landscape; margin: 0; }
    html, body {
      margin: 0; padding: 0; background: #fff;
      width: 297mm; height: 210mm;
      display: flex; align-items: center; justify-content: center;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    #certificate-print-area {
      width: 842px !important;
      height: 595px !important;
      box-shadow: none !important;
    }
    @media print {
      html, body { display: block; }
      #certificate-print-area {
        position: fixed !important;
        top: 0 !important; left: 0 !important;
        width: 297mm !important;
        height: 210mm !important;
        padding: 12mm !important;
        box-sizing: border-box !important;
      }
    }
  </style>
</head>
<body>
  ${certHTML}
  <script>
    window.onload = function() {
      // Give fonts time to load before printing
      setTimeout(function() {
        window.print();
        window.onafterprint = function() { window.close(); };
      }, 600);
    };
  <\/script>
</body>
</html>`);
        printWin.document.close();
    }

    // "Salvar como PDF" button — opens print window
    btnDownloadPdf.addEventListener('click', openCertificatePrintWindow);

    // "Baixar PNG" button
    btnDownloadPng.addEventListener('click', () => downloadCertificateAsPng());

    // Native Browser Print trigger
    // We move the certificate to be a direct child of <body> before printing so
    // the @media print rule `body > #certificate-print-area` can show it without
    // needing to fight against display:none on ancestor elements.
    let _certOriginalParent = null;
    let _certOriginalNextSibling = null;

    window.addEventListener('beforeprint', () => {
        const cert = document.getElementById('certificate-print-area');
        if (cert && cert.parentNode !== document.body) {
            _certOriginalParent = cert.parentNode;
            _certOriginalNextSibling = cert.nextSibling;
            document.body.appendChild(cert);
        }
    });

    window.addEventListener('afterprint', () => {
        const cert = document.getElementById('certificate-print-area');
        if (cert && _certOriginalParent) {
            _certOriginalParent.insertBefore(cert, _certOriginalNextSibling);
            _certOriginalParent = null;
            _certOriginalNextSibling = null;
        }
    });

    btnPrint.addEventListener('click', () => {
        window.print();
    });

    // Restart Integration Flow
    btnReset.addEventListener('click', () => {
        if (confirm('Deseja reiniciar a integração? Você precisará preencher os dados novamente.')) {
            // Reset state
            state.videoWatched = false;
            state.quizPassed = false;
            state.formData = null;
            state.signatureDrawings = [];
            lastTime = 0;

            // Reset player positions
            video.currentTime = 0;
            video.pause();
            progressFill.style.width = '0%';
            btnToQuestions.disabled = true;
            videoStatusText.style.color = 'var(--color-text-light)';
            videoStatusText.innerHTML = '<i data-lucide="info" class="inline-icon"></i> O formulário será desbloqueado automaticamente ao concluir o vídeo. Não é permitido avançar a gravação.';

            // Reset Quiz fields
            quizForm.reset();
            quizResultArea.style.display = 'none';
            btnQuizRetryVideo.style.display = 'none';
            btnQuizRetry.style.display = 'none';
            btnQuizToQuestions.style.display = 'none';
            btnSubmitQuiz.style.display = 'inline-flex';
            errorQuiz.style.display = 'none';

            // Reset Form fields
            form.reset();
            form.querySelectorAll('.form-group, .declaration-item, .epi-grid').forEach(el => {
                el.classList.remove('has-error');
            });
            form.querySelectorAll('.error-message').forEach(el => {
                el.style.display = 'none';
            });

            // Back to step 1
            navigateToStep(1);
        }
    });

});
