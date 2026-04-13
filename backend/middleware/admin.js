function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin"');
    return res.status(401).json({ error: 'unauthorized' });
  }

  const base64 = authHeader.slice(6);
  const [username, password] = Buffer.from(base64, 'base64').toString().split(':');

  if (
    username !== process.env.ADMIN_USERNAME ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    return res.status(403).json({ error: 'forbidden' });
  }

  next();
}

module.exports = { requireAdmin };
