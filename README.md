# Atlas Vivo (Next.js App Router)

Demonstra rotas paralelas (`@panel`) e interceptadas (`(..)location`), com mapa gerado por código, zoom e arrastar.

## Recursos

- Mapa procedural por semente (`seed` em `app/map/page.tsx`)
- Rios que nascem nas montanhas e chegam à costa
- Regiões com polígonos (`data/regions.json`) e nomes que aparecem ao dar zoom
- Editor de regiões: desenhe vértices no mapa, conclua e exporte `regions.json`
- Agrupamento de marcadores ao afastar o zoom
- Destaque e zoom automático no local aberto
- Busca por nome e filtro por região
- Ícones por tipo de local
- Painel com tags e conexões entre locais
- Camadas: liga e desliga florestas, lagos, rios, montanhas e regiões
- Modo editor: clique para adicionar, arraste para mover, duplo clique para renomear
- Exportar PNG do terreno e JSON dos locais
- Histórico de eventos por local, com status (`destruido`, `abandonado`) que apaga o marcador na linha do tempo
- Copiar link: guarda posição, zoom, ano da linha do tempo e camadas ocultas na URL (`/map?x=&y=&z=&t=&l=`)
- Tour: percorre os locais em ordem cronológica (avança sozinho a cada 6 s; pausar, voltar, pular)
- Som ambiente por região (vento, montanha, ondas, floresta), gerado por código: sem arquivos de áudio. Segue o local aberto ou o centro da tela
- Temas dia e noite (botão **🌙 Noite / ☀ Dia**), com efeitos próprios e preferência salva no navegador
- Esc fecha o painel
- Painel vira gaveta no celular
- Galeria de mapas antigos (`/mapas-antigos`): mapas famosos da China, do Japão, da Coreia, da Europa, do mundo islâmico e dos Descobrimentos, com menu hambúrguer de categorias e visualizador com zoom

## Temas

O botão **Noite / Dia** troca o tema do mapa e do painel (a escolha fica salva no navegador e é aplicada antes da primeira pintura, sem piscar).

- **Dia:** sol com brilho, sombras de nuvens atravessando o mapa, pássaros, rios com água correndo e cintilar nos lagos.
- **Noite:** mapa em azul escuro, lua crescente, estrelas piscando sobre o mar, vaga-lumes perto das florestas, marcadores acesos como lanternas e reflexo da lua nos lagos.

Os efeitos ficam em `components/ThemeFx.tsx` e `ThemeFx.module.scss` (só SVG e CSS, sem bibliotecas). Quem usa "reduzir movimento" no sistema vê a versão sem animação. O PNG exportado leva a cor do tema, mas sem os efeitos animados.

## Editor

As alterações do editor ficam salvas no navegador (localStorage) e voltam ao recarregar. Use **Desfazer** (ou Ctrl+Z) para voltar um passo e **Descartar edições** para limpar tudo. Para tornar as mudanças definitivas, clique em **Exportar JSON** e substitua `data/locations.json`.

O PNG exporta o terreno e os nomes das regiões, sem os marcadores.

## Regiões

Cada região em `data/regions.json` tem `id`, `name`, `color` e `points` (lista de `[x, y]` em %). No editor, clique em **Desenhar região**, marque os vértices no mapa e clique em **Concluir região**. No modo editor, o painel "Regiões" permite mostrar os **vértices** de uma região para arrastá-los, adicionar vértice (`+ vértice` insere um ponto na aresta mais longa) e remover um vértice (Delete com o ponto focado). Também permite renomear (o nome também é atualizado nos locais da região), trocar a cor e apagar. Use **Exportar regiões** e substitua `data/regions.json` para tornar definitivo.

## Sons

O botão **Som** liga o som ambiente (o navegador só permite áudio depois de um clique). Cada região em `data/regions.json` pode ter `"sound"`: `vento`, `montanha`, `ondas` ou `floresta`. No editor, cada região tem um seletor de som. Os sons são sintetizados com a Web Audio API, então não há arquivos para baixar.

## Editar locais

Edite `data/locations.json`. Campos: `id`, `name`, `region`, `type` (`vila`, `torre`, `porto`, `ruina`, `fortaleza`, `santuario`, `floresta`), `description`, `x`/`y` (em %), `tags`, `links` e, opcionalmente, `image`.

## Mapas antigos

Os mapas ficam em `data/old-maps.json`. Cada item tem `category` (`china`, `japao`, `coreia`, `europa`, `islamico`, `descobrimentos`), `year`, `place`, `description`, `sourceUrl` e, opcionalmente, `wiki`: o título do artigo da Wikipédia cuja imagem principal é usada (a imagem vem da Wikimedia em tempo de execução, sem arquivos no repositório). Sem `wiki`, o cartão mostra um espaço reservado e o link do acervo. Para criar uma categoria nova, acrescente-a em `lib/oldMaps.ts`.

## Rotas

- `/map`: mapa com painel
- `/mapas-antigos`: galeria de mapas históricos
- `/location/[id]`: acesso direto, página completa

## Rodar

    npm install
    npm run build
    npm run dev

Abra http://localhost:3000/map

## Publicar na Vercel

1. Rode `npm install` e `npm run build` localmente para confirmar que tudo compila.
2. Suba a pasta para o GitHub (o `.gitignore` já exclui `node_modules` e `.next`):

       git init
       git add .
       git commit -m "atlas vivo"
       git branch -M main
       git remote add origin https://github.com/SEU_USUARIO/atlas-vivo.git
       git push -u origin main

3. Em vercel.com/new, importe o repositório e clique em **Deploy**. O Next.js é detectado sozinho e não precisa de configuração extra.
4. O mapa fica em `https://SEU-PROJETO.vercel.app/map`.

Para atualizar o site, faça `git push`: a Vercel publica de novo automaticamente.

Edições do editor, visitas e notas ficam no navegador de cada visitante. Para mudar o conteúdo do site para todos, substitua `data/locations.json` e `data/regions.json` e faça `git push`.
