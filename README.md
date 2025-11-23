# 📄 Proyecto FDE — Generador Automático de Retroalimentación Académica

![Build](https://img.shields.io/badge/build-passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Java](https://img.shields.io/badge/Java-17-orange)
![SpringBoot](https://img.shields.io/badge/SpringBoot-3.x-brightgreen)
![React](https://img.shields.io/badge/React-18-blue)
![OpenAI](https://img.shields.io/badge/OpenAI-API-black)

## 🧠 Descripción general

Este proyecto implementa una plataforma completa para **generar retroalimentación académica automatizada** a partir de planillas Excel. Permite:

1. **Subir un archivo Excel** con las hojas:
   - `Lista`
   - `Ev. Fuentes de Datos Segura`
   - `Ev. Trabajo en Equipo`
2. El backend convierte el Excel a **TSV**, lo envía a **OpenAI** con un prompt especializado.
3. OpenAI devuelve un **JSON estrictamente válido**, con resúmenes académicos por estudiante.
4. El frontend consume este JSON y lo presenta o descarga según sea necesario.

Todo corre sobre **Docker Compose**.

---

## 🏗️ Arquitectura

```
/ui     → Frontend (React + Vite)
/api    → Backend (Spring Boot)
/docker-compose.yml → Orquestación Docker
```

### Flujo del sistema

```
Usuario → UI React → Backend /api/files/process
       → Excel → TSV → OpenAI → JSON → UI
```

---

## 🚀 Tecnologías utilizadas

### **Frontend**
- React + Vite  
- TypeScript  
- shadcn/ui  
- lucide-react  
- sonner  

### **Backend**
- Spring Boot 3  
- Java 17  
- Apache POI (lectura Excel)  
- OpenAI Java SDK  
- Jackson (validación JSON)  
- CORS configurado para UI  

### **DevOps**
- Docker  
- Docker Compose  

---

# ⚙️ Instalación y configuración

## 1️⃣ Clonar repositorio

```bash
git clone <tu-repo>
cd <tu-repo>
```

---

## 2️⃣ Variables de entorno

Crear un archivo `.env` en la raíz:

```
OPENAI_API_KEY=tu_clave_aqui
VITE_API_URL=http://localhost:8080
```

⚠️ **Nunca subas tu API key al repositorio.**

---

## 3️⃣ Ejecutar con Docker Compose

```bash
docker-compose up --build
```

Servicios disponibles:

| Servicio | URL |
|---------|-----|
| UI Frontend | http://localhost:5173 |
| API Backend | http://localhost:8080 |

---

# 📤 Uso del sistema

1. Accede al frontend.  
2. Sube tu archivo Excel `.xlsx`.  
3. La UI envía el archivo al backend:  
   - El backend extrae hojas relevantes  
   - Convierte a TSV  
   - Envía prompt a OpenAI  
   - Valida JSON  
4. La UI muestra el JSON generado.

---

# 🤖 Prompt utilizado (resumen)

El backend le envía al modelo un **prompt altamente estructurado** que exige:

- JSON **estricto**, sin texto adicional.
- Campos:
  - `name`, `matricula`
  - `summary_fuentes_datos_segura`
  - `summary_trabajo_en_equipo`
  - `notes`
- Resúmenes académicos con:
  - Total de indicadores
  - Distribución de puntajes (4/3/2/0)
  - Indicadores con puntaje < 4
  - Párrafo especial para puntaje 0
  - Cierre institucional

---

# 📦 API del backend

## Endpoint principal

```
POST /api/files/process
```

### Entrada:
- `multipart/form-data` con archivo Excel

### Salida:
```json
{
  "students": [...],
  "notes": ""
}
```

### Validaciones incluidas:
- JSON validado con Jackson  
- Manejo de JSON truncado  
- Conversión robusta Excel → TSV  

---

# 🧰 Estructura del proyecto

```
/
├── api/
│   ├── pom.xml
│   ├── controller/
│   ├── service/
│   └── config/
│
├── ui/
│   ├── src/pages/Dashboard.tsx
│   ├── components/
│   └── vite.config.ts
│
└── docker-compose.yml
```

---

# 🛠️ Ejecutar sin Docker

## Frontend

```bash
cd ui
npm install
npm run dev
```

## Backend

```bash
cd api
mvn spring-boot:run
```

---

# 📌 Mejoras futuras sugeridas

- Vista detallada de resultados JSON en UI  
- Conversión del JSON a Excel desde UI  
- Historial con base de datos  
- Autenticación con JWT?
- Procesamiento masivo de archivos y con diversos criteros
- Diversas asignaturas con cantidades de indicadores

---

# 📜 Licencia

MIT — Uso académico y profesional permitido.

