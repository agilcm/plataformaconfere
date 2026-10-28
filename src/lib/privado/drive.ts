// Google Drive pelo navegador: login com Google Identity Services e chamadas REST da API v3.
// O token fica só na memória da página (expira em cerca de 1 hora).

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
export const ESCOPO = 'https://www.googleapis.com/auth/drive';
export const PASTA = 'application/vnd.google-apps.folder';

export interface ArquivoDrive {
  id: string;
  name: string;
  mimeType: string;
  md5Checksum?: string;
  size?: string;
  modifiedTime?: string;
  parents?: string[];
  webViewLink?: string;
  appProperties?: Record<string, string>;
}

const CAMPOS = 'id,name,mimeType,md5Checksum,size,modifiedTime,parents,webViewLink,appProperties';

export class ErroDrive extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}

declare global {
  interface Window {
    google?: any;
  }
}

let gis: Promise<void> | null = null;
function carregarGis() {
  gis ??= new Promise<void>((ok, falha) => {
    if (window.google?.accounts?.oauth2) return ok();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => ok();
    s.onerror = () => {
      gis = null;
      falha(new ErroDrive('Não consegui carregar o login do Google. Verifique a internet ou bloqueadores de anúncio.'));
    };
    document.head.appendChild(s);
  });
  return gis;
}

let token = '';
let expiraEm = 0;

/** Abre a janela de login do Google e guarda o token de acesso. */
export async function conectar(clientId: string, { silencioso = false } = {}): Promise<void> {
  await carregarGis();
  await new Promise<void>((ok, falha) => {
    const cliente = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: ESCOPO,
      prompt: silencioso ? '' : 'consent',
      callback: (r: any) => {
        if (r.error) return falha(new ErroDrive(r.error_description || r.error));
        if (!window.google.accounts.oauth2.hasGrantedAllScopes(r, ESCOPO)) {
          return falha(new ErroDrive('Marque a permissão para ver, editar e organizar os arquivos do Google Drive.'));
        }
        token = r.access_token;
        expiraEm = Date.now() + (Number(r.expires_in) || 3600) * 1000 - 60_000;
        ok();
      },
      error_callback: (e: any) => falha(new ErroDrive(e?.type === 'popup_closed' ? 'A janela do Google foi fechada antes de terminar.' : 'Login do Google não concluído.')),
    });
    cliente.requestAccessToken();
  });
}

export const conectado = () => !!token && Date.now() < expiraEm;
export function desconectar() {
  if (token && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(token, () => {});
  token = '';
  expiraEm = 0;
}

async function chamar(url: string, init: RequestInit = {}, tentativas = 4): Promise<Response> {
  if (!conectado()) throw new ErroDrive('A conexão com o Google expirou. Clique em "Conectar ao Google Drive" de novo.', 401);
  for (let t = 0; ; t++) {
    const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) } });
    if (r.ok) return r;
    if ((r.status === 429 || r.status >= 500 || r.status === 403) && t < tentativas) {
      const corpo = r.status === 403 ? await r.clone().text() : '';
      if (r.status !== 403 || /rateLimit|userRateLimit/i.test(corpo)) {
        await new Promise((ok) => setTimeout(ok, 800 * 2 ** t + Math.random() * 400));
        continue;
      }
    }
    if (r.status === 401) {
      token = '';
      throw new ErroDrive('A conexão com o Google expirou. Clique em "Conectar ao Google Drive" de novo.', 401);
    }
    const msg = await r.text().catch(() => '');
    throw new ErroDrive(`Google Drive respondeu ${r.status}${msg ? `: ${msg.slice(0, 200)}` : ''}`, r.status);
  }
}

export async function usuario(): Promise<{ nome: string; email: string }> {
  const r = await chamar(`${API}/about?fields=user(displayName,emailAddress)`);
  const j = await r.json();
  return { nome: j.user?.displayName || '', email: j.user?.emailAddress || '' };
}

export async function obter(id: string): Promise<ArquivoDrive> {
  const r = await chamar(`${API}/files/${id}?fields=${CAMPOS}&supportsAllDrives=true`);
  return r.json();
}

export async function listarFilhos(pastaId: string): Promise<ArquivoDrive[]> {
  const out: ArquivoDrive[] = [];
  let pageToken = '';
  do {
    const p = new URLSearchParams({
      q: `'${pastaId}' in parents and trashed = false`,
      fields: `nextPageToken,files(${CAMPOS})`,
      pageSize: '1000',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });
    if (pageToken) p.set('pageToken', pageToken);
    const j = await (await chamar(`${API}/files?${p}`)).json();
    out.push(...(j.files || []));
    pageToken = j.nextPageToken || '';
  } while (pageToken);
  return out;
}

export async function baixar(id: string): Promise<Uint8Array> {
  const r = await chamar(`${API}/files/${id}?alt=media&supportsAllDrives=true`);
  return new Uint8Array(await r.arrayBuffer());
}

/** Renomeia e/ou move um arquivo ou pasta. */
export async function atualizar(
  id: string,
  { nome, de, para, appProperties }: { nome?: string; de?: string; para?: string; appProperties?: Record<string, string | null> },
): Promise<ArquivoDrive> {
  const p = new URLSearchParams({ fields: CAMPOS, supportsAllDrives: 'true' });
  if (para && de && para !== de) {
    p.set('addParents', para);
    p.set('removeParents', de);
  }
  const corpo: Record<string, unknown> = {};
  if (nome) corpo.name = nome;
  if (appProperties) corpo.appProperties = appProperties;
  const r = await chamar(`${API}/files/${id}?${p}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  return r.json();
}

export async function criarPasta(nome: string, pai: string, appProperties: Record<string, string>): Promise<ArquivoDrive> {
  const r = await chamar(`${API}/files?fields=${CAMPOS}&supportsAllDrives=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: nome, mimeType: PASTA, parents: [pai], appProperties }),
  });
  return r.json();
}

/** Cria ou substitui um arquivo de texto (JSON, CSV) na pasta. */
export async function salvarTexto(
  { id, nome, pai, mimeType, appProperties }: { id?: string; nome: string; pai: string; mimeType: string; appProperties?: Record<string, string> },
  conteudo: string,
): Promise<ArquivoDrive> {
  const meta: Record<string, unknown> = { name: nome, mimeType };
  if (!id) meta.parents = [pai];
  if (appProperties) meta.appProperties = appProperties;
  const limite = `agilcm${Math.random().toString(36).slice(2)}`;
  const corpo =
    `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
    `--${limite}\r\nContent-Type: ${mimeType}; charset=UTF-8\r\n\r\n${conteudo}\r\n--${limite}--`;
  const url = id
    ? `${UPLOAD}/files/${id}?uploadType=multipart&fields=${CAMPOS}&supportsAllDrives=true`
    : `${UPLOAD}/files?uploadType=multipart&fields=${CAMPOS}&supportsAllDrives=true`;
  const r = await chamar(url, { method: id ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${limite}` }, body: corpo });
  return r.json();
}

/** Extrai o ID de um link de pasta do Drive (ou devolve o próprio texto, se já for um ID). */
export function idDoLink(s: string): string {
  const t = s.trim();
  return t.match(/\/folders\/([\w-]{10,})/)?.[1] || t.match(/[?&]id=([\w-]{10,})/)?.[1] || t;
}

/** Manda para a lixeira do Drive (recuperável por 30 dias). */
export async function lixeira(id: string): Promise<void> {
  await chamar(`${API}/files/${id}?supportsAllDrives=true`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
}
