// Firebase ayarları
const firebaseConfig = {
    apiKey: "AIzaSyBt3WGvcD1-KJgf6FmW4ngnLSjyNSfc-88",
    authDomain: "efegps-0505.firebaseapp.com",
    databaseURL: "https://efegps-0505-default-rtdb.firebaseio.com",
    projectId: "efegps-0505",
    storageBucket: "efegps-0505.appspot.com",
    messagingSenderId: "266569948357",
    appId: "1:266569948357:web:f8b3f64ecfecbdabfe64ac"
};

// DOM elementleri - NULL kontrolü ile
function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`Element bulunamadı: ${id}`);
    }
    return element;
}

// Firebase başlatma ve hata kontrolü
try {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        console.log('Firebase başarıyla başlatıldı');
    }
} catch (error) {
    console.error('Firebase başlatma hatası:', error);
    showError('Firebase bağlantı hatası!');
}

const database = firebase.database();

// Global değişkenler
let map, routeLayer, stopsLayer, analyticsChart;
let speedGradientLayers = [];
let currentPoints = [];

// Sayfa yüklendiğinde
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM yüklendi, init işlemleri başlıyor...');
    initializeApp();
});

// Uygulama başlatma
function initializeApp() {
    showLoading('Uygulama başlatılıyor...');

    try {
        // Haritayı başlat
        initializeMap();

        // Event listener'ları kur
        setupEventListeners();

        // Bugünkü tarihi yükle
        const today = new Date().toISOString().slice(0, 10);
        const datePicker = getElement('datePicker');
        if (datePicker) {
            datePicker.value = today;
        }

        // Sayfayı yükle
        setTimeout(() => {
            loadRoute(today);
        }, 500);

    } catch (error) {
        console.error('Uygulama başlatma hatası:', error);
        showError('Uygulama başlatılamadı: ' + error.message);
    }
}

// Harita başlatma
function initializeMap() {
    try {
        const mapElement = getElement('map');
        if (!mapElement) {
            throw new Error('Harita elementi bulunamadı');
        }

        map = L.map('map', {
            zoomControl: false,
            tap: false
        }).setView([39.9, 32.8], 6);

        // Tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
        }).addTo(map);

        // Zoom kontrolü
        L.control.zoom({
            position: 'bottomright'
        }).addTo(map);

        console.log('Harita başarıyla yüklendi');
    } catch (error) {
        console.error('Harita başlatma hatası:', error);
        showError('Harita yüklenemedi: ' + error.message);
    }
}

// Event listener'ları kur
function setupEventListeners() {
    // Tarih değişikliği
    const datePicker = getElement('datePicker');
    if (datePicker) {
        datePicker.addEventListener('change', function() {
            const selectedDate = this.value;
            if (selectedDate) {
                loadRoute(selectedDate);
            }
        });
    }

    // Filtre uygula butonu
    const applyFiltersBtn = getElement('apply-filters');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', function() {
            applyDateTimeFilter();
        });
    }

    // Menu toggle
    const menuToggle = getElement('menu-toggle');
    const sidebarClose = getElement('sidebar-close');
    if (menuToggle) menuToggle.addEventListener('click', toggleSidebar);
    if (sidebarClose) sidebarClose.addEventListener('click', toggleSidebar);

    // Theme toggle
    const themeToggle = getElement('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // Quick date buttons
    setupQuickDateSelector();

    // Tab navigation
    setupTabNavigation();

    // Hız limit slider
    setupSpeedLimitSlider();

    console.log('Event listenerlar kuruldu');
}

// Hız limit slider event'ini güncelle
function setupSpeedLimitSlider() {
    const speedSlider = getElement('speedLimitSlider');
    if (speedSlider) {
        speedSlider.addEventListener('input', function() {
            const speedValue = getElement('speedLimitValue');
            if (speedValue) {
                speedValue.textContent = this.value + ' km/s';
            }
            if (currentPoints.length > 0) {
                // Hız limiti değiştiğinde rotayı yeniden çiz
                updateMapWithPoints(currentPoints);
            }
        });
    }
}

// Hızlı tarih seçici
function setupQuickDateSelector() {
    document.querySelectorAll('.date-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // Tüm butonlardan active classını kaldır
            document.querySelectorAll('.date-btn').forEach(b => {
                b.classList.remove('active');
            });

            // Tıklanan butona active classını ekle
            this.classList.add('active');

            const daysAgo = parseInt(this.dataset.days);
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() - daysAgo);

            const dateStr = targetDate.toISOString().slice(0, 10);
            const datePicker = getElement('datePicker');
            if (datePicker) {
                datePicker.value = dateStr;
            }
            loadRoute(dateStr);
        });
    });
}

