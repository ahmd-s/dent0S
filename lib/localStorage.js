import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export function uploadBuffer(buffer, originalFilename, folderPath) {
  const uniqueId = crypto.randomUUID();
  const extension = path.extname(originalFilename) || '.bin';
  const fileName = `${uniqueId}${extension}`;
  
  const fullPath = path.join(process.cwd(), 'local-uploads', folderPath);
  
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
  
  const filePath = path.join(fullPath, fileName);
  fs.writeFileSync(filePath, buffer);
  
  return {
    secure_url: `/api/local-files/${folderPath}/${fileName}`,
    resource_type: extension === '.pdf' ? 'raw' : 'image',
    format: extension.replace('.', ''),
    public_id: `${folderPath}/${uniqueId}` 
  };
}
