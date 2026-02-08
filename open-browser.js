import open from 'open';

// Esperar a que el servidor esté listo
setTimeout(() => {
  open('http://localhost:3001').catch(() => {
    console.log('No se pudo abrir el navegador automáticamente.');
    console.log('Accede manualmente a: http://localhost:3001');
  });
}, 2000);
