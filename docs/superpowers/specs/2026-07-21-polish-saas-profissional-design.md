# Polish "SaaS Profissional" — Fluidez e Microinterações (Design)

## Contexto

Pedido do usuário: elevar a experiência do BuildFlow ao nível de fluidez/polimento de produtos
como Linear, Notion, Spotify, Google Workspace e Microsoft Fluent — "gerar dopamina e prazer ao
navegar". Decisões confirmadas antes de desenhar:

- **Mantém a personalidade visual construída até aqui** (blueprint, marcadores tipo "KM
  420+150", cor `signal` única) — não vira um SaaS genérico. A meta é elevar o *polimento*
  (motion, feedback, estados intermediários), não trocar a identidade.
- **Sem paleta de comandos (Cmd+K)** por agora — o perfil de campo usa tablet/celular, não teclado
  desktop; fica pra uma iniciativa futura se fizer sentido pro perfil gerente/escritório.
- **Um design doc cobrindo a visão inteira, implementação em ondas** (múltiplos planos
  sequenciais) — mesmo padrão usado na conclusão do Field OS.

## O que cada referência faz de melhor (base do estudo)

| Produto | Mecanismo concreto (não estética solta) |
|---|---|
| Linear | Motion com propósito e consistente (nunca gratuita); paleta reduzida a 1 acento usado com disciplina; UI otimista (reage antes do servidor confirmar) |
| Notion | Reduz ruído escondendo ações secundárias até hover/foco; espaçamento generoso; tudo edita inline |
| Spotify | Contraste tipográfico forte (número grande vs. legenda pequena); microinterações de hover com transform sutil |
| Google (Material) / Microsoft (Fluent) | Sistema de elevação consistente (sombra como linguagem); grid de espaçamento rígido; skeleton loaders em vez de spinner genérico |

## Arquitetura

Um design, decomposto em **4 ondas de implementação independentes**, cada uma um plano próprio,
executadas em sequência (mesma convenção da conclusão do Field OS):

```
Onda 1 (fundação)     → Tokens de motion + microinterações de hover/press em Button/Card +
                          skeleton loaders (componente já existe em components/ui/skeleton.tsx,
                          criado mas nunca adotado — barato de ativar)
Onda 2 (redução de ruído) → Empty states com mais intenção (ícone + hierarquia + CTA) nos
                          empty states "de página" + ações secundárias hover-reveal
Onda 3 (feedback)     → Sistema de notificação (toast) + momento de "dopamina" na conclusão do RDO
Onda 4 (arquitetural, mais arriscada) → UI otimista num mutation piloto de baixo risco +
                          transição de página (View Transitions API, se a versão instalada do
                          react-router-dom suportar de forma estável — a confirmar na hora do plano)
```

Cada onda entrega algo funcional e testável por si só; a ordem reflete risco crescente (Onda 1 é
puro CSS/componente, Onda 4 mexe em fluxo de dados).

---

## Onda 1 — Fundação: motion tokens + skeleton loaders

### Tokens de motion

Hoje `transition-colors`/`hover:-translate-y-px` aparecem soltos (ex: só na `LoginPage`). Cria
tokens em `app.css` (mesma convenção dos tokens de cor/radius já existentes):

```css
--duration-fast: 120ms;
--duration-base: 200ms;
--ease-out: cubic-bezier(0.16, 1, 0.3, 1); /* mesma curva "emphasized" que dá a sensação Linear */
```

Aplicado de forma consistente em:
- **Botões**: `hover:-translate-y-px active:scale-[0.98] active:translate-y-0` — feedback de
  press além do hover (nenhum botão do app tem feedback de "clicado" hoje).
- **Cards clicáveis** (linhas de lista, células do calendário): mesmo tratamento sutil de
  elevação no hover, já existe em alguns lugares (`hover:bg-surface`), fica consistente em todos.

### Skeleton loaders

`frontend/src/components/ui/skeleton.tsx` já existe (`animate-pulse` + `bg-primary/10`) mas nunca
foi exportado no barrel nem usado — hoje todo loading é `<Spinner label="..."/>` (spinner + texto,
7 páginas usam esse padrão). Substitui por composições de skeleton que imitam a forma real do
conteúdo (linhas pro Dashboard, grade pro calendário, etc.) — sensação de "quase pronto" em vez de
"espera genérica", como Linear/Notion/LinkedIn fazem.

**Fora de escopo desta onda**: não redesenha empty states nem adiciona toast — só motion base +
loading.

---

## Onda 2 — Redução de ruído visual

### Empty states com mais intenção

Hoje `EmptyState` é só texto cinza centralizado, usado em 8 lugares. Nem todos merecem o mesmo
peso: **empty states de página** (ex: "Nenhum projeto ainda" na `ProjetosListPage`, "Nenhum
projeto ativo" no Dashboard) ganham ícone + título + descrição + CTA clara. **Empty states
inline/secundários** (ex: "Nenhuma meta cadastrada" dentro de uma aba de Configurações já ativa,
"Nenhuma foto anexada" num detalhe) mantêm o tratamento leve atual — não é todo vazio que precisa
virar um momento (princípio de restrição já aplicado no piloto do Dashboard).

### Ações secundárias hover-reveal

O botão de editar projeto (`ProjetosListPage`, ícone de lápis) fica sempre visível hoje — vira
oculto por padrão, aparece no hover/foco do card (Notion: esconder o que não é a ação principal
reduz ruído). Mesma lógica avaliada pra outros lugares com ação secundária, mas escopo real
definido na hora do plano (esse é o único caso confirmado hoje).

---

## Onda 3 — Sistema de feedback

### Toast/notificação

Hoje não existe nenhum sistema de toast — erros aparecem como `Alert` inline (mantém, é o padrão
certo pra erro de formulário) mas sucesso de ações não tem feedback nenhum além da navegação
silenciosa. Adiciona um sistema de toast leve (Radix Toast, mesmo padrão dos outros primitivos já
adotados via shadcn) pra confirmações de sucesso.

### Momento de "dopamina" na conclusão do RDO

Salvar um RDO é o momento central e mais repetido do produto (uso diário). Hoje: salva e navega
direto pro detalhe, sem nenhum reconhecimento do momento. Ganha uma confirmação visual breve usando
o próprio vocabulário do produto (o motivo `[✓]` já usado na seção de isolamento multitenant do
login) antes/durante a navegação — reforço positivo genuíno, não um confete genérico.

---

## Onda 4 — Arquitetural (maior risco, por último)

### UI otimista num mutation piloto

TanStack Query já suporta isso nativamente (`onMutate`/`onError` com rollback). Prioridade de
segurança sobre velocidade: escolhe **um** mutation de baixo risco como piloto — candidato natural
é "criar disciplina"/"criar equipe" em Configurações (list-append simples, sem sub-recursos
aninhados) — não o wizard de RDO (múltiplos sub-recursos, criação real só deveria refletir na UI
depois de confirmada, dado o volume de dados por registro). Item otimista aparece com indicação
visual clara de "salvando" (nunca finge que já é dado confirmado do servidor) e é revertido com
mensagem clara em caso de erro.

### Transição de página

View Transitions API (nativa no Chrome/Edge) pra transições suaves entre rotas. A viabilidade via
`react-router-dom` (versão instalada: `^7.18.1`) precisa ser confirmada na hora de escrever o
plano — a API exata de integração pode ter mudado entre versões; se não for estável na versão
instalada, essa peça específica fica documentada como não-implementada nesta rodada, sem bloquear
o resto da onda.

---

## Fora de escopo (todas as ondas)

- Paleta de comandos (Cmd+K) — decisão explícita do usuário, fica pra iniciativa futura.
- Redesign de paleta de cores ou tipografia — a identidade visual já auditada/ajustada nas rodadas
  anteriores permanece.
- Extensão da identidade visual (blueprint/mono-caps) pras telas que ainda não receberam —
  iniciativa separada, já registrada como pendência.
- Animações elaboradas de scroll/parallax (fora do escopo de um app de produtividade de uso
  diário — a LoginPage já usa isso com moderação onde faz sentido, não se estende às telas de
  trabalho).

## Testes

Convenção já estabelecida: E2E (Playwright) é a única camada de teste. Cada onda cobre:
- Onda 1: skeleton aparece durante `isLoading`, some quando os dados chegam (mesma asserção que
  hoje verifica o `Spinner`, só troca o seletor).
- Onda 2: empty state redesenhado ainda contém o texto/link que os testes já verificam; hover-reveal
  testado via `hover()` do Playwright antes de clicar no botão de editar.
- Onda 3: toast aparece após uma mutação de sucesso e some sozinho (ou é dispensável).
- Onda 4: UI otimista testada simulando uma resposta de erro do servidor (mock `route.fulfill`
  com erro) e confirmando que o item otimista é revertido com mensagem clara.
