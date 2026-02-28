// ROTA ANALİZ - MODERN JS LOGIC
if (typeof CONFIG === 'undefined') {
    console.error('Yapılandırma dosyası (config.js) yüklenemedi!');
}

function getElement(id) {
    return document.getElementById(id);
}

// Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

// Global değişkenler
let map, routeLayer, stopsLayer;
let speedGradientLayers = [];
let currentPoints = [];
let cachedLogData = null;

// Sayfa yüklendiğinde
document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
    initializeMap();
    setupEventListeners();
    const today = new Date().toLocaleDateString('en-CA');
    loadRoute(today);
}

function initializeMap() {
    map = L.map('map', {
        zoomControl: false,
        tap: false
    }).setView([39.9, 32.8], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
}

function setupEventListeners() {
    getElement('apply-filters')?.addEventListener('click', applyDateTimeFilter);
    getElement('menu-toggle')?.addEventListener('click', toggleSidebar);
    getElement('sidebar-close')?.addEventListener('click', toggleSidebar);

    document.querySelectorAll('.date-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.date-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const daysAgo = parseInt(this.dataset.days);
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() - daysAgo);
            loadRoute(targetDate.toLocaleDateString('en-CA'));
        });
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const tabName = this.dataset.tab;
            document.querySelectorAll('.tab-pane, .tab-btn').forEach(el => el.classList.remove('active'));
            getElement(`${tabName}-tab`)?.classList.add('active');
            this.classList.add('active');
        });
    });

    setupSpeedLimitSlider();
}

function setupSpeedLimitSlider() {
    const slider = getElement('speedLimitSlider');
    if (slider) {
        slider.addEventListener('input', function () {
            const val = this.value;
            const display = getElement('speedLimitValue');
            if (display) display.textContent = val + ' km/s';
            updateSpeedLimitAnalysis(currentPoints);
        });
    }
}

function loadRoute(dateStr) {
    showLoading(`Veriler talep ediliyor...`);
    clearMapLayers();

    database.ref('log_isteği').set({ active: true, date: dateStr, timestamp: Date.now() });
    const logRef = database.ref('motor_durumu/last_log_content');

    const timeout = setTimeout(() => {
        logRef.off();
        hideLoading();
        showToast('Cihaz yanıt vermedi.', 'error');
    }, 25000);

    logRef.on('value', (snapshot) => {
        const logData = snapshot.val();
        if (logData) {
            clearTimeout(timeout);
            logRef.off();
            const points = parseCSV(logData, dateStr);
            if (points.length < 2) {
                hideLoading();
                showToast('Veri bulunamadı.', 'warning');
            } else {
                updateMapWithPoints(points);
                hideLoading();
            }
            database.ref('motor_durumu/last_log_content').set(null);
        }
    });
}

// CSV PARSER (Orijinal Sistemle %100 Uyumlu)
function parseCSV(csvText, targetDate) {
    const lines = csvText.trim().split('\n');
    const points = [];

    lines.forEach(line => {
        const parts = line.split(',');
        if (parts.length >= 5) {
            const dateTimeStr = parts[0]; // "2024-01-29 14:30:00"
            const datePart = dateTimeStr.split(' ')[0]; // "2024-01-29"

            if (datePart === targetDate) {
                points.push({
                    lat: parseFloat(parts[1]),
                    lng: parseFloat(parts[2]),
                    speed: parseFloat(parts[3]),
                    bearing: parseFloat(parts[4]),
                    timestamp: new Date(dateTimeStr.replace(' ', 'T')).getTime(),
                    time: new Date(dateTimeStr.replace(' ', 'T'))
                });
            }
        }
    });
    return points.sort((a, b) => a.timestamp - b.timestamp);
}

function updateMapWithPoints(points) {
    if (points.length < 2) return;

    // AGRESİF GPS TİTREME FİLTRESİ (Stationary Anchor Algorithm)
    const filteredPoints = [];
    let anchorPoint = points[0];
    filteredPoints.push(anchorPoint);

    let isStationary = false;
    const DISTANCE_THRESHOLD = 45; // 45 metre (Sapma toleransı)
    const SPEED_THRESHOLD = 10;   // 10 km/s (Gürültü hızı)

    for (let i = 1; i < points.length; i++) {
        const point = points[i];
        const distFromAnchor = map.distance([anchorPoint.lat, anchorPoint.lng], [point.lat, point.lng]);

        // DURUM ANALİZİ:
        // Eğer noktalar hala çapa noktasının yakınındaysa ve hız düşükse, bunları rotaya ekleme (Titremedir)
        if (distFromAnchor < DISTANCE_THRESHOLD && point.speed < SPEED_THRESHOLD) {
            if (!isStationary) {
                isStationary = true;
            }
            // Bu nokta 'çapa' etrafında bir gürültü, rotaya eklemiyoruz.
            continue;
        } else {
            // Cihaz gerçekten hareket etmeye başladı veya büyük bir sapma var
            filteredPoints.push(point);
            anchorPoint = point; // Yeni çapa noktamız burası
            isStationary = false;
        }
    }

    // Son noktayı rotanın kopuk görünmemesi için ekle
    const lastPoint = points[points.length - 1];
    if (filteredPoints[filteredPoints.length - 1] !== lastPoint) {
        filteredPoints.push(lastPoint);
    }

    currentPoints = filteredPoints;
    clearMapLayers();

    // Rota Çizimi (Tertemiz filtrelenmiş noktalarla)
    const latlngs = filteredPoints.map(p => [p.lat, p.lng]);
    routeLayer = L.polyline(latlngs, {
        color: '#007aff',
        weight: 6,
        opacity: 0.8,
        lineCap: 'round',
        lineJoin: 'round'
    }).addTo(map);

    findAndDisplayStops(points); // Duraklamaları orijinal veriden bul (daha hassas)
    calculateAndDisplayStats(filteredPoints);
    updateSpeedLimitAnalysis(filteredPoints);

    if (latlngs.length > 0) {
        map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });
    }
}

