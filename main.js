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
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// DOM elementleri
const elements = {
    loadingOverlay: document.getElementById('loading-overlay'),
    datePicker: document.getElementById('datePicker'),
    speedLimitInput: document.getElementById('speedLimit'),
    themeSelect: document.getElementById('themeSelect'),
    fuelConsumptionInput: document.getElementById('fuelConsumption'),
    fuelPriceInput: document.getElementById('fuelPrice'),
    stopsList: document.getElementById('stops-list'),
    stopCount: document.getElementById('stop-count'),
    totalDistance: document.getElementById('total-distance'),
    maxSpeed: document.getElementById('max-speed'),
    avgSpeed: document.getElementById('avg-speed'),
    totalTime: document.getElementById('total-time'),
    driveTime: document.getElementById('drive-time'),
    drivingScore: document.getElementById('driving-score'),
    totalStopTime: document.getElementById('total-stop-time'),
    avgStopTime: document.getElementById('avg-stop-time'),
    routeEfficiency: document.getElementById('route-efficiency'),
    speedVariation: document.getElementById('speed-variation'),
    constantSpeed: document.getElementById('constant-speed'),
    fuelConsumption: document.getElementById('fuel-consumption'),
    co2Emissions: document.getElementById('co2-emissions'),
    fuelCost: document.getElementById('fuel-cost'),
    alertsList: document.getElementById('alerts-list')
};

// Leaflet map
const map = L.map('map').setView([39.9,32.8],6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19}).addTo(map);

// Global değişkenler
let routeLayer, stopsLayer, analyticsChart;
let speedGradientLayers = [];
let polylineDecorator;
let currentPoints = [];

// Utility functions
const utils = {
    formatDuration: (ms) => {
        if (!ms) return '0sn';
        const s = Math.floor(ms/1000%60), m = Math.floor(ms/60000%60), h = Math.floor(ms/3600000);
        return `${h>0?h+'s ':''}${m>0?m+'d ':''}${s>0?s+'sn':''}`.trim() || '0sn';
    },

    formatDurationMinutes: (ms) => {
        if (!ms) return '0d';
        const m = Math.floor(ms/60000), h = Math.floor(ms/3600000);
        return `${h>0?h+'s ':''}${m>0?m+'d':''}`.trim() || '0d';
    },

    getSpeedColor: (speed, speedLimit) => {
        if (speed > speedLimit) return '#ff0000';
        if (speed > speedLimit * 0.8) return '#ff9900';
        return '#00ff00';
    },

    getSpeedStatus: (speed, speedLimit) => {
        if (speed > speedLimit) return 'Hız Limiti Aşıldı!';
        if (speed > speedLimit * 0.8) return 'Limite Yakın';
        return 'Güvenli';
    }
};

// Hesaplama fonksiyonları
const calculations = {
    totalDistance: (points) => {
        let dist = 0;
        for (let i = 1; i < points.length; i++) {
            dist += map.distance([points[i-1].lat, points[i-1].lng], [points[i].lat, points[i].lng]);
        }
        return dist;
    },

    speedLimitStats: (points) => {
        const speedLimit = parseFloat(elements.speedLimitInput.value) || 60;
        const violations = points.filter(p => p.speed > speedLimit);
        return {
            count: violations.length,
            percentage: ((violations.length / points.length) * 100).toFixed(1)
        };
    },

    drivingScore: (points) => {
        let score = 100;
        const speedLimit = parseFloat(elements.speedLimitInput.value) || 60;

        points.forEach(point => {
            if (point.speed > speedLimit) {
                score -= Math.min(5, (point.speed - speedLimit) / 10);
            }
        });

        return Math.max(0, Math.round(score));
    },

    speedVariation: (points) => {
        const speeds = points.map(p => p.speed);
        const mean = speeds.reduce((a, b) => a + b) / speeds.length;
        const variance = speeds.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / speeds.length;
        return Math.sqrt(variance).toFixed(1);
    },

    routeEfficiency: (points) => {
        if (points.length < 2) return 0;
        const totalDist = calculations.totalDistance(points);
        const straightDist = map.distance([points[0].lat, points[0].lng], [points[points.length-1].lat, points[points.length-1].lng]);
        return ((straightDist / totalDist) * 100).toFixed(1);
    },

    fuelConsumption: (points) => {
        const totalDist = calculations.totalDistance(points) / 1000;
        const fuelPer100km = parseFloat(elements.fuelConsumptionInput.value) || 7;
        const fuelPrice = parseFloat(elements.fuelPriceInput.value) || 22;

        const fuelUsed = (totalDist * fuelPer100km) / 100;
        return {
            fuel: fuelUsed.toFixed(2),
            co2: (fuelUsed * 2.31).toFixed(1),
            cost: (fuelUsed * fuelPrice).toFixed(2)
        };
    }
};

