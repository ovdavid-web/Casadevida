const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const backupRoot = process.argv[2];
if (!backupRoot) {
  throw new Error('Debes indicar la carpeta del respaldo.');
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Faltan SUPABASE_URL o SUPABASE_SECRET_KEY en .env.');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const bucket = 'eventos-publicos';
const destination = path.resolve(backupRoot, 'storage', bucket);

async function listFiles(prefix = '') {
  const result = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });

    if (error) throw error;
    if (!data?.length) break;

    for (const item of data) {
      const objectPath = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) {
        result.push(objectPath);
      } else {
        result.push(...await listFiles(objectPath));
      }
    }

    if (data.length < 100) break;
    offset += data.length;
  }

  return result;
}

async function main() {
  fs.mkdirSync(destination, { recursive: true });
  const objectPaths = await listFiles();
  const manifest = [];

  for (const objectPath of objectPaths) {
    const { data, error } = await supabase.storage.from(bucket).download(objectPath);
    if (error) throw error;

    const buffer = Buffer.from(await data.arrayBuffer());
    const localPath = path.resolve(destination, objectPath);
    if (!localPath.startsWith(`${destination}${path.sep}`)) {
      throw new Error(`Ruta no segura detectada: ${objectPath}`);
    }

    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, buffer);
    manifest.push({
      objeto: objectPath,
      bytes: buffer.length,
      sha256: crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase()
    });
  }

  const manifestPath = path.join(destination, 'manifest-storage.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(JSON.stringify({ bucket, archivos: manifest.length, destino: destination }));
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
