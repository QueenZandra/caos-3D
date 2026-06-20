# 📦 Assets do jogo

Arquivos aqui são servidos estaticamente (URL base `/assets/...`). O jogo carrega
modelos via `src/utils/AssetLoader.ts` (`MODELS_BASE = /assets/models/`).

## Modelos de personagens (GLB)

Coloque os modelos com **exatamente** estes nomes:

```
public/assets/models/characters/
  sirius.glb      🐕 Sirius   (cachorro, capa vermelha)
  belatriz.glb    🐕 Belatriz (cachorra veloz)
  minerva.glb     🐱 Minerva  (gata, lenço de aventureira)
  zoe.glb         🐱 Zoe      (gata furtiva)
```

> Enquanto o arquivo não existir, o jogo usa automaticamente o **placeholder
> primitivo** (cápsula colorida). Assim que o `.glb` for adicionado, ele
> substitui o placeholder — sem mudar nenhum código.

### Requisitos do modelo

- **Formato:** `.glb` (glTF binário), riggado, em T-pose.
- **Escala:** qualquer — o jogo auto-escala para ~2 unidades de altura. O ponto
  de origem deve ficar nos **pés** do personagem (padrão Mixamo).
- **Animações (opcional, recomendado):** `AnimationGroup`s nomeados contendo
  `idle` e `walk`/`run` (case-insensitive). O jogo toca `idle` parado e
  `walk` ao se mover. Sem animações, o modelo aparece estático (tudo bem).
- **Polígonos:** 2.000–5.000 tris (otimizado para navegador).

## Como gerar a partir das fotos (Passo 8 do GDD)

1. **Image-to-3D:** suba a foto do pet no [Meshy.ai](https://www.meshy.ai) ou
   [Tripo3D](https://www.tripo3d.ai) com o prompt do GDD (estilo cartoon low-poly,
   toon shading, proporção chibi).
2. **Refino:** ajuste no Blender, exporte como `.glb`.
3. **Animações:** suba o `.glb` no [Mixamo](https://www.mixamo.com), baixe `Idle`,
   `Walking`, `Running`; mescle no Blender (NLA Editor) e exporte um `.glb` único
   com os `AnimationGroup`s.
4. Salve com o nome correto na pasta acima.

## Outras pastas (para fases futuras)

```
public/assets/models/enemies/      mailman.glb, bird.glb, ...
public/assets/models/props/        carta.glb, almofada.glb, ...
public/assets/models/environments/ sala.glb, quintal.glb, ...
public/assets/audio/               music/, sfx/
```