// Harita fonksiyonları
const mapFunctions = {
    createSpeedRoute: (points) => {
        speedGradientLayers.forEach(layer => map.removeLayer(layer));
        speedGradientLayers = [];

        const speedLimit = parseFloat(elements.speedLimitInput.value) || 60;
        const routeGroup = L.featureGroup();

        for (let i = 1; i < points.length; i++) {
            const prev = points[i-1], current = points[i];
            const avgSpeed = (prev.speed + current.speed) / 2;

            const segment = L.polyline([[prev.lat, prev.lng], [current.lat, current.lng]], {
                color: utils.getSpeedColor(avgSpeed, speedLimit),
                weight: 6,
                opacity: 0.8
            }).bindTooltip(`Hız: ${avgSpeed.toFixed(1)} km/s<br>Limit: ${speedLimit} km/s<br>${utils.getSpeedStatus(avgSpeed, speedLimit)}`);

            routeGroup.addLayer(segment);
            speedGradientLayers.push(segment);
        }

        routeGroup.addTo(map);
        return routeGroup;
    },

    addDirectionArrows: (points) => {
        if (polylineDecorator) map.removeLayer(polylineDecorator);

        const latlngs = points.map(p => [p.lat, p.lng]);
        polylineDecorator = L.polylineDecorator(L.polyline(latlngs), {
            patterns: [{
                offset: 15, repeat: 30,
                symbol: L.Symbol.arrowHead({
                    pixelSize: 8, polygon: true,
                    pathOptions: { stroke: false, fill: true, fillColor: '#005eff', fillOpacity: 0.7 }
                })
            }]
        }).addTo(map);

        speedGradientLayers.push(polylineDecorator);
    },

    detectStops: (points) => {
        const stops = [];
        let tempStop = [];
        const MIN_STOP = 2 * 60 * 1000;

        points.forEach((point, index) => {
            if (point.speed < 3) {
                tempStop.push(point);
            } else if (tempStop.length >= 2) {
                const duration = tempStop[tempStop.length-1].timestamp - tempStop[0].timestamp;
                if (duration >= MIN_STOP) {
                    stops.push({
                        startTime: tempStop[0].timestamp,
                        duration: duration,
                        location: tempStop[Math.floor(tempStop.length/2)]
                    });
                }
                tempStop = [];
            }
        });

        return stops;
    }
};

// Analiz fonksiyonları
const analysis = {
    generateAlerts: (points) => {
        const alerts = [];
        const speedLimit = parseFloat(elements.speedLimitInput.value) || 60;
        const violations = points.filter(p => p.speed > speedLimit);

        if (violations.length > points.length * 0.1) {
            alerts.push(`🚨 ${violations.length} noktada hız limiti aşılmış (${((violations.length/points.length)*100).toFixed(1)}%)`);
        }

        const efficiency = parseFloat(calculations.routeEfficiency(points));
        if (efficiency < 60) {
            alerts.push(`📉 Rota verimliliği düşük: ${efficiency}%`);
        }

        return alerts;
    },

    displayAlerts: (alerts) => {
        elements.alertsList.innerHTML = alerts.length === 0
            ? '<div class="alert-item alert-low">✅ Tüm metrikler normal</div>'
            : alerts.map(alert => `<div class="alert-item alert-medium">${alert}</div>`).join('');
    },

    updateChart: (points) => {
        if (analyticsChart) analyticsChart.destroy();

        const ctx = document.getElementById('analyticsChart').getContext('2d');
        analyticsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: points.map(p => new Date(p.timestamp)),
                datasets: [{
                    label: 'Hız (km/s)', data: points.map(p => p.speed),
                    borderColor: '#dc3545', backgroundColor: 'rgba(220, 53, 69, 0.1)',
                    yAxisID: 'y_speed', fill: true, pointRadius: 0, tension: 0.4
                }, {
                    label: 'Yükseklik (m)', data: points.map(p => p.altitude || 0),
                    borderColor: '#007bff', backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    yAxisID: 'y_altitude', fill: true, pointRadius: 0, tension: 0.4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { type: 'time', time: { unit: 'minute', displayFormats: { minute: 'HH:mm' } } },
                    y_speed: { position: 'left', beginAtZero: true, title: { display: true, text: 'Hız (km/s)' } },
                    y_altitude: { position: 'right', beginAtZero: false, title: { display: true, text: 'Yükseklik (m)' }, grid: { drawOnChartArea: false } }
                }
            }
        });
    }
};

