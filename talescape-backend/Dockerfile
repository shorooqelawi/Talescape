# استخدم صورة Node.js
FROM node:16

# تعيين مجلد العمل داخل الحاوية
WORKDIR /usr/src/app

# نسخ ملفات package.json و package-lock.json لتثبيت التبعيات
COPY package*.json ./

# تثبيت التبعيات
RUN npm install

# نسخ باقي الملفات إلى الحاوية
COPY . .

# فتح المنفذ 3000 (أو المنفذ الذي يستخدمه تطبيقك)
EXPOSE 3000

# تشغيل التطبيق
CMD ["npm", "start"]
