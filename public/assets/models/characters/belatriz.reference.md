# 🐕 Belatriz — referência de modelo 3D

> Arquivo final esperado nesta pasta: **`belatriz.glb`** (riggado, com animações
> `idle` e `walk`/`run`). Enquanto não existir, o jogo usa o placeholder.

## Aparência real (das fotos de referência)

- Cãozinha **pequena**, tipo terrier-mix (vibe Yorkshire / Shih Tzu / Maltês).
- **Pelagem longa, ondulada e desgrenhada (scruffy)**, cor **dourada / loiro
  acaramelado**, com tons **castanhos mais escuros** ao redor dos olhos e focinho.
- Rosto com **fartas franjas e "barbicha"** (mustache/beard de terrier).
- **Nariz preto** pequeno; **olhos escuros** grandes e expressivos.
- **Corpo baixinho e comprido**, pernas curtas; muito ágil e fofa.

## Identidade no jogo (GDD)

- Papel: **energética, ágil, veloz** — sempre no lugar certo (ou errado!).
  Habilidade "Corrida Veloz" (2× velocidade + carrega 2 objetos).
- Cor de UI/identidade: **rosa `#FF4D8D`** (só na interface; o pelo é dourado).
- Proporção **chibi** (cabeça grande ~1:2 cabeça/corpo), estilo Overcooked!.

## Prompt para Meshy.ai / Tripo3D (image-to-3D)

> Suba **uma foto nítida** da Belatriz (a foto de perfil na calçada, de corpo
> inteiro, mostra bem o formato comprido e as franjas) junto com este prompt:

```
3D cartoon dog character based on this photo reference, named Belatriz.
Preserve from the photo: small scruffy terrier-mix, long wavy shaggy fur in
GOLDEN / blonde-caramel color with darker tan/brown around the eyes and muzzle,
bushy facial fur (beard and mustache), small black nose, big dark expressive eyes,
short legs and a long low body.
Style: low-poly stylized, thick painted outlines, flat cel/toon shading,
Overcooked! / animated-movie look. Energetic, athletic, playful pose with a
sense of speed (subtle motion in the fur).
Chibi proportion (big head ~1:2 head-to-body), cute and fast.
Output: GLB/glTF, rigged, T-pose, 2000-4000 tris, UV-mapped.
```

## Animações (Mixamo, após gerar o modelo)

1. Suba o `.glb` em [mixamo.com](https://www.mixamo.com).
2. Baixe: **Idle**, **Walking**, **Running** (a Belatriz usa muito o `run`).
3. Mescle no Blender (NLA Editor) e exporte **um** `.glb` com os
   `AnimationGroup`s nomeados (o jogo busca `idle` e `walk`/`run`).
4. Salve como `belatriz.glb` nesta pasta.
