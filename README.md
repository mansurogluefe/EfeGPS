# EfeGPS - Akıllı Motosiklet Takip ve Analiz Sistemi

EfeGPS, motosiklet kullanıcıları için geliştirilmiş, gerçek zamanlı takip, gelişmiş rota analizi ve güvenlik özelliklerini ön plana çıkaran modern bir web ve mobil (PWA) uygulamasıdır. Apple'ın minimalist ve premium tasarım dilinden ilham alınarak geliştirilmiştir.

## ✨ Temel Özellikler

*   **📍 Canlı Takip:** Aracınızın konumunu, hızını ve yönünü harita üzerinde anlık olarak izleyin.
*   **🛣️ Gelişmiş Rota Analizi:** Geçmiş sürüşlerinizi inceleyin, duraklama noktalarını süreleriyle birlikte görün ve hız limit analizleri yapın.
*   **🛡️ Güvenlik Merkezi:**
    *   **Motor Kilidi:** Uzaktan koruma modunu aktif edin.
    *   **Sarsıntı & Yatış Alarmı:** Motorda olağandışı bir sarsıntı veya devrilme olduğunda anında bildirim alın.
    *   **Misafir Modu:** Belirlenen hız sınırı aşılınca otomatik güvenlik kilidi ve Telegram bildirimi.
*   **🏗️ PWA Desteği:** Uygulamayı telefonunuza "Native App" gibi kurabilir ve ana ekranınızdan hızlıca erişebilirsiniz.
*   **⚙️ Özelleştirme:** Farklı motor ikonları (Sport, Premium, Klasik) arasından seçim yapın.

## 📁 Proje Yapısı

```text
EfeGPS/
├── index.html          # Giriş kapısı ve Auth kontrolü
├── login.html          # Kullanıcı giriş ekranı
├── anlık_takip.html    # Ana canlı takip ekranı
├── rota_analiz.html    # Geçmiş sürüş analiz ekranı
├── settings.html       # Kullanıcı ve cihaz ayarları
├── assets/             # Logolar, motor ikonları ve grafikler
├── yedekler/           # Eski sürüm dosyaları ve yedekler
├── style.css           # Global tasarım ve animasyon CSS dosyası
├── main.js             # Rota analiz beyin mantığı
├── config.js           # Firebase ve sistem yapılandırması
├── manifest.json       # PWA kimlik dosyası
└── sw.js              # Çevrimdışı destek ve önbellek yönetimi
```

## 🚀 Teknolojiler

- **Frontend:** HTML5, CSS3 (Vanilla), JavaScript (ES6+).
- **Harita:** Leaflet.js, OpenStreetMap, CartoDB.
- **Backend:** Firebase Realtime Database, Firebase Authentication.
- **İkonlar:** Ionicons.
- **Font:** Google Fonts (Outfit).

## 🛠️ Kurulum ve Geliştirme

1.  `config.js` dosyasındaki Firebase bilgilerinin doğruluğunu kontrol edin.
2.  Android tarafında (`LocationService.kt`) GPS filtreleme ayarlarının yapıldığından emin olun.
3.  Web sunucusu üzerinden (Open with Live Server gibi) yayına alın.

---
*Bu proje, motosiklet tutkunları için verimlilik ve güvenliği bir araya getirmek amacıyla geliştirilmiştir.*