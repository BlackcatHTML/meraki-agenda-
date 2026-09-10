# Meraki

App pessoal de operação diária, feito pra viver no iPhone como se fosse
app nativo. HTML, CSS e JavaScript puros — sem build, sem framework, sem login.
Os dados ficam no próprio aparelho (`localStorage`).

**Abas:** Hoje · Tarefas · Produção · Clientes · Equipe · Links
(Notas fica no ícone do canto superior direito.)
E, dentro de Clientes, uma ficha por cliente com dados, tarefas, links e conteúdos.

---

## 1. Colocar no ar (Netlify)

### Caminho rápido — arrastar a pasta

1. Abra <https://app.netlify.com/drop>
2. Arraste a pasta **`meraki`** inteira pra dentro da página.
3. Em segundos ele devolve um endereço tipo `https://algo-aleatorio.netlify.app`.
4. Em **Site configuration › Change site name**, troque pra algo que você lembre,
   por exemplo `meraki`. O endereço vira `https://meraki.netlify.app`.

Pronto. É HTTPS de verdade, que é o que o push exige.

### Caminho com Git (recomendado se for mexer no app depois)

1. Suba a pasta pra um repositório no GitHub.
2. No Netlify: **Add new site › Import an existing project › GitHub** e escolha o repo.
3. Build command: **deixe vazio**. Publish directory: **`.`** (o `netlify.toml` já diz isso).
4. Deploy. A partir daí, todo `git push` atualiza o site sozinho.

### Para atualizar depois

- Arrastar de novo em `app.netlify.com/drop` cria um site **novo**. Pra atualizar o
  mesmo site, entre nele e use **Deploys › Drag and drop your site folder here**.
- O app tem service worker (cache offline), mas o código vai na rede primeiro:
  depois de um deploy, feche e reabra o app e a versão nova já entra. Confira em
  **Notas › Versão**, no rodapé.

---

## 2. Instalar no iPhone

> Esse passo não é opcional. **Sem instalar na tela de início, o iPhone não recebe
> notificação nenhuma.** É limitação da Apple, não do app.

1. Abra o endereço do Netlify **no Safari** (não funciona no Chrome do iPhone).
2. Toque no botão de **Compartilhar** (o quadradinho com a seta pra cima).
3. Role e toque em **Adicionar à Tela de Início**.
4. Confirme. O ícone do Meraki aparece na tela.
5. **Abra sempre pelo ícone.** Aberto pelo Safari, é só um site: sem push.

Requisitos: iOS 16.4 ou mais novo (o seu já é). No Android é igual, pelo Chrome:
menu **⋮ › Instalar aplicativo**.

---

## 3. Notificações push (OneSignal)

O app já vem com o código pronto. Falta só criar a conta e colar o App ID.

### 3.1 Criar o app no OneSignal

1. Crie a conta grátis em <https://onesignal.com> e faça login.
2. **New App/Website**. Nome: `Meraki`.
3. Plataforma: escolha **Web**.
4. Integração: escolha **Custom Code** (não "Typical Site" — o SDK já está embutido aqui).
5. Preencha:
   - **Site Name**: `Meraki`
   - **Site URL**: exatamente o endereço do Netlify, com `https://` e **sem barra no
     final** — ex.: `https://meraki.netlify.app`
   - **Auto Resubscribe**: ligado
   - **Default Icon URL**: `https://SEU-SITE.netlify.app/icons/icon-192.png`
   - **"My site is not fully HTTPS"**: deixe **desligado**
6. Salve. Na tela seguinte ele mostra um bloco de código e o **App ID**
   (um código tipo `1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d`).
   **Copie o App ID.** O bloco de código você pode ignorar — já está no app.
7. Se ele pedir o arquivo `OneSignalSDKWorker.js`, ignore também: já está na raiz
   do projeto e o Netlify já o serve.

### 3.2 Ligar o App ID no app

Duas formas, use a que preferir:

- **Pelo celular:** abra o app › ícone de **Notas** (canto superior direito) › cole o App ID no campo
  *OneSignal App ID* › **Salvar App ID e recarregar**.
- **Pelo arquivo:** abra `js/config.js` e coloque o código entre as aspas:
  ```js
  ONESIGNAL_APP_ID: "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
  ```
  Depois suba de novo pro Netlify.

