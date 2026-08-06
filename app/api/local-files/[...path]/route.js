const fs = require('fs');
const path = require('path');

export async function GET(request, { params }) {
  // Get the path parameters from the URL
  const pathSegments = params.path;
  
  // Join the path segments
  const relativePath = path.join(...pathSegments);
  
  // Construct the absolute file path
  const absolutePath = path.join(process.cwd(), 'local-uploads', ...pathSegments);
  
  // Check if the file exists
  if (!fs.existsSync(absolutePath)) {
    return new Response('Not found', { status: 404 });
  }
  
  // Read the file buffer
  const buffer = fs.readFileSync(absolutePath);
  
  // Determine Content-Type based on file extension
  const extension = path.extname(absolutePath).toLowerCase();
  let contentType = 'application/octet-stream';
  
  switch (extension) {
    case '.jpg':
    case '.jpeg':
      contentType = 'image/jpeg';
      break;
    case '.png':
      contentType = 'image/png';
      break;
    case '.gif':
      contentType = 'image/gif';
      break;
    case '.webp':
      contentType = 'image/webp';
      break;
    case '.pdf':
      contentType = 'application/pdf';
      break;
    case '.svg':
      contentType = 'image/svg+xml';
      break;
    default:
      contentType = 'application/octet-stream';
  }
  
  // Return the response with the buffer and Content-Type header
  return new Response(buffer, {
    headers: {
      'Content-Type': contentType
    }
  });
}
