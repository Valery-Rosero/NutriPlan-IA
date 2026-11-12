// Configuración dinámica sobre app.json.
// google-services.json (Firebase, para las notificaciones) NO va al repositorio público: tiene una clave de
// Google. En EAS llega como variable de entorno de tipo archivo (GOOGLE_SERVICES_JSON, visibilidad secreta);
// en local se usa el archivo app/google-services.json, ignorado por Git.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  },
});
