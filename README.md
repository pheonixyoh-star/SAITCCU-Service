# 🎨 Design Queue Management System (SAITCCU-Service)

ระบบบริหารจัดการคิวงานออกแบบ (Design Queue Management System) สำหรับองค์กร พัฒนาด้วยสถาปัตยกรรม Serverless ทำงานบน GitHub Pages เชื่อมต่อฐานข้อมูล Google Sheets ผ่าน Google Apps Script (GAS) Web App พร้อมระบบยืนยันตัวตนด้วย Google Identity Services (GIS)

---

## 🌟 ฟีเจอร์หลัก (Key Features)

- **ระบบบทบาทผู้ใช้งาน (Multi-Role Support):**
  - **User (ผู้ขอใช้บริการ):** สร้างคำขอ ออกแบบ ติดตามสถานะงานของตนเอง
  - **Exec1 (หัวหน้าฝ่าย):** ตรวจสอบและรับทราบ/อนุมัติคำขอในระดับฝ่าย
  - **Exec2 (ผู้จ่ายงาน):** พิจารณาอนุมัติ และเลือกมอบหมายดีไซเนอร์ผู้รับผิดชอบ
  - **Designer (นักออกแบบ):** ดูคิวงานที่ได้รับมอบหมาย รับงาน และอัปเดตสถานะงานเสร็จสิ้น
  - **Admin (ผู้ดูแลระบบ):** จัดการสิทธิ์ผู้ใช้งาน ดูภาพรวม และแก้ไขคำขอทั้งหมด
- **การแจ้งเตือนอัตโนมัติ:** ส่งอีเมลแจ้งเตือนผู้ขอและดีไซเนอร์ทันทีเมื่อมีการอนุมัติหรือยกเลิกงานผ่าน GAS MailApp
- **ความปลอดภัย & ป้องกัน Race Condition:** ใช้ Google Apps Script `LockService` ควบคุมการเขียนข้อมูลลงใน Google Sheets

---

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```text
├── index.html        # หน้าเว็บ Frontend แบบ Single Page Application (Tailwind CSS v3 + SweetAlert2)
├── app.js            # โค้ดควบคุม Frontend (Google Sign-In, Role Navigation, View Routing, API Calls)
├── gas-backend.gs    # โค้ด Backend Google Apps Script (REST Web App, LockService, Email Notifier)
├── Users.csv         # โครงสร้างตารางและข้อมูลตัวอย่างผู้ใช้งานสำหรับ Import ลง Google Sheets
├── Jobs.csv          # โครงสร้างตารางและข้อมูลตัวอย่างคิวงานสำหรับ Import ลง Google Sheets
└── README.md         # คู่มือการติดตั้งและใช้งานระบบ
```

---

## 🚀 ขั้นตอนการติดตั้งและการเปิดใช้งาน (Quick Start)

### 1. นำเข้าข้อมูลใน Google Sheets
1. สร้าง Google Spreadsheet ใหม่ที่ [Google Sheets](https://sheets.new)
2. นำเข้าไฟล์ `Users.csv` ไปยังชีตชื่อ **`Users`**
3. นำเข้าไฟล์ `Jobs.csv` ไปยังชีตชื่อ **`Jobs`**
4. คัดลอก **Spreadsheet ID** จาก URL ของสเปรดชีต

### 2. ติดตั้ง Backend (Google Apps Script)
1. ไปที่เมนู **ส่วนขยาย (Extensions)** > **Apps Script**
2. วางโค้ดจากไฟล์ `gas-backend.gs`
3. แก้ไขตัวแปร `SPREADSHEET_ID` ในบรรทัดที่ 12 ด้วย ID สเปรดชีตของคุณ
4. กด **Deploy (ทำให้ใช้งานได้)** > **New deployment (การทำให้ใช้งานได้ใหม่)**
   - เลือกประเภท: **Web app**
   - Execute as: **Me** (ฉัน)
   - Who has access: **Anyone** (ทุกคน)
5. คัดลอก **Web App URL** ที่ได้

### 3. ตั้งค่า Google OAuth 2.0 Client ID
1. ไปที่ [Google Cloud Console](https://console.cloud.google.com/)
2. สร้าง OAuth 2.0 Client ID (ประเภท Web application)
3. ระบุ Authorized JavaScript Origins เป็น URL ของ GitHub Pages ของคุณ

### 4. อัปเดตการตั้งค่าใน Frontend
1. เปิดไฟล์ `app.js`
2. แก้ไขค่า `GAS_URL` ด้วย Web App URL จากขั้นตอนที่ 2
3. แก้ไขค่า `GOOGLE_CLIENT_ID` ด้วย Client ID จากขั้นตอนที่ 3

### 5. เปิดใช้งาน GitHub Pages
1. ไปที่ **Settings** ใน GitHub Repository `SAITCCU-Service`
2. ไปที่เมนู **Pages** ทางด้านซ้าย
3. ในส่วน **Build and deployment** > Source ให้เลือก **Deploy from a branch**
4. เลือก Branch: **`main`** / Folder: **`/ (root)`** แล้วกด **Save**
5. ระบบจะสร้าง URL สำหรับเข้าใช้งานระบบ เช่น `https://pheonixyoh-star.github.io/SAITCCU-Service/`

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

- **Frontend:** HTML5, Vanilla JavaScript (ES6+), [Tailwind CSS](https://tailwindcss.com/) (CDN), [SweetAlert2](https://sweetalert2.github.io/)
- **Authentication:** [Google Identity Services (GIS)](https://developers.google.com/identity/gsi/web)
- **Backend & API:** Google Apps Script (GAS) Web App
- **Database:** Google Sheets
- **Hosting:** GitHub Pages
