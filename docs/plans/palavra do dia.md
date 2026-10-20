# PRD — Palavra do Dia

**Status:** rascunho consolidado para implementação do MVP
**Versão:** 1.0  
**Última atualização:** 13/10/2026  
**Design de referência:** conceito Lúdico do protótipo  
**Plataforma:** web responsiva, mobile-first

## 1. Resumo do produto

Palavra do Dia é um jogo casual em português brasileiro no qual a pessoa tenta descobrir uma palavra comum de cinco letras em até seis tentativas. Depois de cada tentativa válida, o jogo mostra quais letras estão na resposta e se estão na posição correta. Há um desafio novo a cada dia; não é necessário criar conta.

O MVP prioriza uma primeira partida fácil de entender, uma regra de feedback justa e uma experiência agradável em celular. Não inclui pistas, modo ilimitado, compartilhamento, estatísticas, sequências de dias ou monetização.

## 2. Problema e oportunidade

Pessoas que procuram um passatempo breve de palavras precisam compreender rapidamente como jogar e sentir que o resultado de cada tentativa é consistente. Regras de acentuação confusas, palavras obscuras, respostas que parecem injustas, interface difícil de usar no celular ou a obrigação de criar uma conta podem impedir a conclusão da primeira partida.

Oportunidade: oferecer um desafio diário simples, acolhedor e focado no português brasileiro, com vocabulário curado, feedback claro e acesso imediato pela web.

## 3. Público e contexto de uso

- **Público inicial:** adultos e jovens adultos.
- **Idioma e variante:** português do Brasil (pt-BR).
- **Contexto:** sessões curtas, principalmente em celular, acessadas pelo navegador; desktop também deve ser compatível.
- **Necessidade principal:** entender as regras sem tutorial longo e conseguir jogar sem cadastro.
- O MVP não é direcionado especificamente a crianças; caso o público seja ampliado a crianças, revisar conteúdo, privacidade e políticas aplicáveis antes do lançamento.

## 4. Objetivos e critérios de sucesso

### Objetivo principal

As pessoas entendem as regras e concluem a primeira partida.

### Sinais de sucesso a validar

1. Em teste de usabilidade, participantes conseguem explicar o que significam os três estados das letras depois de ler as instruções da tela.
2. Participantes conseguem inserir uma palavra, interpretar o resultado e continuar a rodada sem ajuda do moderador.
3. Participantes conseguem completar o fluxo da primeira partida, por vitória ou pelo uso das seis tentativas, sem bloqueio de interface.
4. Palavras de resposta e palpites são percebidos como familiares e linguisticamente justos.

Metas numéricas de conclusão, retorno ou satisfação serão definidas depois de testes com protótipo. Não presumir que mais sessões, streaks ou tempo de uso sejam sinônimos de sucesso.

## 5. Não objetivos do MVP

- Partidas ilimitadas, arquivo de desafios ou seleção de dificuldade.
- Pistas, dicas progressivas ou ajuda paga.
- Contas, perfis, sincronização entre dispositivos ou ranking.
- Sequência de dias jogados (streaks) ou painel de estatísticas.
- Compartilhamento do resultado.
- Anúncios, assinatura, compras ou patrocínio.
- Conteúdo criado pelos jogadores.
- Suporte a pt-PT ou outras variantes do português no lançamento inicial.
- Aplicativo nativo; o produto inicial é web responsiva.

## 6. Loop principal

1. A pessoa abre o jogo e vê a instrução, o desafio do dia e o tabuleiro.
2. Digita uma palavra de cinco letras usando teclado virtual ou físico.
3. Envia a tentativa.
4. Se aceita, o jogo avalia letra e posição e atualiza o tabuleiro e o teclado.
5. A pessoa continua até descobrir a palavra ou atingir seis tentativas.
6. Ao encerrar, o jogo informa o resultado e revela a resposta correta.
7. O progresso fica salvo no dispositivo para poder retomar a partida no mesmo dia.

## 7. Requisitos funcionais

### P0 — obrigatórios no MVP

