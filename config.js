// EfeGPS Merkezi Yapılandırma Dosyası
const CONFIG = {
    FIREBASE: {
        apiKey: "AIzaSyADWoqmLxx9jP-ojyxzETXChJa39f514DI",
        authDomain: "efegps-f38f0.firebaseapp.com",
        databaseURL: "https://efegps-f38f0-default-rtdb.firebaseio.com",
        projectId: "efegps-f38f0",
        storageBucket: "efegps-f38f0.firebasestorage.app",
        messagingSenderId: "896214577959",
        appId: "1:896214577959:web:f8b3f64ecfecbdabfe64ac"
    },
    TELEGRAM: {
        BOT_TOKEN: "7739075002:AAEpEvduB6kSgdjtb9LogBdHIVBVFRDherw"
    }
};

// Global erişim için (Eski kodlarla uyumluluk amacıyla)
const firebaseConfig = CONFIG.FIREBASE;
const BOT_TOKEN = CONFIG.TELEGRAM.BOT_TOKEN;