// Tab navigasyonu
function setupTabNavigation() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.dataset.tab;
            switchTab(tabName);
        });
    });
}

// Tab değiştirme
function switchTab(tabName) {
    // Tüm tabları gizle
    document.querySelectorAll('.tab-pane').forEach(tab => {
        tab.classList.remove('active');
    });

    // Tüm tab butonlarını pasif yap
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Hedef tabı göster
    const targetTab = document.getElementById(`${tabName}-tab`);
    const targetBtn = document.querySelector(`[data-tab="${tabName}"]`);

    if (targetTab && targetBtn) {
        targetTab.classList.add('active');
        targetBtn.classList.add('active');
    }
}

// Tarih ve saat filtreleme
function applyDateTimeFilter() {
    const datePicker = getElement('datePicker');
    const startTime = getElement('startTime');
    const endTime = getElement('endTime');

    if (!datePicker || !startTime || !endTime) {
        showToast('Form elementleri bulunamadı', 'error');
        return;
    }

    const date = datePicker.value;
    const startTimeValue = startTime.value;
    const endTimeValue = endTime.value;

    if (!date) {
        showToast('Lütfen bir tarih seçin', 'error');
        return;
    }

    showLoading('Filtrelenmiş veriler yükleniyor...');
    loadFilteredRoute(date, startTimeValue, endTimeValue);
}

// Filtreli rota yükleme
function loadFilteredRoute(dateStr, startTime, endTime) {
    console.log('Filtreli rota yükleniyor:', dateStr, startTime, endTime);

    database.ref(`konum_kayitlari/${dateStr}`).once('value')
    .then(snapshot => {
        const data = snapshot.val();
        if (!data) {
            hideLoading();
            showToast(`${dateStr} tarihine ait veri bulunamadı`, 'warning');
            return;
        }

        let points = Object.values(data)
            .sort((a, b) => a.timestamp - b.timestamp)
            .map(p => ({
                lat: p.latitude,
                lng: p.longitude,
                speed: isNaN(p.speed) ? 0 : p.speed,
                altitude: p.altitude || 0,
                timestamp: p.timestamp,
                time: new Date(p.timestamp)
            }));

        // Zaman filtrelemesi uygula
        if (startTime && endTime) {
            const startDateTime = new Date(`${dateStr}T${startTime}`).getTime();
            const endDateTime = new Date(`${dateStr}T${endTime}`).getTime();

            points = points.filter(p => {
                return p.timestamp >= startDateTime && p.timestamp <= endDateTime;
            });

            console.log(`Zaman filtresi uygulandı: ${points.length} nokta kaldı`);
        }

        if (points.length < 2) {
            hideLoading();
            showToast('Filtreleme sonucu yeterli veri bulunamadı', 'warning');
            return;
        }

        // Haritayı güncelle
        updateMapWithPoints(points);
        hideLoading();
        showToast('Filtreleme uygulandı', 'success');

    })
    .catch(error => {
        console.error('Filtreli veri yükleme hatası:', error);
        hideLoading();
        showToast('Veri yüklenirken hata oluştu', 'error');
    });
}

// Ana rota yükleme fonksiyonu
function loadRoute(dateStr) {
    console.log('Rota yükleniyor:', dateStr);
    showLoading(`${dateStr} tarihine ait veriler yükleniyor...`);

    // Önceki katmanları temizle
    clearMapLayers();

    // DOM'u sıfırla
    resetDisplay();

    if (!dateStr) {
        hideLoading();
        showToast('Geçersiz tarih!', 'error');
        return;
    }

    database.ref(`konum_kayitlari/${dateStr}`).once('value')
    .then(snapshot => {
        const data = snapshot.val();
        if (!data) {
            hideLoading();
            showToast(`${dateStr} tarihine ait veri bulunamadı`, 'warning');
            return;
        }

        let points = Object.values(data)
            .sort((a, b) => a.timestamp - b.timestamp)
            .map(p => ({
                lat: p.latitude,
                lng: p.longitude,
                speed: isNaN(p.speed) ? 0 : p.speed,
                altitude: p.altitude || 0,
                timestamp: p.timestamp,
                time: new Date(p.timestamp)
            }));

        console.log(`${points.length} nokta yüklendi`);

        if (points.length < 2) {
            hideLoading();
            showToast('Yeterli kayıt bulunamadı', 'warning');
            return;
        }

        // Haritayı güncelle
        updateMapWithPoints(points);
        hideLoading();
        showToast(`${points.length} nokta başarıyla yüklendi`, 'success');

    })
    .catch(error => {
        console.error('Veri yükleme hatası:', error);
        hideLoading();
        showToast('Veri yüklenirken hata oluştu: ' + error.message, 'error');
    });
}

