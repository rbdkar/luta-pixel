/*
 * Tipos de tile e legenda do mapa.
 *
 * Terreno (surface/fill):
 *   surface: imagens usadas quando não há outro bloco do mesmo tipo em cima (topo com grama).
 *   fill:    imagens usadas no interior (terra).
 *   A variação de cada célula é escolhida pela posição, então o mapa é sempre o
 *   mesmo ao recarregar e a repetição dos tiles fica bem menos visível.
 *
 * Quebráveis (breakable):
 *   hp:     quantos golpes aguenta.
 *   images: imagem por estado, da inteira até a mais danificada.
 *   debris: cores das lascas que voam ao acertar e ao quebrar.
 */
window.Game = window.Game || {};

Game.tileTypes = {
  ground: {
    solid: true,
    surface: ['grassA', 'grassB'],
    fill: ['dirtA', 'dirtB'],
    mirrorFill: true, // espelha parte das células de terra para variar ainda mais
  },
  crate: {
    solid: true,
    breakable: true,
    hp: 2,
    images: ['crate', 'crateCracked'],
    debris: ['#d7995a', '#b8763d', '#94592f', '#6b3f22'],
  },
  // Caixa de fundo: só decoração (não bloqueia), escurecida para parecer mais longe
  crateBack: {
    solid: false,
    images: ['crate'],
    shade: 0.45,
  },
  // Telhado da Cidade: parapeito de concreto em cima, tijolos embaixo
  roof: {
    solid: true,
    surface: ['roofA', 'roofB'],
    fill: ['roofFillA', 'roofFillB'],
  },
  // Dojo: assoalho de madeira em cima, vigas embaixo
  wood: {
    solid: true,
    surface: ['woodA', 'woodB'],
    fill: ['woodFillA', 'woodFillB'],
  },
  // Bambuzal: caminho de pedra · Deserto: areia sobre arenito · Observatório: piso de metal
  stone: { solid: true, surface: ['stoneA', 'stoneB'], fill: ['stoneFillA', 'stoneFillB'] },
  sand: { solid: true, surface: ['sandA', 'sandB'], fill: ['sandFillA', 'sandFillB'] },
  deck: { solid: true, surface: ['deckA', 'deckB'], fill: ['deckFillA', 'deckFillB'] },
  acUnit: { solid: false, images: ['ac'], shade: 0.2 },
  cushion: { solid: false, images: ['cushion'] },
};

// Caractere no mapa da fase → tipo de tile. '.' (ou qualquer outro) = vazio.
Game.tileLegend = {
  '#': 'ground',
  'C': 'crate',
  'c': 'crateBack',
  'R': 'roof',
  'W': 'wood',
  'S': 'stone',
  'D': 'sand',
  'O': 'deck',
  'a': 'acUnit',
  'k': 'cushion',
};

// Caractere que marca onde o jogador começa (a célula em si fica vazia).
Game.spawnChar = 'P';

// Caracteres que criam personagens no mapa → nome da classe em Game (js/entities/).
// Eles nascem em pé no chão da própria célula.
Game.entityLegend = {
  'N': 'Npc',
};
