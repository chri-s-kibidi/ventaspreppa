require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const db = require('./db');

const apartadosRoutes = require('./routes/apartados');
const productosRoutes = require('./routes/productos');
const authRoutes = require('./routes/auth');
const { requireAuthPage } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Verificación de variables de entorno críticas
if (!process.env.JWT_SECRET) {
  console.error('ERROR: La variable de entorno JWT_SECRET es obligatoria. Define JWT_SECRET en tu archivo .env');
  process.exit(1);
}
if (!process.env.ADMIN_PASSWORD) {
  console.error('ERROR: La variable de entorno ADMIN_PASSWORD es obligatoria. Define ADMIN_PASSWORD en tu archivo .env');
  process.exit(1);
}

// Seguridad HTTP con helmet + deshabilitar X-Powered-By
app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:']
      }
    }
  })
);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// Protege las páginas del panel admin ANTES de servir los estáticos de /admin
app.get('/admin', requireAuthPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});
app.get('/admin/index.html', requireAuthPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// Archivos estáticos (frontend público + login de admin + assets)
app.use(express.static(path.join(__dirname, 'public')));

// Rutas de la API
app.use('/api/apartados', apartadosRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/auth', authRoutes);

// Manejo de rutas no encontradas (API)
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Ruta de API no encontrada' });
});

// Fallback para servir index.html en rutas no conocidas del frontend público
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Manejador de errores genérico
app.use((err, req, res, next) => {
  console.error('Error no controlado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

db.initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🍬 candyzz by chr!s (Xile Chile) corriendo en el puerto ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('ERROR: No se pudo inicializar la base de datos:', err);
    process.exit(1);
  });