// Hız limitine göre renkli rota çizimi
function createSpeedGradientRoute(points) {
    // Önceki hız katmanlarını temizle
    speedGradientLayers.forEach(layer => {
        if (layer && map.hasLayer(layer)) {
            map.removeLayer(layer);
        }
    });
    speedGradientLayers = [];

    const speedSlider = getElement('speedLimitSlider');
    if (!speedSlider) return;

    const speedLimit = parseInt(speedSlider.value) || 60;
    const routeGroup = L.featureGroup();

    // Segmentleri çiz
    for (let i = 1; i < points.length; i++) {
        const prevPoint = points[i-1];
        const currentPoint = points[i];
        const avgSpeed = (prevPoint.speed + currentPoint.speed) / 2;

        // Hız limitine göre renk belirle
        const color = getColorForSpeedWithLimit(avgSpeed, speedLimit);
        const status = getSpeedLimitStatus(avgSpeed, speedLimit);

        const segment = L.polyline([
            [prevPoint.lat, prevPoint.lng],
            [currentPoint.lat, currentPoint.lng]
        ], {
            color: color,
            weight: 6,
            opacity: 0.8,
            lineCap: 'round'
        }).bindTooltip(
            `Hız: ${avgSpeed.toFixed(1)} km/s<br>
             Limit: ${speedLimit} km/s<br>
             Durum: ${status}<br>
             Saat: ${new Date(prevPoint.timestamp).toLocaleTimeString('tr-TR')}`,
            {
                permanent: false,
                direction: 'top',
                className: 'speed-tooltip'
            }
        );

        routeGroup.addLayer(segment);
        speedGradientLayers.push(segment);
    }

    routeGroup.addTo(map);
    return routeGroup;
}

// Hız limitine göre renk belirleme
function getColorForSpeedWithLimit(speed, speedLimit) {
    if (speed > speedLimit) {
        return '#ff0000'; // KIRMIZI - limiti aşmış
    } else if (speed > speedLimit * 0.8) {
        return '#ff9900'; // TURUNCU - limite yakın
    } else {
        return '#00ff00'; // YEŞİL - güvenli
    }
}

// Hız limit durumu belirleme
function getSpeedLimitStatus(speed, speedLimit) {
    if (speed > speedLimit) {
        return 'Hız Limiti Aşıldı!';
    } else if (speed > speedLimit * 0.8) {
        return 'Limite Yakın';
    } else {
        return 'Güvenli';
    }
}

// Yön okları ekleme
function addDirectionArrows(points) {
    // Önceki okları temizle
    const existingArrows = speedGradientLayers.filter(layer =>
        layer instanceof L.PolylineDecorator
    );
    existingArrows.forEach(layer => {
        if (map.hasLayer(layer)) {
            map.removeLayer(layer);
        }
    });

    if (points.length < 2) return;

    const latlngs = points.map(p => [p.lat, p.lng]);
    const basePolyline = L.polyline(latlngs);

    const arrowDecorator = L.polylineDecorator(basePolyline, {
        patterns: [{
            offset: 25,
            repeat: 50,
            symbol: L.Symbol.arrowHead({
                pixelSize: 12,
                polygon: true,
                pathOptions: {
                    stroke: true,
                    color: '#005eff',
                    weight: 3,
                    opacity: 0.9,
                    fill: true,
                    fillColor: '#005eff',
                    fillOpacity: 0.8
                }
            })
        }]
    }).addTo(map);

    speedGradientLayers.push(arrowDecorator);
}

// Haritayı noktalarla güncelle
function updateMapWithPoints(points) {
    currentPoints = points;

    try {
        // Önceki katmanları temizle
        clearMapLayers();

        // Hız limitine göre renkli rota çiz
        const speedRouteGroup = createSpeedGradientRoute(points);

        // Yön okları ekle
        addDirectionArrows(points);

        // Basit rota çizgisi (backup olarak)
        const latlngs = points.map(p => [p.lat, p.lng]);
        routeLayer = L.polyline(latlngs, {
            color: 'blue',
            weight: 2,
            opacity: 0.3,
            dashArray: '5,5'
        }).addTo(map);

        // Duraklamaları bul ve göster
        findAndDisplayStops(points);

        // İstatistikleri hesapla
        calculateAndDisplayStats(points);

        // Grafiği güncelle
        updateChart(points);

        // Hız limit analizi
        updateSpeedLimitAnalysis(points);

        // Harita sınırlarını ayarla
        if (speedRouteGroup && speedRouteGroup.getBounds) {
            map.fitBounds(speedRouteGroup.getBounds());
        }

    } catch (error) {
        console.error('Harita güncelleme hatası:', error);
        showToast('Harita güncellenirken hata oluştu', 'error');
    }
}

