import type { QuestionOption } from '../types';

export interface SeedQuestion {
  code: string;
  board: string;
  career: string;
  subject: string;
  topic: string;
  organ: string;
  year: number;
  difficulty: 'Fácil' | 'Média' | 'Difícil';
  questionType: 'multiple_choice' | 'true_false';
  statement: string;
  optionsJson: QuestionOption[];
  correctOption: string;
  commentary: string;
}

export const SEED_QUESTIONS: SeedQuestion[] = [
  {
    code: 'Q-CEB-TRF1-001',
    board: 'Cebraspe',
    career: 'Tribunais',
    subject: 'Direito Constitucional',
    topic: 'Direitos e Garantias Fundamentais',
    organ: 'TRF 1ª Região',
    year: 2025,
    difficulty: 'Média',
    questionType: 'true_false',
    statement:
      'Conforme jurisprudência consolidada do Supremo Tribunal Federal, a casa é asilo inviolável do indivíduo, mas a entrada forçada em domicílio sem mandado judicial é lícita mesmo fora das hipóteses de flagrante delito quando houver fundada suspeita baseada exclusivamente em denúncia anônima.',
    optionsJson: [
      { key: 'C', text: 'Certo' },
      { key: 'E', text: 'Errado' },
    ],
    correctOption: 'E',
    commentary:
      'Errado. No Tema 280 de Repercussão Geral (RE 603.616), o STF firmou que a entrada forçada em domicílio sem mandado judicial só é lícita, mesmo em período noturno, quando amparada em fundadas razões, devidamente justificadas a posteriori, que indiquem situação de flagrante delito. Denúncia anônima isolada não autoriza o ingresso.',
  },
  {
    code: 'Q-FGV-TJ-002',
    board: 'FGV',
    career: 'Tribunais',
    subject: 'Direito Constitucional',
    topic: 'Controle de Constitucionalidade',
    organ: 'TJ-SC',
    year: 2024,
    difficulty: 'Difícil',
    questionType: 'multiple_choice',
    statement:
      'Determinado Estado da Federação promulgou lei estadual dispondo sobre normas gerais de licitação e contratação administrativa em sentido diverso do estabelecido pela Lei nº 14.133/2021. À luz da Constituição Federal de 1988, essa lei estadual pode ser objeto de:',
    optionsJson: [
      { key: 'A', text: 'Ação Direta de Inconstitucionalidade (ADI) perante o STF, por violação à competência privativa da União para legislar sobre normas gerais de licitação.' },
      { key: 'B', text: 'Arguição de Descumprimento de Preceito Fundamental (ADPF) exclusivamente, por tratar-se de norma pré-constitucional.' },
      { key: 'C', text: 'Ação Declaratória de Constitucionalidade (ADC) proposta pelo Governador perante o Tribunal de Justiça local.' },
      { key: 'D', text: 'Controle concentrado apenas perante o Tribunal de Justiça estadual, sem possibilidade de análise pelo STF.' },
      { key: 'E', text: 'Suspensão automática pelo Senado Federal independentemente de decisão judicial.' },
    ],
    correctOption: 'A',
    commentary:
      'Gabarito: A. Compete privativamente à União legislar sobre normas gerais de licitação e contratação (art. 22, XXVII, CF/88). Lei estadual pós-constitucional que invade competência legislativa privativa da União sofre inconstitucionalidade formal orgânica e é impugnável via ADI no STF (art. 102, I, a).',
  },
  {
    code: 'Q-FCC-TRT-003',
    board: 'FCC',
    career: 'Tribunais',
    subject: 'Direito Administrativo',
    topic: 'Atos Administrativos',
    organ: 'TRT 4ª Região',
    year: 2024,
    difficulty: 'Fácil',
    questionType: 'multiple_choice',
    statement:
      'Quando a Administração Pública retira do mundo jurídico um ato administrativo válido, por razões de conveniência e oportunidade, respeitados os direitos adquiridos, opera-se a:',
    optionsJson: [
      { key: 'A', text: 'Anulação com efeitos ex tunc.' },
      { key: 'B', text: 'Convalidação com efeitos retroativos.' },
      { key: 'C', text: 'Revogação com efeitos ex nunc.' },
      { key: 'D', text: 'Cassação por descumprimento de condição pelo particular.' },
      { key: 'E', text: 'Caducidade por superveniência de norma incompatível.' },
    ],
    correctOption: 'C',
    commentary:
      'Gabarito: C. A revogação incide sobre ato administrativo válido e discricionário, fundamenta-se no mérito administrativo (conveniência e oportunidade), produz efeitos prospectivos (ex nunc) e resguarda direitos adquiridos (Súmula 473 do STF).',
  },
  {
    code: 'Q-FGV-RFB-004',
    board: 'FGV',
    career: 'Fiscal',
    subject: 'Direito Tributário',
    topic: 'Limitações ao Poder de Tributar',
    organ: 'Receita Federal',
    year: 2024,
    difficulty: 'Média',
    questionType: 'multiple_choice',
    statement:
      'Em novembro de 2024, a União publicou decreto majorando a alíquota do Imposto sobre Produtos Industrializados (IPI) incidente sobre determinado segmento industrial. Considerando as regras constitucionais das anterioridades anual e nonagesimal, a majoração poderá ser exigida:',
    optionsJson: [
      { key: 'A', text: 'Imediatamente na data da publicação do decreto, por ser imposto extrafiscal.' },
      { key: 'B', text: 'Apenas no exercício financeiro seguinte e após 90 dias da publicação.' },
      { key: 'C', text: 'No mesmo exercício financeiro, após decorridos 90 dias da publicação do decreto.' },
      { key: 'D', text: 'No primeiro dia do exercício financeiro seguinte, independentemente do prazo de 90 dias.' },
      { key: 'E', text: 'Somente mediante conversão do decreto em lei complementar pelo Congresso Nacional.' },
    ],
    correctOption: 'C',
    commentary:
      'Gabarito: C. Conforme o art. 150, § 1º, da CF/88, o IPI é exceção à anterioridade anual (de exercício), mas NÃO é exceção à anterioridade nonagesimal (noventena). Portanto, a alíquota majorada pode valer no mesmo exercício financeiro, desde que respeitados 90 dias da publicação.',
  },
  {
    code: 'Q-CEB-SEFAZ-005',
    board: 'Cebraspe',
    career: 'Fiscal',
    subject: 'Direito Tributário',
    topic: 'Crédito Tributário e Prescrição',
    organ: 'SEFAZ-AC',
    year: 2024,
    difficulty: 'Média',
    questionType: 'true_false',
    statement:
      'Nos termos da Súmula 436 do Superior Tribunal de Justiça, a entrega de declaração pelo contribuinte reconhecendo débito fiscal constitui o crédito tributário, dispensada qualquer outra providência por parte do fisco.',
    optionsJson: [
      { key: 'C', text: 'Certo' },
      { key: 'E', text: 'Errado' },
    ],
    correctOption: 'C',
    commentary:
      'Certo. Trata-se da literalidade da Súmula 436 do STJ, aplicada ao lançamento por homologação: declarando o débito (ex.: DCTF, GIA) sem pagamento, o crédito está formalmente constituído, iniciando-se o prazo prescricional de 5 anos para cobrança executiva.',
  },
  {
    code: 'Q-VUN-TCESP-006',
    board: 'Vunesp',
    career: 'Fiscal',
    subject: 'Contabilidade Pública',
    topic: 'Receita e Despesa Pública',
    organ: 'TCE-SP',
    year: 2024,
    difficulty: 'Média',
    questionType: 'multiple_choice',
    statement:
      'Segundo a Lei nº 4.320/1964 e o MCASP, o estágio da despesa orçamentária que consiste na verificação do direito adquirido pelo credor tendo por base os títulos e documentos comprobatórios do respectivo crédito denomina-se:',
    optionsJson: [
      { key: 'A', text: 'Fixação.' },
      { key: 'B', text: 'Empenho.' },
      { key: 'C', text: 'Liquidação.' },
      { key: 'D', text: 'Pagamento.' },
      { key: 'E', text: 'Restos a pagar processados.' },
    ],
    correctOption: 'C',
    commentary:
      'Gabarito: C. Conforme o art. 63 da Lei nº 4.320/1964, a liquidação da despesa consiste exatamente na verificação do direito adquirido pelo credor com base nos títulos e documentos comprobatórios (entrega do bem ou prestação do serviço), após o empenho e antes do pagamento.',
  },
  {
    code: 'Q-CEB-PF-007',
    board: 'Cebraspe',
    career: 'Policial',
    subject: 'Direito Penal',
    topic: 'Teoria do Crime e Aplicação da Lei Penal',
    organ: 'Polícia Federal',
    year: 2025,
    difficulty: 'Média',
    questionType: 'true_false',
    statement:
      'No que se refere à aplicação da lei penal no espaço, o Código Penal brasileiro adota, como regra geral, o princípio da territorialidade temperada, permitindo a aplicação da lei estrangeira em território nacional quando prevista em convenções, tratados e regras de direito internacional.',
    optionsJson: [
      { key: 'C', text: 'Certo' },
      { key: 'E', text: 'Errado' },
    ],
    correctOption: 'C',
    commentary:
      'Certo. O art. 5º do Código Penal estabelece que "Aplica-se a lei brasileira, sem prejuízo de convenções, tratados e regras de direito internacional, ao crime cometido no território nacional". Essa ressalva caracteriza a territorialidade temperada ou mitigada.',
  },
  {
    code: 'Q-FGV-PC-008',
    board: 'FGV',
    career: 'Policial',
    subject: 'Processo Penal',
    topic: 'Inquérito Policial',
    organ: 'PC-MG',
    year: 2024,
    difficulty: 'Fácil',
    questionType: 'multiple_choice',
    statement:
      'A respeito do inquérito policial, procedimento administrativo pré-processual previsto no Código de Processo Penal, assinale a afirmativa correta:',
    optionsJson: [
      { key: 'A', text: 'O delegado de polícia pode determinar o arquivamento direto dos autos quando concluir pela atipicidade da conduta.' },
      { key: 'B', text: 'Nos crimes de ação penal privada, a autoridade policial pode instaurar o inquérito de ofício independentemente de requerimento.' },
      { key: 'C', text: 'O inquérito policial é dispensável para o oferecimento da denúncia se o Ministério Público já possuir elementos mínimos de autoria e materialidade.' },
      { key: 'D', text: 'A incomunicabilidade do indiciado pode ser decretada pelo delegado de polícia por até 5 dias sem intervenção judicial.' },
      { key: 'E', text: 'O advogado do investigado não tem direito de acesso aos elementos de prova já documentados nos autos do inquérito.' },
    ],
    correctOption: 'C',
    commentary:
      'Gabarito: C. O inquérito policial tem natureza dispensável (art. 12, art. 27 e art. 39, § 5º, CPP). Se o titular da ação penal já dispõe de peças de informação suficientes sobre autoria e materialidade, pode ofertar a peça acusatória diretamente. O delegado nunca arquiva o IP (art. 17 CPP) e a Súmula Vinculante 14 garante ao defensor acesso às diligências já documentadas.',
  },
  {
    code: 'Q-CEB-PRF-009',
    board: 'Cebraspe',
    career: 'Policial',
    subject: 'Direito Penal',
    topic: 'Crimes contra a Administração Pública',
    organ: 'PRF',
    year: 2024,
    difficulty: 'Difícil',
    questionType: 'true_false',
    statement:
      'O agente público que exige vantagem indevida para deixar de lavrar auto de infração no exercício de sua função pratica o crime de corrupção passiva, consumando-se o delito somente com o efetivo recebimento da vantagem.',
    optionsJson: [
      { key: 'C', text: 'Certo' },
      { key: 'E', text: 'Errado' },
    ],
    correctOption: 'E',
    commentary:
      'Errado por dois motivos: (1) o verbo "exigir" configura o crime de concussão (art. 316, CP), e não corrupção passiva (solicitar/receber/aceitar promessa - art. 317); (2) a concussão é crime formal, consumando-se no momento da exigência, independentemente do recebimento efetivo da vantagem.',
  },
  {
    code: 'Q-CES-BB-010',
    board: 'Cesgranrio',
    career: 'Bancos',
    subject: 'Conhecimentos Bancários',
    topic: 'Sistema Financeiro Nacional',
    organ: 'Banco do Brasil',
    year: 2024,
    difficulty: 'Fácil',
    questionType: 'multiple_choice',
    statement:
      'No âmbito do Sistema Financeiro Nacional (SFN), o órgão normativo máximo responsável por formular a política da moeda e do crédito, fixando a meta de inflação e as diretrizes gerais de câmbio, é o:',
    optionsJson: [
      { key: 'A', text: 'Banco Central do Brasil (BCB).' },
      { key: 'B', text: 'Conselho Monetário Nacional (CMN).' },
      { key: 'C', text: 'Comissão de Valores Mobiliários (CVM).' },
      { key: 'D', text: 'Banco Nacional de Desenvolvimento Econômico e Social (BNDES).' },
      { key: 'E', text: 'Comitê de Política Monetária (COPOM).' },
    ],
    correctOption: 'B',
    commentary:
      'Gabarito: B. O Conselho Monetário Nacional (CMN) é o órgão normativo máximo do SFN (Lei nº 4.595/1964). Ele formula diretrizes e metas; o BCB e a CVM são entidades supervisoras/executoras que cumprem e fiscalizam as normas emanadas pelo CMN.',
  },
  {
    code: 'Q-CES-CEF-011',
    board: 'Cesgranrio',
    career: 'Bancos',
    subject: 'Conhecimentos Bancários',
    topic: 'Mercado de Capitais e PIX',
    organ: 'Caixa Econômica Federal',
    year: 2024,
    difficulty: 'Média',
    questionType: 'multiple_choice',
    statement:
      'No ecossistema de pagamentos instantâneos (Pix) regulado pelo Banco Central do Brasil, o Mecanismo Especial de Devolução (MED) permite:',
    optionsJson: [
      { key: 'A', text: 'O estorno unilateral imediato pelo pagador por simples arrependimento comercial em até 7 dias.' },
      { key: 'B', text: 'O bloqueio cautelar e eventual devolução de recursos pela instituição recebedora em casos de fundada suspeita de fraude ou falha operacional.' },
      { key: 'C', text: 'A transferência automática do prejuízo para a bandeira do cartão de crédito vinculado à conta.' },
      { key: 'D', text: 'A reversão exclusiva de transações agendadas antes da liquidação no SPI.' },
      { key: 'E', text: 'O cancelamento de chaves Pix aleatórias sem consentimento do titular.' },
    ],
    correctOption: 'B',
    commentary:
      'Gabarito: B. O Mecanismo Especial de Devolução (MED) foi criado pelo BCB para viabilizar o bloqueio cautelar e a devolução de valores em transações Pix nas quais haja fundada suspeita de fraude (como golpes) ou falha operacional no âmbito do participante.',
  },
  {
    code: 'Q-CEB-BBTI-012',
    board: 'Cebraspe',
    career: 'TI',
    subject: 'Informática e TI',
    topic: 'Banco de Dados Relacional e SQL',
    organ: 'Banco do Brasil — TI',
    year: 2025,
    difficulty: 'Média',
    questionType: 'multiple_choice',
    statement:
      'Em um banco de dados relacional, ao analisar o desempenho de consultas em uma tabela com milhões de registros de questões, um analista verifica a necessidade de garantir integridade transacional na qual todas as operações de um bloco ocorram por completo ou nenhuma delas seja persistida. Essa propriedade ACID corresponde à:',
    optionsJson: [
      { key: 'A', text: 'Consistência.' },
      { key: 'B', text: 'Isolamento.' },
      { key: 'C', text: 'Durabilidade.' },
      { key: 'D', text: 'Atomicidade.' },
      { key: 'E', text: 'Idempotência.' },
    ],
    correctOption: 'D',
    commentary:
      'Gabarito: D. Nas propriedades ACID (Atomicidade, Consistência, Isolamento e Durabilidade), a Atomicidade determina a regra do "tudo ou nada": se qualquer instrução da transação falhar, todo o conjunto sofre rollback.',
  },
  {
    code: 'Q-FGV-DATAPREV-013',
    board: 'FGV',
    career: 'TI',
    subject: 'Informática e TI',
    topic: 'Segurança da Informação e OWASP',
    organ: 'Dataprev',
    year: 2024,
    difficulty: 'Difícil',
    questionType: 'multiple_choice',
    statement:
      'Uma aplicação web recebe uma URL fornecida pelo usuário em um endpoint de importação e realiza uma requisição HTTP a partir do servidor backend sem validar se o endereço aponta para a rede interna (como 169.254.169.254 ou 127.0.0.1). Essa vulnerabilidade crítica listada no OWASP Top 10 é classificada como:',
    optionsJson: [
      { key: 'A', text: 'Cross-Site Request Forgery (CSRF).' },
      { key: 'B', text: 'Server-Side Request Forgery (SSRF).' },
      { key: 'C', text: 'Stored Cross-Site Scripting (XSS).' },
      { key: 'D', text: 'Broken Object Level Authorization (BOLA).' },
      { key: 'E', text: 'Insecure Deserialization.' },
    ],
    correctOption: 'B',
    commentary:
      'Gabarito: B. A falha Server-Side Request Forgery (SSRF) ocorre quando o servidor busca um recurso remoto usando uma URL controlada pelo usuário sem validação de esquema, lista de permissões (allowlist) e bloqueio de IPs privados/link-local.',
  },
  {
    code: 'Q-FGV-CNU-014',
    board: 'FGV',
    career: 'Administrativo',
    subject: 'Língua Portuguesa',
    topic: 'Interpretação de Texto e Coesão',
    organ: 'MGI — CNU',
    year: 2024,
    difficulty: 'Média',
    questionType: 'multiple_choice',
    statement:
      'Na frase "Embora o edital previsse prazo exíguo, os candidatos mantiveram a regularidade nos estudos", a oração subordinada introduzida pela conjunção "Embora" expressa valor semântico de:',
    optionsJson: [
      { key: 'A', text: 'Causa.' },
      { key: 'B', text: 'Condição.' },
      { key: 'C', text: 'Concessão.' },
      { key: 'D', text: 'Consequência.' },
      { key: 'E', text: 'Proporção.' },
    ],
    correctOption: 'C',
    commentary:
      'Gabarito: C. A conjunção "embora" (assim como "conquanto", "ainda que", "mesmo que") introduz oração subordinada adverbial concessiva, indicando um fato contrário ao esperado pela oração principal, mas incapaz de impedi-lo.',
  },
  {
    code: 'Q-FCC-TRF3-015',
    board: 'FCC',
    career: 'Tribunais',
    subject: 'Língua Portuguesa',
    topic: 'Regência Verbal e Crase',
    organ: 'TRF 3ª Região',
    year: 2024,
    difficulty: 'Média',
    questionType: 'multiple_choice',
    statement:
      'Assinale a alternativa em que o emprego do acento indicativo de crase está integralmente de acordo com a norma-padrão:',
    optionsJson: [
      { key: 'A', text: 'O parecer técnico foi encaminhado à Vossa Excelência na tarde de ontem.' },
      { key: 'B', text: 'O servidor dedicou-se à revisar todos os processos pendentes antes do recesso.' },
      { key: 'C', text: 'A resolução entra em vigor daqui à duas semanas, conforme publicado no diário.' },
      { key: 'D', text: 'As novas diretrizes atendem às recomendações expedidas pelo Conselho Nacional.' },
      { key: 'E', text: 'O candidato dirigiu-se à Brasília com antecedência para realizar a prova prática.' },
    ],
    correctOption: 'D',
    commentary:
      'Gabarito: D. O verbo "atender" (no sentido de observar/satisfazer) exige preposição "a" (atende a), que se funde com o artigo "as" de "recomendações", gerando "às". Nos demais casos: não há crase antes de pronomes de tratamento (A), verbos no infinitivo (B), distância futura indeterminada (C) ou topônimos sem artigo definido ("vou a Brasília, volto de Brasília") (E).',
  },
  {
    code: 'Q-VUN-TJSP-016',
    board: 'Vunesp',
    career: 'Administrativo',
    subject: 'Raciocínio Lógico',
    topic: 'Equivalências Lógicas',
    organ: 'TJ-SP',
    year: 2024,
    difficulty: 'Média',
    questionType: 'multiple_choice',
    statement:
      'Considere a proposição lógica composta: "Se o candidato estuda com revisões espaçadas, então ele fixa o conteúdo". Uma proposição logicamente equivalente a ela é:',
    optionsJson: [
      { key: 'A', text: 'Se o candidato fixa o conteúdo, então ele estuda com revisões espaçadas.' },
      { key: 'B', text: 'O candidato não estuda com revisões espaçadas ou ele fixa o conteúdo.' },
      { key: 'C', text: 'O candidato estuda com revisões espaçadas e não fixa o conteúdo.' },
      { key: 'D', text: 'Se o candidato não estuda com revisões espaçadas, então ele não fixa o conteúdo.' },
      { key: 'E', text: 'O candidato não estuda com revisões espaçadas e fixa o conteúdo.' },
    ],
    correctOption: 'B',
    commentary:
      'Gabarito: B. A condicional P → Q possui duas equivalências clássicas: a contrapositiva (~Q → ~P) e a disjunção (~P ∨ Q, conhecida como regra do "NEGA ou MANTÉM"). Negando P e mantendo Q obtemos: "O candidato não estuda com revisões espaçadas ou ele fixa o conteúdo".',
  },
  {
    code: 'Q-CEB-ANATEL-017',
    board: 'Cebraspe',
    career: 'Administrativo',
    subject: 'Direito Administrativo',
    topic: 'Lei nº 14.133/2021 — Licitações',
    organ: 'ANATEL',
    year: 2024,
    difficulty: 'Difícil',
    questionType: 'true_false',
    statement:
      'Na Nova Lei de Licitações e Contratos Administrativos (Lei nº 14.133/2021), a modalidade diálogo competitivo destina-se à contratação de obras, serviços e compras em que a Administração busca desenvolver soluções inovadoras que envolvam tecnologia ou inovação técnica, sendo dispensada a fase de divulgação de edital prévio.',
    optionsJson: [
      { key: 'C', text: 'Certo' },
      { key: 'E', text: 'Errado' },
    ],
    correctOption: 'E',
    commentary:
      'Errado. Embora o diálogo competitivo (art. 32 da Lei nº 14.133/2021) realmente se aplique a soluções que envolvam inovação tecnológica ou técnica e impossibilidade de definição prévia das especificações, NÃO há dispensa de edital: a Administração publica edital de pré-seleção com prazo mínimo de 25 dias úteis para manifestação de interesse dos licitantes.',
  },
  {
    code: 'Q-FGV-CGE-018',
    board: 'FGV',
    career: 'Administrativo',
    subject: 'Direito Administrativo',
    topic: 'Responsabilidade Civil do Estado',
    organ: 'CGE-SC',
    year: 2024,
    difficulty: 'Média',
    questionType: 'multiple_choice',
    statement:
      'Uma viatura oficial de órgão estadual colidiu com veículo particular em razão de falha mecânica súbita e falta de manutenção preventiva, causando danos materiais ao particular. Quanto à responsabilidade civil do Estado perante o terceiro prejudicado, aplica-se a teoria:',
    optionsJson: [
      { key: 'A', text: 'Subjetiva, devendo o particular comprovar dolo ou culpa do motorista.' },
      { key: 'B', text: 'Do risco integral, não admitindo nenhuma excludente de responsabilidade.' },
      { key: 'C', text: 'Objetiva, na modalidade risco administrativo, cabendo ao Estado eventual ação de regresso contra o agente se houver dolo ou culpa.' },
      { key: 'D', text: 'Da culpa anônima do serviço, excluindo a obrigação de indenizar caso não se identifique o motorista.' },
      { key: 'E', text: 'Contratual civil, submetida exclusivamente ao Código de Defesa do Consumidor.' },
    ],
    correctOption: 'C',
    commentary:
      'Gabarito: C. Conforme o art. 37, § 6º, da CF/88, as pessoas jurídicas de direito público respondem objetivamente pelos danos que seus agentes causarem a terceiros (teoria do risco administrativo), assegurado o direito de regresso contra o responsável nos casos de dolo ou culpa.',
  },
  {
    code: 'Q-FCC-TRT15-019',
    board: 'FCC',
    career: 'Tribunais',
    subject: 'Raciocínio Lógico',
    topic: 'Análise Combinatória e Probabilidade',
    organ: 'TRT 15ª Região',
    year: 2024,
    difficulty: 'Difícil',
    questionType: 'multiple_choice',
    statement:
      'Uma comissão julgadora será formada por 3 servidores escolhidos entre 5 analistas e 4 técnicos judiciários. Quantas comissões distintas podem ser formadas contendo pelo menos 2 analistas?',
    optionsJson: [
      { key: 'A', text: '40 comissões.' },
      { key: 'B', text: '50 comissões.' },
      { key: 'C', text: '60 comissões.' },
      { key: 'D', text: '74 comissões.' },
      { key: 'E', text: '84 comissões.' },
    ],
    correctOption: 'B',
    commentary:
      'Gabarito: B. "Pelo menos 2 analistas" admite dois casos: (1) 2 analistas e 1 técnico = C(5,2) × C(4,1) = 10 × 4 = 40; (2) 3 analistas e 0 técnicos = C(5,3) × C(4,0) = 10 × 1 = 10. Somando os casos: 40 + 10 = 50 comissões.',
  },
  {
    code: 'Q-CEB-STJ-020',
    board: 'Cebraspe',
    career: 'Tribunais',
    subject: 'Língua Portuguesa',
    topic: 'Pontuação e Sintaxe',
    organ: 'STJ',
    year: 2025,
    difficulty: 'Fácil',
    questionType: 'true_false',
    statement:
      'No período "Os relatórios técnicos que foram auditados pela comissão receberam parecer favorável", a inserção de vírgulas isolando a oração "que foram auditados pela comissão" manteria inalterado o sentido original do texto.',
    optionsJson: [
      { key: 'C', text: 'Certo' },
      { key: 'E', text: 'Errado' },
    ],
    correctOption: 'E',
    commentary:
      'Errado. Sem vírgulas, a oração adjetiva é restritiva (apenas os relatórios auditados receberam parecer favorável). Ao inserirmos vírgulas, ela passa a ser explicativa (todos os relatórios foram auditados e receberam parecer favorável), alterando substancialmente o sentido.',
  },
  {
    code: 'Q-CES-PETRO-021',
    board: 'Cesgranrio',
    career: 'TI',
    subject: 'Informática e TI',
    topic: 'Redes de Computadores e HTTP',
    organ: 'Petrobras — TI',
    year: 2024,
    difficulty: 'Fácil',
    questionType: 'multiple_choice',
    statement:
      'Em arquiteturas RESTful modernas, qual código de status HTTP indica adequadamente que a requisição do cliente foi autenticada com sucesso, mas o usuário não possui permissão (autorização) para acessar o recurso solicitado?',
    optionsJson: [
      { key: 'A', text: '400 Bad Request' },
      { key: 'B', text: '401 Unauthorized' },
      { key: 'C', text: '403 Forbidden' },
      { key: 'D', text: '404 Not Found' },
      { key: 'E', text: '429 Too Many Requests' },
    ],
    correctOption: 'C',
    commentary:
      'Gabarito: C. O código 401 indica falha ou ausência de autenticação (identidade desconhecida/token inválido). Já o código 403 Forbidden indica que a identidade é conhecida pelo servidor, mas não possui privilégios/autorização para executar aquela operação.',
  },
  {
    code: 'Q-FGV-TCM-022',
    board: 'FGV',
    career: 'Fiscal',
    subject: 'Contabilidade Pública',
    topic: 'Variações Patrimoniais',
    organ: 'TCM-SP',
    year: 2024,
    difficulty: 'Média',
    questionType: 'multiple_choice',
    statement:
      'Sob a ótica da Contabilidade Aplicada ao Setor Público (enfoque patrimonial), o recebimento de dívida ativa inscrita anteriormente em ativo realizável constitui um fato contábil:',
    optionsJson: [
      { key: 'A', text: 'Modificativo aumentativo, pois amplia o patrimônio líquido.' },
      { key: 'B', text: 'Modificativo diminutivo, pois reduz o saldo de créditos a receber.' },
      { key: 'C', text: 'Permutativo, pois troca um direito (crédito de dívida ativa) por disponibilidade de caixa.' },
      { key: 'D', text: 'Misto aumentativo com impacto negativo no resultado patrimonial.' },
      { key: 'E', text: 'Extraorçamentário sem registro patrimonial.' },
    ],
    correctOption: 'C',
    commentary:
      'Gabarito: C. Embora orçamentariamente seja receita orçamentária efetivada na arrecadação, sob o enfoque patrimonial o direito já havia sido reconhecido quando do fato gerador/inscrição. Logo, o recebimento apenas permuta o ativo "Créditos a Receber" pelo ativo "Caixa e Equivalentes", sem alterar o Patrimônio Líquido.',
  },
  {
    code: 'Q-VUN-PM-023',
    board: 'Vunesp',
    career: 'Policial',
    subject: 'Direito Constitucional',
    topic: 'Segurança Pública (Art. 144)',
    organ: 'PM-SP',
    year: 2024,
    difficulty: 'Fácil',
    questionType: 'multiple_choice',
    statement:
      'Nos termos do art. 144 da Constituição Federal, às polícias civis, dirigidas por delegados de polícia de carreira, incumbem, ressalvada a competência da União:',
    optionsJson: [
      { key: 'A', text: 'O policiamento ostensivo e a preservação da ordem pública.' },
      { key: 'B', text: 'As funções de polícia judiciária e a apuração de infrações penais, exceto as militares.' },
      { key: 'C', text: 'O patrulhamento ostensivo das rodovias federais e estaduais.' },
      { key: 'D', text: 'A segurança dos estabelecimentos penais estaduais exclusivamente.' },
      { key: 'E', text: 'A execução das atividades de defesa civil em casos de calamidade.' },
    ],
    correctOption: 'B',
    commentary:
      'Gabarito: B. Conforme o art. 144, § 4º, CF/88, às polícias civis cabem as funções de polícia judiciária e a apuração de infrações penais, exceto as militares. O policiamento ostensivo e preservação da ordem pública competem às polícias militares (§ 5º).',
  },
  {
    code: 'Q-FCC-BACEN-024',
    board: 'FCC',
    career: 'Bancos',
    subject: 'Conhecimentos Bancários',
    topic: 'Lavagem de Dinheiro (Lei nº 9.613/1998)',
    organ: 'Banco Central / Instituições',
    year: 2024,
    difficulty: 'Difícil',
    questionType: 'multiple_choice',
    statement:
      'No processo clássico de prevenção à lavagem de dinheiro (PLD/FT), a etapa em que os recursos ilícitos já foram distanciados da origem criminosa e retornam à economia formal com aparência de licitude (como na compra de imóveis ou investimentos estruturados) denomina-se:',
    optionsJson: [
      { key: 'A', text: 'Colocação (Placement).' },
      { key: 'B', text: 'Ocultação ou Estratificação (Layering).' },
      { key: 'C', text: 'Integração (Integration).' },
      { key: 'D', text: 'Fracionamento (Smurfing).' },
      { key: 'E', text: 'Compensação Bancária.' },
    ],
    correctOption: 'C',
    commentary:
      'Gabarito: C. As três fases da lavagem de dinheiro são: 1) Colocação (inserção inicial no sistema financeiro); 2) Ocultação/Estratificação (movimentações complexas para dificultar o rastreamento); e 3) Integração (incorporação formal à economia com aparência legítima).',
  },
];
