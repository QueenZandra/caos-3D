# 🐾 Caos em Casa: A Saga dos Pets

Co-op caótico **3D** estilo Overcooked!, para **2–4 jogadores locais**, rodando no
navegador com **Babylon.js + TypeScript + Vite** e física **Havok**.

> Os donos saíram. Os pets — Sirius, Belatriz, Minerva e Zoe — viram heróis e
> espalham o caos pela casa. **Campanha completa: as 8 fases do GDD**, jogáveis de
> ponta a ponta (Menu → seleção → fases encadeadas → final), com **progressão
> salva**, **áudio procedural**, **pets procedurais** e pipeline pronto para os
> modelos GLB reais dos pets.

## ▶️ Como rodar

```bash
npm install
npm run dev      # abre em http://localhost:5173
```

Build de produção:

```bash
npm run build    # tsc --noEmit + gera /dist (pronto para deploy estático)
npm run preview  # serve o build localmente
```

Qualidade / DX:

```bash
npm run typecheck     # tsc --noEmit
npm test              # Vitest (lógica pura: Progress, DifficultyScaler)
npm run lint          # ESLint (flat config + typescript-eslint)
npm run format        # Prettier --write em src
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
| Mudo (áudio)      | M          | M          | —                  |

- **P1 e P2** podem jogar no mesmo teclado. **P3 e P4** precisam de gamepad.
- Tipo de gamepad (PlayStation / Xbox / genérico) é detectado pelo `id` do dispositivo.
- **Pausa real**: Esc/Start abre o menu de pausa (Retomar / Reiniciar fase / Menu),
  congelando física e lógica enquanto aberto.

## 🕹️ Campanha (8 fases)

Fluxo: **Menu → (Continuar / Selecionar fase) → Quantidade de jogadores → Seleção
de pets → Fase → Resultado**. Ao vencer, o resultado oferece **➡️ Próxima fase**,
até o **🏆 final**, e o progresso fica salvo (ver [Progressão](#-progressão)).

**Fase 1 — "O Carteiro do Mal"**: o carteiro joga cartas pela porta (física real:
elas deslizam e se acumulam). Pegue as cartas e leve até a lixeira (zona verde)
antes do tempo acabar. Mais de 10 cartas no chão = *slowzone* (todos ficam lentos).

**Fase 2 — "Os Pássaros Abusados"**: pássaros voam até pontos de ninho e os
constroem em **3 estágios** (gravetos → forrado → ovos = permanente). Destrua os
ninhos em construção (interagir por perto) antes que **5** fiquem permanentes;
meta: destruir **8**. Ninhos **altos** (em arbustos altos) só os **gatos**
(Minerva/Zoe) alcançam — divisão de papéis co-op. O pássaro-mãe **mergulha** e
atordoa quem chega perto; o **Latido do Sirius** assusta e faz os pássaros
abandonarem os ninhos. Twist: um **urubu gigante** pousa e exige **2 pets juntos**
para ser expulso.

**Fase 3 — "A Rebelião das Almofadas"**: 24 almofadas com **rigidbody** espalhadas
pela sala; rajadas de **vento** periódicas as empurram. Um **puff gigante** ganha
vida e **persegue o pet mais próximo** — quando encosta numa almofada desprotegida,
ela é destruída. Leve as almofadas para a **zona segura** (a cama) e mantenha pelo
menos **12 intactas** por **120s**. A câmera **treme** quando o puff bate nas
paredes; o **Latido do Sirius repele** o puff. Derrota: cair abaixo de 12 intactas.

**Fase 4 — "O Roubo Épico da Cozinha"**: 15 comidas empilhadas em bancadas altas.
A **cascata de queda é física real** (Havok) — tire a de baixo e as de cima
despencam; quem cai no chão **quebra** (preview em vermelho avisa quais vão cair).
**Gatos** (Minerva/Zoe) sobem nas bancadas; **cães** precisam de **boost** — fique
ao lado de outro pet e use a **ação conjunta (△/Y)**. Entregue as comidas no
**prato**. Meta: 10 comidas com no máximo **5 quebradas**.

**Fase 5 — "O Vizinho Invasor"**: invasores entram por **vários pontos** do muro e
avançam para a **casa**. Expulse-os chegando perto e **interagindo** (o **Latido do
Sirius** expulsa vários de uma vez); os "durões" precisam de 2 acertos. Uma
**galinha perdida** corre pelo quintal e atordoa quem ela encosta. O **Gato Gigante
(boss)** exige **2 pets juntos** por ~1,5s para ser expulso. Meta: expulsar 20 com
menos de **3** entrando na casa. (O split-view ajuda a cobrir pontos distantes.)

**Fase 6 — "A Moto do Terror"**: a moto cruza a rua repetidamente. Corra até uma
das **5 janelas** da fachada e faça **barulho** (interagir = latir/miar) para encher
a **barra de barulho** antes da moto passar — barra cheia = moto afugentada. O
**Latido do Sirius** enche rápido. A câmera **treme** a cada passagem. Meta:
afugentar **15** em 2 minutos, terminando com a **carreata final em V** (5 motos).

**Fase 7 — "Caos Total"**: vários sistemas ao mesmo tempo — cartas se acumulando,
invasores indo ao **núcleo** e o **puff gigante** perseguindo os pets. Um **medidor
de caos** sobe enquanto há bagunça e cai quando você limpa; se chegar a 100%, você
perde. **Sobreviva 3 minutos**. Tem **radar/minimapa** no HUD e, nos últimos 30s,
o **sprint final** com a tela pulsando em vermelho e spawns acelerados.

**Fase 8 — "Operação Perdão"**: os donos chegaram com **raiva** (duas barras). Leve
cada pet ao dono certo e use a **ação fofa** (interagir) para reduzir a raiva —
**Sirius** é eficaz com o Dono 1, **Belatriz** com o Dono 2, **Minerva** com ambos,
**Zoe** dá um golpe único forte. Quando todos fazem fofura juntos, dispara o
**SUPER FOFO** 💖. Zere as duas barras em 90s → **abraço com confetes**.

## 🐶 Personagens e habilidades

| Pet         | Habilidade        | Efeito                                                       |
| ----------- | ----------------- | ------------------------------------------------------------ |
| 🐕 Sirius   | Latido Poderoso   | Onda sonora 3D que atordoa inimigos num raio de 3.           |
| 🐕 Belatriz | Corrida Veloz     | Velocidade 2× por 3s e carrega **2** objetos ao mesmo tempo. |
| 🐱 Minerva  | Escalar           | Impulso vertical + onda de empurrão (alcança lugares altos). |
| 🐱 Zoe      | Furtividade       | Fica semi-transparente; ao voltar, solta onda de susto.      |

Dificuldade adaptativa (`DifficultyScaler`): com menos jogadores, menos objetivo,
mais tempo e spawns mais lentos. Estrelas (⭐–⭐⭐⭐) por desempenho (tempo restante
e bagunça).

## 💾 Progressão

O avanço é **salvo em `localStorage`** (`src/utils/Progress.ts`):

- **Melhores estrelas por fase** e a **fase mais avançada desbloqueada**.
- No menu, o botão vira **"▶ Continuar (Fase N)"** quando há progresso.
- **🗺️ Selecionar fase**: grade 4×2 mostrando **🔒** nas bloqueadas e **⭐** nas
  vencidas; fases abrem conforme você vence as anteriores.
- Tolerante a dados ausentes/corrompidos e a `localStorage` indisponível (segue
  em memória). Há `Progress.reset()` pronto para um futuro botão de "zerar".

## 🔊 Áudio

Tudo é **sintetizado em runtime** com a **Web Audio API** (`src/systems/AudioManager.ts`)
— sem arquivos de áudio para licenciar/baixar, funciona offline:

- **SFX**: latido, miado, whoosh, pegar, entregar, quebrar, susto/stun, navegação
  de UI e fanfarra de vitória / som de derrota.
- **Duas trilhas em loop** (menu calmo, gameplay animado) com *scheduler* lookahead
  pelo relógio do `AudioContext`.
- **Ambiência por fase**: um *drone* contínuo + eventos aleatórios (pássaros na F2,
  buzinas na F6, talheres na F4, galinha na F5, brisa, carrilhão…), num bus próprio.
- **Ducking**: a música abaixa sob as fanfarras de vitória/derrota e volta sozinha.
- Destrava no 1º gesto do usuário (exigência dos navegadores); **M** alterna o mudo.
- **⚙️ Opções** (no menu): volumes de **geral / música / efeitos** e mudo,
  ajustáveis com ← →, tudo persistido em `localStorage`.

## 🎨 Visual e modelos

- **Pets procedurais** (`src/entities/PetModel.ts`): cada personagem é montado de
  primitivas em estilo chibi (cachorro x gata, cor do pelo, orelhas, cauda,
  acessórios), reconhecível tanto em jogo quanto nos menus.
- **Pipeline de GLB com fallback** (`src/utils/AssetLoader.ts`): o `Player` separa
  o collider (cápsula física invisível) do visual (`visualRoot`). `loadModel()`
  tenta carregar o `.glb` do personagem e, se existir, **substitui o pet procedural**
  (auto-escala + animações `idle`/`walk` do Mixamo + sombras). Se não existir, segue
  com o procedural — nada quebra, e a lógica de gameplay é indiferente ao visual.
- **Toon shading** via `StandardMaterial` (cor chapada + emissive) e `renderOutline`
  nativo do Babylon, sem dependências extras.

## 🏗️ Arquitetura

```
src/
  main.ts                  Bootstrap (engine, loading, GameManager)
  systems/
    GameManager.ts         Máquina de estados + loop de render + pausa
    InputManager.ts        Teclado + Gamepad API (edges, deadzone, detecção)
    PhysicsSystem.ts       Inicialização do Havok (WASM)
    CameraSystem.ts        Câmera isométrica que segue o centroide + split-view
    AudioManager.ts        SFX e trilhas procedurais (Web Audio API)
  entities/
    Player.ts              Classe base (visual + física + habilidade)
    PetModel.ts            Modelo procedural chibi por personagem
    Sirius/Belatriz/Minerva/Zoe.ts   Habilidades específicas
    createPlayer.ts        Fábrica por personagem
    Mailman / Bird / Invader / Motorcycle / GiantPuff   Inimigos e obstáculos
  objects/
    Letter / Cushion / Food / Nest   Objetos interativos com física
  scenes/
    MenuScene / PlayerCountScene / CharSelectScene / PhaseSelectScene
    Phase1..Phase8Scene / ResultScene
    SceneController.ts     Contrato comum de cena
    menuHelpers.ts         Fundo animado (pets procedurais) + lista de menu
  ui/
    HUD.ts                 Timer, objetivo, cooldowns, caos, radar, textos flutuantes
    PauseMenu.ts           Overlay de pausa (reusa a MenuList)
  utils/
    Constants / CharacterData / GameConfig / Progress / AssetLoader / Visual
