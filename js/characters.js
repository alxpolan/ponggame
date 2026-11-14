const Characters = (() => {
  const LIST = [
    { id: 'udo', name: 'Udo', front: 'assets/characters/c1-front.png', side: 'assets/characters/c1-left.png', facing: 'left' },
    { id: 'kate', name: 'Kate', front: 'assets/characters/c2-front.png', side: 'assets/characters/c2-right.png', facing: 'right' },
    { id: 'kacper', name: 'Kacper', front: 'assets/characters/c3-front.png', side: 'assets/characters/c3-left.png', facing: 'left' },
    { id: 'alex', name: 'Alex', front: 'assets/characters/c4-front.png', side: 'assets/characters/c4-left.png', facing: 'left' }
  ];

  const sideImages = {};

  function preloadAll() {
    LIST.forEach((c) => {
      const img = new Image();
      img.src = c.side;
      sideImages[c.id] = img;
    });
  }

  function getSideImage(id) {
    return sideImages[id];
  }

  function getFacing(id) {
    const c = LIST.find((item) => item.id === id);
    return c ? c.facing : 'right';
  }

  function list() { return LIST; }

  return { list, preloadAll, getSideImage, getFacing };
})();
