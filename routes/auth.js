const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Hash del password de admin generado una sola vez al arrancar el servidor.
// Esto evita comparar o almacenar la contraseña en texto plano.
let ADMIN_PASSWORD_HASH = null;
(async () => {
  const plain = process.env.ADMIN_PASSWORD;
  if (!plain) {
    console.warn('ADVERTENCIA: ADMIN_PASSWORD no está configurada en las variables de entorno.');
    return;
  }
  ADMIN_PASSWORD_HASH = await bcrypt.hash(plain, 12);
})();

// Rate limit estricto para el login (protección contra fuerza bruta)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 intentos por IP cada 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Intenta de nuevo más tarde.' }
});

// POST /api/auth/login
router.post(
  '/login',
  loginLimiter,
  [
    body('password')
      .notEmpty().withMessage('La contraseña es obligatoria')
      .isLength({ min: 1, max: 200 }).withMessage('Contraseña inválida')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    if (!ADMIN_PASSWORD_HASH) {
      return res.status(500).json({ error: 'El servidor no tiene configurada la contraseña de administrador.' });
    }

    const { password } = req.body;

    try {
      const match = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
      if (!match) {
        return res.status(401).json({ error: 'Contraseña incorrecta.' });
      }

      const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });

      res.cookie('admin_token', token, {
        httpOnly: true,
        sameSite: 'strict',
        secure: NODE_ENV === 'production',
        maxAge: 8 * 60 * 60 * 1000 // 8 horas
      });

      return res.json({ message: 'Autenticación exitosa' });
    } catch (err) {
      console.error('Error en login:', err);
      return res.status(500).json({ error: 'Error interno en el inicio de sesión.' });
    }
  }
);

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('admin_token', {
    httpOnly: true,
    sameSite: 'strict',
    secure: NODE_ENV === 'production'
  });
  return res.json({ message: 'Sesión cerrada' });
});

// GET /api/auth/check -> verifica si hay sesión activa
router.get('/check', (req, res) => {
  const token = req.cookies && req.cookies.admin_token;
  if (!token) {
    return res.status(401).json({ authenticated: false });
  }
  try {
    jwt.verify(token, JWT_SECRET);
    return res.json({ authenticated: true });
  } catch (err) {
    return res.status(401).json({ authenticated: false });
  }
});

module.exports = router;
