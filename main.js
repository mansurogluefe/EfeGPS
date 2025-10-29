// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBt3WGvcD1-KJgf6FmW4ngnLSjyNSfc-88",
    authDomain: "efegps-0505.firebaseapp.com",
    databaseURL: "https://efegps-0505-default-rtdb.firebaseio.com",
    projectId: "efegps-0505",
    storageBucket: "efegps-0505.appspot.com",
    messagingSenderId: "266569948357",
    appId: "1:266569948357:web:f8b3f64ecfecbdabfe64ac"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Global Variables
let map, liveMarker, currentRoute = [];
let liveData = {}, todayStats = {}, charts = {};
let isLiveMode = true, liveInterval;

// DOM Elements
const elements = {
    // Header
    connectionStatus: document.getElementById('connection-status'),
    currentSpeed: document.getElementById('current-speed'),
    lastUpdate: document.getElementById('last-update'),

    // Live Info
    liveSpeed: document.getElementById('live-speed'),
    liveBearing: document.getElementById('live-bearing'),
    liveAltitude: document.getElementById('live-altitude'),
    liveUpdate: document.getElementById('live-update'),

    // Dashboard Stats
    currentLiveSpeed: document.getElementById('current-live-speed'),
    todayDistance: document.getElementById('today-distance'),
    todayFuelCost: document.getElementById('today-fuel-cost'),
    drivingScore: document.getElementById('driving-score'),

    // Analytics
    analyticsDistance: document.getElementById('analytics-distance'),
    analyticsAvgSpeed: document.getElementById('analytics-avg-speed'),
    analyticsMaxSpeed: document.getElementById('analytics-max-speed'),
    analyticsDriveTime: document.getElementById('analytics-drive-time'),
    todayFuel: document.getElementById('today-fuel'),
    totalFuelCost: document.getElementById('total-fuel-cost'),
    co2Emission: document.getElementById('co2-emission'),
    efficiencyValue: document.getElementById('efficiency-value'),
    stabilityValue: document.getElementById('stability-value'),
    safetyValue: document.getElementById('safety-value'),

    // Bars
    efficiencyBar: document.getElementById('efficiency-bar'),
    stabilityBar: document.getElementById('stability-bar'),
    safetyBar: document.getElementById('safety-bar'),

    // Settings
    themeSelect: document.getElementById('theme-select'),
    mapStyle: document.getElementById('map-style'),
    fuelType: document.getElementById('fuel-type'),
    avgConsumption: document.getElementById('avg-consumption'),
    speedLimit: document.getElementById('speed-limit'),
    currentFuelPrice: document.getElementById('current-fuel-price'),

    // Modals
    emergencyModal: document.getElementById('emergency-modal'),
    fuelModal: document.getElementById('fuel-modal')
};

// Initialize Application
class EfeGPSPro {
    constructor() {
        this.init();
    }

    async init() {
        try {
            await this.initializeMap();
            this.initializeCharts();
            this.setupEventListeners();
            this.loadSettings();
            this.startLiveTracking();
            this.hideLoading();

            console.log('🚀 EfeGPS Pro başlatıldı');
        } catch (error) {
            console.error('Başlatma hatası:', error);
            this.showError('Sistem başlatılamadı. Sayfayı yenileyin.');
        }
    }