### 3.3 Ativar no aparelho

1. Abra o app **pelo ícone da tela de início**.
2. Toque no ícone de **Notas**, no canto superior direito › **Ativar notificações**.
3. O iPhone pergunta se permite. Toque em **Permitir**.
4. A bolinha ao lado tem que ficar verde: *"Conectado — este aparelho recebe push"*.

Se ficar vermelho dizendo que a permissão foi negada, não dá pra perguntar de novo
pelo app: vá em **Ajustes do iPhone › Notificações › Meraki** e libere lá.

### 3.4 Criar os lembretes recorrentes

É aqui que mora a graça: o agendamento fica no painel do OneSignal, você não precisa
manter servidor nenhum.

1. No painel do OneSignal, abra **Messages › Push › New Push**.
2. **Audience**: *Subscribed Users* (é só o seu aparelho mesmo).
3. **Message**: escreva o texto, ex.:
   - Título: `Cobrança de sexta`
   - Mensagem: `Cobrar as edições do Victor`
4. **Delivery / Schedule**: escolha enviar em data e hora específicas, e marque a
   opção de **repetição** (aparece como *Recurring* / *Repeat*). Configure
   *toda sexta, 10:00*, e confira se o fuso está em **America/Sao_Paulo**.
5. **Launch URL** (opcional, mas vale): `https://SEU-SITE.netlify.app/#/hoje` —
   assim o toque na notificação abre o app já na tela certa.
6. Salve.

Repita pra cada lembrete fixo. Sugestões pra começar:

| Quando | Mensagem |
|---|---|
| Segunda, 09:00 | Cobrar o relatório de tráfego do Joe |
| Sexta, 10:00 | Cobrar as edições do Victor |
| Domingo, 19:00 | Fechar a produção da semana que vem |
| Todo dia, 08:30 | Abrir o Meraki e ver o que tem hoje |

> Se a sua conta não mostrar a opção de repetir dentro do compositor de push, use
> **Messages › Automated** e crie a mesma mensagem como campanha recorrente. O
> resultado é o mesmo; o menu muda de lugar conforme a versão do painel.

### 3.5 Testar

No OneSignal, **Messages › New Push › Send to Test Device**, ou simplesmente agende
uma mensagem pra dali a 2 minutos. Feche o app completamente antes — a graça é
justamente chegar com o app fechado.

---

## 4. Salvar links do TikTok e do Instagram

Cada link salvo vai pra "pasta" de um cliente e aparece tanto na aba **Links** quanto
dentro da ficha daquele cliente.

### No Android — funciona direto

Depois de instalar o app, ele aparece na lista de compartilhamento do sistema.
No TikTok/Instagram: **Compartilhar › Meraki**. O app abre com o link já
preenchido, você só escolhe o cliente e salva.

### No iPhone — precisa de um Atalho (uma vez só)

O Safari do iPhone não deixa um app web aparecer no menu de compartilhar. A volta é
criar um Atalho da Apple, que faz exatamente a mesma coisa e leva 2 minutos:

1. Abra o app **Atalhos** › toque em **+** (novo atalho).
2. Toque no ícone de informação **(i)** › ligue **Mostrar na Folha de Partilha**.
3. Ainda em (i), em *Tipos de entrada*, deixe marcado **URLs** (pode desmarcar o resto).
4. Volte e adicione a ação **Texto**. No campo do texto, escreva:
   ```
   https://SEU-SITE.netlify.app/?url=
   ```
   e, logo depois do `=`, sem espaço, insira a variável **Entrada do Atalho**
   (toque no campo, aparece a barra de variáveis).
5. Adicione a ação **Abrir URLs** e ligue nela o resultado do Texto.
6. Renomeie o atalho pra **Salvar no Meraki** e escolha um ícone.
7. Pronto. Agora, em qualquer vídeo do TikTok ou Instagram:
   **Compartilhar › Salvar no Meraki**. O app abre com o link preenchido.

### Sem atalho nenhum

Copie o link no TikTok/Instagram, abra o app na aba **Links** e toque em
**Colar link copiado**. Ele lê o que está copiado e já preenche.

---

## 5. Como o app decide o status de cada cliente

