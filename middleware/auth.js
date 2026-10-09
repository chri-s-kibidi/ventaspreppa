const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies.admin_token;

  if (!token) {
    return res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.admin = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sesión inválida o expirada.' });
  }
}

// Protege rutas de páginas HTML (redirige al login si no hay sesión válida)
function requireAuthPage(req, res, next) {
  const token = req.cookies && req.cookies.admin_token;

  if (!token) {
    return res.redirect('/admin/login.html');
  }

  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.redirect('/admin/login.html');
  }
}

module.exports = { requireAuth, requireAuthPage };
