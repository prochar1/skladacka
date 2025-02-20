import React, { useState, useEffect, useRef } from 'react';

const config = window.config;
const TOTAL_TIME = config.timeout; // celkový časový limit
const IMAGE_URL = config.imageUrl; // URL obrázku – nastavíte v config

const containerWidth = 1024;
const containerHeight = 807;
const cellWidth = containerWidth / 2; // 200
const cellHeight = containerHeight / 2; // 200
const snapTolerance = 20; // tolerance v pixelech pro přichycování dílků

// Vygeneruje 8 trojúhelníkových dílků rozdělených ze 4 buněk.
// Každá buňka se rozdělí na 2 trojúhelníky – typ A a typ B.
function generatePieces() {
  const pieces = [];
  let id = 0;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const correctPos = { x: col * cellWidth, y: row * cellHeight };
      // Trojúhelník A – horní/levá polovina (clip-path: zleva nahoře)
      pieces.push({
        id: id++,
        cell: { row, col },
        type: 'A', // polygon(0 0, 100% 0, 0 100%)
        correctPos: { ...correctPos },
        currentPos: {
          x: Math.random() * (containerWidth - cellWidth),
          y: Math.random() * (containerHeight - cellHeight),
        },
        snapped: false,
        dragOffset: null,
      });
      // Trojúhelník B – spodní/pravá polovina (doplněk)
      pieces.push({
        id: id++,
        cell: { row, col },
        type: 'B', // polygon(100% 100%, 100% 0, 0 100%)
        correctPos: { ...correctPos },
        currentPos: {
          x: Math.random() * (containerWidth - cellWidth),
          y: Math.random() * (containerHeight - cellHeight),
        },
        snapped: false,
        dragOffset: null,
      });
    }
  }
  return pieces;
}