| ID | Requisito | Critério de aceite |
|---|---|---|
| FR-01 | Exibir um desafio diário de cinco letras e até seis tentativas. | A tela apresenta o desafio corrente, tabuleiro com seis linhas e instrução antes da primeira tentativa. |
| FR-02 | Permitir entrada por teclado físico e teclado virtual. | Ambas as formas escrevem no mesmo palpite; envio e apagar funcionam em desktop e celular. |
| FR-03 | Aceitar como palpite qualquer palavra válida de cinco letras pt-BR segundo o vocabulário selecionado, mesmo que não possa ser resposta diária. | Um termo válido que não esteja na lista de respostas é aceito; uma palavra inválida é rejeitada sem gastar tentativa. |
| FR-04 | Normalizar acentos para comparar palpites com a resposta. | Formas com ou sem acento comparam de acordo com a política; tentativas comuns sem acento são aceitas. Respostas cuja normalização cause colisão de significados são excluídas do calendário. |
| FR-05 | Mostrar feedback para cada letra. | Cada letra é identificada como correta na posição certa, presente em outra posição ou ausente; o resultado não depende apenas da cor. |
| FR-06 | Tratar letras repetidas com contagem correta. | Uma letra duplicada no palpite não é marcada como presente mais vezes do que ocorre na resposta; letras certas na posição são consideradas antes das demais. |
| FR-07 | Encerrar a partida ao acertar ou após a sexta tentativa aceita. | Vitória encerra imediatamente; seis erros encerram a partida e revelam a resposta com a grafia oficial. |
| FR-08 | Não contar palpites incompletos ou rejeitados. | Entrada com menos de cinco letras ou fora do vocabulário não consome uma das seis tentativas e recebe mensagem clara. |
| FR-09 | Salvar e restaurar o progresso local do desafio atual. | Atualizar ou reabrir a página no mesmo dispositivo restaura palpites aceitos, feedback e estado final; um novo puzzle não mistura o progresso anterior com o atual. |
| FR-10 | Manter o jogo acessível sem conta. | Nenhuma etapa de cadastro ou login impede abrir ou concluir a partida. |
| FR-11 | Apresentar o conceito visual Lúdico como direção principal. | Tema escuro, cartões arredondados, acento amarelo e estados visualmente distintos; contraste e foco atendem aos critérios de acessibilidade deste PRD. |
| FR-12 | Comunicar falhas de serviço sem perder uma tentativa. | Em falha de rede, o palpite continua disponível e o jogador pode tentar novamente; nenhuma jogada é consumida até confirmação do serviço. |

### P1 — desejáveis se couberem sem comprometer P0

- Estado de carregamento e estado de indisponibilidade diária bem definidos.
- Mensagem discreta confirmando que o progresso é salvo neste dispositivo.
- Entrada inicial guiada por exemplo curto, se testes mostrarem que as instruções estáticas não bastam.

Qualquer item P1 que aumente o escopo além do MVP deve ser reavaliado antes de implementação.

## 8. Regras do jogo

### Resposta diária

- Uma resposta por dia, com cinco letras após normalização.
- A lista de respostas é pré-aprovada e usada pelo sistema automaticamente no calendário.
- Respostas devem ser palavras comuns de pt-BR; não usar nomes próprios nem termos raros.
- Evitar resposta que fique ambígua quando acentos são ignorados (por exemplo, colisões entre grafias que se tornam iguais após normalização).
- Cada resposta deve ter grafia editorial armazenada para revelação correta ao final.
- Revisão editorial, fonte lexical, licença, calendário inicial, fuso e hora de troca precisam ser definidos antes do lançamento.

### Palpites

- Cinco letras após a normalização.
- Qualquer palavra válida de pt-BR segundo o vocabulário aceito pode ser tentada, mesmo que não pertença ao conjunto de respostas.
- Palpite incompleto ou não reconhecido recebe mensagem e não consome tentativa.
- A lista de palpites aceitos e a lista de respostas diárias têm escopos diferentes.
- A política específica para `Ç`, flexões, regionalismos, empréstimos, variantes ortográficas e caracteres permitidos deve ser documentada junto ao vocabulário antes de sua importação.

### Feedback e fim da partida

- **Correta e na posição certa:** estado correto, identificado por símbolo/texto.
- **Presente em outra posição:** estado presente, identificado por símbolo/texto.
- **Não aparece na resposta:** estado ausente, identificado por símbolo/texto.
- Avaliar primeiro letras exatas e depois as ocorrências restantes, para tratar corretamente letras repetidas.
- Mensagens de conclusão propostas:
  - Vitória: “Boa! Você encontrou a palavra.”
  - Derrota: “Fim de jogo. A palavra era: {palavra}.”
- A resposta não é revelada antes da vitória ou do fim das seis tentativas.

## 9. Experiência, conteúdo e interface

- Entrada rápida, sem cadastro e sem onboarding obrigatório em várias etapas.
- Instrução inicial proposta: **“Adivinhe a palavra de 5 letras em até 6 tentativas.”**
- Instrução sobre acentos proposta: **“Acentos não fazem diferença: você pode digitar sem acento.”**
- Legenda persistente explica os três resultados com cor, símbolo e texto.
- O tabuleiro, entrada e teclado formam uma ordem visual clara; em telas estreitas, o layout empilha conteúdo e mantém as cinco casas lado a lado.
- O protótipo demonstra `LIMÃO` como resposta fixa, mas ainda não implementa o vocabulário nem o calendário de produção.
- A seleção automatizada do desafio diário usa somente uma lista revisada e pré-aprovada; não escolher respostas aleatórias de uma fonte sem revisão.

## 10. Requisitos não funcionais

### Acessibilidade