Os números são seus: no card de cada cliente tem três contadores com **−** e **+**
(Semana, Prontos, Agendados). Toca e muda, sem abrir formulário nenhum. O mês fica
na barra de baixo do card e se edita em **Editar**.

A partir desses números:

- **Sem conteúdo pra semana** — falta vídeo pra fechar a semana
  (`feitos na semana < necessários na semana`) **e** não há nada agendado.
- **Precisa de novo roteiro** — o estoque está baixo: menos de 2 vídeos prontos.
- **OK** — a semana está coberta ou tem coisa agendada, e há estoque.

A lista já vem ordenada por urgência: primeiro quem está pior, depois quem tem o
maior buraco na semana, depois no mês, depois quem tem menos estoque.

---

## 6. Equipe — o que você cobra de cada um

Cada pessoa que te entrega alguma coisa (o Joe do tráfego, o Victor da edição,
quem entrar depois) fica cadastrada na aba **Equipe**, com nome, função e anotações.

Dentro da ficha de cada um você cria **cobranças**: o que precisa receber, de qual
cliente, e até quando. Cada cobrança tem três botões:

- **Cobrei hoje** — registra a data. O app passa a mostrar *"cobrei 3x · última ter 08/09"*
  e marca quantas vezes você cobrou **na semana passada**, que é o que costuma sumir da cabeça.
- **Entregou** — abre um campo pra guardar o número (leads, vídeos, posts) e o que
  foi conversado. É aqui que entra *"como foi o tráfego da Lume essa semana"*.
- **Furou** — separa numa seção "Não entregou", pra ficar registrado.

O que passou do prazo aparece em vermelho, com quantos dias de atraso, e sobe pro topo.

**Vinculado ao cliente:** se a cobrança tem uma empresa, ela aparece nos dois lugares —
na ficha da pessoa e na ficha da empresa, na seção *Equipe neste cliente*. Então dá pra
abrir a Clínica Lume e ver tudo que o Joe já entregou (e não entregou) por ela.

> O bloco de relatório de tráfego que ficava solto na Produção da semana saiu de lá.
> Virou cobrança do Joe, com cliente vinculado. Se você já tinha preenchido alguma
> coisa lá, ela foi convertida sozinha na primeira abertura — nada se perdeu.

---

## 7. Backup

Os dados vivem só nesse aparelho. Se você trocar de celular ou limpar os dados do
Safari, some tudo.

- **Notas › Exportar backup (.json)** baixa um arquivo com tudo.
- **Notas › Importar backup** devolve.

Vale exportar uma vez por mês e jogar no seu Drive.

---

## 8. O que é cada arquivo

```
meraki/
├── index.html              estrutura, meta tags de PWA e navegação
├── manifest.json           nome, ícones, standalone, share target
├── sw.js                   service worker (quando não há OneSignal)
├── sw-cache.js             o cache offline em si (usado pelos dois workers)
├── OneSignalSDKWorker.js   worker do push — precisa ficar na raiz
├── netlify.toml            publish + headers de cache
├── css/app.css             todo o visual
├── img/                    marca d’água do fundo
├── js/config.js            onde vai o App ID do OneSignal
├── js/store.js             dados, datas, regras de status
├── js/push.js              integração com o OneSignal
├── js/app.js               telas e interações
└── icons/                  ícones 192, 512, maskable e o do iPhone
```

**Paleta:** prata `#CFD0D4` e `#9A9BA1` sobre vinho quase preto `#14080A`.
cherry dark `#42121F` · near black `#1C0B12`.
**Tipografia:** Space Grotesk (títulos) + IBM Plex Sans (texto) + IBM Plex Mono (rótulos).

---

## 9. Se algo der errado

| Sintoma | Causa quase sempre |
|---|---|
| Não chega notificação no iPhone | Abriu pelo Safari em vez do ícone da tela de início |
| Botão "Ativar notificações" não aparece | App ID não foi salvo, ou a permissão já foi negada nos Ajustes |
| Mudei o app e o celular mostra o antigo | Service worker segurando a versão. Feche o app de vez e reabra |
| "OneSignal não respondeu" | App ID digitado errado, ou a *Site URL* no OneSignal não bate com a do Netlify |
| Compartilhar do TikTok não mostra o app (iPhone) | Falta o Atalho do item 4 — o iOS não suporta compartilhar direto pra app web |
