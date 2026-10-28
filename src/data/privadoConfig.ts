// Configuração da área Privado (/privado/).
// Nada aqui é segredo: os documentos só abrem para quem entrar com uma conta Google que tenha acesso à pasta.

/** Client ID OAuth (Google Cloud → APIs e serviços → Credenciais). Pode ser informado também na própria tela. */
export const GOOGLE_CLIENT_ID = '';

/** Pasta "Meu Drive / AGIL CM PRODUTOS ALIMENTICIOS LTDA / Licitacoes - Agil" */
export const PASTA_LICITACOES_ID = '1GZGf7vTgQtPFCb0KO5TFGQ3iapXDKfFB';

/** Login da tela: guardamos só o PBKDF2-SHA256 de "email\nsenha" (210 mil iterações), nunca a senha. */
export const LOGIN = {
  salt: '0ced92103846f03ee294cbf600b4829a',
  hash: '7a5f601d46337b35e392754355e501b2d72c1c6f27802d89adbffc1cd6c440bc',
  iteracoes: 210000,
};

/** Raiz do CNPJ da AGIL CM PRODUTOS ALIMENTICIOS LTDA (51.328.978/0001-18) */
export const AGIL_CNPJ_RAIZ = '51.328.978';