```

### Decisões de implementação

- **Pausa real, centralizada no `GameManager`**: Esc/Start alterna a pausa; enquanto
  aberta, a física (`setTimeStep(0)`) e as animações da cena são congeladas e o loop
  de gameplay é pulado. O `PauseMenu` reusa a `MenuList` e renderiza só pela câmera
  de UI (não duplica no split-view).
- **Câmera**: isométrica seguindo o centroide, com zoom-out conforme os pets se
  afastam. **Split-view automático**: quando os pets se separam (espalhamento > 11
  unidades, com histerese para voltar < 8) a tela divide em duas viewports, cada uma
  seguindo um grupo (clusterização pelo par mais distante). Uma câmera de UI dedicada
  (via `layerMask`) garante o HUD renderizado uma única vez em tela cheia.
- **Áudio e modelos procedurais** evitam dependências de assets externos (ver seções
  acima).

## 🗺️ Roadmap

Feito:

- [x] **Campanha completa**: 8 fases encadeadas (Menu → seleção → fases → final).
- [x] Pipeline de **modelos GLB** com fallback automático (`AssetLoader`).
- [x] **Pets procedurais** (`PetModel`) em jogo e nos menus.
- [x] **Split-view automático** no `CameraSystem`.
- [x] **Áudio procedural** (SFX + 2 trilhas, mudo no M).
- [x] **Pausa real** (Retomar / Reiniciar / Menu), congelando física e lógica.
- [x] **Progressão salva** em `localStorage` (estrelas + seleção/desbloqueio de fases).
- [x] **Opções de volume** (geral/música/efeitos + mudo), persistidas.
- [x] **Passos** dos pets (ritmo conforme a velocidade) e **ducking** da música nas fanfarras.
- [x] **Ambiente sonoro por fase** (pássaros, rua, cozinha, brisa, galinha…).
- [x] **Higiene técnica**: testes (Vitest), ESLint/Prettier e *code-splitting* (Babylon/GUI/jogo).

Pendente / a aprimorar:

- [ ] Gerar de fato os 4 modelos a partir das fotos dos pets (Meshy.ai → Blender →
      Mixamo) — referências e prompts em `public/assets/models/characters/*.reference.md`.
- [ ] **Tutorial/onboarding** e **cutscenes** (`CinematicScene`).
- [ ] Polish da Fase 2: navegação vertical real para ninhos altos, câmera dramática
      na entrada do urubu, voo mais orgânico.
- [ ] **Controles de toque** (mobile) e acessibilidade (remapeamento, reduzir
      shake/flash, daltonismo).
- [ ] Ampliar a cobertura de **testes** (hoje cobre Progress e DifficultyScaler).

## 🚀 Deploy

`npm run build` gera `/dist` estático (inclui o `HavokPhysics.wasm`). Publique em
Netlify, Vercel ou GitHub Pages. Em servidores que exigem, configure o
`Content-Type: application/wasm` para o `.wasm`.
