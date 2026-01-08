// Script para verificar las variables de entorno
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');

console.log('🔍 Verificando archivo .env.local...\n');

if (!fs.existsSync(envPath)) {
  console.log('❌ El archivo .env.local NO existe en la raíz del proyecto.');
  console.log('\n📝 Crea el archivo .env.local con el siguiente contenido:');
  console.log('NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co');
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_aqui');
  process.exit(1);
}

const content = fs.readFileSync(envPath, 'utf8');
const lines = content.split('\n').filter(line => line.trim() !== '');

console.log('✅ Archivo .env.local encontrado\n');
console.log('📄 Contenido del archivo:');
console.log('─'.repeat(50));
console.log(content);
console.log('─'.repeat(50));
console.log('');

const hasUrl = content.includes('NEXT_PUBLIC_SUPABASE_URL');
const hasKey = content.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY');

console.log('🔎 Verificaciones:');
console.log(`  URL presente: ${hasUrl ? '✅' : '❌'}`);
console.log(`  KEY presente: ${hasKey ? '✅' : '❌'}`);
console.log('');

if (!hasUrl || !hasKey) {
  console.log('❌ Faltan variables requeridas.');
  console.log('\n📝 El archivo debe contener exactamente:');
  console.log('NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co');
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_aqui');
  console.log('\n⚠️  IMPORTANTE:');
  console.log('  - Sin espacios alrededor del =');
  console.log('  - Sin comillas');
  console.log('  - Sin líneas vacías al inicio');
  process.exit(1);
}

// Verificar formato
const urlLine = lines.find(line => line.startsWith('NEXT_PUBLIC_SUPABASE_URL'));
const keyLine = lines.find(line => line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY'));

if (urlLine && urlLine.includes(' = ')) {
  console.log('⚠️  ADVERTENCIA: Hay espacios alrededor del = en NEXT_PUBLIC_SUPABASE_URL');
}

if (keyLine && keyLine.includes(' = ')) {
  console.log('⚠️  ADVERTENCIA: Hay espacios alrededor del = en NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

if (urlLine && (urlLine.startsWith('"') || urlLine.startsWith("'"))) {
  console.log('⚠️  ADVERTENCIA: No uses comillas en NEXT_PUBLIC_SUPABASE_URL');
}

if (keyLine && (keyLine.startsWith('"') || keyLine.startsWith("'"))) {
  console.log('⚠️  ADVERTENCIA: No uses comillas en NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

console.log('\n✅ El archivo parece estar bien formateado.');
console.log('\n🔄 Recuerda reiniciar el servidor de desarrollo después de modificar .env.local');
console.log('   (Ctrl+C y luego npm run dev)');



