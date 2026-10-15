-- Pranchetas Digitais - (c) 2026 Guilherme. Banco da nuvem (Cloudflare D1, SQLite).
-- Cada anotação fica inteira em "json"; as outras colunas servem para buscar.
CREATE TABLE IF NOT EXISTS registros (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  prancheta TEXT NOT NULL,
  setor TEXT,
  chave TEXT,
  seq INTEGER NOT NULL,
  atualizadoEm INTEGER,
  apagado INTEGER NOT NULL DEFAULT 0,
  json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS registros_data ON registros (data);
CREATE INDEX IF NOT EXISTS registros_seq ON registros (seq);

-- quantas anotações cada dia tem (a lista de dias sai daqui, sem ler o banco inteiro)
CREATE TABLE IF NOT EXISTS dias (
  data TEXT PRIMARY KEY,
  anotacoes INTEGER NOT NULL DEFAULT 0
);

-- aparelhos bloqueados pelo administrador (versão 2.11): o aparelho longe da usina pergunta aqui
CREATE TABLE IF NOT EXISTS bloqueios (
  id TEXT PRIMARY KEY,
  json TEXT NOT NULL
);

-- o que a central mandou além das anotações: geracao, forms (as folhas), medidas das dornas, último envio
CREATE TABLE IF NOT EXISTS info (
  chave TEXT PRIMARY KEY,
  valor TEXT
);

-- 2.14: ponto de encontro; a central continua conferindo cada pendência.
CREATE TABLE IF NOT EXISTS pendentes (
  aparelho TEXT NOT NULL,
  id TEXT NOT NULL,
  atualizadoEm INTEGER NOT NULL,
  geracao TEXT NOT NULL DEFAULT '',
  ordem INTEGER NOT NULL,
  json TEXT NOT NULL,
  PRIMARY KEY (aparelho, id)
);
CREATE INDEX IF NOT EXISTS pendentes_ordem ON pendentes (ordem);