- Meta: WCAG 2.2 AA nos fluxos principais.
- Operável por teclado, com foco sempre visível e sem captura global de letras quando outro controle tem foco.
- Campo de entrada com rótulo acessível, suporte a teclado virtual e físico, e autocorreção desativada.
- Mudanças de estado anunciadas por leitor de tela sem anunciar individualmente cada célula atualizada.
- Nome acessível para cada estado da letra; cor sozinha não comunica informação.
- Contraste de texto mínimo de 4,5:1 para texto normal e de 3:1 para texto grande, elementos gráficos e estados aplicáveis da interface.
- Alvos interativos confortáveis para toque (meta de 44 × 44 CSS px, consideradas as exceções previstas na WCAG).
- Funcionar em largura de 320 CSS px, zoom de 200%, texto ampliado e com preferência por movimento reduzido.
- Validar manualmente com teclado e tecnologias assistivas além de ferramenta automatizada.

### Compatibilidade e desempenho

- Web responsiva, mobile-first, compatível com navegadores atuais de celular e desktop definidos no plano de lançamento.
- Não depender de fonte, analytics, anúncio ou SDK remoto para iniciar uma partida.
- Carregamento do jogo deve priorizar HTML, CSS e lógica necessários ao primeiro palpite; meta de desempenho e navegadores mínimos serão definidos antes da publicação.
- Partida utilizável em rede móvel instável; falha de rede não deve consumir tentativa.

### Privacidade e segurança

- Nenhuma conta ou dado de perfil no MVP.
- Progresso salvo no dispositivo; comunicar que a persistência é local e não sincroniza entre dispositivos.
- Não incluir publicidade, analytics identificável ou SDKs de terceiros no MVP.
- Se for necessário um serviço para validar tentativas sem expor antecipadamente a resposta, armazenar apenas estado de jogo anônimo pelo período necessário para retomar a partida e definir retenção mínima.
- Revisar obrigações legais e privacidade aplicáveis ao lançamento antes de qualquer coleta adicional de dados.

## 11. Métricas de produto

### Métrica norte inicial

**Conclusão da primeira partida compreendida** — participantes que conseguem descrever o significado do feedback e chegar a um resultado sem ajuda, em teste de usabilidade.

### Instrumentação a considerar

No primeiro ciclo, medir por observação de testes e feedback voluntário, sem analytics identificável. Se for necessário telemetria de produto depois, definir minimização, consentimento, retenção e agregação antes de instrumentar.

Eventos agregados candidatos a futura validação:

- jogo carregado;
- primeira tentativa aceita;
- partida concluída;
- erro de vocabulário;
- falha técnica que impediu uma tentativa.

Retenção diária, número de partidas, streaks e compartilhamentos não são métricas de sucesso do MVP definido.

## 12. Dependências e riscos

| Risco/dependência | Consequência | Mitigação/decisão |
|---|---|---|
| Vocabulário pt-BR não escolhido ou sem licença adequada | Palpites válidos contestáveis ou impossibilidade de distribuir a lista | Selecionar fonte/licença; revisão e validação antes de importar. |
| Acentos ignorados criam colisão semântica | Jogador pode considerar a solução injusta | Excluir respostas ambíguas após normalização e revisar calendário. |
| `Ç` e variantes não têm regra fechada | Palpites aceitos de forma inconsistente | Aprovar política para letras e normalização antes de criar dicionário. |
| Fuso e hora do desafio ainda não definidos | Usuários podem ver datas diferentes ou trocar no meio da partida | Definir calendário e fonte de tempo oficial antes do lançamento. |
| Estado só no armazenamento local | Perda ao limpar dados ou trocar dispositivo | Comunicar limitação claramente; sincronização não faz parte do MVP. |
| Resposta embarcada no cliente | Pessoa pode inspecionar o pacote e revelar a palavra | Se a resposta deve ficar oculta até o fim, validar palpites no serviço; caso contrário, classificar versão estática como protótipo não competitivo. |
| Tema Lúdico tem contraste insuficiente em certos estados | Texto ou feedback pode ser difícil de perceber | Testar cada par de cores, símbolos, foco e estado desabilitado; ajustar paleta sem abandonar direção. |
| Vocabulário ou resposta contestada | Frustração e perda de confiança | Fluxo de revisão, histórico de publicação e procedimento de correção. |

## 13. Decisões em aberto

Estas decisões não anulam o escopo já acordado, mas precisam ser resolvidas antes do lançamento ou da implementação do componente dependente:

1. Qual fonte lexical e licença serão usadas para palpites válidos?
2. Qual será a política de `Ç`, flexões, regionalismos, estrangeirismos, variantes e palavras ofensivas?
3. Qual fuso horário e horário determinam a troca diária?
4. Como será mantido o estado anônimo no servidor, caso seja escolhida validação remota para ocultar a resposta?
5. Qual infraestrutura será usada e qual custo operacional é aceitável?
6. Quais navegadores e versões mínimas serão suportados?
7. Quais metas numéricas serão definidas depois dos primeiros testes de usabilidade?

## 14. Fora do escopo desta versão

Este PRD define produto e critérios de aceite, não fecha fornecedor técnico. A proposta de arquitetura, API, esquema de persistência e plano de implementação está em [Projeto técnico](../projeto-tecnico.md).
