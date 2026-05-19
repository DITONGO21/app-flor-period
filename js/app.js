// Flor App - Advanced Logic (100% Offline)

class FlorApp {
    constructor() {
        this.data = this.loadData();
        this.currentDate = new Date();
        this.selectedDate = new Date();
        this.selectedCalendarDate = new Date();
        this.isAuthenticated = !this.data.settings.pin; // Se não tiver PIN, está logo autenticado
        
        this.init();
    }

    // --- DATA MANAGEMENT ---
    loadData() {
        const defaultData = {
            cycles: [], 
            logs: {},
            settings: {
                theme: 'dark',
                mode: 'padrao', // padrao, gravidez, adolescente
                pin: null,
                cycleType: 'regular',
                avgCycleLength: 28,
                avgPeriodLength: 5
            }
        };

        try {
            const saved = localStorage.getItem('flor_data_v2');
            if (saved) return JSON.parse(saved);
        } catch (e) {
            console.warn('Erro ao carregar dados, a tentar backup...', e);
            try {
                const backup = localStorage.getItem('flor_data_v2_backup');
                if (backup) return JSON.parse(backup);
            } catch (err) {}
        }
        
        try {
            // Migração da v1 para v2
            const oldSaved = localStorage.getItem('flor_data');
            if (oldSaved) {
                const parsed = JSON.parse(oldSaved);
                parsed.settings.mode = 'padrao';
                parsed.settings.pin = null;
                localStorage.setItem('flor_data_v2', JSON.stringify(parsed));
                localStorage.setItem('flor_data_v2_backup', JSON.stringify(parsed));
                return parsed;
            }
        } catch(e) {}
        
        return defaultData;
    }

    saveData() {
        try {
            const dataStr = JSON.stringify(this.data);
            localStorage.setItem('flor_data_v2', dataStr);
            localStorage.setItem('flor_data_v2_backup', dataStr); // Anti-corruption backup
            if (this.isAuthenticated) this.updateViews();
        } catch (e) {
            this.showToast('Erro ao guardar dados. Espaço cheio?');
        }
    }

    formatDate(date) {
        // Correção de bugs de timezone (meia-noite)
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    vibrate(pattern = 10) {
        if (navigator.vibrate) {
            try { navigator.vibrate(pattern); } catch(e) {}
        }
    }

    showToast(msg) {
        const toast = document.getElementById('toast-msg');
        toast.textContent = msg;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    }

    // --- INITIALIZATION ---
    init() {
        if (!localStorage.getItem('flor_has_onboarded')) {
            this.showOnboarding();
        } else if (!this.isAuthenticated) {
            this.setupPinScreen();
            this.authenticateBiometrics();
        } else {
            this.startApp();
        }
    }

    showOnboarding() {
        const obs = document.getElementById('onboarding-screen');
        if (obs) {
            obs.classList.remove('hidden');
            const btn = document.getElementById('btn-start-app');
            if (btn) {
                btn.addEventListener('click', () => {
                    this.vibrate(15);
                    localStorage.setItem('flor_has_onboarded', 'true');
                    obs.classList.add('hidden');
                    if (!this.isAuthenticated) {
                        this.setupPinScreen();
                    } else {
                        this.startApp();
                    }
                });
            }
        }
    }

    startApp() {
        document.getElementById('pin-screen').classList.add('hidden');
        this.setupNavigation();
        this.setupEventListeners();
        this.applyTheme();
        this.updateViews();
        this.registerServiceWorker();
        
        if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
            setTimeout(() => Notification.requestPermission(), 5000);
        }
    }

    setupPinScreen() {
        const pinScreen = document.getElementById('pin-screen');
        pinScreen.classList.remove('hidden');
        
        const bioBtn = document.getElementById('btn-biometric-unlock');
        if (bioBtn) {
            if (this.data.settings.biometricEnabled && window.PublicKeyCredential) {
                bioBtn.classList.remove('hidden');
                // Avoid double registration of click listener
                if (!bioBtn.dataset.bound) {
                    bioBtn.dataset.bound = "true";
                    bioBtn.addEventListener('click', () => {
                        this.vibrate(10);
                        this.authenticateBiometrics();
                    });
                }
            } else {
                bioBtn.classList.add('hidden');
            }
        }
        
        let currentInput = "";
        const dots = document.querySelectorAll('.pin-dots .dot');
        const updateDots = () => {
            dots.forEach((dot, i) => {
                if (i < currentInput.length) dot.classList.add('filled');
                else dot.classList.remove('filled');
            });
        };

        document.querySelectorAll('.pin-btn:not(.action)').forEach(btn => {
            btn.addEventListener('click', () => {
                if (currentInput.length < 4) {
                    currentInput += btn.textContent;
                    updateDots();
                    if (currentInput.length === 4) {
                        if (currentInput === this.data.settings.pin) {
                            setTimeout(() => this.startApp(), 200);
                        } else {
                            currentInput = "";
                            updateDots();
                            this.showToast("PIN Incorreto");
                        }
                    }
                }
            });
        });

        document.getElementById('pin-delete').addEventListener('click', () => {
            currentInput = currentInput.slice(0, -1);
            updateDots();
        });
        document.getElementById('pin-clear').addEventListener('click', () => {
            currentInput = "";
            updateDots();
        });
    }

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const views = document.querySelectorAll('.view:not(#pin-screen)');

        navItems.forEach(item => {
            item.addEventListener('click', () => {
                this.vibrate(10);
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');

                const targetId = item.getAttribute('data-target');
                views.forEach(view => {
                    view.classList.remove('active');
                    if (view.id === targetId) view.classList.add('active');
                });

                if (targetId === 'view-calendar') this.renderCalendar();
                if (targetId === 'view-stats') this.renderCharts();
            });
        });

