/*
 * Arenas de luta: chão plano, com as bordas do mapa funcionando como parede
 * (o "canto" dos jogos de luta). Mesmo formato das fases de plataforma:
 *   #  grama/terra    R  telhado/tijolos    W  assoalho/vigas
 *   S  caminho de pedra    D  areia/arenito    O  piso de metal/concreto
 *   c  caixa de fundo    a  ar-condicionado    k  almofada    (decoração, não bloqueiam)
 * Os lutadores começam no meio; a câmera fica entre os dois.
 */
window.Game = window.Game || {};
Game.levels = Game.levels || {};

(function () {
  const sky = Array(8).fill('................................');
  const arena = (decor, floor) => sky.concat([decor[0], decor[1]], Array(4).fill(floor.repeat(32)));
  Game.levels.arena = {
    name: 'Campo Aberto',
    background: 'sky',
    fight: true,
    map: arena(['c..............................c', 'cc...........................ccc'], '#'),
  };
  Game.levels.roof = {
    name: 'Telhado da Cidade',
    background: null,
    fight: true,
    map: arena(['................................', '.a............................a.'], 'R'),
  };
  Game.levels.dojo = {
    name: 'Dojo',
    background: null,
    fight: true,
    map: arena(['................................', '..k..........................k..'], 'W'),
  };
  const empty = ['................................', '................................'];
  Game.levels.bamboo = { name: 'Bambuzal ao Luar', background: null, fight: true, map: arena(empty, 'S') };
  Game.levels.desert = { name: 'Ruínas do Deserto', background: null, fight: true, map: arena(empty, 'D') };
  Game.levels.observatory = { name: 'Observatório', background: null, fight: true, map: arena(empty, 'O') };
})();

/*
 * Clima de cada luta (o fundo é o mesmo, só muda a luz).
 *   sky:    cor multiplicada sobre o céu (null = como na imagem original)
 *   ground: cor multiplicada sobre o chão
 *   stars:  quantas estrelas aparecem no céu
 */
Game.stageLooks = {
  day: { name: 'Meio-dia', sky: null, ground: null, stars: 0 },
  sunset: { name: 'Entardecer', sky: '#ffb48a', ground: '#f0b69a', stars: 0 },
  night: { name: 'Noite', sky: '#3c4486', ground: '#59609a', stars: 38 },
};

/*
 * Mapas de luta. layers: imagens entre o fundo e o chão, com paralaxe
 * (factor 0 = parada na tela, 1 = anda junto com o chão). bottom: altura da base
 * da imagem acima do chão. color: cor do fundo atrás das camadas.
 */
Game.stages = {
  campo: { name: 'Campo Aberto', level: 'arena', look: 'day', theme: 'fight' },
  campoTarde: { name: 'Campo ao Entardecer', level: 'arena', look: 'sunset', theme: 'fight' },
  campoNoite: { name: 'Campo à Noite', level: 'arena', look: 'night', theme: 'boss' },
  cidade: {
    name: 'Telhado da Cidade', level: 'roof', color: '#070a1c', theme: 'city',
    layers: [{ image: 'cityFar', factor: 0.12, bottom: 0 }, { image: 'cityMid', factor: 0.45, bottom: 0 }],
  },
  dojo: {
    name: 'Dojo', level: 'dojo', color: '#1a0f08', theme: 'dojo',
    layers: [{ image: 'dojoFar', factor: 0.15, bottom: 0 }, { image: 'dojoMid', factor: 0.55, bottom: 0 }],
  },
  // novos: a casa de cada lutador novo (no arcade, a luta contra ele é aqui)
  bambuzal: {
    name: 'Bambuzal ao Luar', level: 'bamboo', color: '#050a14', theme: 'dojo',
    layers: [{ image: 'bambooFar', factor: 0.15, bottom: 0 }, { image: 'bambooMid', factor: 0.55, bottom: 0 }],
  },
  deserto: {
    name: 'Ruínas do Deserto', level: 'desert', color: '#24164a', theme: 'desert',
    layers: [{ image: 'desertFar', factor: 0.15, bottom: 0 }, { image: 'desertMid', factor: 0.55, bottom: 0 }],
  },
  observatorio: {
    name: 'Observatório', level: 'observatory', color: '#02030c', theme: 'space',
    layers: [{ image: 'observFar', factor: 0.12, bottom: 0 }, { image: 'observMid', factor: 0.5, bottom: 0 }],
  },
};

// Ordem na escolha de mapa do Versus
Game.stageOrder = ['campo', 'cidade', 'dojo', 'bambuzal', 'deserto', 'observatorio', 'campoTarde', 'campoNoite'];

/** Opções para criar a cena de luta de um mapa. */
Game.stageScene = function (key) {
  const st = Game.stages[key] || Game.stages.campo;
  return {
    level: Game.levels[st.level],
    opts: { mode: 'fight', look: st.look ? Game.stageLooks[st.look] : null, stage: st },
    stage: st,
  };
};
