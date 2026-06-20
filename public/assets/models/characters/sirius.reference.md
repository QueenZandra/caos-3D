# 🐕 Sirius — referência de modelo 3D

> Arquivo final esperado nesta pasta: **`sirius.glb`** (riggado, com animações
> `idle` e `walk`/`run`). Enquanto não existir, o jogo usa o placeholder.

## Aparência real (das fotos de referência)

- Cão de porte médio, **pelagem preta** longa e sedosa (leves reflexos
  castanho-avermelhados ao sol, na cauda e orelhas).
- **Cauda em plumacho** bem fofa e levantada; **franjas** nas pernas e peito.
- **Orelhas** semi-caídas e emplumadas (uma às vezes perta para cima).
- **Focinho levemente grisalho** (fios brancos) — cão adulto/maduro; nariz preto.
- **Olhos castanhos** quentes e amigáveis; expressão alegre, língua de fora.

## Identidade no jogo (GDD)

- Papel: **herói corajoso, líder da turma**. Habilidade "Latido Poderoso".
- Acessório: **capa vermelha** de herói.
- Cor de UI/identidade: **teal `#06D6A0`** (usada só na interface; o pelo é preto).
- Proporção **chibi** (cabeça grande ~1:2 cabeça/corpo), estilo Overcooked!.

## Prompt para Meshy.ai / Tripo3D (image-to-3D)

> Suba **uma foto nítida de corpo inteiro** do Sirius (a da praia, de perfil, é
> ótima para captar a forma da cauda e das franjas) junto com este prompt:

```
3D cartoon dog character based on this photo reference, named Sirius.
Preserve from the photo: long silky BLACK fur, fluffy plumed curved tail,
feathered legs and chest, semi-floppy feathered ears (one slightly perked),
slightly graying muzzle with white whiskers, warm brown friendly eyes.
Style: low-poly stylized, thick painted outlines, flat cel/toon shading,
Overcooked! / animated-movie look. Heroic happy expression.
Wearing a small RED hero cape on the back.
Chibi proportion (big head ~1:2 head-to-body), cute and brave.
Output: GLB/glTF, rigged, T-pose, 2000-4000 tris, UV-mapped.
```

## Animações (Mixamo, após gerar o modelo)

1. Suba o `.glb` em [mixamo.com](https://www.mixamo.com).
2. Baixe: **Idle**, **Walking**, **Running** (e opcional **Jump**/**Flair**).
3. Mescle no Blender (NLA Editor) e exporte **um** `.glb` com os
   `AnimationGroup`s nomeados (o jogo busca `idle` e `walk`/`run`).
4. Salve como `sirius.glb` nesta pasta.