        // Tabs no Modal
        const tabs = document.querySelectorAll('.modal-tab');
        const panes = document.querySelectorAll('.tab-pane');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                panes.forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(tab.getAttribute('data-tab')).classList.add('active');
            });
        });
    }

    setupEventListeners() {
        // Theme
        const themeToggle = document.getElementById('theme-toggle');
        themeToggle.checked = this.data.settings.theme === 'dark';
        themeToggle.addEventListener('change', (e) => {
            this.data.settings.theme = e.target.checked ? 'dark' : 'light';
            this.applyTheme();
            this.saveData();
        });

        // App Mode
        const modeSelect = document.getElementById('app-mode');
        modeSelect.value = this.data.settings.mode || 'padrao';
        modeSelect.addEventListener('change', (e) => {
            this.data.settings.mode = e.target.value;
            this.saveData();
            this.applyTheme();
            this.updateViews();
        });

        // Cycle Settings
        const cycleTypeSelect = document.getElementById('cycle-type');
        const cycleLengthInput = document.getElementById('cycle-length-input');
        const periodLengthInput = document.getElementById('period-length-input');
        const pregDueDateInput = document.getElementById('preg-due-date');

        cycleTypeSelect.value = this.data.settings.cycleType || 'regular';
        cycleLengthInput.value = this.data.settings.avgCycleLength;
        periodLengthInput.value = this.data.settings.avgPeriodLength;
        if(this.data.settings.pregDueDate) pregDueDateInput.value = this.data.settings.pregDueDate;

        cycleTypeSelect.addEventListener('change', (e) => { this.data.settings.cycleType = e.target.value; this.saveData(); });
        cycleLengthInput.addEventListener('change', (e) => { this.data.settings.avgCycleLength = parseInt(e.target.value) || 28; this.saveData(); });
        periodLengthInput.addEventListener('change', (e) => { this.data.settings.avgPeriodLength = parseInt(e.target.value) || 5; this.saveData(); });
        if(pregDueDateInput) pregDueDateInput.addEventListener('change', (e) => { this.data.settings.pregDueDate = e.target.value; this.saveData(); this.updateViews(); });

        // PIN Setup
        document.getElementById('btn-setup-pin').addEventListener('click', () => {
            const newPin = prompt("Introduz 4 números para o novo PIN (ou deixa vazio para remover):");
            if (newPin === null) return;
            if (newPin === "" || (/^\d{4}$/.test(newPin))) {
                this.data.settings.pin = newPin === "" ? null : newPin;
                if (newPin === "") {
                    this.data.settings.biometricEnabled = false; // Disable bio if pin is removed
                    const bioToggle = document.getElementById('biometric-toggle');
                    if (bioToggle) bioToggle.checked = false;
                }
                this.saveData();
                this.showToast(newPin ? "PIN configurado!" : "PIN removido!");
            } else {
                this.showToast("PIN inválido. Tem de ter 4 números.");
            }
        });

        // Biometric Setup Toggle
        const bioToggle = document.getElementById('biometric-toggle');
        const bioRow = document.getElementById('biometric-row');
        if (bioToggle) {
            if (!window.PublicKeyCredential) {
                if (bioRow) bioRow.classList.add('hidden'); // Hide if not supported
            } else {
                bioToggle.checked = !!this.data.settings.biometricEnabled;
                bioToggle.addEventListener('change', async (e) => {
                    this.vibrate(10);
                    if (e.target.checked) {
                        if (!this.data.settings.pin) {
                            this.showToast("Deves configurar um PIN primeiro!");
                            e.target.checked = false;
                        } else {
                            const success = await this.enrollBiometrics();
                            if (!success) e.target.checked = false;
                        }
                    } else {
                        this.data.settings.biometricEnabled = false;
                        this.saveData();
                        this.showToast("Biometria desativada.");
                    }
                });
            }
        }

        // Home Buttons
        document.getElementById('btn-log-period').addEventListener('click', () => {
            this.vibrate(15);
            this.togglePeriod(this.formatDate(new Date()));
        });
        document.getElementById('btn-log-symptoms').addEventListener('click', () => { this.vibrate(10); this.openLogModal(new Date()); });
        
        const btnPregSymptoms = document.getElementById('btn-log-preg-symptoms');
        if (btnPregSymptoms) btnPregSymptoms.addEventListener('click', () => { this.vibrate(10); this.openLogModal(new Date()); });
        
        // Modals
        document.getElementById('close-modal').addEventListener('click', () => { this.vibrate(5); document.getElementById('log-modal').classList.remove('open'); });
        document.getElementById('btn-educ').addEventListener('click', () => { this.vibrate(10); this.openEduModal(); });
        document.getElementById('close-edu-modal').addEventListener('click', () => { this.vibrate(5); document.getElementById('edu-modal').classList.remove('open'); });
        
        // Pills Logic
        document.querySelectorAll('.pill').forEach(pill => {
            pill.addEventListener('click', (e) => {
                this.vibrate(5);
                const isMulti = e.target.parentElement.classList.contains('multi');
                if (!isMulti) {
                    const isSelected = e.target.classList.contains('selected');
                    Array.from(e.target.parentElement.children).forEach(c => c.classList.remove('selected'));
                    if(!isSelected) e.target.classList.add('selected'); // Toggleable
                } else {
                    e.target.classList.toggle('selected');
                }
            });
        });

        document.getElementById('save-log').addEventListener('click', () => this.saveDailyLog());

        // Calendar Nav
        document.getElementById('prev-month').addEventListener('click', () => { this.selectedDate.setMonth(this.selectedDate.getMonth() - 1); this.renderCalendar(); });
        document.getElementById('next-month').addEventListener('click', () => { this.selectedDate.setMonth(this.selectedDate.getMonth() + 1); this.renderCalendar(); });
        
        // Touch Gestures for Calendar
        let touchStartX = 0;
        let touchEndX = 0;
        const calView = document.getElementById('view-calendar');
        if(calView) {
            calView.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, {passive: true});
            calView.addEventListener('touchend', e => {
                touchEndX = e.changedTouches[0].screenX;
                if (touchStartX - touchEndX > 50) { // Swipe Left
                    this.selectedDate.setMonth(this.selectedDate.getMonth() + 1); this.renderCalendar();
                } else if (touchEndX - touchStartX > 50) { // Swipe Right
                    this.selectedDate.setMonth(this.selectedDate.getMonth() - 1); this.renderCalendar();
                }
            }, {passive: true});
        }

        // Discreet Mode
        document.getElementById('btn-discreet').addEventListener('click', () => {
            const appDiv = document.getElementById('app');
            appDiv.classList.toggle('blur-app');
            if (appDiv.classList.contains('blur-app')) {
                setTimeout(() => appDiv.classList.remove('blur-app'), 4000);
            }
        });

        // Backup
        document.getElementById('btn-export').addEventListener('click', () => this.exportData());
        document.getElementById('btn-delete-data').addEventListener('click', () => {
            if(confirm("Tens a certeza absoluta que queres APAGAR todos os teus dados íntimos?")) {
                localStorage.removeItem('flor_data');
                localStorage.removeItem('flor_data_v2');
                location.reload();
            }
        });
        
        // Import
        document.getElementById('btn-import').addEventListener('click', () => document.getElementById('file-import').click());
        document.getElementById('file-import').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const imported = JSON.parse(e.target.result);
                    if (imported.settings && imported.logs) {
                        this.data = imported;
                        this.saveData();
                        this.showToast("Backup importado com sucesso!");
                    }
                } catch(err) {
                    this.showToast("Ficheiro inválido.");
                }
            };
            reader.readAsText(file);
        });
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.data.settings.theme);
        
        // Update App Mode visual badge
        const badge = document.getElementById('mode-badge');
        const setCycleGroup = document.getElementById('settings-cycle-group');
        const setPregGroup = document.getElementById('settings-pregnancy-group');

        if (this.data.settings.mode === 'gravidez') {
            badge.textContent = 'Gravidez'; badge.classList.remove('hidden');
            if(setCycleGroup) setCycleGroup.classList.add('hidden');
            if(setPregGroup) setPregGroup.classList.remove('hidden');
        } else if (this.data.settings.mode === 'adolescente') {
            badge.textContent = 'Jovem'; badge.classList.remove('hidden');
            if(setCycleGroup) setCycleGroup.classList.remove('hidden');
            if(setPregGroup) setPregGroup.classList.add('hidden');
        } else {
            badge.classList.add('hidden');
            if(setCycleGroup) setCycleGroup.classList.remove('hidden');
            if(setPregGroup) setPregGroup.classList.add('hidden');
        }
    }

    // --- CORE LOGIC ---
    togglePeriod(dateStr) {
        if (!this.data.logs[dateStr]) this.data.logs[dateStr] = { isPeriod: true };
        else this.data.logs[dateStr].isPeriod = !this.data.logs[dateStr].isPeriod;
        
        this.recalculateCycles();
        this.saveData();
        this.showToast(this.data.logs[dateStr].isPeriod ? "Menstruação ativada hoje" : "Menstruação parada");
    }

    recalculateCycles() {
        const periodDays = Object.keys(this.data.logs).filter(date => this.data.logs[date].isPeriod).sort();
        
        this.data.cycles = [];
        if (periodDays.length === 0) return;

        let currentCycleStart = periodDays[0];
        let lastDay = new Date(periodDays[0]);

        for (let i = 1; i < periodDays.length; i++) {
            const currentDay = new Date(periodDays[i]);
            const diffDays = (currentDay - lastDay) / (1000 * 60 * 60 * 24);

            if (diffDays > 10) { // Gap > 10 days means new cycle
                this.data.cycles.push({
                    start: currentCycleStart,
                    end: this.formatDate(new Date(currentDay.getTime() - (1000 * 60 * 60 * 24)))
                });
                currentCycleStart = periodDays[i];
            }
            lastDay = currentDay;
        }
        
        this.data.cycles.push({ start: currentCycleStart, end: null });

        // Update Averages
        const finishedCycles = this.data.cycles.filter(c => c.end);
        if (finishedCycles.length > 0 && this.data.settings.cycleType === 'regular') {
            let totalDays = 0;
            finishedCycles.forEach(c => {
                totalDays += (new Date(c.end) - new Date(c.start)) / (1000 * 60 * 60 * 24) + 1;
            });
            // Mantém os limites configuráveis
            let calculatedAvg = Math.round(totalDays / finishedCycles.length);
            if(calculatedAvg >= 15 && calculatedAvg <= 90) this.data.settings.avgCycleLength = calculatedAvg;
        }
    }

    // --- UI UPDATES ---
    updateViews() {
        this.updateHome();
        this.updateStats();
        this.renderCalendar();
    }

    updateHome() {
        const todayStr = this.formatDate(new Date());
        const logToday = this.data.logs[todayStr] || {};
        
        const btnLog = document.getElementById('btn-log-period');
        if (logToday.isPeriod) {
            btnLog.textContent = "Terminar Período de Hoje";
            btnLog.classList.remove('pulse');
            btnLog.style.background = 'var(--text-muted)';
        } else {
            btnLog.textContent = "Registar Início do Período";
            btnLog.classList.add('pulse');
            btnLog.style.background = 'var(--primary)';
        }

        let cycleDayText = "--";
        let predictionText = "Regista o período para ver previsões";
        let ovulDateText = "--";
        let fertilityProb = "Baixa";
        let progress = 0;

        const cycleDash = document.getElementById('cycle-dashboard');
        const pregDash = document.getElementById('pregnancy-dashboard');

        // Gravidez Mode Overrides
        if (this.data.settings.mode === 'gravidez') {
            if(cycleDash) cycleDash.classList.add('hidden');
            if(pregDash) pregDash.classList.remove('hidden');
            document.getElementById('ovulation-card').classList.add('hidden');
            
            if (this.data.settings.pregDueDate) {
                const dueDate = new Date(this.data.settings.pregDueDate);
                // Start of pregnancy is approx 280 days before due date
                const startPreg = new Date(dueDate.getTime() - (280 * 24 * 60 * 60 * 1000));
                const today = new Date(todayStr);
                const diffDays = Math.max(0, Math.round((today - startPreg) / (1000 * 60 * 60 * 24)));
                const weeks = Math.floor(diffDays / 7);
                const days = diffDays % 7;
                
                document.getElementById('preg-week').textContent = `${weeks}s ${days}d`;
                const daysToDue = Math.max(0, Math.round((dueDate - today) / (1000 * 60 * 60 * 24)));
                document.getElementById('preg-days-left').textContent = `Faltam ${daysToDue} dias`;
                
                progress = Math.min((diffDays / 280) * 100, 100);
                const pregCircle = document.getElementById('preg-progress');
                if (pregCircle) pregCircle.style.strokeDashoffset = 283 - (283 * progress) / 100;
                
                const sizes = ["Semente de Papoila", "Semente de Sésamo", "Lentilha", "Mirtilo", "Framboesa", "Cereja", "Morango", "Lima", "Limão", "Laranja", "Abacate", "Nabo", "Pimento", "Tomate", "Banana", "Cenoura", "Papaia", "Manga", "Batata Doce", "Milho", "Beringela", "Couve", "Alface", "Couve-Flor", "Melão", "Abóbora", "Coco", "Ananás", "Melancia Pequena", "Melancia Média", "Melancia Grande"];
                const sizeIndex = Math.min(Math.max(weeks - 4, 0), sizes.length - 1);
                document.getElementById('preg-baby-size').textContent = sizes[sizeIndex] || "--";
            } else {
                document.getElementById('preg-week').textContent = "--";
                document.getElementById('preg-days-left').textContent = "Configura em Definições";
                document.getElementById('preg-baby-size').textContent = "--";
            }
            fertilityProb = "N/A";
        } else {
            if(cycleDash) cycleDash.classList.remove('hidden');
            if(pregDash) pregDash.classList.add('hidden');
            document.getElementById('home-day-label').textContent = "Dia do Ciclo";
            
            const fertCards = document.getElementById('fertility-cards');
            if (this.data.settings.mode === 'adolescente') {
                if(fertCards) fertCards.classList.add('hidden');
            } else {
                if(fertCards) fertCards.classList.remove('hidden');
            }

            if (this.data.cycles.length > 0) {
                const currentCycle = this.data.cycles[this.data.cycles.length - 1];
                const startDate = new Date(currentCycle.start);
                const today = new Date(todayStr); // Normalized
                const diffDays = Math.round(Math.abs(today - startDate) / (1000 * 60 * 60 * 24)) + 1;
                
                cycleDayText = diffDays;
                
                const avg = this.data.settings.avgCycleLength;
                const daysLeft = avg - diffDays;
                
                if (this.data.settings.cycleType === 'irregular') predictionText = "Previsão aproximada (Ciclo Irregular)";
                else if (daysLeft > 0) predictionText = `Próximo em ~${daysLeft} dias`;
                else if (daysLeft === 0) predictionText = "Esperado para hoje";
                else predictionText = `${Math.abs(daysLeft)} dias de atraso`;

                progress = Math.min((diffDays / avg) * 100, 100);
                
                // Ovulation & Fertility
                const ovulTime = startDate.getTime() + ((avg - 14) * 24 * 60 * 60 * 1000);
                const ovulDateObj = new Date(ovulTime);
                ovulDateText = ovulDateObj.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });

                const diffToOvul = Math.round((ovulTime - today.getTime()) / (1000 * 60 * 60 * 24));
                if (diffToOvul === 0) fertilityProb = "Pico (Ovulação)";
                else if (diffToOvul > 0 && diffToOvul <= 4) fertilityProb = "Alta";
                else if (diffToOvul < 0 && diffToOvul >= -1) fertilityProb = "Alta";
                else if (diffToOvul > 4 && diffToOvul <= 7) fertilityProb = "Média";
                else fertilityProb = "Baixa";
                
                this.checkNotifications(daysLeft);
            }
        }

        document.getElementById('home-cycle-day').textContent = cycleDayText;
        document.getElementById('home-prediction').textContent = predictionText;
        document.getElementById('home-ovulation-date').textContent = ovulDateText;
        document.getElementById('home-fertility-prob').textContent = fertilityProb;
        document.getElementById('home-fertility-prob').style.color = (fertilityProb.includes("Alta") || fertilityProb.includes("Pico")) ? "var(--fertile-color)" : "inherit";

        // Circle Animation
        const cycleCircle = document.getElementById('cycle-progress');
        if(cycleCircle && this.data.settings.mode !== 'gravidez') cycleCircle.style.strokeDashoffset = 283 - (283 * progress) / 100;

        // Smart Insights Generation
        this.generateSmartInsights(logToday, fertilityProb);
    }

    generateSmartInsights(logToday, fertilityProb) {
        const container = document.getElementById('smart-insights');
        container.innerHTML = '';
        
        if (this.data.settings.mode === 'gravidez') {
            container.innerHTML = `<div class="card info-card" style="border-left: 4px solid var(--secondary)"><div class="card-text"><p style="font-size:14px">Lembra-te de beber bastante água e tomar as tuas vitaminas pré-natais hoje!</p></div></div>`;
            return;
        }

        let insights = [];
        if (fertilityProb.includes("Alta") || fertilityProb.includes("Pico")) {
            insights.push(`Estás na tua janela fértil. A probabilidade de engravidar é ${fertilityProb.toLowerCase()}.`);
        }
        if (logToday.isPeriod) {
            insights.push("Dica: Evita cafeína e alimentos muito salgados para ajudar a reduzir a retenção de líquidos e possíveis cólicas.");
        }
        
        // Verifica se bebeu água hoje
        if (logToday.health && logToday.health.includes('agua')) {
            insights.push("Ótimo trabalho com a hidratação hoje! 💧");
        }

        if (insights.length > 0) {
            insights.slice(0, 2).forEach(ins => {
                container.innerHTML += `<div class="card info-card" style="border-left: 4px solid var(--primary-light)"><div class="card-text"><p style="font-size:14px">${ins}</p></div></div>`;
            });
        }
    }

    renderCalendar() {
        const grid = document.getElementById('calendar-days');
        const monthYearDisplay = document.getElementById('month-year-display');
        
        const year = this.selectedDate.getFullYear();
        const month = this.selectedDate.getMonth();
        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        monthYearDisplay.textContent = `${monthNames[month]} ${year}`;
        
        grid.innerHTML = '';
        const fragment = document.createDocumentFragment();
        const firstDay = new Date(year, month, 1).getDay(); 
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const todayStr = this.formatDate(new Date());

        let fertileStart = null, fertileEnd = null, ovulationDateStr = null;

        if (this.data.cycles.length > 0 && this.data.settings.mode === 'padrao') {
            const currentCycle = this.data.cycles[this.data.cycles.length - 1];
            const startDate = new Date(currentCycle.start);
            const avg = this.data.settings.avgCycleLength;
            
            const ovulation = new Date(startDate.getTime() + ((avg - 14) * 24 * 60 * 60 * 1000));
            ovulationDateStr = this.formatDate(ovulation);
            fertileStart = new Date(ovulation.getTime() - (4 * 24 * 60 * 60 * 1000));
            fertileEnd = new Date(ovulation.getTime() + (1 * 24 * 60 * 60 * 1000));
        }

        for (let i = 0; i < firstDay; i++) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'day-cell empty';
            fragment.appendChild(emptyDiv);
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, month, i);
            const dateStr = this.formatDate(date);
            const log = this.data.logs[dateStr];
            
            let classes = ['day-cell'];
            if (dateStr === todayStr) classes.push('today');
            if (log?.isPeriod) classes.push('period');
            
            if (this.data.settings.mode === 'padrao') {
                if (fertileStart && date >= fertileStart && date <= fertileEnd && dateStr !== ovulationDateStr) classes.push('fertile');
                if (dateStr === ovulationDateStr) classes.push('ovulation');
            }

            if (log?.sex && log.sex.activity && log.sex.activity !== 'nao') classes.push('has-sex');
            
            if (this.selectedCalendarDate && dateStr === this.formatDate(this.selectedCalendarDate)) {
                classes.push('selected-day');
            }

            const dayDiv = document.createElement('div');
            dayDiv.className = classes.join(' ');
            dayDiv.textContent = i;
            dayDiv.addEventListener('click', () => {
                this.vibrate(5);
                this.selectedCalendarDate = date;
                this.renderCalendar();
                this.showDaySummary(dateStr, date);
            });
            fragment.appendChild(dayDiv);
        }
        grid.appendChild(fragment);

        // Auto update details card for current selected calendar date
        const selStr = this.formatDate(this.selectedCalendarDate);
        this.showDaySummary(selStr, this.selectedCalendarDate);
    }

    showDaySummary(dateStr, date) {
        const summaryDiv = document.getElementById('calendar-day-summary');
        if (!summaryDiv) return;
        const log = this.data.logs[dateStr] || {};
        const dateFormatted = date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' });
        
        let html = `<div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 12px;">
            <strong style="font-size: 16px; color: var(--primary);">${dateFormatted}</strong>
            <button class="secondary-btn small" id="btn-edit-selected-day" style="margin:0;">Editar Diário</button>
        </div>`;

        let hasData = false;
        let badgesHtml = '<div class="summary-badges-container">';

        if (log.isPeriod) {
            hasData = true;
            let flowLabel = log.flow ? ` (${log.flow})` : '';
            badgesHtml += `<span class="summary-badge badge-period">🩸 Período${flowLabel}</span>`;
            if (log.flowDetails && log.flowDetails.length > 0) {
                log.flowDetails.forEach(d => {
                    badgesHtml += `<span class="summary-badge badge-period">🔹 ${d}</span>`;
                });
            }
        }

        if (log.mucus && log.mucus !== 'seco') {
            hasData = true;
            badgesHtml += `<span class="summary-badge badge-period">💧 Muco: ${log.mucus}</span>`;
        }

        if (log.symptoms && log.symptoms.length > 0) {
            hasData = true;
            const symptomMap = {
                colicas: "Cólicas 💥",
                "dor-lombar": "Dor Lombar 🪵",
                "dor-cabeca": "Dor de Cabeça 🤕",
                "seios-sensiveis": "Seios Sensíveis 🍒",
                acne: "Acne 🧼",
                inchaco: "Inchaço 🎈",
                nausea: "Náusea 🤢",
                tonturas: "Tonturas 🌀",
                desejos: "Desejos 🍫"
            };
            log.symptoms.forEach(s => {
                badgesHtml += `<span class="summary-badge badge-symptom">${symptomMap[s] || s}</span>`;
            });
        }

        if (log.moods && log.moods.length > 0) {
            hasData = true;
            const moodMap = {
                feliz: "Feliz 😊",
                sensivel: "Sensível 🥺",
                triste: "Triste 😢",
                irritada: "Irritada 😠",
                ansiedade: "Ansiedade 😟",
                stress: "Stress ⚡",
                fadiga: "Cansada 😴",
                energia: "Enérgica ⚡"
            };
            log.moods.forEach(m => {
                badgesHtml += `<span class="summary-badge badge-mood">${moodMap[m] || m}</span>`;
            });
        }

        if (log.sex && log.sex.activity && log.sex.activity !== 'nao') {
            hasData = true;
            let prot = log.sex.activity === 'protegida' ? '🔒 Protegida' : '🔓 Não Protegida';
            let libido = log.sex.libido ? ` • Líbi. ${log.sex.libido}` : '';
            badgesHtml += `<span class="summary-badge badge-sex">❤️ Intimidade (${prot}${libido})</span>`;
            if (log.sex.issues && log.sex.issues.length > 0) {
                log.sex.issues.forEach(i => {
                    badgesHtml += `<span class="summary-badge badge-sex">⚠️ ${i}</span>`;
                });
            }
        }

        if (log.health && log.health.length > 0) {
            hasData = true;
            const healthMap = {
                exercicio: "Exercício 🏃‍♀️",
                agua: "Água 💧",
                medicacao: "Medicação 💊",
                vitamina: "Vitaminas 💊"
            };
            log.health.forEach(h => {
                badgesHtml += `<span class="summary-badge badge-health">${healthMap[h] || h}</span>`;
            });
        }

        if (log.temp || log.weight || log.sleep) {
            hasData = true;
            if (log.temp) badgesHtml += `<span class="summary-badge badge-metric">🌡️ ${log.temp} °C</span>`;
            if (log.weight) badgesHtml += `<span class="summary-badge badge-metric">⚖️ ${log.weight} kg</span>`;
            if (log.sleep) badgesHtml += `<span class="summary-badge badge-metric">😴 Sono: ${log.sleep}</span>`;
        }

        badgesHtml += '</div>';

        if (hasData) {
            html += badgesHtml;
            if (log.notes) {
                html += `<div class="summary-notes"><strong>Notas do Diário:</strong> ${log.notes}</div>`;
            }
        } else {
            html += `<p class="text-muted" style="text-align: center; margin: 12px 0;">Sem registos íntimos guardados para este dia.</p>`;
        }

        summaryDiv.innerHTML = html;

        const editBtn = document.getElementById('btn-edit-selected-day');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                this.vibrate(10);
                this.openLogModal(date);
            });
        }
    }

    updateStats() {
        document.getElementById('stat-avg-cycle').textContent = this.data.settings.avgCycleLength;
        document.getElementById('stat-avg-period').textContent = this.data.settings.avgPeriodLength;
        
        // Render simple Bar Chart
        this.renderCharts();

        // History List
        const historyList = document.getElementById('history-list');
        historyList.innerHTML = '';
        const finished = this.data.cycles.filter(c => c.end).reverse().slice(0, 5); 
        
        if (finished.length === 0) {
            historyList.innerHTML = '<li class="history-item"><span class="text-muted">Ainda não há ciclos terminados suficientes.</span></li>';
            return;
        }

        finished.forEach(cycle => {
            const s = new Date(cycle.start).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
            const e = new Date(cycle.end).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
            const diffDays = Math.round(Math.abs(new Date(cycle.end) - new Date(cycle.start)) / (1000 * 60 * 60 * 24)) + 1;

            historyList.innerHTML += `<li class="history-item"><span>${s} - ${e}</span><strong>${diffDays} dias</strong></li>`;
        });
    }

    renderCharts() {
        // 1. Cycle Duration History Bar Chart
        const chartContainer = document.getElementById('chart-cycles');
        if (chartContainer) {
            chartContainer.innerHTML = '';
            const finished = this.data.cycles.filter(c => c.end).slice(-6); // Últimos 6
            if (finished.length === 0) {
                chartContainer.innerHTML = '<span class="text-muted">Sem dados para gráfico.</span>';
            } else {
                const maxDays = Math.max(...finished.map(c => Math.round(Math.abs(new Date(c.end) - new Date(c.start)) / (1000 * 60 * 60 * 24)) + 1), 35);
                finished.forEach((cycle, i) => {
                    const diffDays = Math.round(Math.abs(new Date(cycle.end) - new Date(cycle.start)) / (1000 * 60 * 60 * 24)) + 1;
                    const heightPercent = (diffDays / maxDays) * 100;
                    const monthStr = new Date(cycle.start).toLocaleDateString('pt-PT', { month: 'short' });
                    const isLatest = i === finished.length - 1;
                    chartContainer.innerHTML += `
                        <div class="chart-bar-container">
                            <div class="chart-bar ${isLatest ? 'highlight' : ''}" style="height: ${heightPercent}%"></div>
                            <span class="chart-label">${monthStr}</span>
                        </div>
                    `;
                });
            }
        }

        // 2. Symptom & Mood Frequencies Horizontal Bar Chart
        const symptomChart = document.getElementById('chart-symptoms');
        if (symptomChart) {
            symptomChart.innerHTML = '';
            
            const symptomCounts = {};
            const symptomLabels = {
                colicas: "Cólicas 💥",
                "dor-lombar": "Dor Lombar 🪵",
                "dor-cabeca": "Dor de Cabeça 🤕",
                "seios-sensiveis": "Seios Sensíveis 🍒",
                acne: "Acne 🧼",
                inchaco: "Inchaço 🎈",
                nausea: "Náusea 🤢",
                tonturas: "Tonturas 🌀",
                desejos: "Desejos 🍫",
                feliz: "Feliz 😊",
                sensivel: "Sensível 🥺",
                triste: "Triste 😢",
                irritada: "Irritada 😠",
                ansiedade: "Ansiedade 😟",
                stress: "Stress ⚡",
                fadiga: "Cansada 😴",
                energia: "Enérgica ⚡"
            };

            Object.values(this.data.logs).forEach(log => {
                if (log.symptoms) {
                    log.symptoms.forEach(s => { symptomCounts[s] = (symptomCounts[s] || 0) + 1; });
                }
                if (log.moods) {
                    log.moods.forEach(m => { symptomCounts[m] = (symptomCounts[m] || 0) + 1; });
                }
            });

            const sortedSymptoms = Object.entries(symptomCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);

            if (sortedSymptoms.length === 0) {
                symptomChart.innerHTML = '<span class="text-muted">Ainda não registaste sintomas suficientes.</span>';
            } else {
                const maxCount = Math.max(...sortedSymptoms.map(s => s[1]), 1);
                sortedSymptoms.forEach(([symptom, count]) => {
                    const pct = (count / maxCount) * 100;
                    const name = symptomLabels[symptom] || symptom;
                    symptomChart.innerHTML += `
                        <div class="symptom-row">
                            <span class="symptom-label">${name}</span>
                            <div class="symptom-bar-bg">
                                <div class="symptom-bar-fill" style="width: ${pct}%"></div>
                            </div>
                            <span class="symptom-count">${count}x</span>
                        </div>
                    `;
                });
            }
        }

        // 3. Body Metrics Tracker (Latest 5 logs with Metrics)
        const metricsContainer = document.getElementById('metrics-tracker-container');
        if (metricsContainer) {
            metricsContainer.innerHTML = '';
            
            const logsWithMetrics = Object.entries(this.data.logs)
                .filter(([dateStr, log]) => log.temp || log.weight)
                .sort((a, b) => new Date(b[0]) - new Date(a[0]))
                .slice(0, 5);
                
            if (logsWithMetrics.length === 0) {
                metricsContainer.innerHTML = '<span class="text-muted">Sem registos de temperatura ou peso.</span>';
            } else {
                logsWithMetrics.forEach(([dateStr, log]) => {
                    const formattedDate = new Date(dateStr).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
                    let parts = [];
                    if (log.temp) parts.push(`🌡️ ${log.temp} °C`);
                    if (log.weight) parts.push(`⚖️ ${log.weight} kg`);
                    
                    metricsContainer.innerHTML += `
                        <div class="metric-row-item">
                            <span>${formattedDate}</span>
                            <strong>${parts.join(' • ')}</strong>
                        </div>
                    `;
                });
            }
        }
    }

    // --- BIOMETRIC SECURITY METHODS (WEBAUTHN) ---
    async enrollBiometrics() {
        if (!window.PublicKeyCredential) {
            this.showToast("Biometria não suportada neste browser.");
            return false;
        }
        try {
            const challenge = new Uint8Array(32);
            window.crypto.getRandomValues(challenge);
            const userID = new Uint8Array(16);
            window.crypto.getRandomValues(userID);

            const options = {
                publicKey: {
                    challenge: challenge,
                    rp: { name: "Flor App" },
                    user: {
                        id: userID,
                        name: "user@flor.app",
                        displayName: "Utilizador Flor"
                    },
                    pubKeyCredParams: [{ type: "public-key", alg: -7 }],
                    authenticatorSelection: {
                        authenticatorAttachment: "platform",
                        userVerification: "required"
                    },
                    timeout: 60000
                }
            };
            
            const credential = await navigator.credentials.create(options);
            if (credential) {
                this.data.settings.biometricEnabled = true;
                this.saveData();
                this.showToast("Biometria configurada em segurança!");
                return true;
            }
        } catch (err) {
            console.error("Erro na biometria:", err);
            this.showToast("Falha na autenticação biométrica.");
        }
        return false;
    }

    async authenticateBiometrics() {
        if (!this.data.settings.biometricEnabled || !window.PublicKeyCredential) return;
        try {
            const challenge = new Uint8Array(32);
            window.crypto.getRandomValues(challenge);
            const options = {
                publicKey: {
                    challenge: challenge,
                    timeout: 60000,
                    userVerification: "required"
                }
            };
            const assertion = await navigator.credentials.get(options);
            if (assertion) {
                this.vibrate(15);
                this.isAuthenticated = true;
                this.startApp();
            }
        } catch (err) {
            console.log("Biometria recusada:", err);
        }
    }

    // --- MODAL & LOGS ---
    openLogModal(date) {
        this.selectedDate = date;
        const dateStr = this.formatDate(date);
        document.getElementById('log-modal-date').textContent = date.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
        
        document.querySelectorAll('.pill').forEach(p => p.classList.remove('selected'));
        document.getElementById('log-notes').value = '';

        const log = this.data.logs[dateStr] || {};
        
        // Load Fluxo
        if (log.flow) document.querySelector(`#flow-options .pill[data-value="${log.flow}"]`)?.classList.add('selected');
        if (log.flowDetails) log.flowDetails.forEach(v => document.querySelector(`#flow-details .pill[data-value="${v}"]`)?.classList.add('selected'));
        if (log.mucus) document.querySelector(`#mucus-options .pill[data-value="${log.mucus}"]`)?.classList.add('selected');

        // Load Sintomas
        if (log.symptoms) log.symptoms.forEach(v => document.querySelector(`#symptoms-body .pill[data-value="${v}"]`)?.classList.add('selected'));
        if (log.moods) log.moods.forEach(v => document.querySelector(`#symptoms-mood .pill[data-value="${v}"]`)?.classList.add('selected'));

        // Load Intimidade
        if (log.sex) {
            if (log.sex.activity) document.querySelector(`#sex-activity .pill[data-value="${log.sex.activity}"]`)?.classList.add('selected');
            if (log.sex.libido) document.querySelector(`#sex-libido .pill[data-value="${log.sex.libido}"]`)?.classList.add('selected');
            if (log.sex.issues) log.sex.issues.forEach(v => document.querySelector(`#sex-issues .pill[data-value="${v}"]`)?.classList.add('selected'));
        }

        // Load Saúde e Diário
        if (log.health) log.health.forEach(v => document.querySelector(`#health-habits .pill[data-value="${v}"]`)?.classList.add('selected'));
        if (log.sleep) document.querySelector(`#sleep-options .pill[data-value="${log.sleep}"]`)?.classList.add('selected');
        if (log.notes) document.getElementById('log-notes').value = log.notes;
        
        document.getElementById('log-temp').value = log.temp || '';
        document.getElementById('log-weight').value = log.weight || '';

        document.getElementById('log-modal').classList.add('open');
    }

    saveDailyLog() {
        const dateStr = this.formatDate(this.selectedDate);
        
        // Collect single values
        const flow = document.querySelector('#flow-options .pill.selected')?.getAttribute('data-value') || null;
        const mucus = document.querySelector('#mucus-options .pill.selected')?.getAttribute('data-value') || null;
        const sleep = document.querySelector('#sleep-options .pill.selected')?.getAttribute('data-value') || null;
        const sexActivity = document.querySelector('#sex-activity .pill.selected')?.getAttribute('data-value') || null;
        const sexLibido = document.querySelector('#sex-libido .pill.selected')?.getAttribute('data-value') || null;
        
        const temp = parseFloat(document.getElementById('log-temp').value) || null;
        const weight = parseFloat(document.getElementById('log-weight').value) || null;

        // Collect arrays
        const getMulti = (selector) => Array.from(document.querySelectorAll(`${selector} .pill.selected`)).map(p => p.getAttribute('data-value'));
        
        const flowDetails = getMulti('#flow-details');
        const symptoms = getMulti('#symptoms-body');
        const moods = getMulti('#symptoms-mood');
        const sexIssues = getMulti('#sex-issues');
        const health = getMulti('#health-habits');
        const notes = document.getElementById('log-notes').value.trim();

        // Check if isPeriod logic applies
        const isPeriod = this.data.logs[dateStr]?.isPeriod || (flow && flow !== 'nenhum' && flow !== 'spotting');

        this.data.logs[dateStr] = {
            ...this.data.logs[dateStr],
            isPeriod, flow, flowDetails, mucus,
            symptoms, moods,
            sex: { activity: sexActivity, libido: sexLibido, issues: sexIssues },
            health, sleep, notes, temp, weight
        };

        this.recalculateCycles();
        this.saveData();
        document.getElementById('log-modal').classList.remove('open');
        this.showToast("Diário guardado em segurança.");
    }

    openEduModal() {
        const modalBody = document.querySelector('#edu-modal .modal-body');
        if (this.data.settings.mode === 'gravidez') {
            modalBody.innerHTML = `
                <h4 class="mb-12">Cuidados na Gravidez 🤰</h4>
                <p class="mb-12"><strong>Ácido Fólico:</strong> Essencial no primeiro trimestre para o desenvolvimento do bebé.</p>
                <p class="mb-12"><strong>Hidratação:</strong> Bebe pelo menos 2 a 3 litros de água por dia.</p>
                <p class="mb-12"><strong>Sintomas:</strong> Náuseas e cansaço são normais, descansa sempre que precisares.</p>
            `;
        } else if (this.data.settings.mode === 'adolescente') {
            modalBody.innerHTML = `
                <h4 class="mb-12">O teu corpo está a mudar 🌱</h4>
                <p class="mb-12"><strong>Menstruação:</strong> É a descamação natural do útero, um sinal de saúde normal!</p>
                <p class="mb-12"><strong>Cólicas:</strong> Um saco de água quente na barriga e chá ajudam muito.</p>
                <p class="mb-12"><strong>Dúvidas?</strong> Não tenhas vergonha de falar com um adulto de confiança ou médico.</p>
            `;
        } else {
            modalBody.innerHTML = `
                <h4 class="mb-12">Fases do Ciclo 🌸</h4>
                <p class="mb-12"><strong>Menstruação (Dias 1-5):</strong> Descamação do endométrio. Descansa.</p>
                <p class="mb-12"><strong>Fase Folicular:</strong> O corpo prepara um óvulo. Energia e humor em alta.</p>
                <p class="mb-12"><strong>Ovulação (Dia ~14):</strong> Pico de energia, fertilidade e líbido.</p>
                <p class="mb-12"><strong>Fase Lútea:</strong> Preparação do corpo. Pode surgir TPM (cansaço, sensibilidade).</p>
            `;
        }
        document.getElementById('edu-modal').classList.add('open');
    }

    checkNotifications(daysLeft) {
        if ("Notification" in window && Notification.permission === "granted") {
            const lastNotif = localStorage.getItem('flor_last_notif_date');
            const todayStr = this.formatDate(new Date());
            
            if (lastNotif !== todayStr) {
                if (daysLeft === 2) {
                    new Notification("Flor 🌸", { body: "O teu período está previsto chegar em 2 dias." });
                    localStorage.setItem('flor_last_notif_date', todayStr);
                } else if (daysLeft === 0) {
                    new Notification("Flor 🌸", { body: "O teu período é esperado para hoje." });
                    localStorage.setItem('flor_last_notif_date', todayStr);
                }
            }
        }
    }

    exportData() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.data));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "flor_backup_seguro_" + this.formatDate(new Date()) + ".json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(err => console.error('SW Error', err)));
            
            let deferredPrompt;
            window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                deferredPrompt = e;
                const toast = document.getElementById('install-toast');
                toast.classList.remove('hidden');
                document.getElementById('btn-install').addEventListener('click', () => {
                    toast.classList.add('hidden');
                    deferredPrompt.prompt();
                    deferredPrompt = null;
                });
            });
            document.getElementById('btn-install-close').addEventListener('click', () => document.getElementById('install-toast').classList.add('hidden'));
        }
    }
}

document.addEventListener('DOMContentLoaded', () => { window.app = new FlorApp(); });
