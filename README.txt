Mini-Canva: Editor de Lienzo Simple

Descripción:
Este proyecto es un editor de lienzo web simple, similar a Canva, construido con HTML, CSS, JavaScript, Fabric.js, jsPDF y CropperJS. Permite crear diseños con texto, imágenes, formas y exportarlos a PNG o PDF.

Características:
- Centrado estable del lienzo
- Pan con mano (botón ✋, Space o dos dedos en móvil)
- Zoom que respeta el pan (rueda del mouse, botones HUD, pinch en móvil)
- Formatos predefinidos (A4, A5, etc.)
- Herramientas: texto, imágenes, recortes, formas, capas
- Undo/Redo con límite de 60 estados
- Exportación a PNG/PDF con escala y modo blanco y negro
- Impresión múltiple en hojas
- QR codes para WhatsApp y URLs
- Responsive: dock móvil para pantallas pequeñas

Instalación:
1. Clona el repositorio.
2. Abre index.html en un navegador moderno.
3. O usa npm: npm install && npm start

Dependencias:
- Fabric.js: Manipulación de canvas
- jsPDF: Exportación a PDF
- CropperJS: Recorte de imágenes
- QRCode.js: Generación de QR (cargado dinámicamente)

Atajos de teclado:
- Ctrl+Z: Deshacer
- Ctrl+Y o Ctrl+Shift+Z: Rehacer
- Ctrl+C: Copiar selección
- Ctrl+V: Pegar
- Ctrl+D: Duplicar objeto
- Supr/Backspace: Eliminar selección
- Space: Modo mano temporal

Por defecto usa formato A5 y ajusta el lienzo al alto visible en móviles.
