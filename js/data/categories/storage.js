import { c } from '../schema.js';

export const category = { id: 'storage', label: 'Storage', color: '#334155' };

const ST = '#334155';

export const components = [
  c('storage-backup', 'Backup Storage', '🗄️', { color: ST }),
  c('storage-block', 'Block Storage', '💽', { color: ST }),
  c('storage-file', 'File Storage', '🗂️', { color: ST }),
  c('storage-nas', 'NAS', '🗃️', { color: ST }),
  c('storage-object', 'Object Storage', '🪣', { color: ST, related: ['net-cdn', 'aws-cloudfront'] }),
  c('storage-san', 'SAN', '🧮', { color: ST }),
  c('storage-tape', 'Tape / Cold Archive', '📼', { color: ST }),
  c('storage-warehouse', 'Data Warehouse', '🏭', { shape: 'cylinder', color: ST }),
];
