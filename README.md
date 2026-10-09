# 🍬 candyzz by chr!s — App de Apartados de Gomitas Xile Chile

Aplicación web full-stack de la tienda **candyzz by chr!s** para gestionar apartados (pre-órdenes) de las gomitas enchiladas **Xile Chile**, con una landing page pública para estudiantes y un panel de administración protegido.

> **Nota sobre la marca:** Xile Chile es una marca de productos de terceros. Este proyecto es la tienda/sitio de venta de **candyzz by chr!s**, que comercializa dichas gomitas de forma independiente, sin afiliación, distribución oficial ni representación de la marca Xile Chile.

## Stack técnico

- **Backend:** Node.js + Express
- **Base de datos:** SQLite usando el módulo nativo `node:sqlite` (incluido en Node.js ≥ 22.5), inicializada automáticamente al arrancar. No requiere compilación nativa, por lo que es 100% compatible con Render.com sin necesidad de build tools adicionales.
- **Autenticación:** JWT en cookies `HttpOnly` + `SameSite=Strict`, contraseñas con `bcrypt`
- **Seguridad:** `helmet`, `express-rate-limit`, `express-validator`, `cookie-parser`
- **Frontend:** HTML, CSS y JavaScript vanilla (sin frameworks), dark mode con acentos neón por sabor

## Estructura del proyecto

```
ventas-prepa/
├── server.js              # Punto de entrada del servidor Express
├── db.js                  # Inicialización de SQLite y tabla "apartados"
├── middleware/
│   └── auth.js            # Middlewares de verificación de JWT
├── routes/
│   ├── apartados.js       # Rutas públicas/protegidas de apartados (CRUD)
│   └── auth.js            # Login, logout y verificación de sesión admin
├── public/
│   ├── index.html         # Landing page pública
│   ├── css/style.css      # Estilos globales (tema oscuro + sabores)
│   ├── js/main.js         # Lógica del formulario de apartado
│   └── admin/
│       ├── login.html     # Pantalla de login del admin
│       ├── index.html     # Panel de administración (tabla de apartados)
│       ├── admin.css      # Estilos del panel admin
│       ├── admin.js       # Lógica de la tabla (listar / marcar estado)
│       └── admin-login.js # Lógica del formulario de login
├── data/                  # Carpeta donde se genera el archivo SQLite (ignorada en git)
├── .env.example           # Variables de entorno requeridas
├── render.yaml            # Configuración de despliegue para Render.com
└── package.json
```

## Variables de entorno

Copia `.env.example` a `.env` y configura los valores:

```
PORT=3000
JWT_SECRET=un_secreto_largo_y_aleatorio
ADMIN_PASSWORD=tu_contraseña_segura_de_admin
NODE_ENV=development
```

> ⚠️ `JWT_SECRET` y `ADMIN_PASSWORD` son obligatorias. El servidor no arrancará si faltan.

## Instalación y ejecución local

```bash
npm install
cp .env.example .env   # y edita los valores
npm start
```

La app quedará disponible en `http://localhost:3000`.

- Landing pública: `http://localhost:3000/`
- Panel admin: `http://localhost:3000/admin` (redirige a login si no hay sesión)

## Seguridad implementada

1. **Contraseñas con bcrypt:** la contraseña de administrador nunca se almacena ni compara en texto plano; se hashea en memoria al arrancar el servidor usando `bcrypt` (12 rounds).
2. **JWT en cookies HttpOnly:** las sesiones de admin usan tokens JWT firmados, enviados en cookies `HttpOnly`, `SameSite=Strict` y `Secure` en producción, mitigando XSS y CSRF.
3. **Validación y sanitización:** todos los campos del formulario de apartado (nombre, sabor, cantidad) se validan y sanitizan con `express-validator` antes de insertarse en la base de datos (consultas parametrizadas con `node:sqlite`, por lo que no son vulnerables a inyección SQL).
4. **Rate limiting:** límites de solicitudes en `/api/apartados` (creación de pedidos) y `/api/auth/login` para mitigar spam y ataques de fuerza bruta.
5. **Cabeceras HTTP seguras:** `helmet` está activo y la cabecera `X-Powered-By` está deshabilitada.

## Despliegue en Render.com (gratis)

1. Sube este proyecto a un repositorio de GitHub.
2. En Render.com, crea un nuevo **Web Service** y conéctalo a tu repositorio (o usa el archivo `render.yaml` incluido con "Blueprint").
3. Configura:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Asegúrate de que Render use Node.js 22 o superior (requerido por el módulo nativo `node:sqlite`). Puedes fijar la versión agregando la variable de entorno `NODE_VERSION=22.12.0` en Render, o dejando el archivo `.nvmrc` incluido en el repo, que Render detecta automáticamente.
5. Agrega las variables de entorno en el panel de Render:
   - `JWT_SECRET` (puedes dejar que Render lo genere automáticamente)
   - `ADMIN_PASSWORD` (defínela tú mismo, no se sube al repo)
   - `NODE_ENV=production`
6. Render asignará el puerto automáticamente mediante `process.env.PORT`, ya soportado por `server.js`.

> Nota: el plan gratuito de Render usa almacenamiento efímero. El archivo SQLite (`data/xile_chile.db`) se reiniciará si el servicio se redepliega o duerme por inactividad prolongada. Para persistencia a largo plazo en producción, considera añadir un disco persistente de Render o migrar a una base de datos administrada.

## Funcionalidad

### Cliente (público)
- Navbar con el branding de la tienda "candyzz by chr!s" y hero con el nombre del producto "XILE CHILE", aclarando que se consigue en la tienda.
- 3 tarjetas de sabores (Cereza, Arcoiris, Sandía) con colores de acento propios; Arcoiris usa un degradado de los 3 colores primarios (rojo, amarillo, azul).
- Formulario de apartado (Nombre, Sabor, Cantidad) con feedback visual sin recargar la página (fetch + JSON).
- Footer con aviso de que Xile Chile es una marca de terceros, sin afiliación oficial con la tienda.

### Admin (`/admin`)
- Login protegido por contraseña (bcrypt + JWT).
- Tabla con todos los apartados: Nombre, Sabor, Cantidad, Fecha/Hora, Estado.
- Botón para alternar el estado entre "Pendiente" y "Entregado/Pagado".
- Cierre de sesión seguro (limpia la cookie HttpOnly).
