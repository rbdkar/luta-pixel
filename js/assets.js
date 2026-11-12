/*
 * Lista de imagens do jogo e carregador.
 * Para usar uma imagem nova: coloque o PNG em assets/, registre aqui com uma
 * chave e use essa chave em sprites.js, tiles.js ou no campo "background" da fase.
 */
window.Game = window.Game || {};

Game.assets = {
  images: {
    // Personagem
    player: 'assets/sprites/player.png',
    npc: 'assets/sprites/npc.png',
    hood: 'assets/sprites/hood.png',
    brasa: 'assets/sprites/brasa.png',
    gelida: 'assets/sprites/gelida.png',
    trovao: 'assets/sprites/trovao.png',
    welder: 'assets/sprites/welder.png',
    corvo: 'assets/sprites/corvo.png',
    ampulheta: 'assets/sprites/ampulheta.png',
    orbita: 'assets/sprites/orbita.png',
    marionete: 'assets/sprites/marionete.png',
    pavio: 'assets/sprites/pavio.png',
    // Tiles 16×16
    grassA: 'assets/tiles/grass_a.png',
    grassB: 'assets/tiles/grass_b.png',
    dirtA: 'assets/tiles/dirt_a.png',
    dirtB: 'assets/tiles/dirt_b.png',
    crate: 'assets/tiles/crate.png',
    crateCracked: 'assets/tiles/crate_cracked.png',
    roofA: 'assets/tiles/roof_a.png',
    roofB: 'assets/tiles/roof_b.png',
    roofFillA: 'assets/tiles/roof_fill_a.png',
    roofFillB: 'assets/tiles/roof_fill_b.png',
    ac: 'assets/tiles/ac.png',
    woodA: 'assets/tiles/wood_a.png',
    woodB: 'assets/tiles/wood_b.png',
    woodFillA: 'assets/tiles/wood_fill_a.png',
    woodFillB: 'assets/tiles/wood_fill_b.png',
    cushion: 'assets/tiles/cushion.png',
    stoneA: 'assets/tiles/stone_a.png', stoneB: 'assets/tiles/stone_b.png',
    stoneFillA: 'assets/tiles/stone_fill_a.png', stoneFillB: 'assets/tiles/stone_fill_b.png',
    sandA: 'assets/tiles/sand_a.png', sandB: 'assets/tiles/sand_b.png',
    sandFillA: 'assets/tiles/sand_fill_a.png', sandFillB: 'assets/tiles/sand_fill_b.png',
    deckA: 'assets/tiles/deck_a.png', deckB: 'assets/tiles/deck_b.png',
    deckFillA: 'assets/tiles/deck_fill_a.png', deckFillB: 'assets/tiles/deck_fill_b.png',
    // Fundos
    sky: 'assets/backgrounds/sky.png',
    cityFar: 'assets/backgrounds/city_far.png',
    cityMid: 'assets/backgrounds/city_mid.png',
    dojoFar: 'assets/backgrounds/dojo_far.png',
    dojoMid: 'assets/backgrounds/dojo_mid.png',
    bambooFar: 'assets/backgrounds/bamboo_far.png',
    bambooMid: 'assets/backgrounds/bamboo_mid.png',
    desertFar: 'assets/backgrounds/desert_far.png',
    desertMid: 'assets/backgrounds/desert_mid.png',
    observFar: 'assets/backgrounds/observ_far.png',
    observMid: 'assets/backgrounds/observ_mid.png',
    // Cenários das Expansões de Domínio (fundo, meio e chão de cada um)
    domHoodFar: 'assets/domains/hood_far.png', domHoodMid: 'assets/domains/hood_mid.png', domHoodFloor: 'assets/domains/hood_floor.png',
    domKidFar: 'assets/domains/kid_far.png', domKidMid: 'assets/domains/kid_mid.png', domKidFloor: 'assets/domains/kid_floor.png',
    domGlassesFar: 'assets/domains/glasses_far.png', domGlassesMid: 'assets/domains/glasses_mid.png', domGlassesFloor: 'assets/domains/glasses_floor.png',
    domBrasaFar: 'assets/domains/brasa_far.png', domBrasaMid: 'assets/domains/brasa_mid.png', domBrasaFloor: 'assets/domains/brasa_floor.png',
    domGelidaFar: 'assets/domains/gelida_far.png', domGelidaMid: 'assets/domains/gelida_mid.png', domGelidaFloor: 'assets/domains/gelida_floor.png',
    domTrovaoFar: 'assets/domains/trovao_far.png', domTrovaoMid: 'assets/domains/trovao_mid.png', domTrovaoFloor: 'assets/domains/trovao_floor.png',
    domWelderFar: 'assets/domains/welder_far.png', domWelderMid: 'assets/domains/welder_mid.png', domWelderFloor: 'assets/domains/welder_floor.png',
    domCorvoFar: 'assets/domains/corvo_far.png', domCorvoMid: 'assets/domains/corvo_mid.png', domCorvoFloor: 'assets/domains/corvo_floor.png',
    domAmpulhetaFar: 'assets/domains/ampulheta_far.png', domAmpulhetaMid: 'assets/domains/ampulheta_mid.png', domAmpulhetaFloor: 'assets/domains/ampulheta_floor.png',
    domOrbitaFar: 'assets/domains/orbita_far.png', domOrbitaMid: 'assets/domains/orbita_mid.png', domOrbitaFloor: 'assets/domains/orbita_floor.png',
    domMarioneteFar: 'assets/domains/marionete_far.png', domMarioneteMid: 'assets/domains/marionete_mid.png', domMarioneteFloor: 'assets/domains/marionete_floor.png',
    domPavioFar: 'assets/domains/pavio_far.png', domPavioMid: 'assets/domains/pavio_mid.png', domPavioFloor: 'assets/domains/pavio_floor.png',
  },

  _cache: {},

  load() {
    const jobs = Object.entries(this.images).map(([key, src]) => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this._cache[key] = img;
        resolve();
      };
      img.onerror = () => reject(new Error('Não foi possível carregar a imagem "' + src + '". Confira se a pasta assets está ao lado do index.html.'));
      img.src = src;
    }));
    return Promise.all(jobs);
  },

  get(key) {
    const img = this._cache[key];
    if (!img) throw new Error('Imagem "' + key + '" não foi registrada em Game.assets.images.');
    return img;
  },
};
