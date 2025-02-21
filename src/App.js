import React, { useState, useEffect, useRef } from 'react';

const config = window.config;
const TOTAL_TIME = config.timeout; // celkový časový limit
const IMAGE_URL = config.imageUrl; // URL obrázku – nastavíte v config

const containerWidth = config.width;
const containerHeight = config.height;
const cellWidth = containerWidth / config.piecesRows; // 200
const cellHeight = containerHeight / config.piecesCols; // 200
const snapTolerance = 50; // tolerance v pixelech pro přichycování dílků

// Vygeneruje dílky s náhodnou pozicí
function generatePieces() {
  const pieces = [];
  let id = 0;
  const offsetX = (window.innerWidth - containerWidth) / 2;
  const offsetY = (window.innerHeight - containerHeight) / 2;
  const scatterMinX = -offsetX;
  const scatterMinY = -offsetY;
  const scatterMaxX = containerWidth + offsetX - cellWidth;
  const scatterMaxY = containerHeight + offsetY - cellHeight;

  for (let row = 0; row < config.piecesRows; row++) {
    for (let col = 0; col < config.piecesCols; col++) {
      const correctPos = { x: col * cellWidth, y: row * cellHeight };
      // Pro každý čtverec vytvoříme jen 2 dílky – záleží na pozici buňky, jaký typ použijeme.
      if ((row + col) % 2 === 0) {
        // Původní dělení: přepona zprava doleva zezhora dolů
        pieces.push({
          id: id++,
          cell: { row, col },
          type: 'A', // trojúhelník s přeponou zprava doleva
          correctPos: { ...correctPos },
          currentPos: {
            x: Math.random() * (scatterMaxX - scatterMinX) + scatterMinX,
            y: Math.random() * (scatterMaxY - scatterMinY) + scatterMinY,
          },
          snapped: false,
          dragOffset: null,
        });
        pieces.push({
          id: id++,
          cell: { row, col },
          type: 'B', // doplněk k typu A
          correctPos: { ...correctPos },
          currentPos: {
            x: Math.random() * (scatterMaxX - scatterMinX) + scatterMinX,
            y: Math.random() * (scatterMaxY - scatterMinY) + scatterMinY,
          },
          snapped: false,
          dragOffset: null,
        });
      } else {
        // Alternativní dělení: šikmá strana zleva doprava zezhora dolů
        pieces.push({
          id: id++,
          cell: { row, col },
          type: 'C', // jeden trojúhelník alternativního řezu (např. horní pravý)
          correctPos: { ...correctPos },
          currentPos: {
            x: Math.random() * (scatterMaxX - scatterMinX) + scatterMinX,
            y: Math.random() * (scatterMaxY - scatterMinY) + scatterMinY,
          },
          snapped: false,
          dragOffset: null,
        });
        pieces.push({
          id: id++,
          cell: { row, col },
          type: 'D', // doplněk k typu C – dolní levý
          correctPos: { ...correctPos },
          currentPos: {
            x: Math.random() * (scatterMaxX - scatterMinX) + scatterMinX,
            y: Math.random() * (scatterMaxY - scatterMinY) + scatterMinY,
          },
          snapped: false,
          dragOffset: null,
        });
      }
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

  useEffect(() => {
    if (gamePhase === 'showImage') {
      const timeout = setTimeout(() => {
        setPieces(generatePieces());
        setGamePhase('playing');
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [gamePhase]);

  // Start timer only once after the first move has been made.
  useEffect(() => {
    if (gamePhase === 'playing' && firstMove.current && !timerRef.current) {
      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            timerRef.current = null;
            setGamePhase('failed');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [gamePhase]);

  useEffect(() => {
    if (
      gamePhase === 'playing' &&
      pieces.length > 0 &&
      pieces.every((p) => p.snapped)
    ) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      setGamePhase('completed');
    }
  }, [pieces, gamePhase]);

  // Při spuštění tažení si uložíme offset kliknutí.
  const handleDragStart = (e, id) => {
    if (!firstMove.current) {
      firstMove.current = true;
      if (gamePhase === 'playing' && !timerRef.current) {
        timerRef.current = setInterval(() => {
          setTimer((prev) => {
            if (prev <= 1) {
              clearInterval(timerRef.current);
              timerRef.current = null;
              setGamePhase('failed');
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
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
    clearInterval(timerRef.current);
    timerRef.current = null;
    setPieces([]);
  };

  return (
    <div
      style={{
        textAlign: 'center',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
      }}
    >
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
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              width: containerWidth,
              height: containerHeight,
              margin: '0 auto',
              backgroundImage: `url(${IMAGE_URL})`,
              backgroundSize: 'cover',
              opacity: 0.1,
            }}
          />
          {pieces.map((piece) => {
            // Definice clip-path pro obě orientace:
            const clipPaths = {
              // Původní orientace: přepona zprava doleva zezhora dolů
              A: 'polygon(0 0, 100% 0, 0 100%)',
              B: 'polygon(100% 100%, 100% 0, 0 100%)',
              // Alternativní orientace: šikmá strana zleva doprava zezhora dolů
              C: 'polygon(0 0, 100% 0, 100% 100%)',
              D: 'polygon(0 0, 0 100%, 100% 100%)',
            };

            // Definice transformace – lze doladit podle potřeb:
            const transforms = {
              A: `translate(-${config.border}px, -${config.border}px)`,
              B: `translate(${config.border}px, ${config.border}px)`,
              C: `translate(${config.border}px, -${config.border}px)`,
              D: `translate(-${config.border}px, ${config.border}px)`,
            };

            return (
              <div
                className="piece"
                key={piece.id}
                style={{
                  position: 'absolute',
                  width: cellWidth,
                  height: cellHeight,
                  left: piece.currentPos.x,
                  top: piece.currentPos.y,
                  clipPath: clipPaths[piece.type],
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
                      (containerWidth - config.border * 10) / containerWidth
                    }) ${transforms[piece.type]}`,
                    clipPath: clipPaths[piece.type],
                  }}
                ></div>
              </div>
            );
          })}
          <div
            style={{
              position: 'fixed',
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
              // border: '2px solid green',
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
