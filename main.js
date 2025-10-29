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

// Hız renk skalası - kolayca değiştirilebilir
const speedColorRanges = [
    { maxSpeed: 20, color: '#00ff00', label: 'Çok Yavaş' },
    { maxSpeed: 40, color: '#ffff00', label: 'Yavaş' },
    { maxSpeed: 60, color: '#ff9900', label: 'Orta' },
    { maxSpeed: 80, color: '#ff0000', label: 'Hızlı' },
    { maxSpeed: Infinity, color: '#990000', label: 'Çok Hızlı' }
];

// DOM elementleri
const loadingOverlay = document.getElementById('loading-overlay');
const datePicker = document.getElementById('datePicker');
const speedLimitInput = document.getElementById('speedLimit');
const themeSelect = document.getElementById('themeSelect');
const exportJSONBtn = document.getElementById('exportJSON');
const exportGPXBtn = document.getElementById('exportGPX');
const stopsList = document.getElementById('stops-list');
const stopCount = document.getElementById('stop-count');
const totalDistanceEl = document.getElementById('total-distance');
const maxSpeedEl = document.getElementById('max-speed');
const avgSpeedEl = document.getElementById('avg-speed');
const totalTimeEl = document.getElementById('total-time');
const driveTimeEl = document.getElementById('drive-time');

// Leaflet map
const map = L.map('map').setView([39.9,32.8],6);
const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19}).addTo(map);

// Global değişkenler
let routeLayer, stopsLayer, analyticsChart;
let speedGradientLayers = [];
let polylineDecorator;

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

// Utility functions
function formatDuration(ms) {
    if (!ms) return '0sn';
    const s = Math.floor(ms/1000%60);
    const m = Math.floor(ms/60000%60);
    const h = Math.floor(ms/3600000);
    return `${h>0?h+'s ':''}${m>0?m+'d ':''}${s>0?s+'sn':''}`.trim() || '0sn';
}

function getColorForSpeed(speed) {
    for (const range of speedColorRanges) {
        if (speed <= range.maxSpeed) {
            return range.color;
        }
    }
    return speedColorRanges[speedColorRanges.length - 1].color;
}

function getSpeedRangeLabel(speed) {
    for (const range of speedColorRanges) {
        if (speed <= range.maxSpeed) {
            return range.label;
        }
    }
    return 'Çok Hızlı';
}

// HIZ LİMİTİNE GÖRE RENK BELİRLEME - GÜNCELLENDİ
function getColorForSpeedWithLimit(speed, speedLimit) {
    if (speed > speedLimit) {
        return '#ff0000'; // KIRMIZI - limiti aşmış
    } else if (speed > speedLimit * 0.8) {
        return '#ff9900'; // TURUNCU - limite yakın
    } else {
        return '#00ff00'; // YEŞİL - güvenli
    }
}

// HIZ LİMİTİ DURUMU BELİRLEME
function getSpeedLimitStatus(speed, speedLimit) {
    if (speed > speedLimit) {
        return 'Hız Limiti Aşıldı!';
    } else if (speed > speedLimit * 0.8) {
        return 'Limite Yakın';
    } else {
        return 'Güvenli';
    }
}

// HIZ LİMİTİ İSTATİSTİKLERİ HESAPLAMA
function calculateSpeedLimitStats(points) {
    const speedLimit = parseFloat(speedLimitInput.value) || 60;
    let limitExceedCount = 0;
    let maxExceedSpeed = 0;
    let totalExceedTime = 0;
    let lastExceedTime = null;

    points.forEach((point, index) => {
        if (point.speed > speedLimit) {
            limitExceedCount++;
            maxExceedSpeed = Math.max(maxExceedSpeed, point.speed);

            // Süre hesaplama
            if (lastExceedTime && index > 0) {
                totalExceedTime += point.timestamp - points[index-1].timestamp;
            }
            lastExceedTime = point.timestamp;
        } else {
            lastExceedTime = null;
        }
    });

    return {
        exceedCount: limitExceedCount,
        maxExceed: maxExceedSpeed,
        exceedTime: totalExceedTime,
        percentage: points.length > 0 ? ((limitExceedCount / points.length) * 100).toFixed(1) : '0'
    };
}

