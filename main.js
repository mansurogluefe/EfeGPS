// Firebase ayarları
const firebaseConfig = {
    apiKey: "AIzaSyBt3WGvcD1-KJgf6FmW4ngnLSjyNSfw-88",
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
const satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom:19});

// Sidebar
function openTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el=>el.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(el=>el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelector(`.tab-button[onclick="openTab('${tabId}')"]`).classList.add('active');
}
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('toggle-btn').innerHTML = document.getElementById('sidebar').classList.contains('open') ? '«' : '»';
}

// Utility
function formatDuration(ms) {
    if (!ms) return '0sn';
    const s = Math.floor(ms/1000%60);
    const m = Math.floor(ms/60000%60);
    const h = Math.floor(ms/3600000);
    return `${h>0?h+'s ':''}${m>0?m+'d ':''}${s>0?s+'sn':''}`.trim() || '0sn';
}

// Ana yükleme fonksiyonu
let routeLayer, stopsLayer, analyticsChart;
function loadRoute(dateStr) {
    loadingOverlay.style.display='flex';
    stopsList.innerHTML='';
    stopCount.textContent='0';
    totalDistanceEl.textContent='-';
    maxSpeedEl.textContent='-';
    avgSpeedEl.textContent='-';
    totalTimeEl.textContent='-';
    driveTimeEl.textContent='-';

    const speedLimit = parseFloat(speedLimitInput.value) || 60;

    database.ref(`konum_kayitlari/${dateStr}`).once('value')
    .then(snapshot=>{
        const data = snapshot.val();
        if(!data){ loadingOverlay.innerHTML=`❌ ${dateStr} için veri yok`; return; }

        let points = Object.values(data).sort((a,b)=>a.timestamp-b.timestamp)
            .map(p=>({
                lat: p.latitude,
                lng: p.longitude,
                speed: isNaN(p.speed)?0:p.speed,
                altitude: p.altitude || 0,
                timestamp: p.timestamp
            }));

        if(points.length<2){ loadingOverlay.innerText='❌ Yeterli kayıt yok'; return; }

        // Hotline gradient yerine Polyline ile hız limitine göre renk
        const latlngs = points.map(p=>[p.lat,p.lng]);
        if(routeLayer) map.removeLayer(routeLayer);
        const routeColors = points.map(p=>p.speed>speedLimit?'red':'green');

        routeLayer = L.polyline(latlngs,{
            color:'green', weight:5, opacity:0.9
        }).addTo(map);

        // Duraklamalar
        const MIN_STOP = 3*60*1000;
        const GPS_DRIFT = 50;
        let stops = [], tempStop=[];
        points.forEach((p,i)=>{
            if(p.speed<5) tempStop.push(p);
            else{
                if(tempStop.length>1){
                    const t0 = tempStop[0].timestamp;
                    const t1 = tempStop[tempStop.length-1].timestamp;
                    const dist = map.latLngToLayerPoint([tempStop[0].lat,tempStop[0].lng]).distanceTo(
                        map.latLngToLayerPoint([tempStop[tempStop.length-1].lat,tempStop[tempStop.length-1].lng])
                    );
                    if(t1-t0>=MIN_STOP && dist<GPS_DRIFT){
                        stops.push({
                            lat: tempStop[0].lat,
                            lng: tempStop[0].lng,
                            startTime: t0,
                            duration: t1-t0
                        });
                    }
                }
                tempStop=[];
            }
        });

        // Marker layer
        if(stopsLayer) map.removeLayer(stopsLayer);
        stopsLayer = L.layerGroup();
        stops.forEach((s,i)=>{
            const m = L.marker([s.lat,s.lng]).addTo(stopsLayer)
                .bindPopup(`<b>Duraklama #${i+1}</b><br>Süre: ${formatDuration(s.duration)}`);
            const li = document.createElement('li');
            li.innerHTML=`<b>#${i+1}</b>: ${formatDuration(s.duration)} <small>(${new Date(s.startTime).toLocaleTimeString('tr-TR')})</small>`;
            li.onclick=()=>{map.setView([s.lat,s.lng],17); m.openPopup();}
            stopsList.appendChild(li);
        });
        stopCount.textContent=stops.length;

        stopsLayer.addTo(map);
        map.fitBounds(routeLayer.getBounds());

        // Grafik
        const labels = points.map(p=>new Date(p.timestamp));
        const speedData = points.map(p=>p.speed);
        const altData = points.map(p=>p.altitude);

        if(analyticsChart) analyticsChart.destroy();
        const ctx = document.getElementById('analyticsChart').getContext('2d');
        analyticsChart = new Chart(ctx,{
            type:'line',
            data:{
                labels: labels,
                datasets:[
                    {label:'Hız (km/s)', data:speedData, borderColor:'#dc3545', backgroundColor:'rgba(220,53,69,0.1)', yAxisID:'y_speed', fill:true, pointRadius:0, tension:0.4},
                    {label:'Yükseklik (m)', data:altData, borderColor:'#007bff', backgroundColor:'rgba(0,123,255,0.1)', yAxisID:'y_altitude', fill:true, pointRadius:0, tension:0.4}
                ]
            },
            options:{
                responsive:true, maintainAspectRatio:false,
                interaction:{mode:'index',intersect:false},
                scales:{
                    x:{type:'time',time:{unit:'minute',displayFormats:{minute:'HH:mm'}}},
                    y_speed:{position:'left',beginAtZero:true,title:{display:true,text:'Hız'}},
                    y_altitude:{position:'right',beginAtZero:false,title:{display:true,text:'Yükseklik'},grid:{drawOnChartArea:false}}
                }
            }
        });

        // Özet
        let totalDist=0, totalDrive=0;
        for(let i=1;i<points.length;i++){
            totalDist+=map.distance([points[i-1].lat,points[i-1].lng],[points[i].lat,points[i].lng]);
            if(points[i].speed>1) totalDrive+=points[i].timestamp-points[i-1].timestamp;
        }
        const maxSpeed = Math.max(...points.map(p=>p.speed));
        const avgSpeed = totalDrive>0?totalDist/(totalDrive/1000)*3.6:0;

        totalDistanceEl.textContent=(totalDist/1000).toFixed(2)+' km';
        maxSpeedEl.textContent=maxSpeed.toFixed(2)+' km/s';
        avgSpeedEl.textContent=avgSpeed.toFixed(2)+' km/s';
        totalTimeEl.textContent=formatDuration(points[points.length-1].timestamp - points[0].timestamp);
        driveTimeEl.textContent=formatDuration(totalDrive);

        loadingOverlay.style.display='none';
    })
    .catch(err=>{
        console.error(err);
        loadingOverlay.innerHTML=`❌ Firebase bağlantı hatası!<br>Lütfen internet ve Firebase kurallarını kontrol edin.`;
    });
}

