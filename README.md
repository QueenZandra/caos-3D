# 🐾 Caos em Casa: A Saga dos Pets

Co-op caótico **3D** estilo Overcooked!, para **2–4 jogadores locais**, rodando no
navegador com **Babylon.js + TypeScript + Vite** e física **Havok**.

> Os donos saíram. Os pets — Sirius, Belatriz, Minerva e Zoe — viram heróis e
> espalham o caos pela casa. Esta é a **fatia vertical** do jogo: uma fase
> completa e jogável de ponta a ponta, com toda a arquitetura base pronta para
> as demais fases do GDD.

## ▶️ Como rodar

```bash
npm install
npm run dev      # abre em http://localhost:5173
```

Build de produção:

```bash
npm run build    # gera /dist (pronto para deploy estático)
npm run preview  # serve o build localmente
```

> O binário WASM do Havok é copiado automaticamente para `public/` pelos scripts
> `predev`/`prebuild` (`scripts/copy-havok.mjs`).

## 🎮 Controles

| Ação              | Teclado P1 | Teclado P2 | Gamepad            |
| ----------------- | ---------- | ---------- | ------------------ |
| Mover             | WASD       | Setas      | Analógico esquerdo |
| Interagir / Pegar | Espaço     | Enter      | Botão Sul (× / A)  |
| Habilidade        | E          | Shift dir. | Botão Oeste (□ / X)|
| Largar            | Q          | Ctrl dir.  | Botão Leste (○ / B)|
| Ação conjunta     | F          | /          | Botão Norte (△ / Y)|
| Pausar            | Esc        | Esc        | Start              |

- **P1 e P2** podem jogar no mesmo teclado. **P3 e P4** precisam de gamepad.
- Tipo de gamepad (PlayStation / Xbox / genérico) é detectado pelo `id` do dispositivo.

## 🕹️ O que já está jogável

Fluxo completo: **Menu → Quantidade de jogadores → Seleção de personagens → Fase 1 → Resultado**.

**Fase 1 — "O Carteiro do Mal"**: o carteiro joga cartas pela porta (física real:
elas deslizam e se acumulam). Pegue as cartas e leve até a lixeira (zona verde)
antes do tempo acabar. Mais de 10 cartas no chão = *slowzone* (todos ficam lentos).

Os 4 pets com habilidades funcionais:

| Pet         | Habilidade        | Efeito                                                       |
| ----------- | ----------------- | ------------------------------------------------------------ |
| 🐕 Sirius   | Latido Poderoso   | Onda que atordoa o carteiro num raio de 3 (pausa o envio).   |
| 🐕 Belatriz | Corrida Veloz     | Velocidade 2× por 3s e carrega **2** cartas ao mesmo tempo.  |
| 🐱 Minerva  | Escalar           | Impulso vertical + onda de empurrão.                         |
| 🐱 Zoe      | Furtividade       | Fica semi-transparente; ao voltar, solta onda de susto.      |

Dificuldade adaptativa (`DifficultyScaler`): com menos jogadores, menos cartas,
mais tempo e objetivo menor. Estrelas (⭐–⭐⭐⭐) por tempo restante e bagunça.

**Fase 2 — "Os Pássaros Abusados"**: pássaros voam até pontos de ninho e os
constroem em **3 estágios** (gravetos → forrado → ovos = permanente). Destrua os
ninhos em construção (interagir por perto) antes que **5** fiquem permanentes;
meta: destruir **8**. Ninhos **altos** (em arbustos altos) só os **gatos**
(Minerva/Zoe) alcançam — divisão de papéis co-op. O pássaro-mãe **mergulha** e
atordoa quem chega perto; o **Latido do Sirius** assusta e faz os pássaros
abandonarem os ninhos. Twist: um **urubu gigante** pousa e exige **2 pets juntos**
para ser expulso.

As fases são encadeadas: ao vencer, a tela de resultado oferece **➡️ Próxima fase**.