// Hıza göre renkli rota çizimi - HIZ LİMİTİ ENTEGRE EDİLDİ
function createSpeedGradientRoute(points) {
    speedGradientLayers.forEach(layer => map.removeLayer(layer));
    speedGradientLayers = [];

    const speedLimit = parseFloat(speedLimitInput.value) || 60;
    const routeGroup = L.featureGroup();

    for (let i = 1; i < points.length; i++) {
        const prevPoint = points[i-1];
        const currentPoint = points[i];
        const avgSpeed = (prevPoint.speed + currentPoint.speed) / 2;

        // HIZ LİMİTİNE GÖRE RENK VE DURUM BELİRLE
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

// Yön okları ekleme
function addDirectionArrows(points) {
    if (polylineDecorator) {
        map.removeLayer(polylineDecorator);
    }

    const latlngs = points.map(p => [p.lat, p.lng]);
    const basePolyline = L.polyline(latlngs);

    polylineDecorator = L.polylineDecorator(basePolyline, {
        patterns: [
            {
                offset: 25,
                repeat: 50,
                symbol: L.Symbol.arrowHead({
                    pixelSize: 15,
                    polygon: false,
                    pathOptions: {
                        stroke: true,
                        color: '#005eff',
                        weight: 2,
                        opacity: 0.8
                    }
                })
            }
        ]
    }).addTo(map);

    speedGradientLayers.push(polylineDecorator);
}

// Ana yükleme fonksiyonu
function loadRoute(dateStr) {
    loadingOverlay.style.display = 'flex';
    stopsList.innerHTML = '';
    stopCount.textContent = '0';
    totalDistanceEl.textContent = '-';
    maxSpeedEl.textContent = '-';
    avgSpeedEl.textContent = '-';
    totalTimeEl.textContent = '-';
    driveTimeEl.textContent = '-';

    const speedLimit = parseFloat(speedLimitInput.value) || 60;

    database.ref(`konum_kayitlari/${dateStr}`).once('value')
    .then(snapshot => {
        const data = snapshot.val();
        if(!data) {
            loadingOverlay.innerHTML = `❌ ${dateStr} için veri yok`;
            return;
        }

        let points = Object.values(data).sort((a,b) => a.timestamp - b.timestamp)
            .map(p => ({
                lat: p.latitude,
                lng: p.longitude,
                speed: isNaN(p.speed) ? 0 : p.speed,
                altitude: p.altitude || 0,
                timestamp: p.timestamp,
                time: new Date(p.timestamp)
            }));

        if(points.length < 2) {
            loadingOverlay.innerText = '❌ Yeterli kayıt yok';
            return;
        }

        // Önceki katmanları temizle
        if(routeLayer) map.removeLayer(routeLayer);
        if(stopsLayer) map.removeLayer(stopsLayer);
        speedGradientLayers.forEach(layer => map.removeLayer(layer));
        speedGradientLayers = [];

        // Hıza göre renkli rota oluştur (HIZ LİMİTLİ)
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

        // Duraklamalar
        const MIN_STOP = 3 * 60 * 1000; // 3 dakika
        const GPS_DRIFT = 50; // metre
        let stops = [], tempStop = [];

        points.forEach((p, i) => {
            if(p.speed < 5) {
                tempStop.push(p);
            } else {
                if(tempStop.length > 1) {
                    const t0 = tempStop[0].timestamp;
                    const t1 = tempStop[tempStop.length - 1].timestamp;
                    const dist = map.latLngToLayerPoint([tempStop[0].lat, tempStop[0].lng]).distanceTo(
                        map.latLngToLayerPoint([tempStop[tempStop.length - 1].lat, tempStop[tempStop.length - 1].lng])
                    );
                    if(t1 - t0 >= MIN_STOP && dist < GPS_DRIFT) {
                        stops.push({
                            lat: tempStop[0].lat,
                            lng: tempStop[0].lng,
                            startTime: t0,
                            duration: t1 - t0
                        });
                    }
                }
                tempStop = [];
            }
        });

        // Son tempStop'u kontrol et
        if(tempStop.length > 1) {
            const t0 = tempStop[0].timestamp;
            const t1 = tempStop[tempStop.length - 1].timestamp;
            const dist = map.latLngToLayerPoint([tempStop[0].lat, tempStop[0].lng]).distanceTo(
                map.latLngToLayerPoint([tempStop[tempStop.length - 1].lat, tempStop[tempStop.length - 1].lng])
            );
            if(t1 - t0 >= MIN_STOP && dist < GPS_DRIFT) {
                stops.push({
                    lat: tempStop[0].lat,
                    lng: tempStop[0].lng,
                    startTime: t0,
                    duration: t1 - t0
                });
            }
        }

        // Duraklama marker'ları
        stopsLayer = L.layerGroup();
        stops.forEach((s, i) => {
            const marker = L.marker([s.lat, s.lng]).addTo(stopsLayer)
                .bindPopup(`<b>Duraklama #${i + 1}</b><br>Süre: ${formatDuration(s.duration)}<br>Başlangıç: ${new Date(s.startTime).toLocaleTimeString('tr-TR')}`);

            const listItem = document.createElement('li');
            listItem.innerHTML = `<b>#${i + 1}</b>: ${formatDuration(s.duration)} <small>(${new Date(s.startTime).toLocaleTimeString('tr-TR')})</small>`;
            listItem.onclick = () => {
                map.setView([s.lat, s.lng], 17);
                marker.openPopup();
            };
            stopsList.appendChild(listItem);
        });

        stopCount.textContent = stops.length;
        stopsLayer.addTo(map);

        // Harita sınırlarını ayarla
        map.fitBounds(speedRouteGroup.getBounds());

        // Grafik oluştur
        updateChart(points);

        // İstatistikleri hesapla ve göster (HIZ LİMİTİ İSTATİSTİKLERİ EKLENDİ)
        calculateAndDisplayStats(points);

        loadingOverlay.style.display = 'none';
    })
    .catch(err => {
        console.error('Firebase hatası:', err);
        loadingOverlay.innerHTML = `❌ Firebase bağlantı hatası!<br>Lütfen internet ve Firebase kurallarını kontrol edin.`;
    });
}

// Grafik güncelleme
function updateChart(points) {
    const labels = points.map(p => new Date(p.timestamp));
    const speedData = points.map(p => p.speed);
    const altData = points.map(p => p.altitude);

    if(analyticsChart) {
        analyticsChart.destroy();
    }

    const ctx = document.getElementById('analyticsChart').getContext('2d');
    analyticsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Hız (km/s)',
                    data: speedData,
                    borderColor: '#dc3545',
                    backgroundColor: 'rgba(220, 53, 69, 0.1)',
                    yAxisID: 'y_speed',
                    fill: true,
                    pointRadius: 0,
                    tension: 0.4
                },
                {
                    label: 'Yükseklik (m)',
                    data: altData,
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    yAxisID: 'y_altitude',
                    fill: true,
                    pointRadius: 0,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'minute',
                        displayFormats: { minute: 'HH:mm' }
                    }
                },
                y_speed: {
                    position: 'left',
                    beginAtZero: true,
                    title: { display: true, text: 'Hız (km/s)' }
                },
                y_altitude: {
                    position: 'right',
                    beginAtZero: false,
                    title: { display: true, text: 'Yükseklik (m)' },
                    grid: { drawOnChartArea: false }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.dataset.label === 'Hız (km/s)') {
                                const speedLimit = parseFloat(speedLimitInput.value) || 60;
                                const speed = context.parsed.y;
                                let statusInfo = '';
                                if (speed > speedLimit) {
                                    statusInfo = ` - ⚠️ Limit Aşıldı!`;
                                } else if (speed > speedLimit * 0.8) {
                                    statusInfo = ` - 🟡 Limite Yakın`;
                                }
                                return `Hız: ${speed.toFixed(1)} km/s${statusInfo}`;
                            }
                            return `${context.dataset.label}: ${context.parsed.y.toFixed(1)} m`;
                        }
                    }
                }
            }
        }
    });
}