// Tarih değiştiğinde
datePicker.addEventListener('change', ()=>loadRoute(datePicker.value));
speedLimitInput.addEventListener('change', ()=>loadRoute(datePicker.value));
themeSelect.addEventListener('change', ()=>{
    document.body.setAttribute('data-theme', themeSelect.value);
});

// Export JSON
exportJSONBtn.addEventListener('click', ()=>{
    const dataStr = JSON.stringify(routeLayer?routeLayer.getLatLngs():[]);
    const blob = new Blob([dataStr], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download=`rota_${datePicker.value || 'export'}.json`; a.click();
});

// Export GPX (basit)
exportGPXBtn.addEventListener('click', ()=>{
    if(!routeLayer) return alert('Önce rota yüklenmeli!');
    let gpx = '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="EfeGPS">\n<trk><name>Rota</name>\n<trkseg>\n';
    routeLayer.getLatLngs().forEach(p=>{
        gpx+=`<trkpt lat="${p.lat}" lon="${p.lng}"></trkpt>\n`;
    });
    gpx+='</trkseg></trk>\n</gpx>';
    const blob = new Blob([gpx], {type:"application/gpx+xml"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download=`rota_${datePicker.value || 'export'}.gpx`; a.click();
});

// Başlangıçta bugünkü tarih
const today = new Date().toISOString().slice(0,10);
datePicker.value = today;
loadRoute(today);
