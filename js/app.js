// Flor App - Main Logic (100% Offline)

class FlorApp {
    constructor() {
        this.data = this.loadData();
        this.currentDate = new Date();
        this.selectedDate = new Date();
        
        this.init();
    }

    // --- DATA MANAGEMENT ---
    loadData() {
        const defaultData = {
            cycles: [], // Array de objetos { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
            logs: {},   // Objeto chaveado por 'YYYY-MM-DD'
            settings: {
                theme: 'dark',
                teenMode: false,
                reminders: false,
                cycleType: 'regular',
                avgCycleLength: 28,
                avgPeriodLength: 5
            }
        };

        const saved = localStorage.getItem('flor_data');
        return saved ? JSON.parse(saved) : defaultData;
    }

    saveData() {
        localStorage.setItem('flor_data', JSON.stringify(this.data));
        this.updateViews();
    }

    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    // --- INITIALIZATION ---
    init() {
        this.setupNavigation();
        this.setupEventListeners();
        this.applyTheme();
        this.updateViews();
        this.registerServiceWorker();
    }

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const views = document.querySelectorAll('.view');

        navItems.forEach(item => {
            item.addEventListener('click', () => {
                // Update active nav
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');

                // Update active view
                const targetId = item.getAttribute('data-target');
                views.forEach(view => {
                    view.classList.remove('active');
                    if (view.id === targetId) {
                        view.classList.add('active');
                    }
                });

                if (targetId === 'view-calendar') this.renderCalendar();
            });
        });
    }

    setupEventListeners() {
        // Theme Toggle
        const themeToggle = document.getElementById('theme-toggle');
        themeToggle.checked = this.data.settings.theme === 'dark';
        themeToggle.addEventListener('change', (e) => {
            this.data.settings.theme = e.target.checked ? 'dark' : 'light';
            this.applyTheme();
            this.saveData();
        });

        // Configurações de Ciclo
        const cycleTypeSelect = document.getElementById('cycle-type');
        const cycleLengthInput = document.getElementById('cycle-length-input');
        const periodLengthInput = document.getElementById('period-length-input');

        cycleTypeSelect.value = this.data.settings.cycleType || 'regular';
        cycleLengthInput.value = this.data.settings.avgCycleLength;
        periodLengthInput.value = this.data.settings.avgPeriodLength;

        cycleTypeSelect.addEventListener('change', (e) => {
            this.data.settings.cycleType = e.target.value;
            this.saveData();
        });

        cycleLengthInput.addEventListener('change', (e) => {
            this.data.settings.avgCycleLength = parseInt(e.target.value) || 28;
            this.saveData();
        });

        periodLengthInput.addEventListener('change', (e) => {
            this.data.settings.avgPeriodLength = parseInt(e.target.value) || 5;
            this.saveData();
        });

        // Log Period Button (Home)
        document.getElementById('btn-log-period').addEventListener('click', () => {
            this.togglePeriod(this.formatDate(new Date()));
        });

        // Modal Open/Close
        document.getElementById('btn-log-symptoms').addEventListener('click', () => this.openLogModal(new Date()));
        document.getElementById('close-modal').addEventListener('click', () => this.closeLogModal());
        
        // Pills Logic
        document.querySelectorAll('.pill').forEach(pill => {
            pill.addEventListener('click', (e) => {
                const isMulti = e.target.parentElement.classList.contains('multi');
                if (!isMulti) {
                    Array.from(e.target.parentElement.children).forEach(c => c.classList.remove('selected'));
                }
                e.target.classList.toggle('selected');
            });
        });

        // Save Log
        document.getElementById('save-log').addEventListener('click', () => this.saveDailyLog());

        // Calendar Nav
        document.getElementById('prev-month').addEventListener('click', () => {
            this.selectedDate.setMonth(this.selectedDate.getMonth() - 1);
            this.renderCalendar();
        });
        document.getElementById('next-month').addEventListener('click', () => {
            this.selectedDate.setMonth(this.selectedDate.getMonth() + 1);
            this.renderCalendar();
        });

        // Discreet Mode
        document.getElementById('btn-discreet').addEventListener('click', () => {
            document.body.style.filter = document.body.style.filter ? '' : 'blur(5px) grayscale(100%)';
            setTimeout(() => { document.body.style.filter = ''; }, 3000); // Remove após 3s
        });

        // Export / Delete
        document.getElementById('btn-export').addEventListener('click', () => this.exportData());
        document.getElementById('btn-delete-data').addEventListener('click', () => {
            if(confirm("Tens a certeza que queres apagar todos os dados? Esta ação não pode ser desfeita e sendo 100% offline, os dados estão apenas neste dispositivo.")) {
                localStorage.removeItem('flor_data');
                location.reload();
            }
        });
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.data.settings.theme);
    }

    // --- CORE LOGIC ---
    togglePeriod(dateStr) {
        // Logica simplificada: Adiciona aos logs que é dia de período
        if (!this.data.logs[dateStr]) {
            this.data.logs[dateStr] = { flow: 'medio', symptoms: [], mood: '', notes: '', isPeriod: true };
        } else {
            this.data.logs[dateStr].isPeriod = !this.data.logs[dateStr].isPeriod;
        }
        
        // Atualiza ciclos baseado nos logs (simplificado)
        this.recalculateCycles();
        this.saveData();
    }

    recalculateCycles() {
        // Acha todos os dias de periodo ordenados
        const periodDays = Object.keys(this.data.logs)
            .filter(date => this.data.logs[date].isPeriod)
            .sort();
        
        this.data.cycles = [];
        if (periodDays.length === 0) return;

        let currentCycleStart = periodDays[0];
        let lastDay = new Date(periodDays[0]);

        for (let i = 1; i < periodDays.length; i++) {
            const currentDay = new Date(periodDays[i]);
            const diffDays = (currentDay - lastDay) / (1000 * 60 * 60 * 24);

            if (diffDays > 5) { // Nova menstruação se intervalo > 5 dias
                this.data.cycles.push({
                    start: currentCycleStart,
                    end: this.formatDate(new Date(currentDay.getTime() - (1000 * 60 * 60 * 24))) // Dia antes do novo inicio
                });
                currentCycleStart = periodDays[i];
            }
            lastDay = currentDay;
        }
        
        // Ciclo atual
        this.data.cycles.push({
            start: currentCycleStart,
            end: null
        });

        // Atualizar médias se tiver mais de um ciclo finalizado
        const finishedCycles = this.data.cycles.filter(c => c.end);
        if (finishedCycles.length > 0) {
            let totalDays = 0;
            finishedCycles.forEach(c => {
                const s = new Date(c.start);
                const e = new Date(c.end);
                totalDays += (e - s) / (1000 * 60 * 60 * 24) + 1;
            });
            this.data.settings.avgCycleLength = Math.round(totalDays / finishedCycles.length);
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
        const isPeriodToday = this.data.logs[todayStr]?.isPeriod;
        
        const btnLog = document.getElementById('btn-log-period');
        if (isPeriodToday) {
            btnLog.textContent = "Parar Menstruação";
            btnLog.classList.remove('pulse');
        } else {
            btnLog.textContent = "Registar Menstruação";
            btnLog.classList.add('pulse');
        }

        // Cycle Day Calculation
        let cycleDayText = "--";
        let predictionText = "Regista o período para ver previsões";
        let ovulDate = "--";
        let progress = 0;

        if (this.data.cycles.length > 0) {
            const currentCycle = this.data.cycles[this.data.cycles.length - 1];
            const startDate = new Date(currentCycle.start);
            const todayStr = this.formatDate(new Date());
            const today = new Date(todayStr);
            const diffTime = Math.abs(today - startDate);
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
            
            cycleDayText = diffDays;
            
            const avg = this.data.settings.avgCycleLength;
            const daysLeft = avg - diffDays;
            
            if (this.data.settings.cycleType === 'irregular') {
                predictionText = "Previsão imprecisa (Ciclo Irregular)";
            } else if (daysLeft > 0) {
                predictionText = `Próximo em ~${daysLeft} dias`;
            } else if (daysLeft === 0) {
                predictionText = "Esperado para hoje";
            } else {
                predictionText = `${Math.abs(daysLeft)} dias de atraso`;
            }

            // Progress circle
            progress = Math.min((diffDays / avg) * 100, 100);
            
            // Ovulation prediction
            const ovulTime = startDate.getTime() + ((avg - 14) * 24 * 60 * 60 * 1000);
            const ovulDateObj = new Date(ovulTime);
            ovulDate = ovulDateObj.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
        }

        document.getElementById('home-cycle-day').textContent = cycleDayText;
        document.getElementById('home-prediction').textContent = predictionText;
        document.getElementById('home-ovulation-date').textContent = ovulDate;

        // Animate Circle
        const circle = document.querySelector('.circle-progress');
        const dashoffset = 283 - (283 * progress) / 100;
        circle.style.strokeDashoffset = dashoffset;
    }

    renderCalendar() {
        const grid = document.getElementById('calendar-days');
        const monthYearDisplay = document.getElementById('month-year-display');
        
        const year = this.selectedDate.getFullYear();
        const month = this.selectedDate.getMonth();
        
        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        monthYearDisplay.textContent = `${monthNames[month]} ${year}`;
        
        grid.innerHTML = '';
        
        const firstDay = new Date(year, month, 1).getDay(); // 0 = Domingo
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const todayStr = this.formatDate(new Date());

        // Prediction calculations for display
        let nextPeriodStart = null;
        let fertileStart = null;
        let fertileEnd = null;
        let ovulationDateStr = null;

        if (this.data.cycles.length > 0) {
            const currentCycle = this.data.cycles[this.data.cycles.length - 1];
            const startDate = new Date(currentCycle.start);
            const avg = this.data.settings.avgCycleLength;
            
            nextPeriodStart = new Date(startDate.getTime() + (avg * 24 * 60 * 60 * 1000));
            const ovulation = new Date(startDate.getTime() + ((avg - 14) * 24 * 60 * 60 * 1000));
            ovulationDateStr = this.formatDate(ovulation);
            
            fertileStart = new Date(ovulation.getTime() - (4 * 24 * 60 * 60 * 1000));
            fertileEnd = new Date(ovulation.getTime() + (1 * 24 * 60 * 60 * 1000));
        }

        // Empty cells
        for (let i = 0; i < firstDay; i++) {
            grid.innerHTML += `<div class="day-cell empty"></div>`;
        }

        // Days
        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, month, i);
            const dateStr = this.formatDate(date);
            
            let classes = ['day-cell'];
            if (dateStr === todayStr) classes.push('today');
            
            if (this.data.logs[dateStr]?.isPeriod) {
                classes.push('period');
            }

            // Check predictions
            if (fertileStart && date >= fertileStart && date <= fertileEnd && dateStr !== ovulationDateStr) {
                classes.push('fertile');
            }
            if (dateStr === ovulationDateStr) {
                classes.push('ovulation');
            }

            const dayDiv = document.createElement('div');
            dayDiv.className = classes.join(' ');
            dayDiv.textContent = i;
            dayDiv.addEventListener('click', () => this.openLogModal(date));
            
            grid.appendChild(dayDiv);
        }
    }

    updateStats() {
        document.getElementById('stat-avg-cycle').textContent = this.data.settings.avgCycleLength;
        document.getElementById('stat-avg-period').textContent = this.data.settings.avgPeriodLength;

        const historyList = document.getElementById('history-list');
        historyList.innerHTML = '';
        
        // Render in reverse order
        const finished = this.data.cycles.filter(c => c.end).reverse().slice(0, 5); // Últimos 5
        
        if (finished.length === 0) {
            historyList.innerHTML = '<li class="history-item"><span style="color:var(--text-muted)">Ainda não há ciclos terminados suficientes.</span></li>';
            return;
        }

        finished.forEach(cycle => {
            const s = new Date(cycle.start).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
            const e = new Date(cycle.end).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
            
            const diffTime = Math.abs(new Date(cycle.end) - new Date(cycle.start));
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

            historyList.innerHTML += `
                <li class="history-item">
                    <span>${s} - ${e}</span>
                    <strong>${diffDays} dias</strong>
                </li>
            `;
        });
    }

    // --- MODAL & LOGS ---
    openLogModal(date) {
        this.selectedDate = date;
        const dateStr = this.formatDate(date);
        document.getElementById('log-modal-date').textContent = date.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
        
        // Reset and Load existing
        document.querySelectorAll('.pill').forEach(p => p.classList.remove('selected'));
        document.getElementById('log-notes').value = '';

        const log = this.data.logs[dateStr];
        if (log) {
            if (log.flow) document.querySelector(`#flow-options .pill[data-value="${log.flow}"]`)?.classList.add('selected');
            if (log.mood) document.querySelector(`#mood-options .pill[data-value="${log.mood}"]`)?.classList.add('selected');
            if (log.symptoms) {
                log.symptoms.forEach(symp => {
                    document.querySelector(`#symptoms-options .pill[data-value="${symp}"]`)?.classList.add('selected');
                });
            }
            if (log.notes) document.getElementById('log-notes').value = log.notes;
        }

        document.getElementById('log-modal').classList.add('open');
    }

    closeLogModal() {
        document.getElementById('log-modal').classList.remove('open');
    }

    saveDailyLog() {
        const dateStr = this.formatDate(this.selectedDate);
        
        const flow = document.querySelector('#flow-options .pill.selected')?.getAttribute('data-value') || null;
        const mood = document.querySelector('#mood-options .pill.selected')?.getAttribute('data-value') || null;
        const symptoms = Array.from(document.querySelectorAll('#symptoms-options .pill.selected')).map(p => p.getAttribute('data-value'));
        const notes = document.getElementById('log-notes').value;

        // Manter isPeriod se já existir
        const isPeriod = this.data.logs[dateStr]?.isPeriod || (flow && flow !== 'nenhum');

        this.data.logs[dateStr] = {
            ...this.data.logs[dateStr],
            flow, mood, symptoms, notes, isPeriod
        };

        this.recalculateCycles();
        this.saveData();
        this.closeLogModal();
    }

    // --- UTILS ---
    exportData() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.data));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "flor_backup_" + this.formatDate(new Date()) + ".json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js').then(reg => {
                    console.log('SW registado com sucesso!', reg.scope);
                }).catch(err => {
                    console.error('Falha ao registar SW', err);
                });
            });

            // Lógica de PWA Install Prompt
            let deferredPrompt;
            window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                deferredPrompt = e;
                const toast = document.getElementById('install-toast');
                toast.classList.remove('hidden');

                document.getElementById('btn-install').addEventListener('click', () => {
                    toast.classList.add('hidden');
                    deferredPrompt.prompt();
                    deferredPrompt.userChoice.then((choiceResult) => {
                        if (choiceResult.outcome === 'accepted') {
                            console.log('App instalada');
                        }
                        deferredPrompt = null;
                    });
                });
            });

            document.getElementById('btn-install-close').addEventListener('click', () => {
                document.getElementById('install-toast').classList.add('hidden');
            });
        }
    }
}

// Iniciar a aplicação
document.addEventListener('DOMContentLoaded', () => {
    window.app = new FlorApp();
});
