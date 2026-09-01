import api from '../../../services/api';

const BASE = '/api/financeiro/pro';

export const localUser = {
  id: 'carecore-financas',
  email: 'financas@carecore.local',
};

export const localApi = {
  list: <T,>(table: string) =>
    api.get<T[]>(`${BASE}/${table}`).then((response) => response.data),

  insert: <T,>(table: string, record: unknown) =>
    api.post<T>(`${BASE}/${table}`, record).then((response) => response.data),

  insertMany: <T,>(table: string, records: unknown[]) =>
    api.post<T[]>(`${BASE}/${table}`, records).then((response) => response.data),

  update: <T,>(table: string, id: string, record: unknown) =>
    api.put<T>(`${BASE}/${table}/${id}`, record).then((response) => response.data),

  remove: (table: string, id: string) =>
    api.delete<{ ok: boolean }>(`${BASE}/${table}/${id}`).then((response) => response.data),

  uploadInvoice: async (file: File) => {
    const data = new FormData();
    data.append('file', file);
    const response = await api.post<{ path: string; publicUrl: string }>(
      `${BASE}/upload-invoice`,
      data,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  },
};
