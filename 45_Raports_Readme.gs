/**
 * RAPORTS MODULE — коротко по суті.
 *
 * Що додано:
 * - окремі листи RAPORTS_*;
 * - bootstrap із даних RAPORTS APP.xlsx;
 * - генерація Google Docs за шаблоном;
 * - заміна плейсхолдерів {{fio_n}}, {{fp_d}}, {{ds}}, {{de}}, {{sign_me}} тощо;
 * - експорт PDF, якщо заповнений PDF_OUTPUT_FOLDER_ID;
 * - окреме меню “Рапорти”.
 *
 * Мінімальний запуск:
 * 1. Відкрити таблицю → меню “Рапорти” → “Створити/оновити листи Raports”.
 * 2. Заповнити RAPORTS_SETTINGS:
 *    DOC_OUTPUT_FOLDER_ID, PDF_OUTPUT_FOLDER_ID, SIGNS_FOLDER_ID.
 * 3. Заповнити RAPORTS_TEMPLATES.DOC_ID для TPL_KEY = vac_main.
 * 4. Заповнити RAPORTS_SIGNS.FILE_ID для потрібних підписів.
 * 5. Додати активну відпустку у RAPORTS_VACATIONS.
 * 6. Запустити:
 *    raportsGenerateVacationReport('vac_0001')
 *
 * Модуль не чіпає бойові листи WASB: VACATIONS, PHONES, TEMPLATES, LOG.
 */