**Split-view**: afaste os pets pela casa e a tela se divide automaticamente em
duas, cada metade seguindo um grupo; ao se reaproximarem, volta a ser única.

## 🏗️ Arquitetura

```
src/
  main.ts                  Bootstrap (engine, loading, GameManager)
  systems/
    GameManager.ts         Máquina de estados + loop de render
    InputManager.ts        Teclado + Gamepad API (edges, deadzone, detecção)
    PhysicsSystem.ts       Inicialização do Havok (WASM)
    CameraSystem.ts        Câmera isométrica que segue o centroide dos pets
  entities/
    Player.ts              Classe base (placeholder primitivo + física + habilidade)
    Sirius/Belatriz/Minerva/Zoe.ts   Habilidades específicas
    createPlayer.ts        Fábrica por personagem
    Mailman.ts             Carteiro (spawner atordoável)
  objects/
    Letter.ts              Carta com física (free → carried → destroyed)
  scenes/
    MenuScene / PlayerCountScene / CharSelectScene / Phase1Scene / ResultScene
    menuHelpers.ts         Fundo animado + lista de menu navegável
  ui/
    HUD.ts                 Timer, objetivo, cooldowns, barra de caos, textos flutuantes
  utils/
    Constants / CharacterData / GameConfig / Visual
```

### Decisões de implementação

- **Modelos GLB com fallback**: o `Player` separa collider (cápsula física invisível)
  de visual (`visualRoot`). No início, mostra um **placeholder primitivo**; em paralelo,
  `loadModel()` tenta carregar o `.glb` do personagem e, se existir, o substitui
  (auto-escala + animações `idle`/`walk` do Mixamo + sombras). Se o arquivo não existir,
  segue com o placeholder — nada quebra. Toda a lógica de gameplay é indiferente a qual
  visual está em uso.
- **Toon shading** via `StandardMaterial` (cor chapada + emissive) e `renderOutline`
  nativo do Babylon, evitando dependências extras.
- **Câmera**: isométrica fixa seguindo o centroide, com zoom-out conforme os pets se
  afastam. **Split-view automático**: quando os pets se separam (espalhamento > 11
  unidades, com histerese para voltar < 8) a tela divide em duas viewports, cada
  uma seguindo um grupo de pets próximos (clusterização pelo par mais distante).
  Uma câmera de UI dedicada (via `layerMask`) garante que o HUD renderize uma única
  vez em tela cheia, sem duplicar nas viewports.

## 🗺️ Próximos passos (roadmap do GDD)

- [x] Pipeline de carregamento de **modelos GLB** com fallback automático para placeholders
      (`src/utils/AssetLoader.ts`). Basta dropar os `.glb` em `public/assets/models/characters/`
      — ver `public/assets/README.md` para nomes e como gerar a partir das fotos.
- [ ] Gerar de fato os 4 modelos a partir das fotos dos pets (Meshy.ai → Blender → Mixamo)
      — referências e prompts prontos em `public/assets/models/characters/*.reference.md`.
- [x] Split-view automático no `CameraSystem` quando os pets se separam.
- [x] **Fase 2 "Os Pássaros Abusados"** (ninhos em 3 estágios, gating de gatos, urubu).
- [ ] Fases 3–8 reaproveitando os mesmos sistemas (cada uma é uma nova `*.Scene.ts`).
- [ ] Polish da Fase 2: navegação vertical real para ninhos altos (subir no arbusto),
      câmera dramática na entrada do urubu, pathfinding de voo mais orgânico.
- [ ] `DestructionTracker` persistido em `localStorage` para alimentar a Fase 8.
- [ ] Áudio (latido, miado, SFX) e cutscenes (`CinematicScene`).

## 🚀 Deploy

`npm run build` gera `/dist` estático (inclui o `HavokPhysics.wasm`). Publique em
Netlify, Vercel ou GitHub Pages. Em servidores que exigem, configure o
`Content-Type: application/wasm` para o `.wasm`.
