/* ─────────── API Preço / Prazo ─────────── */

export type ServicoCorreio = "SEDEX" | "PAC" | "SEDEX12" | "SEDEX10";

export type CalcFreteDto = {
  cepOrigem: string;
  cepDestino: string;
  peso: number;
  comprimento: number;
  altura: number;
  largura: number;
  servico?: ServicoCorreio;
};

export type FreteResultado = {
  servico: string;
  valor: number;
  prazo: number;
  erro?: string;
};

/* ─────────── API Pré-Postagem ─────────── */

export type RemetenteDto = {
  nome: string;
  cpfCnpj: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone?: string;
  email?: string;
};

export type DestinatarioDto = {
  nome: string;
  cpfCnpj: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone?: string;
};

export type ItemDeclaracaoDto = {
  descricao: string;
  quantidade: number;
  valor: number;
};

export type PrePostagemDto = {
  contrato: string;
  servico: ServicoCorreio;
  remetente: RemetenteDto;
  destinatario: DestinatarioDto;
  itensDeclaracao: ItemDeclaracaoDto[];
  peso: number;
  comprimento: number;
  altura: number;
  largura: number;
  notaFiscal?: string;
};

export type PostagemResultado = {
  id: string;
  codigoObjeto: string;
  etiqueta: string;
  dae: string;
  urlDAE: string;
  status: string;
};

export type PostagemType = {
  id: string;
  codigoObjeto: string;
  cliente: string;
  servico: string;
  status: "PENDENTE" | "POSTADO" | "CANCELADO" | "EM_TRANSITO" | "ENTREGUE";
  etiqueta: string;
  dae: string;
  dataPostagem: string;
  valorFrete: number;
};

/* ─────────── API Rastro ─────────── */

export type RastreioEvento = {
  data: string;
  hora: string;
  local: string;
  descricao: string;
};

export type RastreioResultado = {
  codigo: string;
  servico: string;
  eventos: RastreioEvento[];
  ultimaAtualizacao: string;
};

/* ─────────── Resumo ─────────── */

export type ResumoCorreiosType = {
  postagensHoje: number;
  postagensMes: number;
  postagensPendentes: number;
  totalFreteMes: number;
};
