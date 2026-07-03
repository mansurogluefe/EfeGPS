// EfeGPS Merkezi Yapılandırma Dosyası
const CONFIG = {
    FIREBASE: {
        apiKey: "AIzaSyBXoJ_7Ye9v-yO2eAhJrWHUPgL3-3rEIlc",
        authDomain: "core-prime-8606c.firebaseapp.com",
        databaseURL: "https://core-prime-8606c-default-rtdb.firebaseio.com",
        projectId: "core-prime-8606c",
        storageBucket: "core-prime-8606c.firebasestorage.app",
        messagingSenderId: "580644022734",
        appId: "1:580644022734:web:cb1707e83f4181929ea39f",
        measurementId: "G-05S016D76R"
    },
    TELEGRAM: {
        BOT_TOKEN: "7739075002:AAEpEvduB6kSgdjtb9LogBdHIVBVFRDherw"
    }
};

// Global erişim için (Eski kodlarla uyumluluk amacıyla)
const firebaseConfig = CONFIG.FIREBASE;
const BOT_TOKEN = CONFIG.TELEGRAM.BOT_TOKEN;
