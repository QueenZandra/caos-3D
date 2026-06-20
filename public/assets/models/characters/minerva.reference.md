# 🐱 Minerva — referência de modelo 3D

> Arquivo final esperado nesta pasta: **`minerva.glb`** (riggado, com animações
> `idle` e `walk`/`run`). Enquanto não existir, o jogo usa o placeholder.

## Aparência real (das fotos de referência)

- Gata de **pelagem preta, curta e lustrosa** (brilho liso, não fofo).
- **Olhos verde-amarelados** marcantes e expressivos.
- **Orelhas grandes e pontudas**; focinho fino e elegante; nariz preto.
- Porte esguio e gracioso; postura altiva (o famoso "I know, I'm perfect").

## Identidade no jogo (GDD)

- Papel: **elegante, calculista, observa de cima com ar de superioridade**.
  Habilidade "Escalar" (sobe em superfícies altas e empurra objetos).
- Acessório: **pequeno lenço de aventureira** no pescoço.
- Cor de UI/identidade: **roxo `#9B5DE5`** (só na interface; o pelo é preto).
- Proporção **chibi** (cabeça grande ~1:2 cabeça/corpo), estilo Overcooked!.

## Prompt para Meshy.ai / Tripo3D (image-to-3D)

> Suba **uma foto nítida** da Minerva (a de corpo inteiro sentada, de perfil, é
> ótima) junto com este prompt:

```
3D cartoon cat character based on this photo reference, named Minerva.
Preserve from the photo: sleek SHORT BLACK fur (glossy, not fluffy),
striking yellow-green eyes, large pointed ears, slender elegant body,
thin refined muzzle, black nose, long white whiskers.
Style: low-poly stylized, thick painted outlines, flat cel/toon shading,
Overcooked! / animated-movie look. Elegant, clever, slightly superior expression.
Wearing a small adventurer's scarf around the neck.
Chibi proportion (big head ~1:2 head-to-body), cute and graceful.
Output: GLB/glTF, rigged, T-pose, 2000-4000 tris, UV-mapped.
```

## Animações (Mixamo, após gerar o modelo)

1. Suba o `.glb` em [mixamo.com](https://www.mixamo.com).
2. Baixe: **Idle**, **Walking**, **Running** e **Jump** (a Minerva escala/pula).
3. Mescle no Blender (NLA Editor) e exporte **um** `.glb` com os
   `AnimationGroup`s nomeados (o jogo busca `idle` e `walk`/`run`).
4. Salve como `minerva.glb` nesta pasta.