function updateSpeedLimitAnalysis(points) {
    const speedSlider = getElement('speedLimitSlider');
    const exceedCountEl = getElement('exceed-count');

    if (!speedSlider || !exceedCountEl) return;

    const speedLimit = parseInt(speedSlider.value) || 60;
    let exceedCount = 0;
    points.forEach(point => {
        if (point.speed > speedLimit) exceedCount++;
    });

    exceedCountEl.textContent = exceedCount;
}

function findAndDisplayStops(points) {
    const MIN_STOP_DURATION = 3 * 60 * 1000;
    const stops = [];
    let tempStop = [];

    points.forEach((point) => {
        if (point.speed < 4) { // Düşük hızları duraklama sayıyoruz
            tempStop.push(point);
        } else {
            if (tempStop.length >= 2) {
                const duration = tempStop[tempStop.length - 1].timestamp - tempStop[0].timestamp;
                if (duration >= MIN_STOP_DURATION) {
                    stops.push({
                        lat: tempStop[0].lat,
                        lng: tempStop[0].lng,
                        startTime: tempStop[0].timestamp,
                        endTime: tempStop[tempStop.length - 1].timestamp,
                        duration: duration
                    });
                }
            }
            tempStop = [];
        }
    });

    displayStopsOnMap(stops);
    displayStopsInList(stops);
}

// V2 ÖZELLİĞİ: iOS TARZI MODERN MARKERLAR
function displayStopsOnMap(stops) {
    if (stopsLayer) map.removeLayer(stopsLayer);
    stopsLayer = L.layerGroup();

    stops.forEach((stop, index) => {
        // iOS Tarzı DivIcon tasarımı
        const customIcon = L.divIcon({
            className: 'ios-stop-marker',
            html: `
                <div class="ios-marker-container">
                    <div class="ios-marker-pulse"></div>
                    <div class="ios-marker-inner">
                        <ion-icon name="pin"></ion-icon>
                    </div>
                </div>
            `,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });

        const marker = L.marker([stop.lat, stop.lng], { icon: customIcon })
            .on('click', () => showStopDetails(stop, index + 1))
            .addTo(stopsLayer);
    });

    stopsLayer.addTo(map);
}

function showStopDetails(stop, index) {
    getElement('sheet-title').textContent = `Duraklama #${index}`;
    getElement('sheet-duration').textContent = formatDuration(stop.duration);
    getElement('sheet-start').textContent = new Date(stop.startTime).toLocaleTimeString('tr-TR');
    getElement('sheet-end').textContent = new Date(stop.endTime).toLocaleTimeString('tr-TR');

    getElement('sheet-zoom-btn').onclick = () => {
        map.setView([stop.lat, stop.lng], 18);
    };

    getElement('stop-details-sheet').classList.add('visible');
}

function closeStopDetails() {
    getElement('stop-details-sheet').classList.remove('visible');
}

function displayStopsInList(stops) {
    const list = getElement('stops-list');
    const count = getElement('stop-count');
    if (count) count.textContent = stops.length;
    if (!list) return;

    list.innerHTML = '';
    stops.forEach((stop, index) => {
        const div = document.createElement('div');
        div.className = 'stop-item v2';
        div.innerHTML = `
            <div class="stop-icon-v2"><ion-icon name="time"></ion-icon></div>
            <div class="stop-info-v2">
                <span class="stop-name">Duraklama #${index + 1}</span>
                <span class="stop-meta">${formatDuration(stop.duration)} • ${new Date(stop.startTime).toLocaleTimeString('tr-TR')}</span>
            </div>
        `;
        div.onclick = () => {
            map.setView([stop.lat, stop.lng], 17);
            showStopDetails(stop, index + 1);
            toggleSidebar();
        };
        list.appendChild(div);
    });
}

function calculateAndDisplayStats(points) {
    let dist = 0;
    let maxS = 0;
    for (let i = 1; i < points.length; i++) {
        dist += map.distance([points[i - 1].lat, points[i - 1].lng], [points[i].lat, points[i].lng]);
        maxS = Math.max(maxS, points[i].speed);
    }
    getElement('total-distance').textContent = (dist / 1000).toFixed(2) + ' km';
    getElement('max-speed').textContent = maxS.toFixed(1) + ' km/s';
}

function applyDateTimeFilter() {
    const start = getElement('startTime').value;
    const end = getElement('endTime').value;
    // ... filtreleme mantığı (burada basitleştirildi)
    showToast('Filtreleme V2 simülasyonu aktif', 'info');
}

// Genel Fonksiyonlar
function showLoading(msg) {
    const overlay = getElement('loading-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
        overlay.querySelector('p').textContent = msg;
    }
}

function hideLoading() {
    const overlay = getElement('loading-overlay');
    if (overlay) overlay.style.display = 'none';
}

function showToast(msg, type) {
    const cont = getElement('toast-container');
    if (!cont) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    cont.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function toggleSidebar() {
    getElement('mobile-sidebar')?.classList.toggle('sidebar-visible');
}

function formatDuration(ms) {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return m > 0 ? `${m}dk ${s}sn` : `${s}sn`;
}

function clearMapLayers() {
    if (routeLayer) map.removeLayer(routeLayer);
    if (stopsLayer) map.removeLayer(stopsLayer);
}
