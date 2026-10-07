const bytenode = require('bytenode');
const fs = require('fs');
const path = require('path');

const DIST_SRC = path.join(__dirname, 'dist', 'src');

function compilarDir(dir) {
  fs.readdirSync(dir).forEach(file => {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      compilarDir(full);
    } else if (file.endsWith('.js') && !file.endsWith('.jsc.js')) {
      bytenode.compileFile({
        filename: full,
        output: full.replace('.js', '.jsc'),
        electron: false
      });
      fs.unlinkSync(full); // eliminar el .js original
      console.log('Compilado:', path.relative(__dirname, full));
    }
  });
}

if (!fs.existsSync(DIST_SRC)) {
  console.error('No existe dist/src/. Corré npm run build primero.');
  process.exit(1);
}

console.log('Compilando con bytenode...');
compilarDir(DIST_SRC);
console.log('Listo.');
