import os

# المسار إلى مجلد الصور
folder_path = 'Screenshots'

# فتح ملف README.md للكتابة فيه
with open('README.md', 'a') as readme_file:
    # أضف عنوان القسم الخاص بالصور
    readme_file.write("## Screenshots\n\nHere are some screenshots of the platform:\n\n<div>\n")

    # استعرض جميع الملفات في المجلد
    for filename in os.listdir(folder_path):
        # تحقق إذا كان الملف صورة بناءً على الامتداد
        if filename.endswith(('.jpg', '.jpeg', '.png', '.gif')):  # التأكد من أنها صورة
            # أنشئ وسم HTML لكل صورة مع المسار الصحيح
            img_tag = f'  <img src="Screenshots/{filename}" alt="{filename}" width="300">\n'
            readme_file.write(img_tag)

    # أغلق الوسم <div>
    readme_file.write("</div>\n")