function App() {
  const [gamePhase, setGamePhase] = useState('showImage'); // 'showImage', 'playing', 'completed', 'failed'
  const [pieces, setPieces] = useState([]);
  const [timer, setTimer] = useState(TOTAL_TIME);
  const timerRef = useRef(null);
  const firstMove = useRef(false);

  // Zobrazíme celý obrázek po dobu 5 sekund, poté spustíme hru se zamíchanými dílky.
  useEffect(() => {
    if (gamePhase === 'showImage') {
      const timeout = setTimeout(() => {
        setPieces(generatePieces());
        setGamePhase('playing');
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [gamePhase]);

  // Sledujeme, zda jsou všechny dílky správně přichyceny.
  useEffect(() => {
    if (
      gamePhase === 'playing' &&
      pieces.length > 0 &&
      pieces.every((piece) => piece.snapped)
    ) {
      setGamePhase('completed');
      clearInterval(timerRef.current);
    }
  }, [pieces, gamePhase]);

  // Spustíme odpočet časového limitu po prvním pohnutí dílkem.
  useEffect(() => {
    if (gamePhase === 'playing' && firstMove.current) {
      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setGamePhase('failed');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [gamePhase, timer]);

  // Při spuštění tažení si uložíme offset kliknutí.
  const handleDragStart = (e, id) => {
    // e.preventDefault();
    if (!firstMove.current) {
      firstMove.current = true;
      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setGamePhase('failed');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    setPieces((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              dragOffset: {
                x: clientX - p.currentPos.x,
                y: clientY - p.currentPos.y,
              },
            }
          : p
      )
    );
  };

  // Aktualizujeme pozici dílku při tažení.
  const handleDragMove = (e, id) => {
    // e.preventDefault();
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    setPieces((prev) =>
      prev.map((p) => {
        if (p.id === id && !p.snapped && p.dragOffset) {
          return {
            ...p,
            currentPos: {
              x: clientX - p.dragOffset.x,
              y: clientY - p.dragOffset.y,
            },
          };
        }
        return p;
      })
    );
  };

  // Na uvolnění dílku jej "přichytíme", pokud je v toleranci.
  const handleDragEnd = (e, id) => {
    e.preventDefault();
    setPieces((prev) =>
      prev.map((p) => {
        if (p.id === id && !p.snapped) {
          const dx = p.currentPos.x - p.correctPos.x;
          const dy = p.currentPos.y - p.correctPos.y;
          if (Math.sqrt(dx * dx + dy * dy) < snapTolerance) {
            return {
              ...p,
              currentPos: { ...p.correctPos },
              snapped: true,
              dragOffset: null,
            };
          }
        }
        return { ...p, dragOffset: null };
      })
    );
  };

  const restartGame = () => {
    setGamePhase('showImage');
    setTimer(TOTAL_TIME);
    firstMove.current = false;
    setPieces([]);
  };

  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      {gamePhase === 'showImage' && (
        <div
          style={{
            width: containerWidth,
            height: containerHeight,
            margin: '0 auto',
            backgroundImage: `url(${IMAGE_URL})`,
            backgroundSize: 'cover',
          }}
        />
      )}

      {gamePhase === 'playing' && (
        <div
          style={{
            position: 'relative',
            width: containerWidth,
            height: containerHeight,
            margin: '0 auto',
            // border: '1px solid black',
          }}
        >
          {pieces.map((piece) => (
            <div
              className="piece"
              key={piece.id}
              style={{
                position: 'absolute',
                width: cellWidth,
                height: cellHeight,
                left: piece.currentPos.x,
                top: piece.currentPos.y,
                // backgroundImage: `url(${IMAGE_URL})`,
                // backgroundSize: `${containerWidth}px ${containerHeight}px`,
                // backgroundPosition: `-${piece.correctPos.x}px -${piece.correctPos.y}px`,
                clipPath:
                  piece.type === 'A'
                    ? 'polygon(0 0, 100% 0, 0 100%)'
                    : 'polygon(100% 100%, 100% 0, 0 100%)',
                touchAction: 'none',
                cursor: 'grab',
                zIndex: piece.snapped ? 0 : piece.dragOffset ? 100 : 1,
              }}
              onMouseDown={(e) => handleDragStart(e, piece.id)}
              onTouchStart={(e) => handleDragStart(e, piece.id)}
              onMouseMove={(e) => handleDragMove(e, piece.id)}
              onTouchMove={(e) => handleDragMove(e, piece.id)}
              onMouseUp={(e) => handleDragEnd(e, piece.id)}
              onTouchEnd={(e) => handleDragEnd(e, piece.id)}
            >
              <div
                style={{
                  position: 'absolute',
                  width: cellWidth,
                  height: cellHeight,
                  left: 0,
                  top: 0,
                  background: 'black',
                  clipPath: 'inherit',
                  zIndex: -1,
                }}
              ></div>

              <div
                style={{
                  position: 'absolute',
                  width: cellWidth,
                  height: cellHeight,
                  left: 0,
                  top: 0,
                  backgroundImage: `url(${IMAGE_URL})`,
                  backgroundSize: `${containerWidth}px ${containerHeight}px`,
                  backgroundPosition: `-${piece.correctPos.x}px -${piece.correctPos.y}px`,
                  zIndex: 1,
                  transform: `scale(${
                    (containerWidth - 30) / containerWidth
                  }) ${
                    piece.type === 'A'
                      ? `translate(-3px, -3px)`
                      : `translate(3px, 3px)`
                  }`,
                  clipPath:
                    piece.type === 'A'
                      ? 'polygon(0 0, 100% 0, 0 100%)'
                      : 'polygon(100% 100%, 100% 0, 0 100%)',
                }}
              ></div>
            </div>
          ))}
          <div
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              background: '#fff',
              padding: '5px',
              border: '1px solid #000',
            }}
          >
            Čas: {timer}s
          </div>
        </div>
      )}

      {gamePhase === 'completed' && (
        <div>
          <div
            style={{
              width: containerWidth,
              height: containerHeight,
              margin: '0 auto',
              backgroundImage: `url(${IMAGE_URL})`,
              backgroundSize: 'cover',
              border: '2px solid green',
            }}
          />
          <p>Gratulujeme, úspěšně jste složil obrázek!</p>
          <button onClick={restartGame}>Opakovat hru</button>
        </div>
      )}

      {gamePhase === 'failed' && (
        <div>
          <p>Čas vypršel! Nepodařilo se vám složit obrázek.</p>
          <button onClick={restartGame}>Opakovat hru</button>
        </div>
      )}
    </div>
  );
}

export default App;