// Ana yükleme fonksiyonu
function loadRoute(dateStr) {
    elements.loadingOverlay.style.display = 'flex';

    // Reset UI
    Object.values(elements).forEach(el => {
        if (el && el.textContent && el !== elements.loadingOverlay && el !== elements.stopsList && el !== elements.alertsList) {
            el.textContent = '-';
        }
    });
    elements.stopsList.innerHTML = '';
    elements.alertsList.innerHTML = '';

    database.ref(`konum_kayitlari/${dateStr}`).once('value').then(snapshot => {
        const data = snapshot.val();
        if (!data) {
            elements.loadingOverlay.innerHTML = `❌ ${dateStr} için veri bulunamadı`;
            return;
        }

        currentPoints = Object.values(data).sort((a, b) => a.timestamp - b.timestamp).map(p => ({
            lat: p.latitude, lng: p.longitude, speed: isNaN(p.speed) ? 0 : p.speed,
            altitude: p.altitude || 0, timestamp: p.timestamp
        }));

        if (currentPoints.length < 2) {
            elements.loadingOverlay.innerText = '❌ Yeterli kayıt yok';
            return;
        }

        // Temizleme
        if (routeLayer) map.removeLayer(routeLayer);
        if (stopsLayer) map.removeLayer(stopsLayer);
        speedGradientLayers.forEach(layer => map.removeLayer(layer));
        speedGradientLayers = [];

        // Harita güncelleme
        const routeGroup = mapFunctions.createSpeedRoute(currentPoints);
        mapFunctions.addDirectionArrows(currentPoints);

        const latlngs = currentPoints.map(p => [p.lat, p.lng]);
        routeLayer = L.polyline(latlngs, { color: 'blue', weight: 2, opacity: 0.3, dashArray: '5,5' }).addTo(map);

        // Duraklamalar
        const stops = mapFunctions.detectStops(currentPoints);
        stopsLayer = L.layerGroup();
        stops.forEach((stop, i) => {
            const marker = L.marker([stop.location.lat, stop.location.lng]).addTo(stopsLayer)
                .bindPopup(`<b>Duraklama #${i + 1}</b><br>Süre: ${utils.formatDuration(stop.duration)}`);

            const li = document.createElement('li');
            li.innerHTML = `<b>#${i + 1}</b>: ${utils.formatDuration(stop.duration)}`;
            li.onclick = () => { map.setView([stop.location.lat, stop.location.lng], 17); marker.openPopup(); };
            elements.stopsList.appendChild(li);
        });
        stopsLayer.addTo(map);

        // İstatistikler
        const totalDist = calculations.totalDistance(currentPoints);
        const totalTime = currentPoints[currentPoints.length-1].timestamp - currentPoints[0].timestamp;
        const maxSpeed = Math.max(...currentPoints.map(p => p.speed));
        const avgSpeed = currentPoints.reduce((sum, p) => sum + p.speed, 0) / currentPoints.length;
        const fuelData = calculations.fuelConsumption(currentPoints);
        const stopsStats = stops.reduce((stats, stop) => {
            stats.totalDuration += stop.duration;
            return stats;
        }, { totalDuration: 0, count: stops.length });

        // UI güncelleme
        elements.totalDistance.textContent = (totalDist / 1000).toFixed(2) + ' km';
        elements.maxSpeed.textContent = maxSpeed.toFixed(1) + ' km/s';
        elements.avgSpeed.textContent = avgSpeed.toFixed(1) + ' km/s';
        elements.totalTime.textContent = utils.formatDuration(totalTime);
        elements.driveTime.textContent = utils.formatDuration(totalTime * 0.8); // Tahmini
        elements.drivingScore.textContent = calculations.drivingScore(currentPoints);
        elements.stopCount.textContent = stops.length;
        elements.totalStopTime.textContent = utils.formatDuration(stopsStats.totalDuration);
        elements.avgStopTime.textContent = stops.length ? utils.formatDuration(stopsStats.totalDuration / stops.length) : '0sn';
        elements.routeEfficiency.textContent = calculations.routeEfficiency(currentPoints) + '%';
        elements.speedVariation.textContent = calculations.speedVariation(currentPoints) + ' km/s';
        elements.constantSpeed.textContent = '75%'; // Sabit değer
        elements.fuelConsumption.textContent = fuelData.fuel + ' L';
        elements.co2Emissions.textContent = fuelData.co2 + ' kg';
        elements.fuelCost.textContent = fuelData.cost + ' TL';

        // Uyarılar ve grafik
        analysis.displayAlerts(analysis.generateAlerts(currentPoints));
        analysis.updateChart(currentPoints);
        map.fitBounds(routeGroup.getBounds());
        elements.loadingOverlay.style.display = 'none';

    }).catch(err => {
        console.error('Firebase hatası:', err);
        elements.loadingOverlay.innerHTML = '❌ Firebase bağlantı hatası!';
    });
}