// İstatistik hesaplama - HIZ LİMİTİ BİLGİSİ EKLENDİ
function calculateAndDisplayStats(points) {
    let totalDist = 0;
    let totalDrive = 0;

    for(let i = 1; i < points.length; i++) {
        totalDist += map.distance([points[i-1].lat, points[i-1].lng], [points[i].lat, points[i].lng]);
        if(points[i].speed > 1) {
            totalDrive += points[i].timestamp - points[i-1].timestamp;
        }
    }

    const maxSpeed = Math.max(...points.map(p => p.speed));
    const avgSpeed = totalDrive > 0 ? (totalDist / (totalDrive / 1000)) * 3.6 : 0;

    // HIZ LİMİTİ İSTATİSTİKLERİ
    const speedLimit = parseFloat(speedLimitInput.value) || 60;
    const limitStats = calculateSpeedLimitStats(points);

    totalDistanceEl.textContent = (totalDist / 1000).toFixed(2) + ' km';

    // MAKSİMUM HIZ GÖSTERİMİNE LİMİT BİLGİSİ EKLE
    if (maxSpeed > speedLimit) {
        maxSpeedEl.innerHTML = `${maxSpeed.toFixed(2)} km/s <span style="color:red; font-weight:bold">(Limit +${(maxSpeed - speedLimit).toFixed(1)})</span>`;
    } else {
        maxSpeedEl.textContent = maxSpeed.toFixed(2) + ' km/s';
    }

    avgSpeedEl.textContent = avgSpeed.toFixed(2) + ' km/s';
    totalTimeEl.textContent = formatDuration(points[points.length - 1].timestamp - points[0].timestamp);
    driveTimeEl.textContent = formatDuration(totalDrive);

    // HIZ LİMİTİ İSTATİSTİKLERİNİ KONSOLA YAZ (isteğe bağlı)
    if (limitStats.exceedCount > 0) {
        console.log(`🚨 Hız Limiti İstatistikleri:`);
        console.log(`   - ${limitStats.exceedCount} noktada limit aşılmış (${limitStats.percentage}%)`);
        console.log(`   - Maksimum aşım: ${limitStats.maxExceed.toFixed(1)} km/s`);
        console.log(`   - Toplam aşım süresi: ${formatDuration(limitStats.exceedTime)}`);
    }
}

