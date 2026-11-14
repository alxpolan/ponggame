const Characters = (() => {
  const LIST = [
    { id: 'udo', name: 'Udo', front: 'assets/characters/c1-front.png', left: 'assets/characters/c1-left.png', right: null },
    { id: 'kate', name: 'Kate', front: 'assets/characters/c2-front.png', left: 'assets/characters/c2-left.png', right: 'assets/characters/c2-right.png' },
    { id: 'kacper', name: 'Kacper', front: 'assets/characters/c3-front.png', left: 'assets/characters/c3-left.png', right: null },
    { id: 'alex', name: 'Alex', front: 'assets/characters/c4-front.png', left: 'assets/characters/c4-left.png', right: 'assets/characters/c4-right.png' }
  ];

  const images = {};

  function preloadAll() {
    LIST.forEach((c) => {
      images[c.id] = {
        left: c.left ? loadImage(c.left) : null,
        right: c.right ? loadImage(c.right) : null
      };
    });
  }

  function loadImage(src) {
    const img = new Image();
    img.src = src;
    return img;
  }

  function getSprite(id, side) {
    const entry = images[id];
    if (!entry) return null;
    const direct = entry[side];
    if (direct) return { img: direct, flip: false };
    const other = side === 'left' ? 'right' : 'left';
    const fallback = entry[other];
    return fallback ? { img: fallback, flip: true } : null;
  }

  function list() { return LIST; }

  return { list, preloadAll, getSprite };
})();