// Event listener'lar
elements.datePicker.addEventListener('change', () => loadRoute(elements.datePicker.value));
elements.speedLimitInput.addEventListener('change', () => loadRoute(elements.datePicker.value));
elements.themeSelect.addEventListener('change', () => {
    document.body.setAttribute('data-theme', elements.themeSelect.value);
});

// Export fonksiyonları
document.getElementById('exportJSON').addEventListener('click', () => {
    if (!routeLayer) return alert('Önce rota yüklenmeli!');
    const dataStr = JSON.stringify({ points: currentPoints }, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rota_${elements.datePicker.value || 'export'}.json`;
    a.click();
});

document.getElementById('exportGPX').addEventListener('click', () => {
    if (!routeLayer) return alert('Önce rota yüklenmeli!');
    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="EfeGPS">
    <trk><name>Rota ${elements.datePicker.value}</name><trkseg>
`;
    currentPoints.forEach(p => {
        gpx += `<trkpt lat="${p.lat}" lon="${p.lng}"><time>${new Date(p.timestamp).toISOString()}</time><speed>${p.speed}</speed></trkpt>`;
    });
    gpx += '</trkseg></trk></gpx>';

    const blob = new Blob([gpx], { type: "application/gpx+xml" });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rota_${elements.datePicker.value || 'export'}.gpx`;
    a.click();
});

document.getElementById('exportReport').addEventListener('click', () => {
    const report = `
        EfeGPS Raporu - ${elements.datePicker.value}
        ================================
        Mesafe: ${elements.totalDistance.textContent}
        Maksimum Hız: ${elements.maxSpeed.textContent}
        Ortalama Hız: ${elements.avgSpeed.textContent}
        Sürüş Süresi: ${elements.driveTime.textContent}
        Sürüş Puanı: ${elements.drivingScore.textContent}
        Yakıt Tüketimi: ${elements.fuelConsumption.textContent}
        Toplam Maliyet: ${elements.fuelCost.textContent}
    `;
    const blob = new Blob([report], { type: "text/plain" });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rapor_${elements.datePicker.value || 'export'}.txt`;
    a.click();
});

// Sidebar functions
function openTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelector(`.tab-button[onclick="openTab('${tabId}')"]`).classList.add('active');
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggle-btn');
    sidebar.classList.toggle('open');
    toggleBtn.innerHTML = sidebar.classList.contains('open') ? '«' : '»';
}

// Başlangıç
const today = new Date().toISOString().slice(0, 10);
elements.datePicker.value = today;
loadRoute(today);

// Hata yönetimi
window.addEventListener('error', (e) => {
    console.error('Global hata:', e.error);
    elements.loadingOverlay.innerHTML = '❌ Bir hata oluştu! Sayfayı yenileyin.';
});