// Event listener'lar
datePicker.addEventListener('change', () => loadRoute(datePicker.value));
speedLimitInput.addEventListener('change', () => loadRoute(datePicker.value));
themeSelect.addEventListener('change', () => {
    document.body.setAttribute('data-theme', themeSelect.value);
});

// Export JSON
exportJSONBtn.addEventListener('click', () => {
    if(!routeLayer) {
        alert('Önce rota yüklenmeli!');
        return;
    }

    const routeData = {
        date: datePicker.value,
        points: routeLayer.getLatLngs().map((latlng, index) => ({
            lat: latlng.lat,
            lng: latlng.lng,
            index: index
        }))
    };

    const dataStr = JSON.stringify(routeData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rota_${datePicker.value || 'export'}.json`;
    a.click();
});

// Export GPX
exportGPXBtn.addEventListener('click', () => {
    if(!routeLayer) {
        alert('Önce rota yüklenmeli!');
        return;
    }

    database.ref(`konum_kayitlari/${datePicker.value}`).once('value')
    .then(snapshot => {
        const data = snapshot.val();
        if(!data) {
            alert('Veri bulunamadı!');
            return;
        }

        const points = Object.values(data).sort((a, b) => a.timestamp - b.timestamp);

        let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="EfeGPS">
    <trk>
        <name>Rota ${datePicker.value}</name>
        <trkseg>
`;

        points.forEach(p => {
            gpx += `            <trkpt lat="${p.latitude}" lon="${p.longitude}">
                <time>${new Date(p.timestamp).toISOString()}</time>
                <speed>${p.speed || 0}</speed>
                ${p.altitude ? `<ele>${p.altitude}</ele>` : ''}
            </trkpt>
`;
        });

        gpx += `        </trkseg>
    </trk>
</gpx>`;

        const blob = new Blob([gpx], { type: "application/gpx+xml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rota_${datePicker.value || 'export'}.gpx`;
        a.click();
    })
    .catch(err => {
        console.error('GPX export hatası:', err);
        alert('GPX dosyası oluşturulurken hata oluştu!');
    });
});

// Başlangıçta bugünkü tarih
const today = new Date().toISOString().slice(0, 10);
datePicker.value = today;
loadRoute(today);

// Hata yönetimi
window.addEventListener('error', function(e) {
    console.error('Global hata:', e.error);
    loadingOverlay.innerHTML = `❌ Bir hata oluştu!<br>Lütfen sayfayı yenileyin.`;
});