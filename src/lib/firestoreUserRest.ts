type FirestoreValue = {
  nullValue?: null;
  booleanValue?: boolean;
  integerValue?: string;
  doubleValue?: number;
  timestampValue?: string;
  stringValue?: string;
  arrayValue?: { values?: FirestoreValue[] };
  mapValue?: { fields?: Record<string, FirestoreValue> };
};

interface FirestoreDocument {
  name: string;
  fields?: Record<string, FirestoreValue>;
}

const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'jyp-mentor';
const databaseRoot = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents`;

function decodeValue(value: FirestoreValue): unknown {
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('stringValue' in value) return value.stringValue;
  if ('arrayValue' in value) return (value.arrayValue?.values ?? []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue?.fields ?? {});
  return undefined;
}

function decodeFields(fields: Record<string, FirestoreValue>) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
}

function encodeValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, encodeValue(item)])),
      },
    };
  }
  return { stringValue: String(value) };
}

async function requestFirestore(token: string, url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    cache: 'no-store',
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: { message?: string } };
    const error = new Error(data.error?.message || `Firestore 요청 실패 (${response.status})`);
    Object.assign(error, { status: response.status });
    throw error;
  }
  return response;
}

export async function getUserDocument(token: string, collectionId: string, documentId: string) {
  const url = `${databaseRoot}/${encodeURIComponent(collectionId)}/${encodeURIComponent(documentId)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (response.status === 404) return undefined;
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(data.error?.message || `Firestore 문서 조회 실패 (${response.status})`);
  }
  const document = await response.json() as FirestoreDocument;
  return decodeFields(document.fields ?? {});
}

export async function queryUserDocuments(token: string, collectionId: string, fieldPath: string, value: string) {
  const response = await requestFirestore(token, `${databaseRoot}:runQuery`, {
    method: 'POST',
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath },
            op: 'EQUAL',
            value: { stringValue: value },
          },
        },
      },
    }),
  });
  const rows = await response.json() as Array<{ document?: FirestoreDocument }>;
  return rows.flatMap((row) => row.document ? [decodeFields(row.document.fields ?? {})] : []);
}

export async function commitUserDocuments(
  token: string,
  writes: Array<{ collectionId: string; documentId: string; data: Record<string, unknown> }>,
) {
  await requestFirestore(token, `${databaseRoot}:commit`, {
    method: 'POST',
    body: JSON.stringify({
      writes: writes.map(({ collectionId, documentId, data }) => ({
        update: {
          name: `projects/${projectId}/databases/(default)/documents/${collectionId}/${documentId}`,
          fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, encodeValue(value)])),
        },
        updateMask: { fieldPaths: Object.keys(data) },
        updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
      })),
    }),
  });
}