    initializeMap() {
        return new Promise((resolve) => {
            map = L.map('map').setView([36.2189752, 36.1691751], 13);

            const standardLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap'
            });

            const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: '© Esri'
            });

            standardLayer.addTo(map);

            // Live marker with custom icon
            const bikeIcon = L.divIcon({
                html: '<div class="live-bike-marker"><i class="fas fa-motorcycle"></i></div>',
                className: 'live-marker',
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            });

            liveMarker = L.marker([36.2189752, 36.1691751], { icon: bikeIcon }).addTo(map);

            resolve();
        });
    }

    initializeCharts() {
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { display: false },
                y: { display: true, grid: { color: 'rgba(255,255,255,0.1)' } }
            }
        };

        // Speed Chart
        charts.speed = new Chart(document.getElementById('speed-chart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: chartOptions
        });

        // Altitude Chart
        charts.altitude = new Chart(document.getElementById('altitude-chart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: chartOptions
        });

        // Fuel Chart
        charts.fuel = new Chart(document.getElementById('fuel-chart'), {
            type: 'bar',
            data: {
                labels: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'],
                datasets: [{
                    data: [45, 52, 38, 61, 55, 48, 42],
                    backgroundColor: '#f59e0b',
                    borderColor: '#f59e0b',
                    borderWidth: 1
                }]
            },
            options: chartOptions
        });
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => this.switchTab(item.dataset.tab));
        });

        // Map Controls
        document.getElementById('btn-live').addEventListener('click', () => this.setLiveMode(true));
        document.getElementById('btn-history').addEventListener('click', () => this.setLiveMode(false));
        document.getElementById('btn-satellite').addEventListener('click', this.toggleMapStyle);

        // Quick Actions
        document.getElementById('btn-route-plan').addEventListener('click', this.showRoutePlanner);
        document.getElementById('btn-fuel-calc').addEventListener('click', () => this.showModal('fuel-modal'));
        document.getElementById('btn-emergency').addEventListener('click', () => this.showModal('emergency-modal'));
        document.getElementById('btn-share-live').addEventListener('click', this.shareLiveLocation);

        // Settings
        document.getElementById('save-settings').addEventListener('click', this.saveSettings);
        document.getElementById('reset-settings').addEventListener('click', this.resetSettings);

        // Modal Controls
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', this.closeModals);
        });

        // Fuel Calculator
        document.getElementById('calc-distance').addEventListener('input', this.calculateFuel);
        document.getElementById('calc-price').addEventListener('input', this.calculateFuel);
        document.getElementById('calc-consumption').addEventListener('input', this.calculateFuel);

        // Emergency Actions
        document.querySelector('.btn-emergency-call').addEventListener('click', this.makeEmergencyCall);
        document.querySelector('.btn-share-location').addEventListener('click', this.shareEmergencyLocation);
        document.querySelector('.btn-cancel-emergency').addEventListener('click', this.closeModals);

        // Theme Change
        elements.themeSelect.addEventListener('change', (e) => {
            document.body.setAttribute('data-theme', e.target.value);
            this.saveSettings();
        });
    }

    startLiveTracking() {
        // Live motor durumu takibi
        database.ref('motor_durumu').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                this.updateLiveData(data);
            }
        });

        // Geçmiş veri yükleme
        this.loadTodayData();
    }

    updateLiveData(data) {
        liveData = data;

        // Update UI
        elements.currentSpeed.textContent = `${data.speed || 0} km/s`;
        elements.liveSpeed.textContent = `${data.speed || 0} km/s`;
        elements.liveBearing.textContent = `${data.bearing || 0}°`;
        elements.liveAltitude.textContent = `${data.altitude || 0} m`;

        const updateTime = new Date(data.lastUpdate).toLocaleTimeString('tr-TR');
        elements.lastUpdate.textContent = updateTime;
        elements.liveUpdate.textContent = updateTime;
        elements.currentLiveSpeed.textContent = data.speed || 0;

        // Update map
        const newLatLng = [data.latitude, data.longitude];
        liveMarker.setLatLng(newLatLng);

        if (isLiveMode) {
            map.setView(newLatLng, 15);
        }

        // Add to current route
        currentRoute.push({
            lat: data.latitude,
            lng: data.longitude,
            speed: data.speed,
            altitude: data.altitude,
            timestamp: data.lastUpdate
        });

        // Update charts
        this.updateCharts();

        // Update stats
        this.updateLiveStats();

        // Check alerts
        this.checkAlerts(data);
    }

    updateLiveStats() {
        if (currentRoute.length < 2) return;

        // Calculate distance
        let totalDistance = 0;
        for (let i = 1; i < currentRoute.length; i++) {
            totalDistance += this.calculateDistance(
                currentRoute[i-1].lat, currentRoute[i-1].lng,
                currentRoute[i].lat, currentRoute[i].lng
            );
        }

        // Calculate fuel cost
        const fuelPrice = parseFloat(elements.currentFuelPrice.value) || 42.50;
        const avgConsumption = parseFloat(elements.avgConsumption.value) || 6.5;
        const fuelUsed = (totalDistance * avgConsumption) / 100;
        const fuelCost = fuelUsed * fuelPrice;

        // Update UI
        elements.todayDistance.textContent = totalDistance.toFixed(1);
        elements.todayFuelCost.textContent = fuelCost.toFixed(1);
        elements.todayFuel.textContent = fuelUsed.toFixed(1);
        elements.totalFuelCost.textContent = fuelCost.toFixed(1);
        elements.co2Emission.textContent = (fuelUsed * 2.31).toFixed(1);

        // Update performance metrics
        this.updatePerformanceMetrics();
    }

    updatePerformanceMetrics() {
        const speeds = currentRoute.map(p => p.speed).filter(s => s > 0);
        if (speeds.length === 0) return;

        const avgSpeed = speeds.reduce((a, b) => a + b) / speeds.length;
        const maxSpeed = Math.max(...speeds);
        const speedVariation = this.calculateSpeedVariation(speeds);

        elements.analyticsDistance.textContent = elements.todayDistance.textContent + ' km';
        elements.analyticsAvgSpeed.textContent = avgSpeed.toFixed(1) + ' km/s';
        elements.analyticsMaxSpeed.textContent = maxSpeed.toFixed(1) + ' km/s';

        // Calculate efficiencies
        const efficiency = Math.max(60, 100 - speedVariation * 2);
        const stability = Math.max(70, 100 - (maxSpeed - avgSpeed));
        const safety = Math.min(100, 100 - (maxSpeed > 80 ? (maxSpeed - 80) * 2 : 0));

        elements.efficiencyValue.textContent = efficiency + '%';
        elements.stabilityValue.textContent = stability + '%';
        elements.safetyValue.textContent = safety + '%';

        elements.efficiencyBar.style.width = efficiency + '%';
        elements.stabilityBar.style.width = stability + '%';
        elements.safetyBar.style.width = safety + '%';
    }

    calculateSpeedVariation(speeds) {
        const mean = speeds.reduce((a, b) => a + b) / speeds.length;
        const variance = speeds.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / speeds.length;
        return Math.sqrt(variance);
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    updateCharts() {
        if (currentRoute.length < 2) return;

        const recentData = currentRoute.slice(-20); // Son 20 veri noktası

        charts.speed.data.labels = recentData.map((_, i) => i);
        charts.speed.data.datasets[0].data = recentData.map(p => p.speed);
        charts.speed.update();

        charts.altitude.data.labels = recentData.map((_, i) => i);
        charts.altitude.data.datasets[0].data = recentData.map(p => p.altitude);
        charts.altitude.update();
    }

    checkAlerts(data) {
        const speedLimit = parseFloat(elements.speedLimit.value) || 80;
        const alertsContainer = document.getElementById('live-alerts');

        if (data.speed > speedLimit) {
            this.showAlert(`🚨 Hız limiti aşıldı: ${data.speed} km/s`, 'danger');
        }

        if (data.altitude > 1500) {
            this.showAlert('⚠️ Yüksek rakım bölgesindesiniz', 'warning');
        }
    }

    showAlert(message, type = 'info') {
        const alertsContainer = document.getElementById('live-alerts');
        const alert = document.createElement('div');
        alert.className = `alert-item ${type}`;
        alert.innerHTML = `<i class="fas fa-${type === 'danger' ? 'exclamation-triangle' : 'info-circle'}"></i><span>${message}</span>`;

        alertsContainer.insertBefore(alert, alertsContainer.firstChild);

        // Keep only last 5 alerts
        while (alertsContainer.children.length > 5) {
            alertsContainer.removeChild(alertsContainer.lastChild);
        }

        // Auto remove after 10 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
        }, 10000);
    }

    switchTab(tabName) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');
    }

    setLiveMode(live) {
        isLiveMode = live;
        const liveBtn = document.getElementById('btn-live');
        const historyBtn = document.getElementById('btn-history');

        if (live) {
            liveBtn.classList.add('active');
            historyBtn.classList.remove('active');
            if (liveData.latitude) {
                map.setView([liveData.latitude, liveData.longitude], 15);
            }
        } else {
            liveBtn.classList.remove('active');
            historyBtn.classList.add('active');
        }
    }

    showModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }

    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    }

    calculateFuel() {
        const distance = parseFloat(document.getElementById('calc-distance').value) || 100;
        const price = parseFloat(document.getElementById('calc-price').value) || 42.50;
        const consumption = parseFloat(document.getElementById('calc-consumption').value) || 6.5;

        const fuelUsed = (distance * consumption) / 100;
        const totalCost = fuelUsed * price;

        document.getElementById('calc-result').textContent = totalCost.toFixed(2) + ' TL';
    }

    async loadTodayData() {
        const today = new Date().toISOString().split('T')[0];
        try {
            const snapshot = await database.ref(`konum_kayitlari/${today}`).once('value');
            const data = snapshot.val();
            if (data) {
                this.processHistoricalData(data);
            }
        } catch (error) {
            console.error('Geçmiş veri yükleme hatası:', error);
        }
    }

    processHistoricalData(data) {
        const points = Object.values(data).sort((a, b) => a.timestamp - b.timestamp);

        // Calculate daily stats
        let totalDistance = 0;
        let totalTime = 0;
        let maxSpeed = 0;

        for (let i = 1; i < points.length; i++) {
            const dist = this.calculateDistance(
                points[i-1].latitude, points[i-1].longitude,
                points[i].latitude, points[i].longitude
            );
            totalDistance += dist;
            totalTime += points[i].timestamp - points[i-1].timestamp;
            maxSpeed = Math.max(maxSpeed, points[i].speed || 0);
        }

        todayStats = {
            distance: totalDistance,
            time: totalTime,
            maxSpeed: maxSpeed
        };

        this.updateDashboard();
    }

    updateDashboard() {
        if (todayStats.distance) {
            elements.todayDistance.textContent = todayStats.distance.toFixed(1);
        }
    }

    loadSettings() {
        const savedSettings = localStorage.getItem('efeGPS-settings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);

            if (settings.theme) {
                document.body.setAttribute('data-theme', settings.theme);
                elements.themeSelect.value = settings.theme;
            }

            if (settings.fuelPrice) {
                elements.currentFuelPrice.value = settings.fuelPrice;
            }

            if (settings.consumption) {
                elements.avgConsumption.value = settings.consumption;
            }

            if (settings.speedLimit) {
                elements.speedLimit.value = settings.speedLimit;
            }
        }
    }

    saveSettings() {
        const settings = {
            theme: elements.themeSelect.value,
            fuelPrice: elements.currentFuelPrice.value,
            consumption: elements.avgConsumption.value,
            speedLimit: elements.speedLimit.value,
            fuelType: elements.fuelType.value
        };

        localStorage.setItem('efeGPS-settings', JSON.stringify(settings));
        this.showAlert('✅ Ayarlar kaydedildi', 'info');
    }

    resetSettings() {
        localStorage.removeItem('efeGPS-settings');
        location.reload();
    }

    shareLiveLocation() {
        if (navigator.share && liveData.latitude) {
            navigator.share({
                title: 'Canlı Konumum',
                text: `Şu an bu konumdayım: ${liveData.latitude}, ${liveData.longitude}`,
                url: `https://maps.google.com/?q=${liveData.latitude},${liveData.longitude}`
            });
        } else {
            // Fallback - copy to clipboard
            const locationText = `Konum: https://maps.google.com/?q=${liveData.latitude},${liveData.longitude}`;
            navigator.clipboard.writeText(locationText);
            this.showAlert('📍 Konum linki panoya kopyalandı', 'info');
        }
    }

    makeEmergencyCall() {
        window.open('tel:112', '_self');
    }

    shareEmergencyLocation() {
        const message = `ACİL DURUM! Konum: https://maps.google.com/?q=${liveData.latitude},${liveData.longitude}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    }

    showRoutePlanner() {
        this.showAlert('🗺️ Rota planlama özelliği yakında eklenecek', 'info');
    }

    toggleMapStyle() {
        this.showAlert('🗺️ Harita stili değiştirme yakında eklenecek', 'info');
    }

    hideLoading() {
        document.getElementById('loading-overlay').style.display = 'none';
    }

    showError(message) {
        const loading = document.getElementById('loading-overlay');
        loading.innerHTML = `
            <div class="loading-content">
                <div style="color: #ef4444; font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
                <h3>Hata</h3>
                <p>${message}</p>
                <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer;">Sayfayı Yenile</button>
            </div>
        `;
    }
}

// CSS for live marker
const liveMarkerStyles = `
    .live-marker {
        background: none;
        border: none;
    }
    .live-bike-marker {
        width: 40px;
        height: 40px;
        background: #ef4444;
        border: 3px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 18px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        animation: pulse-live 1.5s infinite;
    }
    @keyframes pulse-live {
        0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
        70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
        100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }
`;

// Add styles to document
const styleSheet = document.createElement('style');
styleSheet.textContent = liveMarkerStyles;
document.head.appendChild(styleSheet);

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new EfeGPSPro();
});

// Fuel calculator initialization
document.addEventListener('DOMContentLoaded', () => {
    const efeGPS = new EfeGPSPro();
    efeGPS.calculateFuel(); // Initial calculation
});