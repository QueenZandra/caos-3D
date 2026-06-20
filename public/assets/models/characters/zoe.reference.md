# 🐱 Zoe — referência de modelo 3D

> Arquivo final esperado nesta pasta: **`zoe.glb`** (riggado, com animações
> `idle` e `walk`/`run`). Enquanto não existir, o jogo usa o placeholder.

## Aparência real (das fotos de referência)

- Gata **tartaruga (tortoiseshell)**: pelagem **curta mesclada de preto com
  manchas ferrugem / laranja / âmbar** espalhadas (padrão marmorizado).
- **Olhos amarelo-dourados** intensos; orelhas grandes e pontudas; nariz escuro.
- Porte ágil e esguio. **Importante:** NÃO é preta sólida (essa é a Minerva) —
  o diferencial da Zoe é o padrão escama-de-tartaruga.

## Identidade no jogo (GDD)

- Papel: **misteriosa, independente, aparece e some**. Habilidade "Furtividade"
  (semi-transparente + onda de susto ao reaparecer).
- Detalhe de estilo: leve **aura sombria** no pelo, olhos brilhantes.
- Cor de UI/identidade: **laranja `#FF6B35`** (combina com as manchas dela).
- Proporção **chibi** (cabeça grande ~1:2 cabeça/corpo), estilo Overcooked!.

## Prompt para Meshy.ai / Tripo3D (image-to-3D)

> Suba **uma foto nítida** da Zoe (a deitada ao sol, de corpo inteiro, mostra
> bem o padrão escama) junto com este prompt:

```
3D cartoon cat character based on this photo reference, named Zoe.
Preserve from the photo: TORTOISESHELL short fur — mottled/marbled mix of
black with rust, ginger and amber patches scattered over the body and face;
intense golden-yellow eyes, large pointed ears, dark nose, slender agile body.
IMPORTANT: not solid black — keep the tortoiseshell color pattern.
Style: low-poly stylized, thick painted outlines, flat cel/toon shading,
Overcooked! / animated-movie look. Mysterious, independent, with half-lidded
eyes and a subtle dark aura shimmer on the fur.
Chibi proportion (big head ~1:2 head-to-body), cute and sneaky.
Output: GLB/glTF, rigged, T-pose, 2000-4000 tris, UV-mapped.
```

## Animações (Mixamo, após gerar o modelo)

1. Suba o `.glb` em [mixamo.com](https://www.mixamo.com).
2. Baixe: **Idle**, **Walking**, **Running** (e opcional **Sneak Walk**).
3. Mescle no Blender (NLA Editor) e exporte **um** `.glb` com os
   `AnimationGroup`s nomeados (o jogo busca `idle` e `walk`/`run`).
4. Salve como `zoe.glb` nesta pasta.
