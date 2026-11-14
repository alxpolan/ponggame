// Manifest of selectable characters. Each has a front-facing photo (shown
// on the selection screen) and a side-profile photo (used as the in-game
// paddle sprite, since the court is viewed from the side).
const Characters = (() => {
  const LIST = [
    { id: 'udo', name: 'Udo', front: 'assets/characters/c3.png', side: 'assets/characters/c1.png' },
    { id: 'kate', name: 'Kate', front: 'assets/characters/c4.png', side: 'assets/characters/c2.png' }
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

  function list() { return LIST; }

  return { list, preloadAll, getSideImage };
})();