// Duraklamaları bul ve göster
function findAndDisplayStops(points) {
    const MIN_STOP_DURATION = 3 * 60 * 1000; // 3 dakika
    const stops = [];
    let tempStop = [];

    points.forEach((point, index) => {
        if (point.speed < 5) { // 5 km/s altı duraklama
            tempStop.push(point);
        } else {
            if (tempStop.length >= 2) {
                const startTime = tempStop[0].timestamp;
                const endTime = tempStop[tempStop.length - 1].timestamp;
                const duration = endTime - startTime;

                if (duration >= MIN_STOP_DURATION) {
                    stops.push({
                        lat: tempStop[0].lat,
                        lng: tempStop[0].lng,
                        startTime: startTime,
                        duration: duration,
                        points: [...tempStop]
                    });
                }
            }
            tempStop = [];
        }
    });

    // Son duraklamayı kontrol et
    if (tempStop.length >= 2) {
        const startTime = tempStop[0].timestamp;
        const endTime = tempStop[tempStop.length - 1].timestamp;
        const duration = endTime - startTime;

        if (duration >= MIN_STOP_DURATION) {
            stops.push({
                lat: tempStop[0].lat,
                lng: tempStop[0].lng,
                startTime: startTime,
                duration: duration,
                points: [...tempStop]
            });
        }
    }

    displayStopsOnMap(stops);
    displayStopsInList(stops);
}

// Duraklamaları haritada göster
function displayStopsOnMap(stops) {
    if (stopsLayer) {
        map.removeLayer(stopsLayer);
    }

    stopsLayer = L.layerGroup();

    stops.forEach((stop, index) => {
        const marker = L.marker([stop.lat, stop.lng])
            .bindPopup(`
                <b>Duraklama #${index + 1}</b><br>
                Süre: ${formatDuration(stop.duration)}<br>
                Başlangıç: ${new Date(stop.startTime).toLocaleTimeString('tr-TR')}<br>
                Nokta Sayısı: ${stop.points.length}
            `)
            .addTo(stopsLayer);
    });

    stopsLayer.addTo(map);
}

// Duraklamaları listeye ekle
function displayStopsInList(stops) {
    const stopsList = getElement('stops-list');
    const stopCount = getElement('stop-count');

    if (stopsList) {
        stopsList.innerHTML = '';
    }

    if (stopCount) {
        stopCount.textContent = stops.length;
    }

    stops.forEach((stop, index) => {
        if (!stopsList) return;

        const li = document.createElement('div');
        li.className = 'stop-item';
        li.innerHTML = `
            <strong>Duraklama #${index + 1}</strong>
            <div style="font-size: 12px; opacity: 0.8;">
                ${formatDuration(stop.duration)} -
                ${new Date(stop.startTime).toLocaleTimeString('tr-TR')}
            </div>
        `;

        li.addEventListener('click', () => {
            map.setView([stop.lat, stop.lng], 17);
            // Marker popup'ını aç
            map.eachLayer(layer => {
                if (layer instanceof L.Marker && layer.getLatLng().equals([stop.lat, stop.lng])) {
                    layer.openPopup();
                }
            });
        });

        stopsList.appendChild(li);
    });
}

