# ✦ Cicada Studio — READMI (operational guide)

> Практичный мини-гайд для быстрого запуска, деплоя и диагностики проекта.  
> Продуктовая документация — в [`README.md`](README.md). Этот файл — **операционка**.

---

## 1) Быстрый старт (локально)

```bash
npm install
cp env.example .env
npm run dev
```

Backend отдельно:

```bash
npm run server
```

Проверка backend-синтаксиса:

```bash
npm run check:server
```

---

## 2) Обязательные зависимости

### Node / npm

```bash
node -v
npm -v
```

### PM2 (production)

```bash
npm install -g pm2
```

### PostgreSQL

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### Resend SDK (почта)

```bash
npm install resend
```

---

## 3) Настройка БД PostgreSQL

```bash
sudo -u postgres psql << 'SQL'
CREATE DATABASE cicada;
CREATE USER cicada_user WITH PASSWORD 'change_me_strong_password';
GRANT ALL PRIVILEGES ON DATABASE cicada TO cicada_user;
\c cicada
GRANT ALL ON SCHEMA public TO cicada_user;
SQL
```

Проверка:

```bash
psql -h localhost -U cicada_user -d cicada
```

---

## 4) Production

### Сборка фронта

```bash
npm run build
```

---

## 5) Webinstall — веб-панель (порт 7700)

Один файл [`webinstall.py`](webinstall.py), без pip-зависимостей. UI на русском.

### Вкладки

| Вкладка | Назначение |
|---------|------------|
| **Монитор** | CPU, RAM, подкачка (swap), список процессов |
| **Установка** | Деплой через форму → `setup.sh --webinstall` (логи SSE) |
| **Файлы** | Файловый менеджер проекта |

### Адрес панели

Открывайте **только HTTP** (не HTTPS на этом порту):

```text
http://IP_СЕРВЕРА:7700/
```

В шапке панели отображается ссылка и кнопка **КОПИРОВАТЬ**. Пример: `http://173.242.63.247:7700/`.

> Сайт с SSL — через nginx на порту **443** (`https://домен/`).  
> `https://IP:7700` не работает: в логах будет «HTTPS на HTTP-порт» (это нормально для сканеров и ошибочных закладок).

### Запуск на сервере

```bash
cd /path/to/tg-constructor
git pull
sudo pkill -f webinstall.py   # если уже запущен
sudo python3 webinstall.py
```

**Swap из браузера** — на вкладке «Монитор», блок «Подкачка». Нужен **root**:

```bash
sudo python3 webinstall.py
```

Создаётся `/swapfile`, включается swap, строка в `/etc/fstab`.

### Установка без веб-UI

```bash
python3 webinstall.py --direct
```

Читает `.env` / `webinstall/last-install.env` и запускает `setup.sh` в терминале.

### Файловый менеджер

В правой колонке (после выбора файла):

| Кнопка | Действие |
|--------|----------|
| **Копировать** | Текст в буфер обмена |
| **Скачать** | Скачать файл |
| **Изменить** | Редактор → сохранить на сервер |
| **Загрузить** | Загрузить файл в текущую папку (до 512 КБ) |

Скрыты и защищены от записи: `.env`, `node_modules`, служебные каталоги.

### Переменные окружения

| Переменная | Описание |
|------------|----------|
| `WEBINSTALL_PORT` | Порт (по умолчанию `7700`) |
| `WEBINSTALL_PUBLIC_URL` | Свой URL в консоли (`http://домен:7700`) |
| `WEBINSTALL_SKIP_FIREWALL=1` | Не трогать ufw |
| `WEBINSTALL_NO_FREE_PORT=1` | Не освобождать порт 7700 |
| `WEBINSTALL_UFW_ENABLE=0` | Не включать ufw автоматически |

### API (отладка)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/info` | Платформа, root, `app_dir`, `panel_url` |
| GET | `/api/system/metrics` | Метрики системы |
| GET | `/api/system/processes` | Процессы |
| POST | `/api/system/swap` | Создать swap (`{"sizeGb": 2}`) |
| GET | `/api/files/list?path=` | Список файлов |
| GET | `/api/files/read?path=` | Чтение UTF-8 |
| GET | `/api/files/download?path=` | Скачивание |
| POST | `/api/files/write` | Сохранение `{"path","content"}` |
| POST | `/api/files/upload` | Загрузка `{"dir","name","content","encoding":"base64"}` |

---

## 6) Порты и firewall

```bash
sudo ufw allow 3001
sudo ufw allow 3000
sudo ufw allow 7700    # webinstall (доступ снаружи)
sudo ufw status
```

---

## 7) Parser / DSL

```bash
npm run parser-smoke
npm run parser-smoke:regression
npm run ci:parser
```

---

## 8) Nginx

```bash
sudo systemctl reload nginx
```

---

## 9) Чек-лист перед деплоем

- [ ] Заполнен `.env` (JWT, DB, APP_URL, ADMIN_KEY, токены при необходимости)
- [ ] `npm run check:server`
- [ ] `npm run ci:parser`
- [ ] `npm run build`
- [ ] Backend в PM2 стабилен
- [ ] Порты / reverse proxy настроены
- [ ] Swap при необходимости (webinstall или вручную)
- [ ] Панель webinstall: `http://IP:7700` (не https)

---

## 10) Диагностика

1. `pm2 logs cicada-server` — ошибки backend  
2. Логи PostgreSQL — подключение и права  
3. `.env` — URL, секреты, порты  
4. `npm run check:server` — быстрая проверка  
5. **Webinstall:** только `http://` на **7700**; swap — `sudo python3 webinstall.py`  
6. В логах webinstall повтор «HTTPS/TLS» — кто-то стучит по https; используйте `http://IP:7700`

---

## 11) Полезное

### Cicada runtime

```bash
which cicada
```

Если не найден — пропишите `CICADA_BIN` в `.env`.

### PM2

```bash
pm2 start server.mjs --name cicada-server
pm2 save
pm2 status
pm2 logs cicada-server
```

Пересборка и рестарт:

```bash
pm2 kill && npm run build && pm2 start server.mjs --name cicada-server
```

Кто слушает порты:

```bash
lsof -i :3001
lsof -i :7700
```

### Защита файла (chattr)

```bash
sudo chattr +i b.ccd
sudo chattr -i b.ccd
```

---

*Дубликат в legacy-формате: [`readmi.txt`](readmi.txt)*