// İstatistikleri hesapla ve göster
function calculateAndDisplayStats(points) {
    let totalDistance = 0;
    let totalDriveTime = 0;
    let maxSpeed = 0;

    for (let i = 1; i < points.length; i++) {
        const dist = map.distance(
            [points[i-1].lat, points[i-1].lng],
            [points[i].lat, points[i].lng]
        );
        totalDistance += dist;

        if (points[i].speed > 1) {
            totalDriveTime += points[i].timestamp - points[i-1].timestamp;
        }

        maxSpeed = Math.max(maxSpeed, points[i].speed);
    }

    const totalTime = points.length > 1 ? points[points.length-1].timestamp - points[0].timestamp : 0;
    const avgSpeed = totalDriveTime > 0 ? (totalDistance / (totalDriveTime / 1000)) * 3.6 : 0;

    // DOM'u güncelle - SADECE MEVCUT ELEMENTLERİ
    const totalDistanceEl = getElement('total-distance');
    const maxSpeedEl = getElement('max-speed');
    const driveTimeEl = getElement('drive-time');

    if (totalDistanceEl) totalDistanceEl.textContent = (totalDistance / 1000).toFixed(2) + ' km';
    if (maxSpeedEl) maxSpeedEl.textContent = maxSpeed.toFixed(1) + ' km/s';
    if (driveTimeEl) driveTimeEl.textContent = formatDuration(totalDriveTime);

    // Eksik elementler için console log
    console.log('Toplam Süre:', formatDuration(totalTime));
    console.log('Ortalama Hız:', avgSpeed.toFixed(1) + ' km/s');
}

// Hız limit analizi
function updateSpeedLimitAnalysis(points) {
    const speedSlider = getElement('speedLimitSlider');
    const exceedCountEl = getElement('exceed-count');
    const exceedTimeEl = getElement('exceed-time');

    if (!speedSlider || !exceedCountEl || !exceedTimeEl) return;

    const speedLimit = parseInt(speedSlider.value) || 60;
    let exceedCount = 0;
    let totalExceedTime = 0;
    let maxExceedSpeed = 0;

    points.forEach(point => {
        if (point.speed > speedLimit) {
            exceedCount++;
            maxExceedSpeed = Math.max(maxExceedSpeed, point.speed);
        }
    });

    // Basit süre hesaplama
    totalExceedTime = exceedCount * 1000;

    exceedCountEl.textContent = exceedCount;
    exceedTimeEl.textContent = formatDuration(totalExceedTime);
}

// Yardımcı fonksiyonlar
function showLoading(message = 'Yükleniyor...') {
    const loadingOverlay = getElement('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
        const messageEl = loadingOverlay.querySelector('p');
        if (messageEl) {
            messageEl.textContent = message;
        }
    }
}

function hideLoading() {
    const loadingOverlay = getElement('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

function showToast(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    // Basit toast implementasyonu
    const toastContainer = getElement('toast-container');
    if (toastContainer) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    } else {
        // Fallback
        alert(message);
    }
}

function showError(message) {
    showToast(message, 'error');
}

function toggleSidebar() {
    const mobileSidebar = getElement('mobile-sidebar');
    if (mobileSidebar) {
        mobileSidebar.classList.toggle('sidebar-visible');
    }
}

function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    showToast(`Tema ${newTheme === 'dark' ? 'koyu' : 'açık'} moda geçirildi`);
}

function formatDuration(ms) {
    if (!ms || ms < 0) return '0sn';

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}s ${minutes % 60}d`;
    } else if (minutes > 0) {
        return `${minutes}d ${seconds % 60}sn`;
    } else {
        return `${seconds}sn`;
    }
}

function clearMapLayers() {
    if (routeLayer) {
        map.removeLayer(routeLayer);
        routeLayer = null;
    }

    if (stopsLayer) {
        map.removeLayer(stopsLayer);
        stopsLayer = null;
    }

    speedGradientLayers.forEach(layer => {
        if (layer && map.hasLayer(layer)) {
            map.removeLayer(layer);
        }
    });
    speedGradientLayers = [];
}

function resetDisplay() {
    const elements = [
        'total-distance', 'max-speed', 'drive-time',
        'stop-count', 'exceed-count', 'exceed-time'
    ];

    elements.forEach(id => {
        const element = getElement(id);
        if (element) {
            if (id === 'stop-count') {
                element.textContent = '0';
            } else if (id === 'exceed-count' || id === 'exceed-time') {
                element.textContent = '0';
            } else {
                element.textContent = '-';
            }
        }
    });

    const stopsList = getElement('stops-list');
    if (stopsList) {
        stopsList.innerHTML = '';
    }
}

// Grafik güncelleme
function updateChart(points) {
    const ctx = document.getElementById('analyticsChart');
    if (!ctx) return;

    if (analyticsChart) {
        analyticsChart.destroy();
    }

    const labels = points.map(p => new Date(p.timestamp));
    const speedData = points.map(p => p.speed);

    analyticsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Hız (km/s)',
                data: speedData,
                borderColor: '#005eff',
                backgroundColor: 'rgba(0, 94, 255, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'hour'
                    }
                },
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Hata yönetimi
window.addEventListener('error', function(e) {
    console.error('Global hata:', e.error);
    showError('Bir hata oluştu');
});